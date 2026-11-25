import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const rawClassRule = 'raw-conditional-class-name';
const productionRoots = ['src/app/', 'src/components/finance/', 'src/components/shared/'];
const nonProductionDirectories = new Set(['__tests__', '__fixtures__', 'test', 'tests', 'fixtures']);

export function isProductionTsx(path: string): boolean {
  const parts = path.split('/');
  return productionRoots.some((root) => path.startsWith(root))
    && !path.startsWith('src/app/api/')
    && path.endsWith('.tsx')
    && !/\.(test|spec|fixture)\.tsx$/.test(path)
    && parts.slice(0, -1).every((part) => part !== '' && part !== '.' && part !== '..' && !nonProductionDirectories.has(part));
}

type Identity = { rule: typeof rawClassRule; path: string; symbol: string; hash: string };
type Counted = Identity & { count: number };
type Occurrence = Counted & { lines: number[] };
type Warning = { rule: string; path: string; symbol: string; line: number; detail: string };
type BaselineEntry = Counted & { reason: string; owner: string; removeWhen: string };
type Issue = { code: 'unbaselined' | 'orphan' | 'ceiling-exceeded'; entry: Counted; limit: number };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const key = ({ rule, path, symbol, hash }: Identity) => JSON.stringify([rule, path, symbol, hash]);
const isJsxTag = (node: ts.Node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
type AstPrint = [kind: ts.SyntaxKind, content: string | AstPrint[]];

function printAst(node: ts.Node, source: ts.SourceFile): AstPrint {
  // Keep the parsed hierarchy and tokens, not the printer's source line layout.
  // Literal leaves retain their spelling, including whitespace inside templates.
  const children = node.getChildren(source).filter((child) => !ts.isJSDoc(child));
  return [node.kind, children.length
    ? children.map((child) => printAst(child, source))
    : ts.isJsxText(node) ? node.getFullText(source) : node.getText(source)];
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  return expression;
}

function isClassLiteral(expression: ts.Expression): boolean {
  const node = unwrap(expression);
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function symbolPart(node: ts.Node): string | undefined {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node)) {
    return node.name?.text ?? (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : undefined);
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return undefined;
}

function countCallbackTags(callback: ts.ArrowFunction | ts.FunctionExpression): number {
  let count = 0;
  function visit(node: ts.Node) {
    if (isJsxTag(node)) count++;
    ts.forEachChild(node, visit);
  }
  visit(callback.body);
  return count;
}

export function scanFrontend(sources: Iterable<readonly [string, string]>) {
  const grouped = new Map<string, Occurrence>();
  const warnings: Warning[] = [];
  let files = 0;
  for (const [path, text] of sources) {
    if (!isProductionTsx(path)) continue;
    files++;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const warn = (rule: string, detail: string, symbol: string, line: number) => warnings.push({ rule, path, symbol, line, detail });
    const lineCount = source.getLineStarts().length;
    let deepest: { depth: number; line: number; symbol: string } = { depth: 0, line: 1, symbol: '<module>' };
    if (lineCount > 500) warn('large-tsx-file', `${lineCount} linhas`, '<module>', 1);

    function visit(node: ts.Node, scope: string[], depth: number) {
      const name = symbolPart(node);
      if (name && name !== scope[scope.length - 1]) scope = [...scope, name];
      const symbol = scope.length ? scope.join('.') : '<module>';
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        depth++;
        if (depth > deepest.depth) deepest = { depth, line: lineOf(node), symbol };
      }
      if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent) && node.parent.arguments.some((argument) => argument === node)) {
        const tags = countCallbackTags(node);
        if (tags >= 12) warn('dense-jsx-callback', `${tags} tags no callback`, symbol, lineOf(node));
      }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'className'
        && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const value = unwrap(node.initializer.expression);
        if (ts.isTemplateExpression(value)) {
          const interpolations = value.templateSpans.map((span) => unwrap(span.expression));
          const rawClass = interpolations.some((part) => ts.isConditionalExpression(part)
            && isClassLiteral(part.whenTrue) && isClassLiteral(part.whenFalse));
          if (rawClass) {
            const tag = node.parent.parent.tagName;
            const hash = createHash('sha256').update(JSON.stringify([printAst(tag, source), printAst(value, source)])).digest('hex');
            const identity: Identity = { rule: rawClassRule, path, symbol, hash };
            const id = key(identity);
            const occurrence = grouped.get(id) ?? { ...identity, count: 0, lines: [] };
            occurrence.count++;
            occurrence.lines.push(lineOf(node));
            grouped.set(id, occurrence);
          } else if (interpolations.some((part) => !isClassLiteral(part))) {
            warn('non-literal-class-interpolation', 'className contém interpolação não literal', symbol, lineOf(node));
          }
        }
      }
      ts.forEachChild(node, (child) => visit(child, scope, depth));
    }
    visit(source, [], 0);
    if (deepest.depth >= 10) warn('deep-jsx', `${deepest.depth} níveis JSX`, deepest.symbol, deepest.line);
  }
  return {
    files,
    occurrences: [...grouped.entries()].sort(([a], [b]) => compare(a, b)).map(([, occurrence]) => occurrence),
    warnings: warnings.sort((a, b) => compare(a.path, b.path) || a.line - b.line || compare(a.rule, b.rule)),
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonBlank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function parseBaseline(value: unknown): BaselineEntry[] {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new Error('Baseline inválido: esperado version=1 e array entries.');
  }
  const ids = new Set<string>();
  return value.entries.map((entry: unknown, index): BaselineEntry => {
    if (!record(entry) || entry.rule !== rawClassRule || typeof entry.path !== 'string' || !isProductionTsx(entry.path)
      || !nonBlank(entry.symbol) || typeof entry.hash !== 'string' || !/^[a-f0-9]{64}$/.test(entry.hash)
      || typeof entry.count !== 'number' || !Number.isSafeInteger(entry.count) || entry.count < 1
      || !nonBlank(entry.reason) || !nonBlank(entry.owner) || !nonBlank(entry.removeWhen)) {
      throw new Error(`Baseline inválido: entrada ${index + 1} sem identidade, multiplicidade ou metadados revisáveis.`);
    }
    const { rule, path, symbol, hash, count, reason, owner, removeWhen } = entry;
    const validated: BaselineEntry = { rule, path, symbol, hash, count, reason, owner, removeWhen };
    const id = key(validated);
    if (ids.has(id)) throw new Error(`Baseline inválido: entrada ${index + 1} duplicada.`);
    ids.add(id);
    return validated;
  });
}

