/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React, { type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';
import { toast } from 'sonner';
import { readFileSync } from 'node:fs';
import { useAppStore } from '@/lib/store';
import { AccountsView, reconcileTransactionDraft, transactionDraftForAccount } from './accounts-view';
import { CardsView } from './cards-view';

function markup(file: string) {
  const source = ts.createSourceFile(file, new TextDecoder().decode(readFile(file)), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: ts.JsxOpeningLikeElement[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return elements;
}

function attribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find((attr): attr is ts.JsxAttribute => ts.isJsxAttribute(attr) && attr.name.getText() === name);
}

function namedAction(elements: ts.JsxOpeningLikeElement[], handler: string, label: string) {
  return elements.some((node) => ['Button', 'button'].includes(node.tagName.getText())
    && attribute(node, 'onClick')?.getText().includes(handler)
    && attribute(node, 'aria-label')?.getText().includes(label));
}

const accountView = markup('accounts-view.tsx');
const cardView = markup('cards-view.tsx');

for (const [name, nodes, summary, records] of [
  ['Contas', accountView, 'Posição das contas', 'Contas cadastradas'],
  ['Cartões', cardView, 'Posição dos cartões', 'Cartões cadastrados'],
] as const) {
  test(`${name}: faixa de indicadores antes dos registros`, () => {
    const strip = nodes.findIndex((node) => node.tagName.getText() === 'dl' && attribute(node, 'aria-label')?.getText().includes(summary));
    const list = nodes.findIndex((node) => node.tagName.getText() === 'ul' && attribute(node, 'aria-label')?.getText().includes(records));
    expect(strip).toBeGreaterThanOrEqual(0);
    expect(list).toBeGreaterThan(strip);
    expect(nodes.some((node) => /gradient|card-glow|blur-xl/.test(node.getText()))).toBe(false);
  });
}

test('Contas: detalhe e ações de cada conta têm botão e nome', () => {
  expect(namedAction(accountView, 'openAccount(acc)', 'Abrir conta')).toBe(true);
  expect(namedAction(accountView, 'openEditAccount(acc)', 'Editar conta')).toBe(true);
  expect(namedAction(accountView, 'setShowDeleteDialog(acc.id)', 'Excluir conta')).toBe(true);
  expect(namedAction(accountView, 'openTransaction(selectedAccount.id)', 'Nova transação')).toBe(true);
  expect(namedAction(accountView, 'setShowTransferDialog(true)', 'Transferir')).toBe(true);
});

test('Cartões: detalhe, cópia, edição e exclusão são botões nomeados', () => {
  expect(namedAction(cardView, 'openCard(card)', 'Abrir cartão')).toBe(true);
  expect(namedAction(cardView, 'copyNumber(card.id', 'Copiar número mascarado')).toBe(true);
  expect(namedAction(cardView, 'openEditCard(card)', 'Editar cartão')).toBe(true);
  expect(namedAction(cardView, 'setShowDeleteDialog(card.id)', 'Excluir cartão')).toBe(true);
});

test('Cartões: acionador de compra expõe o estado e o painel que controla', () => {
  const trigger = cardView.find((node) => attribute(node, 'onClick')?.getText().includes('setExpandedPurchase('));
  expect(trigger?.tagName.getText()).toBe('button');
  expect(attribute(trigger!, 'aria-expanded')).toBeDefined();
  expect(attribute(trigger!, 'aria-controls')).toBeDefined();
});

test('Contas: rascunho sintético não migra para outra conta nem sobrevive a remoção confirmada', () => {
  const draft = { accountId: 'conta-a', session: Symbol(), data: { amount: '7.25' } };
  const a = { id: 'conta-a' };
  const b = { id: 'conta-b' };
  expect(reconcileTransactionDraft(draft, [b], false)).toBe(draft);
  expect(reconcileTransactionDraft(draft, [b], true)).toBeNull();
  expect(transactionDraftForAccount(draft, b.id, [a, b])).toBeNull();
  expect(transactionDraftForAccount(draft, a.id, [a, b])).toBe(draft);
});

function readFile(file: string) {
  return readFileSync(new URL(file, import.meta.url));
}

// Portais Radix não aparecem no SSR; verificar o contrato das confirmações na view.
for (const [file, count] of [["accounts-view.tsx",2],["cards-view.tsx",1]] as const) {
  test(`${file}: confirmação destrutiva usa cores semânticas e hover legível`, async () => {
    const source = await Bun.file(new URL(file, import.meta.url)).text();
    const actions = [...source.matchAll(/<AlertDialogAction\b([\s\S]*?)<\/AlertDialogAction>/g)];
    expect(actions).toHaveLength(count);
    for (const [, attrs] of actions) {
      expect(attrs).toContain('bg-destructive');
      expect(attrs).toContain('text-[var(--ds-destructive-fg)]');
      expect(attrs).toContain('hover:bg-destructive');
      expect(attrs).toContain('hover:underline');
      expect(attrs).not.toMatch(/text-white|text-destructive-foreground|bg-rose-|hover:bg-destructive\/90/);
    }
  });
}

test('Contas consome selectedAccountId da store, trata erro/loading de transações', async () => {
  const source = await Bun.file(new URL('accounts-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedAccountId');
  expect(source).toContain('setSelectedAccountId');
  expect(source).toContain('Carregando transações');
  expect(source).toContain('Não foi possível carregar as transações');
});

test('Cartões consome selectedCardId da store, trata loading/erro/retry e valida nome do cartão', async () => {
  const source = await Bun.file(new URL('cards-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedCardId');
  expect(source).toContain('setSelectedCardId');
  expect(source).toContain('Não foi possível carregar os cartões');
  expect(source).toContain('Não foi possível carregar as compras do cartão');
  expect(source).toContain('Carregando compras do cartão');
  expect(source).toContain('Nome do cartão é obrigatório');
});

const qaAccounts = ['a', 'b'].map((id) => ({
  id, name: `Conta ${id.toUpperCase()}`, type: 'BANK', balance: 10, color: '#22c55e', icon: 'wallet', isActive: true,
}));
const qaTransaction = {
  id: 'tx-a', type: 'INCOME', amount: 12.5, description: 'Transação sintética', date: '2026-02-03T00:00:00.000Z',
  category: { id: 'income', name: 'Receita sintética', color: '#22c55e' }, categoryId: 'unused', notes: 'Nota preservada',
};
const qaCategories = [
  { id: 'income', type: 'INCOME', name: 'Receita sintética' },
  { id: 'expense', type: 'EXPENSE', name: 'Despesa sintética' },
];

type Element = ReactElement<Record<string, any>>;
type Call = { url: string; method: string; body?: unknown };
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function heldResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function find(node: ReactNode, match: (element: Element) => boolean): Element | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Element['props']>(child)) continue;
    if (match(child)) return child;
    // Só expande a folha de campos, sem simular componentes Radix ou DOM.
    const nested = find(typeof child.type === 'function' && child.type.name === 'AccountTransactionFields'
      ? (child.type as (props: Element['props']) => ReactNode)(child.props) : child.props.children, match);
    if (nested) return nested;
  }
}
const required = (node: ReactNode, match: (element: Element) => boolean) => {
  const result = find(node, match);
  if (!result) throw new Error('Controle sintético não encontrado');
  return result;
};
const nameIs = (name: string) => (element: Element) => element.props['aria-label'] === name;
const buttonNamed = (name: string) => (element: Element) => element.props.onClick
  && (React.Children.toArray(element.props.children).some((child) => typeof child === 'string' && child.trim() === name) || nameIs(name)(element));
const dialogTitleIs = (name: string) => (element: Element) => element.props.open === true
  && Boolean(find(element.props.children, (child) => React.Children.toArray(child.props.children).includes(name)));
const byId = (id: string) => (element: Element) => element.props.id === id;
const collection = '/api/transactions';

// Exercita callbacks da view com fetch/toasts sintéticos; foco, conexão e portais são oráculos do runner DOM.
async function exerciseAccounts(onRun: (testbed: {
  render: () => Element; calls: Call[]; feedback: string[];
  answerWrite: (answer: () => Promise<Response>) => void;
}) => Promise<void>, accounts = qaAccounts) {
  const react = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const dispatcher = react.H;
  const { fetch } = globalThis;
  const { success, error } = toast;
  const store = useAppStore.getState();
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: (readonly unknown[] | undefined)[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const calls: Call[] = [];
  const feedback: string[] = [];
  let write = () => Promise.resolve(new Response(null, { status: 204 }));
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    left && right && left.length === right.length && left.every((dep, i) => Object.is(dep, right[i]));
  function render() {
    let s = 0, r = 0, e = 0, c = 0;
    const afterRender: (() => void)[] = [];
    react.H = {
      useState(initial: unknown) {
        const i = s++;
        if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], (next: unknown) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[r++] ??= { current }),
      useCallback(fn: unknown, deps: readonly unknown[]) {
        const i = c++;
        if (!sameDeps(callbacks[i]?.deps, deps)) callbacks[i] = { fn, deps };
        return callbacks[i].fn;
      },
      useMemo: (factory: () => unknown) => factory(),
      useDebugValue: () => {},
      useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
      useEffect(fn: () => void, deps?: readonly unknown[]) {
        const i = e++;
        if (!sameDeps(effects[i], deps)) afterRender.push(fn);
        effects[i] = deps;
      },
    };
    try {
      const tree = AccountsView({ refreshCounter: 0, onLaunchClose: () => {} });
      afterRender.forEach((fn) => fn());
      return tree as Element;
    } finally { react.H = dispatcher; }
  }
  try {
    useAppStore.setState({ currentView: 'accounts', selectedAccountId: null, newTransactionRequested: false });
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
      if (method !== 'GET' && ['/api/accounts', '/api/transfer'].includes(url) || url.startsWith(collection) && ['POST', 'PUT', 'DELETE'].includes(method)) {
        return write();
      }
      if (method === 'GET') {
        if (url === '/api/accounts') return Response.json(accounts);
        if (url === '/api/categories') return Response.json(qaCategories);
        if (url === `${collection}?accountId=a`) return Response.json([qaTransaction]);
        if (url === `${collection}?accountId=b`) return Response.json([{ ...qaTransaction, id: 'tx-b', description: 'Transação B sintética' }]);
        if (url.startsWith(`${collection}?from=`)) return Response.json([]);
      }
      throw new Error(`Chamada não prevista pela fixture: ${method} ${url}`);
    }) as typeof fetch;
    toast.success = (text) => { feedback.push(`ok: ${text}`); return 'ok'; };
    toast.error = (text) => { feedback.push(`erro: ${text}`); return 'erro'; };
    render();
    await settle();
    await onRun({ render, calls, feedback, answerWrite: (answer) => { write = answer; } });
  } finally {
    globalThis.fetch = fetch;
    toast.success = success;
    toast.error = error;
    useAppStore.setState(store, true);
  }
}

