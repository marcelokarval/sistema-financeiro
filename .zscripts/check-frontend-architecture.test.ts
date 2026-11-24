import { expect, test } from 'bun:test';
import * as gate from './check-frontend-architecture';

const path = 'src/components/finance/example.tsx';
const legacy = "export function Row() { return <dd className={`p-2 ${ok ? 'on' : ''}`} />; }";
const changed = legacy.replace("'on'", "'other'");
const doubled = legacy.replace('return <dd', 'return <><dd').replace(' />;', ' /><dd className={`p-2 ${ok ? \'on\' : \'\'}`} /></>;');
const empty = { version: 1, entries: [] };

const scan = (text: string, file = path) => gate.scanFrontend([[file, text]]).occurrences;
const warningRules = (text: string) => gate.scanFrontend([[path, text]]).warnings.map(({ rule }) => rule);
const baseline = (text: string) => ({ version: 1, entries: scan(text).map(({ rule, path, symbol, hash, count }) => ({
  rule, path, symbol, hash, count,
  reason: 'A variante do exemplo ainda é mantida junto à linha.',
  owner: 'Arquitetura frontend',
  removeWhen: 'Quando a linha adotar cn().',
})) });
const initial = (text: string, candidate = baseline(text)) => gate.evaluateBaseline(scan(text), candidate, scan(text));
const ratchet = (text: string, candidate = baseline(text), approved = baseline(legacy)) =>
  gate.evaluateBaseline(scan(text), candidate, gate.parseBaseline(approved));
const codes = (issues?: { code: string }[]) => issues?.map(({ code }) => code) ?? [];

const legacyHash = /^[0-9a-f]{64}$/;
const calibration = 'eb76f7d0f3ced99248ed3c8e5334fcc8792a348f';
const integration = 'a'.repeat(40);
const baselinePath = '.zscripts/frontend-architecture-baseline.json';
const testPath = '.zscripts/check-frontend-architecture.test.ts';
const planPath = 'openspec/changes/formalizar-componentizacao-extrema-frontend/design.md';

// Sintético no limite de I/O: o TypeScript e a comparação são reais; as duas árvores
// podem ser divergentes sem escrever TSX, mexer no índice ou fabricar commits na entrega.
function verificationInput({ current = changed, candidate = baseline(legacy), approved = baseline(legacy),
  head = calibration, tracked = [] as string[], untracked = [planPath, testPath], ignored = [] as string[], integrationDiff = [baselinePath] }: {
    current?: string; candidate?: object; approved?: object; head?: string; tracked?: string[]; untracked?: string[];
    ignored?: string[]; integrationDiff?: string[];
  } = {}) {
  return {
    resolveCommit: (ref: string) => {
      if (ref === 'eb76f7d' || ref === calibration) return calibration;
      if (ref === integration) return integration;
      throw new Error('referência ilegível');
    },
    initialPreflight: () => ({ head, tracked, untracked, ignored, hidden: [] }),
    integrationDiff: () => integrationDiff,
    gitSources: (ref: string) => {
      if (ref !== calibration) throw new Error('fonte inesperada');
      return [[path, legacy]] as const;
    },
    currentSources: () => [[path, current]] as const,
    candidateBaseline: () => JSON.stringify(candidate),
    approvedBaseline: (ref: string) => {
      if (ref !== integration) throw new Error('referência sem baseline legível');
      return JSON.stringify(approved);
    },
  };
}

test('calibração usa só TSX Git; mudança rastreada, não rastreada ou TSX ignorado invalida a prova', () => {
  const args = ['--initial-base', 'eb76f7d'];
  expect(gate.verify(args, { ...verificationInput(), currentSources: () => { throw new Error('leu TSX de disco'); } }).issues).toEqual([]);
  for (const change of [{ head: integration }, { tracked: [path] }, { untracked: [path] }, { ignored: [path] }]) {
    expect(() => gate.verify(args, verificationInput(change))).toThrow(/calibração/i);
  }
});