export function evaluateBaseline(actual: readonly Counted[], candidateJson: unknown, ceiling: readonly Counted[]): Issue[] {
  const candidate = parseBaseline(candidateJson).sort((a, b) => compare(key(a), key(b)));
  const counts = (entries: readonly Counted[]) => new Map(entries.map((entry) => [key(entry), entry.count]));
  const actualCounts = counts(actual);
  const candidateCounts = counts(candidate);
  const ceilingCounts = counts(ceiling);
  const issues: Issue[] = [];
  for (const entry of candidate) {
    const observed = actualCounts.get(key(entry)) ?? 0;
    const approved = ceilingCounts.get(key(entry)) ?? 0;
    if (entry.count > observed) issues.push({ code: 'orphan', entry, limit: observed });
    if (entry.count > approved) issues.push({ code: 'ceiling-exceeded', entry, limit: approved });
  }
  for (const entry of actual) {
    const declared = candidateCounts.get(key(entry)) ?? 0;
    if (entry.count > declared) issues.push({ code: 'unbaselined', entry, limit: declared });
  }
  return issues;
}

const calibrationCommit = 'eb76f7d0f3ced99248ed3c8e5334fcc8792a348f';
const baselinePath = '.zscripts/frontend-architecture-baseline.json';
const calibrationPaths = new Set([
  '.zscripts/check-frontend-architecture.ts', baselinePath,
  '.zscripts/check-frontend-architecture.test.ts', 'docs/reference/frontend-architecture-gate.md',
]);
const planningRoot = 'openspec/changes/formalizar-componentizacao-extrema-frontend/';
const roots = productionRoots.map((root) => root.slice(0, -1));
const relevantIgnored = (paths: string[]) => paths.filter(isProductionTsx);
const commitHash = /^[a-f0-9]{40}$/;