async function openDetail(render: () => Element) {
  required(render(), nameIs('Abrir conta Conta A')).props.onClick();
  render();
  await settle();
}
const variants = [
  { mode: 'create', id: 'tx', title: 'Nova Transação', opener: 'Nova transação', submit: 'Registrar', method: 'POST' },
  { mode: 'edit', id: 'edit-tx', title: 'Editar Transação', opener: 'Editar transação Transação sintética', submit: 'Salvar', method: 'PUT' },
] as const;
const writes = (calls: Call[]) => calls.filter(({ method }) => method !== 'GET');

test('Contas usa a mesma folha de campos para criar e editar, com as duas variantes', async () => {
  await exerciseAccounts(async ({ render }) => {
    await openDetail(render);
    const fieldTypes = variants.map(({ mode, title, opener }) => {
      required(render(), nameIs(opener)).props.onClick({ currentTarget: null });
      const dialog = required(render(), dialogTitleIs(title));
      const field = find(dialog, (element) => typeof element.type === 'function' && element.type.name === 'AccountTransactionFields');
      required(dialog, buttonNamed('Cancelar')).props.onClick();
      expect(field?.props.mode).toBe(mode);
      return field?.type;
    });
    expect(fieldTypes[0]).toBe(fieldTypes[1]);
  });
});

