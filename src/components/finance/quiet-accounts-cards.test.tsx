/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { toast } from 'sonner';
import { readFileSync } from 'node:fs';
import { useAppStore } from '@/lib/store';
import { AccountsView, reconcileTransactionDraft, transactionDraftForAccount } from './accounts-view';
import { AccountPicker } from './account-picker';
import { AccountTransferDialog } from './account-transfer-dialog';
import { CardsView } from './cards-view';
import { CardEditor } from './card-editor';
import { FinanceConfirmationDialogShell, FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { AlertDialogContent } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceRow } from '@/components/shared/finance-row';
import { QueryPanel } from '@/components/shared/query-panel';
import { renderWithIntl } from '@/test-utils/intl';
import { CANONICAL_LOCALES, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { AppIntlBridgeContext } from '@/i18n/provider';

function ptUseContext(ctx: React.Context<unknown>, locale: CanonicalLocale = 'pt') {
  return ctx === AppIntlBridgeContext
    ? { locale, messages: getMessagesForLocale(locale) }
    : (ctx as unknown as { _currentValue?: unknown })._currentValue;
}

function withPtIntlDispatcher<T>(fn: () => T, locale: CanonicalLocale = 'pt'): T {
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.H;
  internals.H = {
    useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx, locale),
    useId: () => 'test-id',
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (cb: unknown) => cb,
  };
  try {
    return fn();
  } finally {
    internals.H = previous;
  }
}

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
  ['Contas', accountView, "t('summary.ariaLabel')", "t('list.title')"],
  ['Cartões', cardView, "t('summary.ariaLabel')", "t('list.title')"],
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
  expect(namedAction(accountView, 'openAccount(acc)', "t('list.openAccountAria'")).toBe(true);
  expect(namedAction(accountView, 'openEditAccount(acc)', "t('list.editAccountAria'")).toBe(true);
  expect(namedAction(accountView, 'setShowDeleteDialog(acc.id)', "t('list.deleteAccountAria'")).toBe(true);
  expect(namedAction(accountView, 'openTransaction(selectedAccount.id)', "t('actions.newTransaction')")).toBe(true);
  expect(namedAction(accountView, 'setShowTransferDialog(true)', "t('actions.transfer')")).toBe(true);
});

test('Cartões: detalhe, cópia, edição, exclusão e expansor de compra têm controles acessíveis', async () => {
  await exerciseCards(async ({ render }) => {
    const listTree = render();
    expect(required(listTree, nameIs('Abrir cartão Cartão A'))).toBeDefined();
    expect(required(listTree, nameIs('Copiar número mascarado de Cartão A'))).toBeDefined();
    expect(required(listTree, nameIs('Editar cartão Cartão A'))).toBeDefined();
    expect(required(listTree, nameIs('Excluir cartão Cartão A'))).toBeDefined();

    required(listTree, nameIs('Abrir cartão Cartão A')).props.onClick();
    render();
    await settle();

    const detailTree = render();
    const trigger = required(detailTree, (node) => node.type === 'button' && Boolean(node.props['aria-controls']) && node.props['aria-expanded'] !== undefined);
    expect(trigger.props['aria-expanded']).toBe(false);
    expect(trigger.props['aria-controls']).toBe('card-purchase-p-/api/purchases?cardId=a');
    trigger.props.onClick();
    const expandedTrigger = required(render(), (node) => node.type === 'button' && node.props['aria-controls'] === 'card-purchase-p-/api/purchases?cardId=a');
    expect(expandedTrigger.props['aria-expanded']).toBe(true);
  });
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
  expect(source).toContain("t('detail.loadingTransactions')");
  expect(source).toContain("t('errors.loadTransactions')");
});