type Preflight = { head: string; tracked: string[]; untracked: string[]; ignored: string[]; hidden: string[] };
type VerificationInput = {
  resolveCommit(ref: string): string;
  initialPreflight(): Preflight;
  integrationDiff(ref: string): string[];
  gitSources(ref: string): Iterable<readonly [string, string]>;
  currentSources(): Iterable<readonly [string, string]>;
  candidateBaseline(): string;
  approvedBaseline(ref: string): string;
};

function parseJson(text: string, label: string): unknown {
  try { return JSON.parse(text); } catch { throw new Error(`Baseline ${label} não é JSON válido.`); }
}

export function verify(args: readonly string[], input: VerificationInput) {
  const [mode, ref] = args;
  if (args.length !== 2 || (mode !== '--initial-base' && mode !== '--baseline-ref')) {
    throw new Error('Escolha um único modo: --initial-base eb76f7d ou --baseline-ref <hash completo da integração aprovada>.');
  }
  if ((mode === '--initial-base' && ref !== 'eb76f7d' && ref !== calibrationCommit)
    || (mode === '--baseline-ref' && !commitHash.test(ref))) {
    throw new Error('Referência inválida: calibre em eb76f7d ou informe o hash completo da integração aprovada.');
  }
  const commit = input.resolveCommit(ref);
  let preflight: Preflight | undefined;
  let integrationPaths: string[] | undefined;
  let approvedJsonHash: string | undefined;
  let report: ReturnType<typeof scanFrontend>;
  let ceiling: readonly Counted[];
  if (mode === '--initial-base') {
    preflight = input.initialPreflight();
    const forbidden = [
      ...preflight.tracked.filter((file) => !calibrationPaths.has(file)),
      ...preflight.untracked.filter((file) => !calibrationPaths.has(file) && !file.startsWith(planningRoot)),
      ...relevantIgnored(preflight.ignored), ...preflight.hidden,
    ];
    if (commit !== calibrationCommit || preflight.head !== commit || forbidden.length) {
      throw new Error(`Calibração inválida: HEAD=${preflight.head}; caminhos fora da prova: ${JSON.stringify([...new Set(forbidden)].sort(compare))}.`);
    }
    report = scanFrontend(input.gitSources(commit));
    ceiling = report.occurrences;
  } else {
    if (commit !== ref) throw new Error('Referência da integração não corresponde ao commit solicitado.');
    integrationPaths = input.integrationDiff(commit);
    if (integrationPaths.some((file) => !calibrationPaths.has(file))) {
      throw new Error('Referência de integração contém delta fora dos quatro caminhos de calibração.');
    }
    const approved = input.approvedBaseline(commit);
    approvedJsonHash = createHash('sha256').update(approved).digest('hex');
    ceiling = parseBaseline(parseJson(approved, 'da integração'));
    report = scanFrontend(input.currentSources());
  }
  if (!report.files) throw new Error('Nenhum módulo TSX próprio encontrado; prova inválida.');
  const candidate = parseJson(input.candidateBaseline(), 'candidato');
  return { mode, commit, preflight, integrationPaths, approvedJsonHash, ...report, issues: evaluateBaseline(report.occurrences, candidate, ceiling) };
}

const splitNul = (output: string) => output.split('\0').filter(Boolean);