for (const { mode, id, title, opener, submit, method } of variants) {
  const editing = mode === 'edit';
  test(`Contas ${method}: defaults, validação, falhas recuperáveis e payload`, async () => {
    await exerciseAccounts(async ({ render, calls, feedback, answerWrite }) => {
      await openDetail(render);
      const earliestDate = new Date().toISOString().slice(0, 10);
      required(render(), nameIs(opener)).props.onClick({ currentTarget: null });
      const latestDate = new Date().toISOString().slice(0, 10);
      const dialog = () => required(render(), dialogTitleIs(title));
      const input = (key: string) => required(dialog(), byId(`${id}-${key}`));
      const change = (key: string, value: string) => input(key).props.onChange({ target: { value } });
      const select = (key: string) => find(dialog(), (node) => node.props.onValueChange && !!find(node.props.children, byId(`${id}-${key}`)))!;
      const send = async () => { required(dialog(), buttonNamed(submit)).props.onClick(); await settle(); };
      expect(['description', 'amount'].map((key) => input(key).props.value)).toEqual(editing
        ? ['Transação sintética', '12.5'] : ['', '']);
      expect(editing ? ['2026-02-03'] : [earliestDate, latestDate]).toContain(input('date').props.value);
      for (const [key, label] of Object.entries({ description: 'Descrição', amount: 'Valor (R$)', date: 'Data', type: 'Tipo', category: 'Categoria' })) {
        expect(required(dialog(), (node) => node.props.htmlFor === `${id}-${key}`).props.children).toBe(label);
      }
      expect(select('type').props.value).toBe(editing ? 'INCOME' : 'EXPENSE');
      expect(select('category').props.value).toBe(editing ? 'income' : '');
      expect(Boolean(find(select('category'), (node) => node.props.value === '__none__'))).toBe(editing);
      expect(find(select('category'), (node) => node.props.value === (editing ? 'expense' : 'income'))).toBeUndefined();
      select('type').props.onValueChange(editing ? 'EXPENSE' : 'INCOME');
      expect(find(select('category'), (node) => node.props.value === (editing ? 'expense' : 'income'))).toBeDefined();
      expect(select('category').props.value).toBe(editing ? 'income' : ''); // Trocar tipo não limpa o rascunho.
      if (editing) select('category').props.onValueChange('__none__');
      change('description', '  ');
      await send();
      change('description', '  Rascunho QA  ');
      change('amount', '0');
      await send();
      expect(writes(calls)).toEqual([]);
      expect(feedback).toEqual(['erro: Informe a descrição da transação', 'erro: Informe um valor maior que zero']);
      change('amount', '7.25');
      change('date', '2026-05-06');
      const expected = { url: collection, method, body: {
        ...(editing ? { id: 'tx-a' } : {}), type: editing ? 'EXPENSE' : 'INCOME', amount: 7.25,
        description: 'Rascunho QA', date: '2026-05-06', categoryId: editing ? null : '',
        notes: editing ? 'Nota preservada' : '', accountId: 'a',
      } };
      const before = calls.length;
      answerWrite(async () => Response.json({ error: 'Falha sintética' }, { status: 503 }));
      await send();
      expect(feedback.at(-1)).toBe(editing ? 'erro: Falha sintética' : 'erro: Erro ao registrar transação');
      answerWrite(async () => { throw new Error('Transporte sintético'); });
      await send();
      expect(feedback.at(-1)).toBe(editing ? 'erro: Erro ao atualizar transação' : 'erro: Erro ao registrar transação');
      expect(calls.slice(before)).toEqual([expected, expected]);
      expect(input('description').props.value).toBe('  Rascunho QA  ');
      expect(input('amount').props.value).toBe('7.25');
      expect(select('category').props.value).toBe(editing ? '__none__' : '');
      answerWrite(async () => new Response(null, { status: 204 }));
      await send();
      expect(writes(calls)).toEqual([expected, expected, expected]);
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      expect(calls.slice(before + 3).some(({ url }) => url === `${collection}?accountId=a`)).toBe(true);
    });
  });

  test(`Contas ${method}: mesmo turno não duplica e OK antigo não fecha a abertura posterior`, async () => {
    await exerciseAccounts(async ({ render, calls, answerWrite }) => {
      await openDetail(render);
      const open = () => required(render(), nameIs(opener)).props.onClick({ currentTarget: null });
      const dialog = () => required(render(), dialogTitleIs(title));
      const field = (name: string) => required(dialog(), byId(`${id}-${name}`));
      const change = (text: string) => field('description').props.onChange({ target: { value: text } });
      open();
      change('Rascunho antigo');
      field('amount').props.onChange({ target: { value: '8' } });
      const old = heldResponse();
      answerWrite(() => old.promise);
      const { onClick: send } = required(dialog(), buttonNamed(submit)).props;
      send();
      send();
      expect(required(dialog(), buttonNamed(submit)).props['aria-disabled']).toBe(true);
      required(dialog(), buttonNamed('Cancelar')).props.onClick();
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      open();
      change('Rascunho posterior');
      field('amount').props.onChange({ target: { value: '9' } });
      required(dialog(), buttonNamed(submit)).props.onClick();
      expect(writes(calls)).toHaveLength(1);
      old.resolve(new Response(null, { status: 204 }));
      await settle();
      expect(field('description').props.value).toBe('Rascunho posterior');
      expect(required(dialog(), buttonNamed(submit)).props['aria-disabled']).toBe(false);
      const root = dialog();
      root.props.onOpenChange(false); // callback de fechamento do Radix, não evento DOM.
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      expect(writes(calls)).toHaveLength(1);
    });
  });

  test(`Contas ${method}: chaves de A e B independentes com OK fora de ordem`, async () => {
    await exerciseAccounts(async ({ render, calls, answerWrite }) => {
      await openDetail(render);
      const a = heldResponse();
      const b = heldResponse();
      const dialog = () => required(render(), dialogTitleIs(title));
      const input = (field: string) => required(dialog(), byId(`${id}-${field}`));
      const send = () => required(dialog(), buttonNamed(submit)).props.onClick();
      function writeFor(account: string, control: string, reply: ReturnType<typeof heldResponse>) {
        required(render(), nameIs(control)).props.onClick({ currentTarget: null });
        input('description').props.onChange({ target: { value: `Rascunho ${account}` } });
        input('amount').props.onChange({ target: { value: '7.25' } });
        answerWrite(() => reply.promise);
        send();
      }
      writeFor('A', opener, a);
      required(dialog(), buttonNamed('Cancelar')).props.onClick();
      required(render(), (node) => node.props.onClick && React.Children.toArray(node.props.children).includes(' Voltar para contas')).props.onClick();
      required(render(), nameIs('Abrir conta Conta B')).props.onClick();
      render();
      await settle();
      writeFor('B', editing ? 'Editar transação Transação B sintética' : opener, b);
      expect(writes(calls).map(({ url, method, body }) => [url, method, body])).toEqual([
        [collection, method, expect.objectContaining({ accountId: 'a', description: 'Rascunho A', ...(editing ? { id: 'tx-a' } : {}) })],
        [collection, method, expect.objectContaining({ accountId: 'b', description: 'Rascunho B', ...(editing ? { id: 'tx-b' } : {}) })],
      ]);
      const before = calls.length;
      b.resolve(new Response(null, { status: 204 }));
      await settle();
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      await settle();
      a.resolve(new Response(null, { status: 204 }));
      await settle();
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      expect(calls.slice(before).filter(({ url }) => url.includes('accountId='))).toEqual([
        { method: 'GET', url: `${collection}?accountId=b` }, { method: 'GET', url: `${collection}?accountId=b` },
      ]);
    });
  });
}