test('modo posterior lê o teto da integração autorizada, não do candidato', () => {
  const args = ['--baseline-ref', integration];
  const verified = gate.verify(args, verificationInput({ candidate: baseline(changed) }));
  expect(verified.commit).toBe(integration);
  expect(codes(verified.issues)).toEqual(['ceiling-exceeded']);
  expect(gate.verify(args, verificationInput({ current: legacy })).issues).toEqual([]);
  expect(() => gate.verify(args, verificationInput({ integrationDiff: [baselinePath, path] }))).toThrow(/integração/i);
});

test('modo exige uma única referência legível e integração fixada por hash completo', () => {
  for (const args of [[], ['--initial-base'], ['--baseline-ref', 'HEAD'], ['--initial-base', 'master'], ['--baseline-ref', integration, '--initial-base', 'eb76f7d']]) {
    expect(() => gate.verify(args, verificationInput())).toThrow(/modo|referência/i);
  }
  expect(() => gate.verify(['--baseline-ref', 'b'.repeat(40)], verificationInput())).toThrow(/referência/i);
  expect(() => gate.verify(['--baseline-ref', calibration], verificationInput())).toThrow(/baseline/i);
});

test('identifica classe ternária literal no JSX com regra, caminho, símbolo, hash e posição', () => {
  expect(scan(legacy)).toEqual([{ rule: 'raw-conditional-class-name', path, symbol: 'Row', hash: expect.stringMatching(legacyHash), count: 1, lines: [1] }]);
});

test('identidade AST não depende de linha, espaços ou comentários e preserva multiplicidade', () => {
  const reformatted = legacy.replace('ok ?', 'ok  /* keep */   ?');
  expect(scan(`\n\n${reformatted}`)).toEqual(scan(legacy).map((entry) => ({ ...entry, lines: [3] })));
  expect(scan(doubled)).toEqual([{ ...scan(legacy)[0], count: 2, lines: [1, 1] }]);
  expect(scan(legacy.replace('function Row()', 'function Other()'))[0]?.symbol).toBe('Other');
  expect(scan(changed)[0]?.hash).not.toBe(scan(legacy)[0]?.hash);
});

test('reformatar uma ternária em várias linhas conserva sua autorização no baseline', () => {
  const text = legacy.replace("ok ? 'on' : ''", "\n  ok\n    ? 'on'\n    : ''\n");
  expect(scan(text)[0]?.hash).toBe(scan(legacy)[0]?.hash);
  expect(ratchet(text, baseline(legacy))).toEqual([]);
});

test('o hash preserva espaços significativos em strings e no texto do template', () => {
  const base = legacy.replace("'on'", "'on off'");
  expect(scan(base.replace("'on off'", "'on  off'"))[0]?.hash).not.toBe(scan(base)[0]?.hash);
  expect(scan(base.replace('`p-2 ', '`p-2  '))[0]?.hash).not.toBe(scan(base)[0]?.hash);
});

test('o resultado é determinístico independentemente da ordem de descoberta dos arquivos', () => {
  const files = [[path, legacy], ['src/app/page.tsx', changed]] as const;
  const result = gate.scanFrontend(files);
  expect(result.occurrences.map((entry) => entry.path)).toEqual(['src/app/page.tsx', path]);
  expect(result).toEqual(gate.scanFrontend([...files].reverse()));
});

test('markup semântico, wrapper técnico e classes com cn() não geram erros', () => {
  const text = [
    'export const Details = () => <section><dl><dt>Total</dt><dd className="tabular-nums">0</dd></dl>',
    '<div style={{ width: `${fill}%`, printColorAdjust: print ? "exact" : "economy" }} className={cn("bar", active ? "on" : "")} />',
    '<span className={active ? "on" : ""} /><span className={`bar`} /><span aria-label={`x ${active ? "yes" : "no"}`} />',
    '<span className={`bar ${active ? tone : ""}`} /><span className={cn(`bar ${active ? "on" : ""}`)} /></section>;',
  ].join('\n');
  expect(scan(text)).toEqual([]);
  expect(warningRules(text)).toEqual(['non-literal-class-interpolation']);
});