test('Cartões consome selectedCardId da store, trata loading/erro/retry e valida nome do cartão', async () => {
  const source = await Bun.file(new URL('cards-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedCardId');
  expect(source).toContain('setSelectedCardId');
  expect(source).toContain("t('errors.loadCards')");
  expect(source).toContain("t('errors.loadPurchases')");
  expect(source).toContain("t('detail.loadingPurchases')");
  expect(source).toContain("t('errors.nameRequired')");
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

function find(node: ReactNode, match: (element: Element) => boolean, locale: CanonicalLocale = 'pt'): Element | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Element['props']>(child)) continue;
    if (match(child)) return child;
    // Só expande as folhas próprias, sem simular componentes Radix ou DOM.
    let expanded = child.props.children;
    if (typeof child.type === 'function') {
      if (
        child.type.name === 'AccountTransactionFields'
        || child.type.name === 'CardRow'
        || child.type.name === 'CardPurchaseRow'
        || child.type === AccountPicker
        || child.type === AccountTransferDialog
        || child.type === CardEditor
        || child.type === FinanceFormDialogShell
        || child.type === FinanceConfirmationDialogShell
        || child.type === QueryPanel
      ) {
        expanded = withPtIntlDispatcher(() => (child.type as (props: Element['props']) => ReactNode)(child.props), locale);
      }
    }
    const nested = find(expanded, match, locale);
    if (nested) return nested;
  }
}
const required = (node: ReactNode, match: (element: Element) => boolean, locale: CanonicalLocale = 'pt') => {
  const result = find(node, match, locale);
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
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx),
      useId: () => 'test-id',
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
      required(render(), (node) => node.props.onClick && React.Children.toArray(node.props.children).includes('Voltar para contas')).props.onClick();
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
}) => Promise<void>, cards = qaCards, locale: CanonicalLocale = 'pt') {
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
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx, locale),
      useId: () => 'test-id',
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
    required(render(), (node) => node.props.onClick && React.Children.toArray(node.props.children).includes('Voltar para cartões')).props.onClick();
    required(render(), nameIs('Abrir cartão Cartão B')).props.onClick();
    purB.resolve(Response.json([{ id: 'pb', merchant: 'Compra B Vigente', totalAmount: 25, date: '2026-01-15', items: [] }]));
    await settle();
    purA.resolve(Response.json([{ id: 'pa', merchant: 'Compra A Atrasada', totalAmount: 99, date: '2026-01-15', items: [] }]));
    await settle();
    expect(find(render(), (node) => node.props.children === 'Compra B Vigente')).toBeDefined();
    expect(find(render(), (node) => node.props.children === 'Compra A Atrasada')).toBeUndefined();
  });
});

test('Contas e Cartões adotam FinanceMetric e FinanceRow com variantes, semântica, ações e máscara', async () => {
  const accountsSrc = await Bun.file(new URL('accounts-view.tsx', import.meta.url)).text();
  const cardsSrc = await Bun.file(new URL('cards-view.tsx', import.meta.url)).text();
  expect(accountsSrc).toContain("from '@/components/shared/finance-metric'");
  expect(accountsSrc).toContain("from '@/components/shared/finance-row'");
  expect(accountsSrc).not.toContain('function AccountMetric');
  expect(cardsSrc).toContain("from '@/components/shared/finance-metric'");
  expect(cardsSrc).not.toContain('function CardMetric');

  const metricHtml = renderToStaticMarkup(
    <dl>
      <FinanceMetric variant="strip" label="Saldo em contas" value="R$ 1.500,00" />
      <FinanceMetric variant="cell" label="Limite" value="R$ 3.000,00" />
      <FinanceMetric variant="compact" label="Disponível" value="R$ 1.200,00" showValues={false} ariaLabel="Disponível R$ 1.200,00" />
    </dl>,
  );
  expect(metricHtml).toContain('<dt');
  expect(metricHtml).toContain('<dd');
  expect(metricHtml).toContain('Saldo em contas');
  expect(metricHtml).toContain('R$ 1.500,00');
  expect(metricHtml).toContain('R$ 3.000,00');
  expect(metricHtml).toContain('R$ ••••••');
  expect(metricHtml).not.toMatch(/1\.?200/);

  const rowHtml = renderToStaticMarkup(
    <ul>
      <FinanceRow
        variant="default"
        tone="positive"
        description="Depósito"
        metadata="Receita · 03/02/2026 · Salário"
        amount={2500}
        actions={<button type="button" aria-label="Editar transação Depósito">Editar</button>}
      />
    </ul>,
  );
  expect(rowHtml).toMatch(/^<ul><li\b/);
  expect(rowHtml).toContain('Depósito');
  expect(rowHtml).toContain('Receita · 03/02/2026 · Salário');
  expect(rowHtml).toContain('+R$');
  expect(rowHtml).toContain('--ds-accent-positive');
  expect(rowHtml).toContain('aria-label="Editar transação Depósito"');

  await exerciseAccounts(async ({ render }) => {
    await openDetail(render);
    const tree = render();
    const row = find(tree, (node) => node.type === FinanceRow);
    expect(row).toBeDefined();
    expect(required(tree, nameIs('Editar transação Transação sintética'))).toBeDefined();
    expect(required(tree, nameIs('Excluir transação Transação sintética'))).toBeDefined();
  });
});