test('Lançamento global exige escolher conta mesmo no detalhe e não grava ao abrir/cancelar', async () => {
  await exerciseAccounts(async ({ render, calls }) => {
    await openDetail(render);
    useAppStore.getState().requestNewTransaction();
    const chooser = required(render(), dialogTitleIs('Novo lançamento'));
    expect(find(render(), dialogTitleIs('Nova Transação'))).toBeUndefined();
    const pick = required(chooser, (node) => node.props.onClick && !!find(node.props.children, (child) => child.props.children === 'Conta B'));
    pick.props.onClick();
    const editor = required(render(), dialogTitleIs('Nova Transação'));
    expect(find(editor, (node) => React.Children.toArray(node.props.children).join('') === 'Registrar nova transação em Conta B')).toBeDefined();
    required(editor, buttonNamed('Cancelar')).props.onClick();
    expect(find(render(), dialogTitleIs('Nova Transação'))).toBeUndefined();
    expect(writes(calls)).toEqual([]);
  });
});

test('POST do lançamento global vincula Conta B, mantém rascunho após erro e relê a conta escolhida', async () => {
  await exerciseAccounts(async ({ render, calls, feedback, answerWrite }) => {
    await openDetail(render);
    useAppStore.getState().requestNewTransaction();
    const chooser = required(render(), dialogTitleIs('Novo lançamento'));
    required(chooser, (node) => node.props.onClick && !!find(node.props.children, (child) => child.props.children === 'Conta B')).props.onClick();
    const editor = () => required(render(), dialogTitleIs('Nova Transação'));
    const input = (key: string) => required(editor(), byId(`tx-${key}`));
    for (const [key, value] of Object.entries({ description: '  Lançamento B  ', amount: '17.5', date: '2026-05-06' })) {
      input(key).props.onChange({ target: { value } });
    }
    await settle(); // Isola a leitura inicial do detalhe da releitura após a mutação.
    const before = calls.length;
    const send = () => required(editor(), buttonNamed('Registrar')).props.onClick();
    const expected = { url: collection, method: 'POST', body: {
      accountId: 'b', type: 'EXPENSE', description: 'Lançamento B', amount: 17.5, date: '2026-05-06', categoryId: '', notes: '',
    } };
    answerWrite(async () => Response.json({ error: 'Falha sintética' }, { status: 503 }));
    await send();
    expect(calls.slice(before)).toEqual([expected]);
    expect(feedback).toEqual(['erro: Erro ao registrar transação']);
    expect(input('description').props.value).toBe('  Lançamento B  ');
    expect(input('amount').props.value).toBe('17.5');
    expect(input('date').props.value).toBe('2026-05-06');
    answerWrite(async () => new Response(null, { status: 204 }));
    await send();
    expect(find(render(), dialogTitleIs('Nova Transação'))).toBeUndefined();
    expect(writes(calls)).toEqual([expected, expected]);
    expect(calls.slice(before).filter(({ url }) => url.includes('accountId='))).toEqual([{ method: 'GET', url: `${collection}?accountId=b` }]);
  });
});