test('ternária parentetizada e alternativas template sem interpolação ainda são literais', () => {
  expect(scan('const Row = () => <i className={(`x ${(ok ? `on` : ``)}`)} />;')).toHaveLength(1);
});

test('perímetro inclui App Router e subpastas próprias, mas exclui teste, fixture, API, shadcn e demo', () => {
  expect(['src/app/page.tsx', 'src/components/shared/metric.tsx', 'src/components/finance/accounts/row.tsx']
    .map((file) => scan(legacy, file).length)).toEqual([1, 1, 1]);
  expect([
    'src/app/api/example/route.tsx', 'src/app/__tests__/page.tsx', 'src/components/finance/row.test.tsx',
    'src/components/finance/fixtures/page.tsx', 'src/components/shared/row.spec.tsx', 'src/components/ui/progress.tsx',
    'examples/websocket/page.tsx', 'src/components/finance-old/example.tsx',
  ].flatMap((file) => scan(legacy, file))).toEqual([]);
});

test('callback denso, profundidade e tamanho são sinais não bloqueantes', () => {
  const jsx = '<div>'.repeat(12) + 'item' + '</div>'.repeat(12);
  const text = `${'\n'.repeat(501)}const Report = () => <section>{items.map(item => ${jsx})}</section>;`;
  expect(warningRules(text).sort()).toEqual(['deep-jsx', 'dense-jsx-callback', 'large-tsx-file']);
  expect(initial(text, empty)).toEqual([]);
});

test('dívida da árvore inicial e dívida da referência aprovada são aceitas', () => {
  expect(initial(legacy)).toEqual([]);
  expect(ratchet(legacy)).toEqual([]);
});

test('ocorrência confirmada sem entrada é erro', () => {
  expect(codes(initial(legacy, empty))).toEqual(['unbaselined']);
});

test('ocorrência sanada exige retirada da entrada órfã', () => {
  const fixed = 'const Row = () => <dd className={cn("p-2", ok && "on")} />;';
  expect(codes(ratchet(fixed, baseline(legacy)))).toEqual(['orphan']);
  expect(ratchet(fixed, empty)).toEqual([]);
});

test('adicionar ocorrência ao candidato não cria autorização de nenhuma das referências', () => {
  const newRow = legacy.replace('Row', 'Other');
  const both = `${legacy}\n${newRow}`;
  expect(codes(ratchet(both))).toEqual(['ceiling-exceeded']);
  expect(codes(gate.evaluateBaseline(scan(legacy), baseline(both), scan(legacy)))).toContain('ceiling-exceeded');
});

test('ratchet não permite aumentar a multiplicidade nem trocar a impressão AST', () => {
  expect(codes(ratchet(doubled))).toEqual(['ceiling-exceeded']);
  expect(codes(ratchet(changed))).toEqual(['ceiling-exceeded']);
  expect(ratchet(legacy, baseline(legacy), baseline(doubled))).toEqual([]);
  expect(codes(ratchet(doubled, baseline(legacy)))).toEqual(['unbaselined']);
  expect(codes(ratchet(legacy, baseline(doubled), baseline(doubled)))).toEqual(['orphan']);
});

test('baseline rejeita entradas ambíguas e metadados de revisão ausentes', () => {
  const entry = baseline(legacy).entries[0];
  expect(() => gate.parseBaseline({ version: 1, entries: [entry, entry] })).toThrow(/duplicad/);
  for (const patch of [{ owner: '  ' }, { reason: '' }, { removeWhen: '' }, { count: 0 }, { hash: '*' }, { path: 'src/components/ui/button.tsx' }]) {
    expect(() => gate.parseBaseline({ version: 1, entries: [{ ...entry, ...patch }] })).toThrow(/baseline/i);
  }
});
