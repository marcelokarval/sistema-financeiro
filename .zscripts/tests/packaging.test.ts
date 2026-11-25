import { expect, test } from "bun:test";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const scripts = join(import.meta.dir, "..");
const marker = "synthetic-private-marker";

function fixture(run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "packaging-test-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function put(root: string, path: string, content: string, executable = false) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (executable) chmodSync(file, 0o755);
}

function runShell(shell: string, path: string, root: string, env: Record<string, string>) {
  const result = Bun.spawnSync([shell, path], {
    cwd: root,
    env: { PATH: `${root}/bin:/usr/bin:/bin`, HOME: root, LC_ALL: "C", ...env },
  });
  return { status: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
}

const buildStub = [
  "#!/bin/sh",
  "set -eu",
  'root=$(dirname -- "$(dirname -- "$0")")',
  'printf "%s|%s|%s\n" "$*" "${DATABASE_URL-}" "${PRIVATE_TOKEN-}" >> "$root/commands.log"',
  'case "$*" in',
  "  install*) exit 0;;",
  '  "run build")',
  "    mkdir -p .next/standalone/.next/static .next/standalone/public .next/static",
  "    printf static > .next/static/asset",
  "    cp .next/static/asset .next/standalone/.next/static/asset",
  "    cp public/icon .next/standalone/public/icon",
  "    printf server > .next/standalone/server.js",
  "    ln -s server.js .next/standalone/alias.js",
  "    case $(cat scenario) in",
  "      missing) rm .next/standalone/server.js;;",
  "      failed) exit 42;;",
  "      dotenv) printf synthetic > .next/standalone/.env.production;;",
  "      sqlite) printf synthetic > .next/standalone/storage.sqlite3-wal;;",
  "      benign-xdb) printf benign > .next/standalone/dashboard-xdb;;",
  "      db-dir) mkdir .next/standalone/db;;",
  '      newline) printf synthetic > ".next/standalone/multi\nline.db";;',
  "      escape) ln -s ../../public/icon .next/standalone/outside;;",
  "      hardlink) ln public/icon .next/standalone/hardlink;;",
  "    esac;;",
  '  "run db:push") exit 0;;',
  "  build*)",
  '    pwd -P >> "$root/bundle-cwd.log"',
  '    [ ! -e "$root/mini-failure" ] || exit 43',
  '    printf bundle > "$4";;',
  "  *) exit 99;;",
  "esac",
].join("\n");

function build(scenario: string, check: (result: ReturnType<typeof runShell>, commands: string, paths: string[], old: string, root: string) => void) {
  fixture((fixtureRoot) => {
    const root = join(fixtureRoot, "project");
    mkdirSync(root);
    const id = fixtureRoot.split("/").at(-1)!;
    const prefix = `build_fullstack_${id}`;
    const old = join("/tmp", prefix);
    const outputs = () => readdirSync("/tmp").filter((name) => name.startsWith(prefix)).map((name) => join("/tmp", name));
    mkdirSync(old);
    put(old, "other-invocation", marker);
    put(root, "scenario", scenario);
    put(root, "Caddyfile", "synthetic config");
    put(root, "public/icon", "icon");
    put(root, ".env.example", "DATABASE_URL=");
    put(root, "bin/bun", buildStub, true);
    put(root, ".zscripts/start.sh", "#!/bin/sh\n");
    copyFileSync(join(scripts, "build.sh"), join(root, ".zscripts/build.sh"));
    put(root, "package.json", "{}");
    put(root, "bun.lock", "{}");
    if (scenario === "private") put(root, ".env.production.local", `TOKEN=${marker}`);
    if (scenario === "dotenv") put(root, "db/custom.db", marker);
    if (scenario !== "missing-service-root") {
      mkdirSync(join(root, "mini-services"));
      const service = "mini-services/finance-ws";
      if (scenario !== "missing-finance-ws") {
        mkdirSync(join(root, service));
        if (scenario !== "missing-manifest") put(root, `${service}/package.json`, "{}");
        if (scenario !== "missing-lockfile") put(root, `${service}/bun.lock`, "{}");
        if (scenario !== "missing-entry") put(root, `${service}/index.ts`, "export {};");
      }
    }
    if (scenario !== "missing-mini-launcher") put(root, ".zscripts/mini-services-start.sh", "#!/bin/sh\n");
    if (scenario === "mini") {
      put(root, "mini-services/demo/package.json", "{}");
      put(root, "mini-services/demo/bun.lock", "{}");
      put(root, "mini-services/demo/index.ts", "export {};");
    }
    if (scenario === "mini-failed") put(root, "mini-failure", "synthetic failure");
    const symbolicPaths: Record<string, string> = {
      "symbolic-services": "mini-services",
      "symbolic-finance": "mini-services/finance-ws",
      "symbolic-manifest": "mini-services/finance-ws/package.json",
      "symbolic-lockfile": "mini-services/finance-ws/bun.lock",
      "symbolic-entry": "mini-services/finance-ws/index.ts",
      "symbolic-main-manifest": "package.json",
      "symbolic-main-public": "public",
    };
    const symbolicPath = symbolicPaths[scenario];
    if (symbolicPath) {
      const original = join(root, symbolicPath);
      const target = join(fixtureRoot, "ordinary-fixture-input");
      renameSync(original, target);
      symlinkSync(target, original);
    }
    const env: Record<string, string> = { BUILD_ID: id };
    if (scenario === "cdpath") {
      env.CDPATH = join(root, "ordinary-directory");
      mkdirSync(join(env.CDPATH, "mini-services", "finance-ws"), { recursive: true });
    } else {
      env.DATABASE_URL = `file:/${marker}.db`;
      env.PRIVATE_TOKEN = marker;
    }
    try {
      const result = runShell("bash", join(root, ".zscripts/build.sh"), root, env);
      const commands = existsSync(join(root, "commands.log")) ? readFileSync(join(root, "commands.log"), "utf8") : "";
      check(result, commands, outputs(), old, root);
    } finally {
      for (const path of outputs()) rmSync(path, { recursive: true, force: true });
    }
  });
}

function assertArchive(result: ReturnType<typeof runShell>, paths: string[], old: string) {
  expect(result.status, result.output).toBe(0);
  expect(readFileSync(join(old, "other-invocation"), "utf8")).toBe(marker);
  const archive = paths.find((path) => path.endsWith(".tar.gz"))!;
  expect(paths.sort()).toEqual([old, archive]);
  expect(result.output).toContain(archive);
  expect(lstatSync(archive).mode & 0o077).toBe(0);
  const listing = Bun.spawnSync(["tar", "-tzf", archive]);
  expect(listing.exitCode).toBe(0);
  const names = listing.stdout.toString().trim().split("\n");
  expect(names).toContain("./start.sh");
  expect(names).toContain("./Caddyfile");
  expect(names).toContain("./next-service-dist/server.js");
  expect(names).toContain("./next-service-dist/.next/static/asset");
  expect(names).toContain("./next-service-dist/public/icon");
  expect(names).toContain("./mini-services-dist/mini-service-finance-ws.js");
  expect(names).toContain("./mini-services-start.sh");
  expect(names.join("\n")).not.toMatch(/other-invocation|\/db\/|\.env|\.db|\.sqlite/);
  fixture((extracted) => {
    expect(Bun.spawnSync(["tar", "-xzf", archive, "-C", extracted]).exitCode).toBe(0);
    expect(readFileSync(join(extracted, "next-service-dist/alias.js"), "utf8")).toBe("server");
  });
  return names;
}

function assertRejected(result: ReturnType<typeof runShell>, paths: string[], old: string) {
  expect(result.status, result.output).not.toBe(0);
  expect(result.output).not.toContain(marker);
  expect(paths).toEqual([old]);
  expect(readFileSync(join(old, "other-invocation"), "utf8")).toBe(marker);
}

test("build aceita contexto sem SQLite, isola o ambiente e entrega pacote novo", () => {
  build("valid", (result, commands, paths, old) => {
    assertArchive(result, paths, old);
    expect(commands.trim().split("\n")).toEqual(["install --frozen-lockfile||", "run build||",
      "install --frozen-lockfile||", expect.stringMatching(/^build index\.ts --outfile .*mini-service-finance-ws\.js --target bun --minify\|\|$/)]);
  });
});

test("build recusa dotenv privado antes de qualquer produtor", () => {
  build("private", (result, commands, paths, old) => {
    expect(commands).toBe("");
    assertRejected(result, paths, old);
  });
});

for (const scenario of ["dotenv", "sqlite", "db-dir", "newline", "escape", "hardlink", "missing", "failed", "mini-failed"]) {
  test(`pacote não é entregue para saída ou produtor inválido: ${scenario}`, () => {
    build(scenario, (result, commands, paths, old) => {
      assertRejected(result, paths, old);
      expect(commands).not.toContain("db:push");
    });
  });
}

test("pacote inclui o bundle e a inicialização dos mini-serviços", () => {
  build("mini", (result, commands, paths, old) => {
    const names = assertArchive(result, paths, old);
    expect(names).toContain("./mini-services-dist/mini-service-demo.js");
    expect(names).toContain("./mini-services-start.sh");
    expect(commands).not.toContain("db:push");
  });
});

for (const scenario of ["symbolic-services", "symbolic-finance", "symbolic-manifest", "symbolic-lockfile",
  "symbolic-entry", "symbolic-main-manifest", "symbolic-main-public"]) {
  test(`D1: build recusa caminho simbólico antes dos produtores: ${scenario}`, () => {
    build(scenario, (result, commands, paths, old) => {
      expect(commands).toBe("");
      assertRejected(result, paths, old);
    });
  });
}

test("D1: CDPATH não muda o diretório do produtor", () => {
  build("cdpath", (result, _commands, _paths, _old, root) => {
    expect(result.status, result.output).toBe(0);
    expect(readFileSync(join(root, "bundle-cwd.log"), "utf8").trim()).toBe(join(root, "mini-services", "finance-ws"));
  });
});

for (const scenario of ["missing-service-root", "missing-finance-ws", "missing-manifest", "missing-lockfile",
  "missing-entry", "missing-mini-launcher"]) {
  test(`D2 obrigatório: falha antes de Bun se o insumo falta: ${scenario}`, () => {
    build(scenario, (result, commands, paths, old) => {
      expect(commands).toBe("");
      assertRejected(result, paths, old);
    });
  });
}

test("D2 extensão: pacote aceita dashboard-xdb sem ponto literal", () => {
  build("benign-xdb", (result, _commands, paths, old) => {
    expect(assertArchive(result, paths, old)).toContain("./next-service-dist/dashboard-xdb");
  });
});

function launcher(kind: string) {
  fixture((root) => {
    const pkg = join(root, "package");
    const external = join(root, "outside", `${marker}.db`);
    put(root, `outside/${marker}.db`, "synthetic nonempty fixture");
    put(root, "outside/empty.db", "");
    put(pkg, "db/internal.db", "synthetic packaged fixture");
    put(pkg, "next-service-dist/server.js", "synthetic");
    put(pkg, "Caddyfile", "synthetic");
    copyFileSync(join(scripts, "start.sh"), join(pkg, "start.sh"));
    put(root, "bin/bun", [
      "#!/bin/sh",
      'printf "%s|%s\n" "$*" "${DATABASE_URL-}" >> "$HOME/launcher.log"',
      "exec /bin/sleep 2",
    ].join("\n"), true);
    put(pkg, "mini-services-start.sh", 'printf "mini\n" >> "$HOME/launcher.log"');
    put(root, "bin/caddy", '#!/bin/sh\nprintf "caddy\n" >> "$HOME/launcher.log"\n', true);
    symlinkSync(join(pkg, "db/internal.db"), join(root, "outside/link.db"));
    symlinkSync(external, join(root, "outside/external-link.db"));
    const urls: Record<string, string | undefined> = {
      absent: undefined, empty: "", malformed: `file:${marker}.db`,
      nonSQLite: `postgresql://example.invalid/${marker}`,
      query: `file:${external}?mode=ro`, fragment: `file:${external}#fragment`,
      escape: `file:${external}%20`, backslash: `file:${external}\\suffix`,
      control: `file:${external}\n`, authority: `file://example.invalid/${marker}`,
      missing: `file:${external}.missing`, directory: `file:${dirname(external)}`,
      zero: `file:${dirname(external)}/empty.db`,
      internal: `file:${pkg}/db/internal.db`, internalLink: `file:${root}/outside/link.db`,
      valid: `file:${external}`, validLink: `file:${root}/outside/external-link.db`,
    };
    const url = urls[kind];
    const result = runShell("sh", join(pkg, "start.sh"), root, url === undefined ? {} : { DATABASE_URL: url });
    const log = join(root, "launcher.log");
    const valid = kind === "valid" || kind === "validLink";
    if (valid) {
      expect(result.status, result.output).toBe(0);
      expect(readFileSync(log, "utf8").trim().split("\n").sort()).toEqual(["caddy", "mini", `server.js|file:${external}`]);
    } else {
      expect(existsSync(log)).toBe(false);
      expect(result.status, result.output).not.toBe(0);
      expect(result.output).toContain("DATABASE_URL");
    }
    expect(result.output).not.toContain(external);
    expect(result.output).not.toContain(marker);
    expect(existsSync(`${external}.missing`)).toBe(false);
    expect(readFileSync(external, "utf8")).toBe("synthetic nonempty fixture");
    expect(readFileSync(join(pkg, "db/internal.db"), "utf8")).toBe("synthetic packaged fixture");
    expect(readdirSync(dirname(external)).sort()).toEqual(["empty.db", "external-link.db", "link.db", `${marker}.db`]);
  });
}

for (const kind of ["absent", "empty", "malformed", "nonSQLite", "query", "fragment", "escape", "backslash",
  "control", "authority", "missing", "directory", "zero", "internal", "internalLink", "valid", "validLink"]) {
  test(`launcher valida a fronteira do SQLite antes dos serviços: ${kind}`, () => launcher(kind));
}

test("Caddyfile restringe XTransformPort exclusivamente para 3004 sem wildcard ou placeholder dinâmico", () => {
  const caddyfile = readFileSync(join(scripts, "..", "Caddyfile"), "utf8");
  expect(caddyfile).toContain("query XTransformPort=3004");
  expect(caddyfile).toContain("reverse_proxy localhost:3004");
  expect(caddyfile).not.toContain("XTransformPort=*");
  expect(caddyfile).not.toContain("{query.XTransformPort}");
});

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sysBinWithoutCaddy(root: string) {
  const sysbin = join(root, "sysbin");
  mkdirSync(sysbin, { recursive: true });
  for (const cmd of ["sh", "realpath", "ps", "sleep", "dirname", "basename", "sed", "cat"]) {
    const resolved = Bun.which(cmd);
    if (resolved) symlinkSync(resolved, join(sysbin, cmd));
  }
  return sysbin;
}

test("launcher falha antes dos serviços quando caddy não está no PATH", () => {
  fixture((root) => {
    const pkg = join(root, "package");
    const external = join(root, "outside", `${marker}.db`);
    put(root, `outside/${marker}.db`, "synthetic nonempty fixture");
    put(pkg, "next-service-dist/server.js", "synthetic");
    put(pkg, "Caddyfile", "synthetic");
    copyFileSync(join(scripts, "start.sh"), join(pkg, "start.sh"));
    put(root, "bin/bun", '#!/bin/sh\nprintf "bun\n" >> "$HOME/launcher.log"\nexec /bin/sleep 2\n', true);
    put(pkg, "mini-services-start.sh", 'printf "mini\n" >> "$HOME/launcher.log"\n');
    const sysbin = sysBinWithoutCaddy(root);
    const result = runShell("sh", join(pkg, "start.sh"), root, {
      DATABASE_URL: `file:${external}`,
      PATH: `${root}/bin:${sysbin}`,
    });
    expect(result.status, result.output).not.toBe(0);
    expect(result.output.toLowerCase()).toContain("caddy");
    expect(existsSync(join(root, "launcher.log"))).toBe(false);
  });
});

test("launcher preserva código de saída do caddy e encerra NEXT_PID e MINI_PID", () => {
  fixture((root) => {
    const pkg = join(root, "package");
    const external = join(root, "outside", `${marker}.db`);
    put(root, `outside/${marker}.db`, "synthetic nonempty fixture");
    put(pkg, "next-service-dist/server.js", "synthetic");
    put(pkg, "Caddyfile", "synthetic");
    copyFileSync(join(scripts, "start.sh"), join(pkg, "start.sh"));
    put(root, "bin/bun", '#!/bin/sh\nprintf "%s\\n" "$$" > "$HOME/next.pid"\nexec /bin/sleep 10 >/dev/null 2>&1\n', true);
    put(pkg, "mini-services-start.sh", 'printf "%s\\n" "$$" > "$HOME/mini.pid"\nexec /bin/sleep 10 >/dev/null 2>&1\n');
    put(root, "bin/caddy", "#!/bin/sh\nexit 17\n", true);
    let nextPid = 0;
    let miniPid = 0;
    try {
      const result = runShell("sh", join(pkg, "start.sh"), root, {
        DATABASE_URL: `file:${external}`,
      });
      nextPid = Number(readFileSync(join(root, "next.pid"), "utf8").trim());
      miniPid = Number(readFileSync(join(root, "mini.pid"), "utf8").trim());
      expect(result.status, result.output).toBe(17);
      expect(isPidAlive(nextPid)).toBe(false);
      expect(isPidAlive(miniPid)).toBe(false);
    } finally {
      for (const pid of [nextPid, miniPid]) {
        if (pid > 0) {
          try { process.kill(pid, "SIGKILL"); } catch {}
        }
      }
    }
  });
});

test("mini-services-start.sh propaga SIGTERM aos filhos bun e preserva saída não zero", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaging-test-"));
  let childPid = 0;
  let proc: ReturnType<typeof Bun.spawn> | undefined;
  try {
    copyFileSync(join(scripts, "mini-services-start.sh"), join(root, "mini-services-start.sh"));
    put(root, "mini-services-dist/mini-service-demo.js", "export {};\n");
    put(root, "bin/bun", '#!/bin/sh\nprintf "%s\\n" "$$" > "$HOME/service.pid"\nexec /bin/sleep 10 >/dev/null 2>&1\n', true);
    proc = Bun.spawn(["sh", join(root, "mini-services-start.sh")], {
      cwd: root,
      env: { PATH: `${root}/bin:/usr/bin:/bin`, HOME: root, LC_ALL: "C" },
      stdout: "ignore",
      stderr: "ignore",
    });
    const pidFile = join(root, "service.pid");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (existsSync(pidFile)) {
        const raw = readFileSync(pidFile, "utf8").trim();
        if (/^\d+$/.test(raw)) {
          childPid = Number(raw);
          break;
        }
      }
      await Bun.sleep(50);
    }
    expect(childPid).toBeGreaterThan(0);
    await Bun.sleep(700);
    proc.kill("SIGTERM");
    const exitCode = await proc.exited;
    expect(exitCode).not.toBe(0);
    expect(isPidAlive(childPid)).toBe(false);
  } finally {
    try { proc?.kill("SIGKILL"); } catch {}
    if (childPid > 0) {
      try { process.kill(childPid, "SIGKILL"); } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});

const repoRoot = join(scripts, "..");

test("higiene de ambiente: .env.example usa file:../db/custom.db sem GITHUB_TOKEN e .env.local está ausente", () => {
  const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8").trim();
  expect(envExample).toBe('DATABASE_URL="file:../db/custom.db"');
  expect(envExample).not.toContain("GITHUB_TOKEN");
  expect(envExample).not.toContain("/home/z/my-project/");
  expect(existsSync(join(repoRoot, ".env.local"))).toBe(false);
});

test("higiene de ignore: .gitignore cobre .env.*, !.env.example e .playwright-cli/", () => {
  const lines = readFileSync(join(repoRoot, ".gitignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());
  expect(lines).toContain(".env.*");
  expect(lines).toContain("!.env.example");
  expect(lines).toContain(".playwright-cli/");
});

test("higiene de toolchain: tsconfig.json e eslint.config.mjs não referenciam examples nem skills", () => {
  const tsconfig = JSON.parse(readFileSync(join(repoRoot, "tsconfig.json"), "utf8")) as {
    exclude?: string[];
  };
  expect(tsconfig.exclude).not.toContain("examples");
  expect(tsconfig.exclude).not.toContain("skills");

  const eslintSource = readFileSync(join(repoRoot, "eslint.config.mjs"), "utf8");
  const ignoresMatch = eslintSource.match(/ignores:\s*\[([\s\S]*?)\]/);
  expect(ignoresMatch).not.toBeNull();
  const ignoresItems = Array.from(ignoresMatch![1].matchAll(/["']([^"']+)["']/g), (match) => match[1]);
  expect(ignoresItems).not.toContain("examples");
  expect(ignoresItems).not.toContain("examples/**");
  expect(ignoresItems).not.toContain("skills");
});

test("documentação pública: README.md raiz orienta setup e links canônicos para marcelokarval/sistema-financeiro", () => {
  const readmePath = join(repoRoot, "README.md");
  expect(existsSync(readmePath)).toBe(true);
  const readme = readFileSync(readmePath, "utf8");
  expect(readme).toContain("marcelokarval/sistema-financeiro");
  expect(readme).not.toContain("marcelo-karval");
  expect(readme).toContain("bun --no-env-file run db:generate");
  expect(readme).toContain("docs/operacao-empacotamento.md");
  expect(readme).toContain("docs/reference/design-system.contract.md");
  expect(readme).toContain("AGENTS.md");
  expect(readme).toContain("openspec/specs/");
});

test("guia de agentes: AGENTS.md enxuto remove referências legadas e documenta ruleset ativo", () => {
  const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
  expect(agents).not.toContain("Framer Motion");
  expect(agents).not.toContain("agent-ctx/");
  expect(agents).not.toContain("worklog.md");
  expect(agents).not.toContain("Sobre o Projeto");
  expect(agents).toContain("main-ci-protection");
  expect(agents).toContain("28102433");
  expect(agents).toContain("bun --no-env-file run db:generate");
});

test("contrato visual: docs/reference/design-system.contract.md não aponta para artefatos históricos removidos", () => {
  const contract = readFileSync(join(repoRoot, "docs/reference/design-system.contract.md"), "utf8");
  expect(contract).not.toContain("design-system.premium-direction.md");
  expect(contract).not.toContain("design-system.theme.css");
  expect(contract).not.toContain("design-system.html");
});