test('Lançamento sem contas orienta o cadastro, sem gravar ao abrir/cancelar', async () => {
  await exerciseAccounts(async ({ render, calls }) => {
    useAppStore.getState().requestNewTransaction();
    const chooser = required(render(), dialogTitleIs('Novo lançamento'));
    expect(find(chooser, (node) => node.props.children === 'Cadastre uma conta antes de registrar um lançamento.')).toBeDefined();
    required(chooser, buttonNamed('Cadastrar conta')).props.onClick();
    const account = required(render(), dialogTitleIs('Nova Conta'));
    required(account, buttonNamed('Cancelar')).props.onClick();
    expect(find(render(), dialogTitleIs('Nova Conta'))).toBeUndefined();
    expect(writes(calls)).toEqual([]);
  }, []);
});

const qaCards = ['a', 'b'].map((id) => ({
  id,
  name: `Cartão ${id.toUpperCase()}`,
  type: 'CREDIT',
  brand: 'VISA',
  lastFourDigits: id === 'a' ? '1111' : '2222',
  creditLimit: 1000,
  currentBalance: 100,
  closingDay: 1,
  dueDay: 10,
  color: '#8b5cf6',
  flag: '',
}));

async function exerciseCards(onRun: (testbed: {
  render: () => Element;
  calls: Call[];
  feedback: string[];
  answerWrite: (answer: () => Promise<Response>) => void;
  answerPurchases: (answer: (url: string) => Promise<Response>) => void;
}) => Promise<void>, cards = qaCards) {
  const react = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const dispatcher = react.H;
  const { fetch } = globalThis;
  const { success, error } = toast;
  const store = useAppStore.getState();
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: (readonly unknown[] | undefined)[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const calls: Call[] = [];
  const feedback: string[] = [];
  let write = () => Promise.resolve(new Response(null, { status: 204 }));
  let readPurchases = (url: string) => Promise.resolve(Response.json([
    { id: `p-${url}`, merchant: `Compra ${url.split('=')[1]}`, totalAmount: 10, date: '2026-01-15', items: [] },
  ]));
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    left && right && left.length === right.length && left.every((dep, i) => Object.is(dep, right[i]));
  function render() {
    let s = 0, r = 0, e = 0, c = 0;
    const afterRender: (() => void)[] = [];
    react.H = {
      useState(initial: unknown) {
        const i = s++;
        if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], (next: unknown) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[r++] ??= { current }),
      useCallback(fn: unknown, deps: readonly unknown[]) {
        const i = c++;
        if (!sameDeps(callbacks[i]?.deps, deps)) callbacks[i] = { fn, deps };
        return callbacks[i].fn;
      },
      useMemo: (factory: () => unknown) => factory(),
      useDebugValue: () => {},
      useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
      useEffect(fn: () => void, deps?: readonly unknown[]) {
        const i = e++;
        if (!sameDeps(effects[i], deps)) afterRender.push(fn);
        effects[i] = deps;
      },
    };
    try {
      const tree = CardsView();
      afterRender.forEach((fn) => fn());
      return tree as Element;
    } finally { react.H = dispatcher; }
  }
  try {
    useAppStore.setState({ currentView: 'cards', selectedCardId: null });
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
      if (url === '/api/cards' && ['POST', 'PUT', 'DELETE'].includes(method)) return write();
      if (method === 'GET') {
        if (url === '/api/cards') return Response.json(cards);
        if (url.startsWith('/api/purchases?cardId=')) return readPurchases(url);
      }
      throw new Error(`Chamada não prevista pela fixture de Cartões: ${method} ${url}`);
    }) as typeof fetch;
    toast.success = (text) => { feedback.push(`ok: ${text}`); return 'ok'; };
    toast.error = (text) => { feedback.push(`erro: ${text}`); return 'erro'; };
    render();
    await settle();
    await onRun({
      render,
      calls,
      feedback,
      answerWrite: (answer) => { write = answer; },
      answerPurchases: (answer) => { readPurchases = answer; },
    });
  } finally {
    globalThis.fetch = fetch;
    toast.success = success;
    toast.error = error;
    useAppStore.setState(store, true);
  }
}

