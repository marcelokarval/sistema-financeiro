// Run explicitly with Bun --no-env-file. Requires the installed Playwright CLI and Chrome.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = await mkdtemp(join(tmpdir(), "quiet-accounts-cards-"));
const session = `quiet-accounts-cards-${process.pid}`;
const sourceDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = fileURLToPath(new URL("../../../", import.meta.url));

async function cli(...args) {
  const proc = Bun.spawn(["playwright-cli", `-s=${session}`, ...args], {
    cwd: dir, stdout: "pipe", stderr: "pipe", stdin: "ignore", timeout: 120000,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  if (exit !== 0 || stdout.includes("### Error")) throw new Error(`${stdout}
${stderr}`);
  return stdout;
}

async function runCases(page, html) {
  // All navigations are fulfilled locally; anything else is blocked.
  await page.route("**/*", (route) => route.request().url() === "https://finance-qa.invalid/"
    ? route.fulfill({ path: html, contentType: "text/html" }) : route.abort());
  await page.goto("https://finance-qa.invalid/");
  page.setDefaultTimeout(1500);
  const failures = [];
  const button = (name) => page.getByRole("button", { name, exact: true });
  const field = (id) => page.locator(`#${id}`);
  const dialog = (role = "dialog") => page.getByRole(role);
  const ensure = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = (text) => page.getByText(text, { exact: true }).waitFor({ state: "visible" });
  const state = () => page.evaluate(() => window.qa.mutations);
  const checkBody = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) {
      ensure(actual[key] === value, `payload: ${key} deveria ser ${value}, veio ${actual[key]}`);
    }
    ensure(Object.keys(actual).length === Object.keys(expected).length, "payload tem campos inesperados");
  };
  async function scenario(name, view, run) {
    await page.reload();
    await page.evaluate((kind) => window.qa.mount(kind), view);
    try { await run(); } catch (e) { failures.push(`${name}: ${e.message}`); }
  }
  async function rejectAndRetry({ method, url, action, body, error, success, draft, role }) {
    const before = await page.evaluate(() => window.qa.gets.length);
    await dialog(role).getByRole("button", { name: action, exact: true }).click();
    let calls = await state();
    ensure(calls.length === 1 && calls[0].url === url && calls[0].method === method, "mutação incorreta");
    checkBody(calls[0].body, body);
    const feedback = page.locator("[data-sonner-toast]").first();
    await feedback.waitFor();
    const actual = { feedback: await feedback.innerText(), open: await dialog(role).isVisible() };
    ensure(actual.feedback === error && actual.open, `HTTP 503: ${JSON.stringify(actual)}`);
    ensure(await feedback.getAttribute("data-type") === "error", "feedback não é de erro");
    if (draft) ensure(await field(draft[0]).inputValue() === draft[1], "rascunho perdido");
    ensure(await page.evaluate(() => window.qa.gets.length) === before, "HTTP 503 disparou recarga");
    await page.evaluate(() => { window.qa.ok = true; });
    await dialog(role).getByRole("button", { name: action, exact: true }).click();
    await wait(success);
    await dialog(role).waitFor({ state: "hidden" });
    calls = await state();
    ensure(calls.length === 2 && calls[1].url === url && calls[1].method === method, "retry incorreto");
    checkBody(calls[1].body, body);
  }

  await scenario("POST lançamento 503", "accounts", async () => {
    await button("Abrir conta Conta A").click();
    await button("Nova transação").click();
    await field("tx-description").fill("Lançamento QA");
    await field("tx-amount").fill("7.25");
    await field("tx-date").fill("2026-01-15");
    await rejectAndRetry({ method: "POST", url: "/api/transactions", action: "Registrar",
      body: { type: "EXPENSE", description: "Lançamento QA", amount: 7.25, date: "2026-01-15",
        categoryId: "", notes: "", accountId: "a" }, error: "Erro ao registrar transação",
      success: "Transação registrada!", draft: ["tx-description", "Lançamento QA"] });
  });

  for (const method of ["POST", "PUT"]) {
    const edit = method === "PUT";
    await scenario(`${method} cartão 503`, "cards", async () => {
      await button(edit ? "Editar cartão Cartão A" : "Novo cartão").click();
      await field("card-name").fill("Cartão QA");
      await field("card-digits").fill("1234");
      await field("card-limit").fill("1500.25");
      await rejectAndRetry({ method, url: "/api/cards", action: edit ? "Atualizar" : "Adicionar",
        body: { ...(edit ? { id: "a" } : {}), name: "Cartão QA", type: "CREDIT", brand: "VISA",
          lastFourDigits: "1234", creditLimit: 1500.25, closingDay: 1, dueDay: 10, color: "#8b5cf6", flag: "" },
        error: "Erro ao salvar cartão", success: edit ? "Cartão atualizado!" : "Cartão adicionado!",
        draft: ["card-name", "Cartão QA"] });
    });
    await scenario(`${method} conta 503`, "accounts", async () => {
      await button(edit ? "Editar conta Conta A" : "Nova conta").click();
      await field("account-name").fill("Conta QA");
      await field("account-balance").fill("10.35");
      await rejectAndRetry({ method, url: "/api/accounts", action: edit ? "Atualizar" : "Criar",
        body: { ...(edit ? { id: "a" } : {}), name: "Conta QA", type: "CASH",
          balance: 10.35, color: "#22c55e", icon: "wallet" },
        error: edit ? "Erro ao atualizar conta" : "Erro ao criar conta",
        success: edit ? "Conta atualizada!" : "Conta criada!", draft: ["account-name", "Conta QA"] });
    });
  }

  for (const [view, type, label, success] of [
    ["accounts", "conta", "Conta", "Conta excluída!"], ["cards", "cartão", "Cartão", "Cartão excluído!"],
  ]) {
    await scenario(`DELETE ${type} 503`, view, async () => {
      await button(`Excluir ${type} ${label} A`).click();
      await rejectAndRetry({ method: "DELETE", url: `/api/${view}`, action: "Excluir",
        body: { id: "a" }, error: `Erro ao excluir ${type}`, success, role: "alertdialog" });
    });
  }

  await scenario("POST transferência 503", "accounts", async () => {
    await button("Transferir").click();
    await field("transfer-from").click();
    await page.getByRole("option", { name: /Conta A/ }).click();
    await field("transfer-to").click();
    await page.getByRole("option", { name: /Conta B/ }).click();
    await field("transfer-amount").fill("2.75");
    await field("transfer-date").fill("2026-01-15");
    await field("transfer-description").fill("Transferência QA");
    await rejectAndRetry({ method: "POST", url: "/api/transfer", action: "Transferir",
      body: { fromAccountId: "a", toAccountId: "b", amount: 2.75, date: "2026-01-15",
        description: "Transferência QA" }, error: "Erro na transferência",
      success: "Transferência realizada com sucesso!", draft: ["transfer-amount", "2.75"] });
  });

  async function fillTransfer(amount) {
    await button("Transferir").click();
    for (const [id, account] of [["transfer-from", /Conta A/], ["transfer-to", /Conta B/]]) {
      await field(id).click();
      await page.getByRole("option", { name: account }).click();
    }
    await field("transfer-amount").fill(amount);
  }
  async function openTransaction(account, description) {
    await button(`Abrir conta Conta ${account}`).click();
    await button("Nova transação").click();
    await field("tx-description").fill(description);
    await field("tx-amount").fill("3.25");
  }
  const hold = () => page.evaluate(() => { window.qa.hold = true; });
  const respond = (status = 200, index = 0) => page.evaluate(([status, index]) => {
    window.qa.replies[index](new Response(null, { status }));
  }, [status, index]);
  const action = (label, role) => dialog(role).getByRole("button", { name: label, exact: true });
  const cancel = async (role) => {
    await action("Cancelar", role).click();
    await dialog(role).waitFor({ state: "hidden" });
  };
  const checkFocus = async (locator) => {
    ensure(await locator.evaluate((el) => el === document.activeElement), "foco não voltou à origem");
  };
  const checkNoDuplicate = async (label, role) => {
    await hold();
    // Two synchronous clicks also exercise the gap before React commits its pending state.
    await action(label, role).evaluate((el) => { el.click(); el.click(); });
    const calls = await state();
    ensure(calls.length === 1, `${calls.length} envios enquanto pendente`);
  };
  for (const [view, type, label, fieldId, createAction] of [
    ["accounts", "conta", "Conta", "account-name", "Criar"],
    ["cards", "cartão", "Cartão", "card-name", "Adicionar"],
  ]) {
    const edit = (id) => button(`Editar ${type} ${label} ${id}`);
    const remove = (id) => button(`Excluir ${type} ${label} ${id}`);
    await scenario(`POST ${type} pendente não duplica`, view, async () => {
      await button(type === "conta" ? "Nova conta" : "Novo cartão").click();
      await field(fieldId).fill("Rascunho");
      if (type === "cartão") await field("card-digits").fill("1234");
      await checkNoDuplicate(createAction);
    });
    await scenario(`PUT ${type} pendente não duplica`, view, async () => {
      await edit("A").click();
      await field(fieldId).fill("Rascunho");
      await checkNoDuplicate("Atualizar");
    });
    await scenario(`DELETE ${type} pendente não duplica`, view, async () => {
      await remove("A").click();
      await checkNoDuplicate("Excluir", "alertdialog");
    });
    for (const target of ["A", "B"]) {
      await scenario(`PUT ${type} A→${target} preserva a edição`, view, async () => {
        await hold();
        await edit("A").click();
        await field(fieldId).fill("Rascunho anterior");
        await action("Atualizar").click();
        await cancel();
        await checkFocus(edit("A"));
        await edit(target).click();
        await field(fieldId).fill("Rascunho vigente");
        await respond();
        await wait(`${label} atualizad${type === "conta" ? "a" : "o"}!`);
        ensure(await dialog().isVisible() && await field(fieldId).inputValue() === "Rascunho vigente", "a resposta antiga fechou ou sobrescreveu a edição");
        ensure(await page.evaluate((url) => window.qa.gets.filter((get) => get === url).length === 2, `/api/${view}`), "lista não foi relida após confirmação antiga");
        await cancel();
        await checkFocus(edit(target));
      });
      await scenario(`DELETE ${type} A→${target} preserva a confirmação`, view, async () => {
        await hold();
        await remove("A").click();
        await action("Excluir", "alertdialog").click();
        await cancel("alertdialog");
        await checkFocus(remove("A"));
        await remove(target).click();
        await respond(204);
        await wait(`${label} excluíd${type === "conta" ? "a" : "o"}!`);
        ensure(await dialog("alertdialog").isVisible(), "a resposta antiga fechou a confirmação reaberta");
        await cancel("alertdialog");
        await checkFocus(remove(target));
      });
    }
  }
  await scenario("Transferência pendente não duplica", "accounts", async () => {
    await fillTransfer("1.25");
    await checkNoDuplicate("Transferir");
  });
  await scenario("Transferência tardia preserva formulário reaberto", "accounts", async () => {
    await hold();
    await fillTransfer("1.25");
    await action("Transferir").click();
    await cancel();
    await checkFocus(button("Transferir"));
    await button("Transferir").click();
    await field("transfer-amount").fill("2.75");
    await respond();
    await wait("Transferência realizada com sucesso!");
    ensure(await dialog().isVisible() && await field("transfer-amount").inputValue() === "2.75", "a resposta antiga fechou ou limpou a transferência");
    await cancel();
    await checkFocus(button("Transferir"));
  });
  await scenario("Transferência confirmada após cancelar limpa apenas o rascunho enviado", "accounts", async () => {
    await hold();
    await fillTransfer("1.25");
    await action("Transferir").click();
    await cancel();
    await respond();
    await wait("Transferência realizada com sucesso!");
    await button("Transferir").click();
    ensure(await field("transfer-amount").inputValue() === "", "a próxima abertura recuperou o rascunho já confirmado");
  });
  await scenario("Lançamento pendente não duplica", "accounts", async () => {
    await openTransaction("A", "Lançamento anterior");
    await checkNoDuplicate("Registrar");
  });
  for (const target of ["A", "B"]) {
    await scenario(`POST lançamento A→${target} preserva rascunho e relê detalhe vigente`, "accounts", async () => {
      await hold();
      await openTransaction("A", "Lançamento anterior");
      await action("Registrar").click();
      await cancel();
      await checkFocus(button("Nova transação"));
      await button("Voltar para contas").click();
      await openTransaction(target, "Lançamento vigente");
      const before = await page.evaluate(() => window.qa.gets.length);
      await respond();
      await wait("Transação registrada!");
      ensure(await dialog().isVisible() && await field("tx-description").inputValue() === "Lançamento vigente", "a resposta antiga fechou ou limpou o rascunho");
      const reread = await page.evaluate((index) => window.qa.gets.slice(index).filter((url) => url.includes("?accountId=")), before);
      ensure(JSON.stringify(reread) === JSON.stringify([`/api/transactions?accountId=${target.toLowerCase()}`]), `releitura incorreta do detalhe: ${reread}`);
      await cancel();
      await checkFocus(button("Nova transação"));
    });
  }

  async function openCard(id, index) {
    await button(`Abrir cartão Cartão ${id.toUpperCase()}`).click();
    await page.waitForFunction(([id, index]) => window.qa.pending[index]?.id === id, [id, index]);
  }
  async function reply(index, merchant) {
    await page.evaluate(async ([index, merchant]) => {
      window.qa.reply(index, merchant);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }, [index, merchant]);
  }
  const back = () => button("Voltar para cartões").click();
  const absent = async (text) => ensure(!(await page.getByText(text, { exact: true }).isVisible()), `compra indevida visível: ${text}`);

  await scenario("GET compras A→B: renderização por ID e atraso", "cards", async () => {
    await openCard("a", 0);
    await reply(0, "Compra A anterior");
    await wait("Compra A anterior");
    await back();
    await openCard("a", 1);
    await back();
    await openCard("b", 2);
    const leakedBeforeReply = await page.getByText("Compra A anterior", { exact: true }).isVisible();
    await reply(2, "Compra B vigente");
    await wait("Compra B vigente");
    await reply(1, "Compra A atrasada");
    await absent("Compra A atrasada");
    await wait("Compra B vigente");
    ensure(!leakedBeforeReply, "compras de A ficaram visíveis em B antes da resposta");
  });

  await scenario("GET compras: reabertura A ignora sua consulta anterior", "cards", async () => {
    await openCard("a", 0);
    await back();
    await openCard("a", 1);
    await reply(1, "Compra A vigente");
    await wait("Compra A vigente");
    await reply(0, "Compra A obsoleta");
    await absent("Compra A obsoleta");
    await wait("Compra A vigente");
  });

  return failures;
}