function git(args: string[], cwd: string): string {
  try {
    return execFileSync('git', ['--no-optional-locks', '--no-replace-objects', '-c', 'core.fsmonitor=false', ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error(`Git não pôde executar ${args[0]}: referência, árvore ou blob ilegível.`);
  }
}

function gitTree(root: string, commit: string, paths: string[]) {
  return splitNul(git(['ls-tree', '-r', '-z', commit, '--', ...paths], root)).map((entry) => {
    const separator = entry.indexOf('\t');
    const [mode, type, oid] = entry.slice(0, separator).split(' ');
    return { mode, type, oid, path: entry.slice(separator + 1) };
  });
}

function regularGitBlob(root: string, entry: ReturnType<typeof gitTree>[number]): string {
  if (entry.type !== 'blob' || !/^100(644|755)$/.test(entry.mode)) {
    throw new Error(`Esperado um blob Git regular: ${JSON.stringify(entry.path)}.`);
  }
  return git(['cat-file', 'blob', entry.oid], root);
}

function readRegularFile(root: string, path: string): string {
  const file = join(root, path);
  if (!lstatSync(file).isFile() || realpathSync(file) !== file) {
    throw new Error(`Esperado arquivo regular sem links simbólicos: ${JSON.stringify(path)}.`);
  }
  return readFileSync(file, 'utf8');
}

function repositoryInput(root: string): VerificationInput {
  const diffFlags = ['--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z'];
  const diff = (refs: string[]) => splitNul(git(['diff', ...diffFlags, ...refs, '--'], root));
  const list = (flags: string[], paths: string[] = []) => splitNul(git(['ls-files', '-z', ...flags, '--', ...paths], root));
  const ignored = () => relevantIgnored(list(['--others', '--ignored', '--exclude-standard'], roots));
  return {
    resolveCommit: (ref) => git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], root).trim(),
    initialPreflight: () => ({
      head: git(['rev-parse', 'HEAD'], root).trim(),
      tracked: [...new Set([...diff([calibrationCommit]), ...diff(['--cached', calibrationCommit])])].sort(compare),
      untracked: list(['--others', '--exclude-standard']),
      ignored: ignored(),
      hidden: list(['-v']).filter((entry) => /^[a-zS] /.test(entry)).map((entry) => entry.slice(2)),
    }),
    integrationDiff: (ref) => diff([calibrationCommit, ref]),
    *gitSources(ref) {
      for (const entry of gitTree(root, ref, roots)) {
        if (isProductionTsx(entry.path)) yield [entry.path, regularGitBlob(root, entry)];
      }
    },
    *currentSources() {
      if (ignored().length) throw new Error('TSX próprio ignorado invalida a verificação.');
      const paths = list(['--cached', '--others', '--exclude-standard'], roots);
      const deleted = new Set(list(['--deleted'], roots));
      for (const path of [...new Set(paths)].sort(compare)) {
        if (isProductionTsx(path) && !deleted.has(path)) yield [path, readRegularFile(root, path)];
      }
    },
    candidateBaseline: () => readRegularFile(root, baselinePath),
    approvedBaseline: (ref) => {
      const [entry] = gitTree(root, ref, [baselinePath]);
      if (!entry || entry.path !== baselinePath) throw new Error('Referência da integração sem baseline aprovado legível.');
      return regularGitBlob(root, entry);
    },
  };
}

function main(args: string[]): number {
  try {
    const root = realpathSync(git(['rev-parse', '--show-toplevel'], resolve(process.cwd())).trim());
    const result = verify(args, repositoryInput(root));
    console.log(`frontend-architecture ${result.mode} ${result.commit}`);
    if (result.preflight) {
      const { head, tracked, untracked, ignored, hidden } = result.preflight;
      console.log(`preflight ${JSON.stringify({ head, tracked, gateUntracked: untracked.filter((file) => calibrationPaths.has(file)), planningUntracked: untracked.filter((file) => file.startsWith(planningRoot)).length, ignored, hidden })}`);
    }
    if (result.integrationPaths) console.log(`integração ${JSON.stringify(result.integrationPaths)}; SHA-256 do JSON Git: ${result.approvedJsonHash}`);
    for (const { rule, path, symbol, line, detail } of result.warnings) {
      console.log(`aviso ${rule} ${path}:${line} ${symbol}: ${detail}`);
    }
    for (const { code, entry, limit } of result.issues) {
      const { rule, path, symbol, hash, count } = entry;
      const position = result.occurrences.find((occurrence) => key(occurrence) === key(entry))?.lines.join(',');
      console.error(`erro ${code} ${rule} ${path}${position ? `:${position}` : ''} ${symbol} ${hash} multiplicidade=${count} limite=${limit}`);
    }
    const total = result.occurrences.reduce((sum, occurrence) => sum + occurrence.count, 0);
    console.log(`${result.files} arquivos; ${total} ocorrências em ${result.occurrences.length} identidades; ${result.warnings.length} avisos; ${result.issues.length} erros.`);
    return result.issues.length ? 1 : 0;
  } catch (error) {
    console.error(`erro de verificação: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