test('Contas e Cartões usam useKeyedMutationLock compartilhado sem duplicar usePendingMutations', async () => {
  for (const file of ['accounts-view.tsx', 'cards-view.tsx']) {
    const source = await Bun.file(new URL(file, import.meta.url)).text();
    expect(source).toContain("from '@/hooks/use-keyed-mutation-lock'");
    expect(source).toContain('useKeyedMutationLock()');
    expect(source).not.toContain('usePendingMutations');
  }
});

test('Contas CRUD e exclusão de transação: trava síncrona, chaves distintas, liberação em erro e guarda de abertura', async () => {
  await exerciseAccounts(async ({ render, calls, feedback, answerWrite }) => {
    const openCreate = () => required(render(), buttonNamed('Nova conta')).props.onClick({ currentTarget: null });
    const createDialog = () => required(render(), dialogTitleIs('Nova Conta'));

    // Duas ativações síncronas antes de re-renderizar disparam apenas 1 POST e refletem pending.
    openCreate();
    required(createDialog(), byId('account-name')).props.onChange({ target: { value: 'Conta Nova' } });
    const heldCreate = heldResponse();
    answerWrite(() => heldCreate.promise);
    const submitCreate = required(createDialog(), buttonNamed('Criar')).props.onClick;
    submitCreate();
    submitCreate();
    expect(writes(calls)).toHaveLength(1);
    expect(required(createDialog(), buttonNamed('Criar')).props['aria-disabled']).toBe(true);
    heldCreate.reject(new Error('Falha de transporte'));
    await settle();
    expect(feedback.at(-1)).toBe('erro: Erro ao salvar conta');
    expect(required(createDialog(), buttonNamed('Criar')).props['aria-disabled']).toBe(false);

    // Após erro no finally, novo envio funciona e fecha somente a abertura vigente.
    answerWrite(async () => new Response(null, { status: 204 }));
    required(createDialog(), buttonNamed('Criar')).props.onClick();
    await settle();
    expect(find(render(), dialogTitleIs('Nova Conta'))).toBeUndefined();
    expect(feedback.at(-1)).toBe('ok: Conta criada!');

    // Chaves distintas de edição/exclusão progridem independentemente e resposta antiga não fecha abertura B.
    const editA = heldResponse();
    const editB = heldResponse();
    required(render(), nameIs('Editar conta Conta A')).props.onClick({ currentTarget: null });
    let editDialog = required(render(), dialogTitleIs('Editar Conta'));
    required(editDialog, byId('account-name')).props.onChange({ target: { value: 'Conta A Editada' } });
    answerWrite(() => editA.promise);
    required(editDialog, buttonNamed('Atualizar')).props.onClick();
    required(editDialog, buttonNamed('Cancelar')).props.onClick();

    required(render(), nameIs('Editar conta Conta B')).props.onClick({ currentTarget: null });
    editDialog = required(render(), dialogTitleIs('Editar Conta'));
    required(editDialog, byId('account-name')).props.onChange({ target: { value: 'Conta B Editada' } });
    answerWrite(() => editB.promise);
    required(editDialog, buttonNamed('Atualizar')).props.onClick();
    expect(writes(calls)).toHaveLength(4);

    editA.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(required(render(), dialogTitleIs('Editar Conta'))).toBeDefined();
    expect(required(required(render(), dialogTitleIs('Editar Conta')), byId('account-name')).props.value).toBe('Conta B Editada');
    editB.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(find(render(), dialogTitleIs('Editar Conta'))).toBeUndefined();

    // Exclusão de conta: duas ativações síncronas antes do render + liberação no erro + exclusão de transação.
    const delHeld = heldResponse();
    required(render(), nameIs('Excluir conta Conta A')).props.onClick({ currentTarget: null });
    const delDialog = () => required(render(), dialogTitleIs('Excluir conta?'));
    answerWrite(() => delHeld.promise);
    const confirmDelete = required(delDialog(), buttonNamed('Excluir')).props.onClick;
    confirmDelete({ preventDefault() {} });
    confirmDelete({ preventDefault() {} });
    expect(writes(calls)).toHaveLength(5);
    expect(required(delDialog(), buttonNamed('Excluir')).props['aria-disabled']).toBe(true);
    delHeld.resolve(Response.json({ error: 'Bloqueio sintético' }, { status: 503 }));
    await settle();
    expect(feedback.at(-1)).toBe('erro: Bloqueio sintético');
    expect(required(delDialog(), buttonNamed('Excluir')).props['aria-disabled']).toBe(false);
    delDialog().props.onOpenChange(false);

    // Transferência: duas ativações síncronas antes do render -> 1 envio; erro libera em finally.
    required(render(), buttonNamed('Transferir')).props.onClick({ currentTarget: null });
    const transferDialog = () => required(render(), dialogTitleIs('Transferir entre Contas'));
    const transferSelect = (selectId: string) =>
      find(transferDialog(), (node) => node.props.onValueChange && !!find(node.props.children, byId(selectId)))!;
    transferSelect('transfer-from').props.onValueChange('a');
    transferSelect('transfer-to').props.onValueChange('b');
    required(transferDialog(), byId('transfer-amount')).props.onChange({ target: { value: '5' } });
    const transferHeld = heldResponse();
    answerWrite(() => transferHeld.promise);
    const submitTransfer = required(transferDialog(), buttonNamed('Transferir')).props.onClick;
    submitTransfer();
    submitTransfer();
    expect(writes(calls)).toHaveLength(6);
    expect(required(transferDialog(), buttonNamed('Transferir')).props['aria-disabled']).toBe(true);
    transferHeld.resolve(Response.json({ error: 'Saldo insuficiente' }, { status: 503 }));
    await settle();
    expect(feedback.at(-1)).toBe('erro: Saldo insuficiente');
    expect(required(transferDialog(), buttonNamed('Transferir')).props['aria-disabled']).toBe(false);
    required(transferDialog(), buttonNamed('Cancelar')).props.onClick();

    await openDetail(render);
    const txDelHeld = heldResponse();
    required(render(), nameIs('Excluir transação Transação sintética')).props.onClick({ currentTarget: null });
    const txDelDialog = () => required(render(), dialogTitleIs('Excluir transação?'));
    answerWrite(() => txDelHeld.promise);
    const confirmTxDelete = required(txDelDialog(), buttonNamed('Excluir')).props.onClick;
    confirmTxDelete({ preventDefault() {} });
    confirmTxDelete({ preventDefault() {} });
    expect(writes(calls)).toHaveLength(7);
    expect(required(txDelDialog(), buttonNamed('Excluir')).props['aria-disabled']).toBe(true);
    txDelHeld.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(find(render(), dialogTitleIs('Excluir transação?'))).toBeUndefined();
    expect(feedback.at(-1)).toBe('ok: Transação excluída!');
  });
});