test('CardEditor adota FinanceFormDialogShell, alterna variantes criar/editar e oculta crédito no débito', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const changes: [string, string][] = [];
  const baseForm = {
    name: 'Cartão Teste',
    type: 'CREDIT',
    brand: 'VISA',
    lastFourDigits: '4321',
    creditLimit: '2500',
    closingDay: '5',
    dueDay: '15',
    color: '#8b5cf6',
    flag: 'Banco X',
  };

  const createTree = withPtIntlDispatcher(() =>
    CardEditor({
      mode: 'create',
      open: true,
      pending: false,
      form: baseForm,
      onFieldChange: (field, value) => changes.push([field, value]),
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );
  expect(createTree.type).toBe(FinanceFormDialogShell);
  expect(createTree.props.title).toBe('Novo Cartão');
  expect(find(createTree, byId('card-limit'))).toBeDefined();
  expect(find(createTree, buttonNamed('Adicionar'))?.props['aria-disabled']).toBe(false);

  const editDebitTree = withPtIntlDispatcher(() =>
    CardEditor({
      mode: 'edit',
      open: true,
      pending: true,
      form: { ...baseForm, type: 'DEBIT' },
      onFieldChange: (field, value) => changes.push([field, value]),
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );
  expect(editDebitTree.type).toBe(FinanceFormDialogShell);
  expect(editDebitTree.props.title).toBe('Editar Cartão');
  expect(find(editDebitTree, byId('card-limit'))).toBeUndefined();
  expect(find(editDebitTree, buttonNamed('Atualizar'))?.props['aria-disabled']).toBe(true);
  required(editDebitTree, byId('card-name')).props.onChange({ target: { value: 'Novo Nome' } });
  expect(changes).toEqual([['name', 'Novo Nome']]);
});

test('Cartões adota QueryPanel e FinanceConfirmationDialogShell, e isola falha/carregamento ao trocar de cartão em voo', async () => {
  const cardsSrc = await Bun.file(new URL('cards-view.tsx', import.meta.url)).text();
  expect(cardsSrc).toContain("from '@/components/shared/query-panel'");
  expect(cardsSrc).toContain("from '@/components/shared/finance-dialog-shell'");
  expect(cardsSrc).toContain("from './card-editor'");

  await exerciseCards(async ({ render, answerPurchases }) => {
    const purA = heldResponse();
    const purB = heldResponse();
    answerPurchases((url) => (url.endsWith('=a') ? purA.promise : purB.promise));

    required(render(), nameIs('Abrir cartão Cartão A')).props.onClick();
    let tree = render();
    expect(find(tree, (node) => node.type === QueryPanel && node.props.status === 'loading')).toBeDefined();
    expect(required(tree, (node) => node.props.role === 'status' && node.props.children === 'Carregando compras do cartão…')).toBeDefined();

    // Troca para Cartão B enquanto Cartão A ainda carrega.
    required(tree, (node) => node.props.onClick && React.Children.toArray(node.props.children).includes('Voltar para cartões')).props.onClick();
    required(render(), nameIs('Abrir cartão Cartão B')).props.onClick();
    tree = render();
    expect(find(tree, (node) => node.type === QueryPanel && node.props.status === 'loading')).toBeDefined();

    // Erro tardio de Cartão A (503/rejeição) não encerra o loading nem exibe erro em Cartão B.
    purA.reject(new Error('Falha tardia de A'));
    await settle();
    tree = render();
    expect(find(tree, (node) => node.type === QueryPanel && node.props.status === 'loading')).toBeDefined();
    expect(find(tree, (node) => node.props.role === 'alert')).toBeUndefined();

    // Erro no cartão vigente B exibe estado de erro e permite retry só de leitura.
    purB.resolve(new Response(null, { status: 503 }));
    await settle();
    tree = render();
    expect(find(tree, (node) => node.type === QueryPanel && node.props.status === 'error')).toBeDefined();
    answerPurchases(async () => Response.json([{ id: 'pb-ok', merchant: 'Compra B Retry', totalAmount: 30, date: '2026-01-15', items: [] }]));
    required(tree, buttonNamed('Tentar novamente')).props.onClick();
    await settle();
    expect(find(render(), (node) => node.props.children === 'Compra B Retry')).toBeDefined();
  });
});

test('AccountPicker preserva showCloseButton={false}, estados loading/erro/vazio/lista e seleção sem gravar', () => {
  let selectedId = '';
  let retried = 0;
  let created = 0;
  let closed = 0;
  const onCloseAutoFocus = () => {};

  const listPicker = withPtIntlDispatcher(() =>
    AccountPicker({
      open: true,
      loading: false,
      loadFailed: false,
      accounts: qaAccounts,
      onRetry: () => { retried++; },
      onCreateAccount: () => { created++; },
      onSelectAccount: (acc) => { selectedId = acc.id; },
      onClose: () => { closed++; },
      onCloseAutoFocus,
    }),
  );
  expect(listPicker.type).toBe(Dialog);
  const content = find(listPicker, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(false);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  required(listPicker, (e) => e.props.onClick && !!find(e.props.children, (c) => c.props.children === 'Conta B')).props.onClick();
  expect(selectedId).toBe('b');

  const errorPicker = withPtIntlDispatcher(() =>
    AccountPicker({
      open: true,
      loading: false,
      loadFailed: true,
      accounts: [],
      onRetry: () => { retried++; },
      onCreateAccount: () => { created++; },
      onSelectAccount: () => {},
      onClose: () => { closed++; },
      onCloseAutoFocus,
    }),
  );
  required(errorPicker, buttonNamed('Tentar novamente')).props.onClick();
  expect(retried).toBe(1);

  const emptyPicker = withPtIntlDispatcher(() =>
    AccountPicker({
      open: true,
      loading: false,
      loadFailed: false,
      accounts: [],
      onRetry: () => {},
      onCreateAccount: () => { created++; },
      onSelectAccount: () => {},
      onClose: () => {},
      onCloseAutoFocus,
    }),
  );
  required(emptyPicker, buttonNamed('Cadastrar conta')).props.onClick();
  expect(created).toBe(1);

  listPicker.props.onOpenChange(false);
  expect(closed).toBe(1);
});

test('AccountTransferDialog adota FinanceFormDialogShell, filtra origem/destino opostos e preserva pendência', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const changes: [string, string][] = [];
  const element = withPtIntlDispatcher(() =>
    AccountTransferDialog({
      open: true,
      pending: true,
      form: {
        fromAccountId: 'a',
        toAccountId: '',
        amount: '50',
        date: '2026-05-01',
        description: 'Reserva',
      },
      accounts: qaAccounts,
      onFieldChange: (field, value) => changes.push([field, value]),
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.onOpenChange).toBe(onOpenChange);
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const submitBtn = find(element, buttonNamed('Transferir'));
  expect(submitBtn?.props['aria-disabled']).toBe(true);
  expect(submitBtn?.props.disabled).toBe(true); // toAccountId vazio desabilita envio
  const toSelect = find(element, (node) => node.props.onValueChange && !!find(node.props.children, byId('transfer-to')))!;
  expect(find(toSelect, (node) => node.props.value === 'a')).toBeUndefined();
  expect(find(toSelect, (node) => node.props.value === 'b')).toBeDefined();
  toSelect.props.onValueChange('b');
  expect(changes).toEqual([['toAccountId', 'b']]);
});

function assignRef(element: Element, value: unknown) {
  const ref = (element.props.ref ?? (element as unknown as { ref?: { current: unknown } }).ref) as { current: unknown } | undefined;
  if (!ref) throw new Error('Ref esperada no controle sobrevivente');
  ref.current = value;
}

test('Contas: DELETE 2xx limpa dialogReturn e foca Nova conta mesmo com botão da linha conectado, preservando retorno em cancelamento e falha', async () => {
  await exerciseAccounts(async ({ render, feedback, answerWrite }) => {
    const focused: string[] = [];
    const fallbackTarget = { isConnected: true, focus() { focused.push('Nova conta'); } };
    const rowTrigger = { isConnected: true, focus() { focused.push('Excluir conta Conta A'); } };
    const fakeCloseEvent = { preventDefault() {} } as unknown as Event;

    const attachFallback = () => assignRef(required(render(), buttonNamed('Nova conta')), fallbackTarget);
    const deleteAlert = () => required(render(), (node) => node.type === AlertDialogContent
      && Boolean(find(node.props.children, (child) => React.Children.toArray(child.props.children).includes('Excluir conta?'))));
    const openDelete = () => {
      attachFallback();
      required(render(), nameIs('Excluir conta Conta A')).props.onClick({ currentTarget: rowTrigger });
    };

    // 1) Cancelamento mantém retorno ao acionador da linha
    openDelete();
    required(render(), dialogTitleIs('Excluir conta?')).props.onOpenChange(false);
    deleteAlert().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir conta Conta A']);

    // 2) Falha HTTP de DELETE preserva dialogReturn e retorna ao acionador ao fechar
    openDelete();
    answerWrite(async () => Response.json({ error: 'Falha sintética' }, { status: 503 }));
    await required(required(render(), dialogTitleIs('Excluir conta?')), buttonNamed('Excluir')).props.onClick({ preventDefault() {} });
    await settle();
    expect(feedback.at(-1)).toBe('erro: Falha sintética');
    expect(find(render(), dialogTitleIs('Excluir conta?'))).toBeDefined();
    required(render(), dialogTitleIs('Excluir conta?')).props.onOpenChange(false);
    deleteAlert().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir conta Conta A', 'Excluir conta Conta A']);

    // 3) DELETE 2xx com botão da linha ainda conectado (GET tardio) limpa dialogReturn e foca Nova conta
    openDelete();
    answerWrite(async () => new Response(null, { status: 204 }));
    await required(required(render(), dialogTitleIs('Excluir conta?')), buttonNamed('Excluir')).props.onClick({ preventDefault() {} });
    await settle();
    expect(find(render(), dialogTitleIs('Excluir conta?'))).toBeUndefined();
    deleteAlert().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir conta Conta A', 'Excluir conta Conta A', 'Nova conta']);
  });
});

test('Cartões: DELETE 2xx limpa dialogReturn e foca Novo cartão mesmo com botão da linha conectado, preservando retorno em cancelamento e falha', async () => {
  await exerciseCards(async ({ render, feedback, answerWrite }) => {
    const focused: string[] = [];
    const fallbackTarget = { isConnected: true, focus() { focused.push('Novo cartão'); } };
    const rowTrigger = { isConnected: true, focus() { focused.push('Excluir cartão Cartão A'); } };
    const fakeCloseEvent = { preventDefault() {} } as unknown as Event;

    const attachFallback = () => assignRef(required(render(), buttonNamed('Novo cartão')), fallbackTarget);
    const deleteShell = () => required(render(), (node) => node.type === FinanceConfirmationDialogShell);
    const openDelete = () => {
      attachFallback();
      required(render(), nameIs('Excluir cartão Cartão A')).props.onClick({ currentTarget: rowTrigger });
    };

    // 1) Cancelamento mantém retorno ao acionador da linha
    openDelete();
    deleteShell().props.onOpenChange(false);
    deleteShell().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir cartão Cartão A']);

    // 2) Falha HTTP de DELETE preserva dialogReturn e retorna ao acionador ao fechar
    openDelete();
    answerWrite(async () => new Response(null, { status: 503 }));
    await required(required(render(), dialogTitleIs('Excluir cartão?')), buttonNamed('Excluir')).props.onClick({ preventDefault() {} });
    await settle();
    expect(feedback.at(-1)).toBe('erro: Erro ao excluir cartão');
    expect(find(render(), dialogTitleIs('Excluir cartão?'))).toBeDefined();
    deleteShell().props.onOpenChange(false);
    deleteShell().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir cartão Cartão A', 'Excluir cartão Cartão A']);

    // 3) DELETE 2xx com botão da linha ainda conectado (GET tardio) limpa dialogReturn e foca Novo cartão
    openDelete();
    answerWrite(async () => new Response(null, { status: 204 }));
    await required(required(render(), dialogTitleIs('Excluir cartão?')), buttonNamed('Excluir')).props.onClick({ preventDefault() {} });
    await settle();
    expect(find(render(), dialogTitleIs('Excluir cartão?'))).toBeUndefined();
    deleteShell().props.onCloseAutoFocus(fakeCloseEvent);
    expect(focused).toEqual(['Excluir cartão Cartão A', 'Excluir cartão Cartão A', 'Novo cartão']);
  });
});

test('Task 1.3: AccountsView saveTransfer trata resposta 503 não-JSON com Erro na transferência mantendo diálogo aberto sem releitura', async () => {
  await exerciseAccounts(async ({ render, calls, feedback, answerWrite }) => {
    const initialGets = calls.filter(({ method }) => method === 'GET').length;
    required(render(), buttonNamed('Transferir')).props.onClick({ currentTarget: null });
    const transferDialog = () => required(render(), dialogTitleIs('Transferir entre Contas'));
    const transferSelect = (selectId: string) =>
      find(transferDialog(), (node) => node.props.onValueChange && !!find(node.props.children, byId(selectId)))!;

    transferSelect('transfer-from').props.onValueChange('a');
    transferSelect('transfer-to').props.onValueChange('b');
    required(transferDialog(), byId('transfer-amount')).props.onChange({ target: { value: '25' } });

    answerWrite(async () => new Response('não JSON', { status: 503 }));
    required(transferDialog(), buttonNamed('Transferir')).props.onClick();
    await settle();

    expect(feedback).toEqual(['erro: Erro na transferência']);
    expect(find(render(), dialogTitleIs('Transferir entre Contas'))).toBeDefined();
    expect(writes(calls)).toHaveLength(1);
    expect(calls.filter(({ method }) => method === 'GET').length).toBe(initialGets);
  });
});

test('renderiza AccountsView, CardsView e showValues=false sem vazar dígitos em pt, es e en', () => {
  const expected = {
    pt: { accountsLoading: 'Carregando contas…', cardsLoading: 'Carregando cartões…', available: 'Disponível' },
    es: { accountsLoading: 'Cargando cuentas…', cardsLoading: 'Cargando tarjetas…', available: 'Disponible' },
    en: { accountsLoading: 'Loading accounts…', cardsLoading: 'Loading cards…', available: 'Available' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const accountsHtml = renderWithIntl(<AccountsView refreshCounter={0} onLaunchClose={() => {}} />, locale);
    expect(accountsHtml).toContain(expected[locale].accountsLoading);
    expect(accountsHtml).not.toContain('MISSING_MESSAGE');

    const cardsHtml = renderWithIntl(<CardsView />, locale);
    expect(cardsHtml).toContain(expected[locale].cardsLoading);
    expect(cardsHtml).not.toContain('MISSING_MESSAGE');

    const maskedHtml = renderWithIntl(
      <dl>
        <FinanceMetric variant="compact" label={expected[locale].available} value="R$ 1.200,00" showValues={false} ariaLabel={`${expected[locale].available} R$ 1.200,00`} />
      </dl>,
      locale,
    );
    expect(maskedHtml).not.toMatch(/1\.?200/);
    for (const [, label] of maskedHtml.matchAll(/aria-label="([^"]*)"/g)) {
      expect(label).not.toMatch(/\d/);
    }
  }
});

test('Cartões omite fatura, limite, disponibilidade, uso e ciclo em cartões DEBIT na lista e no detalhe em pt, es e en', async () => {
  const mixedCards = [
    {
      id: 'credit-1',
      name: 'Crédito Principal',
      type: 'CREDIT',
      brand: 'VISA',
      lastFourDigits: '1111',
      creditLimit: 5000,
      currentBalance: 450,
      closingDay: 5,
      dueDay: 15,
      color: '#8b5cf6',
      flag: 'Banco QA',
    },
    {
      id: 'debit-1',
      name: 'Débito Conta',
      type: 'DEBIT',
      brand: 'ELO',
      lastFourDigits: '9876',
      creditLimit: 0,
      currentBalance: 0,
      closingDay: 1,
      dueDay: 10,
      color: '#0ea5e9',
      flag: 'Banco Débito',
    },
  ];
  const expectedByLocale = {
    pt: {
      openAria: 'Abrir cartão Débito Conta',
      debitSubtitle: 'Modalidade débito',
      debitMode: 'Débito à vista',
      debitNoCredit: 'Movimentação vinculada ao saldo da conta',
      debitNotice: 'Cartão na modalidade débito: compras registradas diretamente sem ciclo de crédito.',
      purchasesTitle: 'Compras no cartão',
      creditTerms: ['Fecha dia', 'Vence dia', 'Fatura atual', 'Disponível', 'Uso do limite', 'Fechamento', 'Vencimento'],
    },
    es: {
      openAria: 'Abrir tarjeta Débito Conta',
      debitSubtitle: 'Modalidad débito',
      debitMode: 'Débito al contado',
      debitNoCredit: 'Movimientos vinculados al saldo de la cuenta',
      debitNotice: 'Tarjeta en modalidad débito: compras registradas directamente sin ciclo de crédito.',
      purchasesTitle: 'Compras en la tarjeta',
      creditTerms: ['Cierra día', 'Vence día', 'Factura actual', 'Disponible', 'Uso del límite', 'Cierre', 'Vencimiento'],
    },
    en: {
      openAria: 'Open card Débito Conta',
      debitSubtitle: 'Debit mode',
      debitMode: 'Debit card',
      debitNoCredit: 'Purchases linked to account balance',
      debitNotice: 'Debit mode card: purchases are recorded directly without a credit billing cycle.',
      purchasesTitle: 'Card purchases',
      creditTerms: ['Closes day', 'Due day', 'Current statement', 'Available', 'Limit usage', 'Closing', 'Due'],
    },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const spec = expectedByLocale[locale];
    await exerciseCards(async ({ render }) => {
      const listTree = render();
      const debitRow = find(
        listTree,
        (node) => typeof node.type === 'function' && node.type.name === 'CardRow' && node.props.card?.id === 'debit-1',
      );
      expect(debitRow).toBeDefined();
      const rowHtml = renderWithIntl(debitRow!, locale);
      expect(rowHtml).toContain('Débito Conta');
      expect(rowHtml).toContain('•••• •••• •••• 9876');
      expect(rowHtml).toContain(spec.debitSubtitle);
      expect(rowHtml).toContain(spec.debitMode);
      expect(rowHtml).toContain(spec.debitNoCredit);
      expect(rowHtml).not.toContain('role="progressbar"');
      for (const forbidden of spec.creditTerms) {
        expect(rowHtml).not.toContain(forbidden);
      }

      required(listTree, nameIs(spec.openAria), locale).props.onClick();
      render();
      await settle();
      const detailTree = render();
      const detailHtml = renderWithIntl(detailTree, locale);
      expect(detailHtml).toContain('Débito Conta');
      expect(detailHtml).toContain('•••• •••• •••• 9876');
      expect(detailHtml).toContain(spec.debitNotice);
      expect(detailHtml).toContain(spec.purchasesTitle);
      expect(detailHtml).toContain('Compra debit-1');
      expect(detailHtml).not.toContain('role="progressbar"');
      for (const forbidden of spec.creditTerms) {
        expect(detailHtml).not.toContain(forbidden);
      }
    }, mixedCards, locale);
  }
});