const entry = [
  `import { AccountsView } from ${JSON.stringify(join(sourceDir, "accounts-view.tsx"))};`,
  `import { CardsView } from ${JSON.stringify(join(sourceDir, "cards-view.tsx"))};`,
  `import { AppIntlProvider } from ${JSON.stringify(join(rootDir, "src/i18n/provider.tsx"))};`,
  `import { getMessagesForLocale } from ${JSON.stringify(join(rootDir, "src/i18n/messages.ts"))};`,
  "import { createElement, Fragment } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { Toaster } from 'sonner';",
  "const qa = window.qa = { mutations: [], gets: [], pending: [], replies: [], hold: false, ok: false };",
  "const accounts = ['a', 'b'].map((id) => ({ id, name: 'Conta ' + id.toUpperCase(), type: 'CASH', balance: 0, color: '#22c55e', icon: 'wallet', isActive: true }));",
  "const cards = ['a', 'b'].map((id) => ({ id, name: 'Cartão ' + id.toUpperCase(), type: 'CREDIT', brand: 'VISA', lastFourDigits: '0000', creditLimit: 0, currentBalance: 0, color: '#8b5cf6', closingDay: 1, dueDay: 10, flag: '' }));",
  "window.fetch = async (url, init) => {",
  "  if (init?.method) {",
  "    qa.mutations.push({ url, method: init.method, body: JSON.parse(init.body) });",
  "    if (qa.hold) return new Promise(resolve => qa.replies.push(resolve));",
  "    return qa.ok ? Response.json({}) : new Response('Indisponível', { status: 503 });",
  "  }",
  "  qa.gets.push(url);",
  "  if (url.startsWith('/api/purchases?cardId=')) {",
  "    return new Promise(resolve => qa.pending.push({ resolve, id: url.split('=')[1] }));",
  "  }",
  "  if (url === '/api/cards') return Response.json(cards);",
  "  if (url === '/api/accounts') return Response.json(accounts);",
  "  if (url === '/api/categories' || url.startsWith('/api/transactions?')) return Response.json([]);",
  "  throw new Error('Requisição inesperada: ' + url);",
  "};",
  "qa.reply = (index, merchant) => qa.pending[index].resolve(Response.json([{ id: merchant, merchant, totalAmount: 2, date: '2026-01-15', items: [] }]));",
  "qa.mount = kind => createRoot(document.getElementById('root')).render(createElement(AppIntlProvider, { locale: 'pt', messages: getMessagesForLocale('pt') }, createElement(Fragment, null, createElement(kind === 'cards' ? CardsView : AccountsView, { refreshCounter: 0, onLaunchClose() {} }), createElement(Toaster))));",
].join("\n");

try {
  const bundle = await Bun.build({
    entrypoints: [fileURLToPath(import.meta.url)],
    target: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [{ name: "fixture em memória", setup(build) {
      build.onLoad({ filter: /quiet-accounts-cards\.qa\.mjs$/ }, () => ({ contents: entry, loader: "ts" }));
    } }],
  });
  const html = join(dir, "fixture.html");
  const script = (await bundle.outputs[0].text()).replaceAll("</script", "<\\/script");
  await writeFile(html, `<!doctype html><meta charset="utf-8"><div id="root"></div><script>${script}</script>`);
  await cli("open", "about:blank", "--browser=chrome", "--idle-timeout=120s");
  await cli("snapshot");
  const outcome = await cli("run-code", `(page) => (${runCases.toString()})(page, ${JSON.stringify(html)})`);
  const result = outcome.match(/^### Result\n([^\n]+)/m)?.[1];
  const failures = JSON.parse(result ?? "null");
  assert.deepEqual(failures, [], "Cenários com falha");
  console.log("30 cenários passaram: 10 regressões iniciais e 20 provas de envios e respostas pendentes.");
} finally {
  try { await cli("close"); } finally { await rm(dir, { recursive: true, force: true }); }
}