test('Cartões: trava síncrona em POST/PUT/DELETE, chaves distintas, liberação em erro e isolamento de compras', async () => {
  await exerciseCards(async ({ render, calls, feedback, answerWrite, answerPurchases }) => {
    // POST: duas ativações síncronas antes do render -> 1 envio; erro libera e permite retry.
    required(render(), buttonNamed('Novo cartão')).props.onClick({ currentTarget: null });
    const createDialog = () => required(render(), dialogTitleIs('Novo Cartão'));
    required(createDialog(), byId('card-name')).props.onChange({ target: { value: 'Cartão Novo' } });
    const heldCreate = heldResponse();
    answerWrite(() => heldCreate.promise);
    const submitCreate = required(createDialog(), buttonNamed('Adicionar')).props.onClick;
    submitCreate();
    submitCreate();
    expect(writes(calls)).toHaveLength(1);
    expect(required(createDialog(), buttonNamed('Adicionar')).props['aria-disabled']).toBe(true);
    heldCreate.resolve(new Response(null, { status: 503 }));
    await settle();
    expect(feedback.at(-1)).toBe('erro: Erro ao salvar cartão');
    expect(required(createDialog(), buttonNamed('Adicionar')).props['aria-disabled']).toBe(false);

    answerWrite(async () => new Response(null, { status: 204 }));
    required(createDialog(), buttonNamed('Adicionar')).props.onClick();
    await settle();
    expect(find(render(), dialogTitleIs('Novo Cartão'))).toBeUndefined();
    expect(feedback.at(-1)).toBe('ok: Cartão adicionado!');

    // PUT: chaves distintas edit:a e edit:b progridem em paralelo; resposta de A não fecha B.
    const editA = heldResponse();
    const editB = heldResponse();
    required(render(), nameIs('Editar cartão Cartão A')).props.onClick({ currentTarget: null });
    let editDialog = required(render(), dialogTitleIs('Editar Cartão'));
    required(editDialog, byId('card-name')).props.onChange({ target: { value: 'Cartão A Editado' } });
    answerWrite(() => editA.promise);
    required(editDialog, buttonNamed('Atualizar')).props.onClick();
    required(editDialog, buttonNamed('Cancelar')).props.onClick();

    required(render(), nameIs('Editar cartão Cartão B')).props.onClick({ currentTarget: null });
    editDialog = required(render(), dialogTitleIs('Editar Cartão'));
    required(editDialog, byId('card-name')).props.onChange({ target: { value: 'Cartão B Editado' } });
    answerWrite(() => editB.promise);
    required(editDialog, buttonNamed('Atualizar')).props.onClick();
    expect(writes(calls)).toHaveLength(4);

    editA.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(required(render(), dialogTitleIs('Editar Cartão'))).toBeDefined();
    expect(required(required(render(), dialogTitleIs('Editar Cartão')), byId('card-name')).props.value).toBe('Cartão B Editado');
    editB.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(find(render(), dialogTitleIs('Editar Cartão'))).toBeUndefined();

    // DELETE: clique duplo síncrono dispara 1 chamada, rejeição libera no finally e reabertura funciona.
    const delHeld = heldResponse();
    required(render(), nameIs('Excluir cartão Cartão A')).props.onClick({ currentTarget: null });
    const delDialog = () => required(render(), dialogTitleIs('Excluir cartão?'));
    answerWrite(() => delHeld.promise);
    const confirmDelete = required(delDialog(), buttonNamed('Excluir')).props.onClick;
    confirmDelete({ preventDefault() {} });
    confirmDelete({ preventDefault() {} });
    expect(writes(calls)).toHaveLength(5);
    expect(required(delDialog(), buttonNamed('Excluir')).props['aria-disabled']).toBe(true);
    delHeld.reject(new Error('Falha de transporte'));
    await settle();
    expect(feedback.at(-1)).toBe('erro: Erro ao excluir cartão');
    expect(required(delDialog(), buttonNamed('Excluir')).props['aria-disabled']).toBe(false);

    answerWrite(async () => new Response(null, { status: 204 }));
    required(delDialog(), buttonNamed('Excluir')).props.onClick({ preventDefault() {} });
    await settle();
    expect(find(render(), dialogTitleIs('Excluir cartão?'))).toBeUndefined();
    expect(feedback.at(-1)).toBe('ok: Cartão excluído!');

    // Compras de outro cartão não vazam quando a resposta chega atrasada.
    const purA = heldResponse();
    const purB = heldResponse();
    answerPurchases((url) => (url.endsWith('=a') ? purA.promise : purB.promise));
    required(render(), nameIs('Abrir cartão Cartão A')).props.onClick();
    required(render(), (node) => node.props.onClick && React.Children.toArray(node.props.children).includes(' Voltar para cartões')).props.onClick();
    required(render(), nameIs('Abrir cartão Cartão B')).props.onClick();
    purB.resolve(Response.json([{ id: 'pb', merchant: 'Compra B Vigente', totalAmount: 25, date: '2026-01-15', items: [] }]));
    await settle();
    purA.resolve(Response.json([{ id: 'pa', merchant: 'Compra A Atrasada', totalAmount: 99, date: '2026-01-15', items: [] }]));
    await settle();
    expect(find(render(), (node) => node.props.children === 'Compra B Vigente')).toBeDefined();
    expect(find(render(), (node) => node.props.children === 'Compra A Atrasada')).toBeUndefined();
  });
});
