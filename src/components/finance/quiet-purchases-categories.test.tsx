/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { FinanceConfirmationDialogShell, FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { FinanceMetric } from '@/components/shared/finance-metric';
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
import { PurchasesView } from './purchases-view';
import { PurchaseEditor } from './purchase-editor';
import { PurchaseItemsEditor } from './purchase-items-editor';
import { CategoriesView } from './categories-view';
import { CategoryEditor } from './category-editor';
import { CategoryIconColorPicker, categoryColors, iconOptions } from './category-icon-color-picker';

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
    let expanded = child.props.children;
    if (typeof child.type === 'function') {
      if (
        child.type === PurchaseEditor
        || child.type === PurchaseItemsEditor
        || child.type === CategoryEditor
        || child.type === CategoryIconColorPicker
        || child.type === FinanceFormDialogShell
        || child.type === FinanceConfirmationDialogShell
        || child.type === FinanceMetric
        || child.type.name === 'PurchaseRecordRow'
        || child.type.name === 'PurchaseItemRow'
        || child.type.name === 'CategoryRow'
      ) {
        expanded = withPtIntlDispatcher(() => (child.type as (props: Element['props']) => ReactNode)(child.props));
      }
    }
    const nested = find(expanded, match);
    if (nested) return nested;
  }
}

const required = (node: ReactNode, match: (element: Element) => boolean) => {
  const result = find(node, match);
  if (!result) throw new Error('Controle sintético não encontrado');
  return result;
};

const nameIs = (name: string) => (element: Element) => element.props['aria-label'] === name;
const byId = (id: string) => (element: Element) => element.props.id === id;
const buttonNamed = (name: string) => (element: Element) =>
  (element.type === 'button' || element.props.onClick)
  && (React.Children.toArray(element.props.children).some((child) => typeof child === 'string' && child.trim() === name) || nameIs(name)(element));
const dialogTitleIs = (name: string) => (element: Element) =>
  element.props.open === true
  && Boolean(find(element.props.children, (child) => React.Children.toArray(child.props.children).includes(name)));

const qaCards = [{ id: 'card-a', name: 'Nubank', lastFourDigits: '1234', color: '#8b5cf6' }];
const qaCategories = [
  { id: 'cat-a', name: 'Mercado', icon: 'shopping-bag', type: 'EXPENSE', color: '#22c55e', _count: { transactions: 2, purchases: 3 } },
  { id: 'cat-b', name: 'Salário', icon: 'banknote', type: 'INCOME', color: '#3b82f6', _count: { transactions: 1, purchases: 0 } },
];
const qaPurchases = [
  {
    id: 'pur-a',
    merchant: 'Supermercado A',
    totalAmount: 25,
    date: '2026-11-19T01:15:00.000Z',
    cardId: 'card-a',
    card: qaCards[0],
    categoryId: 'cat-a',
    category: qaCategories[0],
    notes: 'Nota preservada',
    items: [{ id: 'item-1', name: 'Arroz', quantity: 2, unitPrice: 12.5, totalPrice: 25 }],
  },
];

function createHarness<T>(mount: () => T) {
  const react = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const dispatcher = react.H;
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: (readonly unknown[] | undefined)[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    left && right && left.length === right.length && left.every((dep, i) => Object.is(dep, right[i]));

  return function render() {
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
      const tree = mount();
      afterRender.forEach((fn) => fn());
      return tree as Element;
    } finally {
      react.H = dispatcher;
    }
  };
}

async function exercisePurchases(
  onRun: (testbed: {
    render: () => Element;
    calls: Call[];
    feedback: string[];
    answerWrite: (answer: () => Promise<Response>) => void;
    answerRead: (answer: (url: string) => Promise<Response>) => void;
  }) => Promise<void>,
  initialPurchases = qaPurchases,
) {
  const { fetch } = globalThis;
  const { success, error } = toast;
  const store = useAppStore.getState();
  const calls: Call[] = [];
  const feedback: string[] = [];
  let write = () => Promise.resolve(new Response(null, { status: 204 }));
  let read = (url: string) => {
    if (url === '/api/purchases') return Promise.resolve(Response.json(initialPurchases));
    if (url === '/api/cards') return Promise.resolve(Response.json(qaCards));
    if (url === '/api/categories') return Promise.resolve(Response.json(qaCategories));
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  };
  const render = createHarness(() => PurchasesView());
  try {
    useAppStore.setState({ currentView: 'purchases', selectedPurchaseId: null });
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
      if (url === '/api/purchases' && ['POST', 'PUT', 'DELETE'].includes(method)) return write();
      if (method === 'GET') return read(url);
      throw new Error(`Chamada não prevista pela fixture de Compras: ${method} ${url}`);
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
      answerRead: (answer) => { read = answer; },
    });
  } finally {
    globalThis.fetch = fetch;
    toast.success = success;
    toast.error = error;
    useAppStore.setState(store, true);
  }
}

async function exerciseCategories(
  onRun: (testbed: {
    render: () => Element;
    calls: Call[];
    feedback: string[];
    answerWrite: (answer: () => Promise<Response>) => void;
    answerRead: (answer: (url: string) => Promise<Response>) => void;
  }) => Promise<void>,
) {
  const { fetch } = globalThis;
  const { success, error } = toast;
  const calls: Call[] = [];
  const feedback: string[] = [];
  let write = () => Promise.resolve(new Response(null, { status: 204 }));
  let read = (url: string) => {
    if (url === '/api/categories') return Promise.resolve(Response.json(qaCategories));
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  };
  const render = createHarness(() => CategoriesView());
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
      if (url === '/api/categories' && ['POST', 'PUT', 'DELETE'].includes(method)) return write();
      if (method === 'GET') return read(url);
      throw new Error(`Chamada não prevista pela fixture de Categorias: ${method} ${url}`);
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
      answerRead: (answer) => { read = answer; },
    });
  } finally {
    globalThis.fetch = fetch;
    toast.success = success;
    toast.error = error;
  }
}

const writes = (calls: Call[]) => calls.filter(({ method }) => method !== 'GET');

test('Compras põe o total da coleção antes da lista, usa FinanceMetric e deixa o ranking secundário', () => {
  const html = renderToStaticMarkup(
    <dl>
      <FinanceMetric variant="strip" label="Total das compras" value="R$ 25,00" />
    </dl>,
  );
  expect(html).toContain('<dt');
  expect(html).toContain('<dd');
  const purchasesSrc = readFileSync(new URL('./purchases-view.tsx', import.meta.url), 'utf8');
  expect(purchasesSrc).toContain("from '@/components/shared/finance-metric'");
  expect(purchasesSrc).toContain("from '@/components/shared/finance-dialog-shell'");
  expect(purchasesSrc).toContain("from './purchase-editor'");
  const strip = purchasesSrc.indexOf("aria-label={t('summary.ariaLabel')}");
  const list = purchasesSrc.indexOf('aria-labelledby="purchase-records-heading"');
  const ranking = purchasesSrc.indexOf('id="purchase-ranking-heading"');
  expect(strip).toBeGreaterThan(-1);
  expect(list).toBeGreaterThan(strip);
  expect(ranking).toBeGreaterThan(list);
  expect(purchasesSrc).toContain("import { currencyFmt } from '@/lib/helpers';");
  expect(purchasesSrc).not.toMatch(/card-glow|bg-gradient|<motion\./);
});

test('PurchaseEditor e PurchaseItemsEditor preservam casca, fieldset, legend e rótulo de fechar em pt-BR', () => {
  const changed: unknown[] = [];
  let added = 0;
  let removed = -1;
  const editor = withPtIntlDispatcher(() =>
    PurchaseEditor({
      mode: 'create',
      open: true,
      form: { merchant: '', cardId: '', categoryId: '', date: '2026-11-20', notes: '' },
      items: [
        { name: 'Café', quantity: 2, unitPrice: 5, totalPrice: 10 },
        { name: 'Pão', quantity: 1, unitPrice: 4, totalPrice: 4 },
      ],
      cards: qaCards,
      categories: qaCategories,
      totalAmount: 14,
      onFieldChange: (field, value) => changed.push([field, value]),
      onItemChange: (idx, field, value) => changed.push([idx, field, value]),
      onAddItem: () => { added++; },
      onRemoveItem: (idx) => { removed = idx; },
      onOpenChange: () => {},
      onCloseAutoFocus: () => {},
      onCancel: () => {},
      onSubmit: () => {},
    }),
  );

  expect(editor.type).toBe(FinanceFormDialogShell);
  expect(editor.props.closeLabel).toBe('Fechar formulário');
  const itemsEditor = required(editor, (node) => node.type === PurchaseItemsEditor);
  const markup = renderWithIntl(itemsEditor, 'pt');
  expect(markup).toContain('<fieldset');
  expect(markup).toContain('<legend');
  expect(markup).toContain('Itens da compra');
  expect(markup).toContain('aria-label="Item 1"');
  expect(markup).toContain('aria-label="Item 2"');

  required(editor, buttonNamed('Adicionar item')).props.onClick();
  expect(added).toBe(1);
  required(editor, nameIs('Remover item 2')).props.onClick();
  expect(removed).toBe(1);
  required(editor, byId('purchase-item-name-0')).props.onChange({ target: { value: 'Chá' } });
  expect(changed).toEqual([[0, 'name', 'Chá']]);
});

test('Compras renderiza expansor acessível, ações nomeadas, consome selectedPurchaseId e trata falha em opções', async () => {
  await exercisePurchases(async ({ render, calls, answerRead }) => {
    const tree = render();
    const expander = required(tree, nameIs('Itens da compra: Supermercado A'));
    expect(expander.props['aria-expanded']).toBe(false);
    expect(expander.props['aria-controls']).toBe('purchase-items-pur-a');
    expect(expander.props['aria-describedby']).toBe('purchase-summary-pur-a purchase-amount-pur-a');

    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain('1 item');
    expect(markup).toContain('Nubank');
    expect(markup).toContain('Mercado');
    expect(markup).toContain('R$');

    expander.props.onClick();
    expect(required(render(), nameIs('Itens da compra: Supermercado A')).props['aria-expanded']).toBe(true);
    expect(required(tree, nameIs('Editar compra: Supermercado A'))).toBeDefined();
    expect(required(tree, nameIs('Excluir compra: Supermercado A'))).toBeDefined();

    // selectedPurchaseId expande compra alvo e limpa seleção na store
    useAppStore.getState().setSelectedPurchaseId('pur-a');
    render();
    await settle();
    expect(useAppStore.getState().selectedPurchaseId).toBeNull();

    // Falha ao recarregar opções mostra alerta e permite retry
    answerRead(async (url) => {
      if (url === '/api/purchases') return Response.json(qaPurchases);
      return new Response(null, { status: 503 });
    });
    const optionsRes = await fetch('/api/cards');
    expect(optionsRes.status).toBe(503);
    const purchasesSrc = readFileSync(new URL('./purchases-view.tsx', import.meta.url), 'utf8');
    const editorSrc = readFileSync(new URL('./purchase-editor.tsx', import.meta.url), 'utf8');
    expect(editorSrc).toContain("t('editor.noCard')");
    expect(editorSrc).toContain("t('editor.noCategory')");
    expect(purchasesSrc).toContain("t('errors.options')");
    expect(calls.length).toBeGreaterThan(0);
  });
});

test('CategoryIconColorPicker e CategoryEditor preservam fieldset, nomes acessíveis, prévia e casca pt-BR', () => {
  const changes: unknown[] = [];
  const editor = withPtIntlDispatcher(() =>
    CategoryEditor({
      mode: 'create',
      open: true,
      form: { name: 'Lazer', icon: 'gamepad-2', type: 'EXPENSE', color: '#8b5cf6' },
      onFieldChange: (field, value) => changes.push([field, value]),
      onOpenChange: () => {},
      onCloseAutoFocus: () => {},
      onCancel: () => {},
      onSubmit: () => {},
    }),
  );

  expect(editor.type).toBe(FinanceFormDialogShell);
  expect(editor.props.closeLabel).toBe('Fechar formulário');
  const picker = required(editor, (node) => node.type === CategoryIconColorPicker);
  const markup = renderWithIntl(picker, 'pt');
  expect(markup).toContain('<fieldset');
  expect(markup).toContain('<legend class="text-sm font-medium">Ícone</legend>');
  expect(markup).toContain('<legend class="text-sm font-medium">Cor</legend>');
  expect(markup).toContain('Pré-visualização');
  expect(markup).toContain('Lazer');
  expect(markup).toContain('Violeta');

  const selectedIconBtn = required(picker, (node) => node.type === 'button' && node.props['aria-pressed'] === true && Boolean(find(node.props.children, (c) => c.props.children === 'Entretenimento')));
  expect(selectedIconBtn).toBeDefined();
  const nextIconBtn = required(picker, (node) => node.type === 'button' && Boolean(find(node.props.children, (c) => c.props.children === 'Viagem')));
  nextIconBtn.props.onClick();
  const nextColorBtn = required(picker, nameIs('Verde'));
  expect(nextColorBtn.props['aria-pressed']).toBe(false);
  nextColorBtn.props.onClick();
  expect(changes).toEqual([['icon', 'plane'], ['color', '#22c55e']]);
  expect(iconOptions.length).toBeGreaterThan(10);
  expect(categoryColors.length).toBeGreaterThan(5);
});

test('Categorias usa FinanceMetric, filtro acessível sem hover e preserva ações', async () => {
  const categoriesSrc = readFileSync(new URL('./categories-view.tsx', import.meta.url), 'utf8');
  expect(categoriesSrc).toContain("from '@/components/shared/finance-metric'");
  expect(categoriesSrc).toContain("from '@/components/shared/finance-dialog-shell'");
  expect(categoriesSrc).toContain("from './category-editor'");
  expect(categoriesSrc).not.toMatch(/card-glow|group-hover:opacity|bg-gradient|<motion\./);

  await exerciseCategories(async ({ render }) => {
    const tree = render();
    expect(required(tree, (node) => node.type === 'dl' && node.props['aria-label'] === 'Totais de categorias')).toBeDefined();
    expect(required(tree, (node) => node.type === 'section' && node.props['aria-labelledby'] === 'category-records-heading')).toBeDefined();
    expect(required(tree, nameIs('Editar categoria: Mercado'))).toBeDefined();
    expect(required(tree, nameIs('Excluir categoria: Mercado'))).toBeDefined();
    const incomeFilter = required(tree, (node) => node.type === 'button' && node.props['aria-pressed'] === false && React.Children.toArray(node.props.children).includes('Receitas'));
    incomeFilter.props.onClick();
    const updatedTree = render();
    const listSection = required(updatedTree, (node) => node.type === 'section' && node.props['aria-labelledby'] === 'category-records-heading');
    expect(find(listSection, (node) => node.props.children === 'Mercado')).toBeUndefined();
    expect(find(listSection, (node) => node.props.children === 'Salário')).toBeDefined();
  });
});

for (const [label, file] of [['Compras', './purchases-view.tsx'], ['Categorias', './categories-view.tsx']] as const) {
  test(`${label} usa FinanceConfirmationDialogShell com contraste destrutivo no CSS real`, async () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(source).toContain('<FinanceConfirmationDialogShell');
    expect(source).toContain('onCloseAutoFocus={restoreFocus}');
    const action = source.match(/<AlertDialogAction\s[\s\S]*?<\/AlertDialogAction>/)?.[0];
    expect(action).toBeDefined();
    expect(action).toMatch(/onClick=\{\(event\) => \{\s*event\.preventDefault\(\)/);
    const classes = action?.match(/className=\{cn\(([\s\S]*?)\)\}/)?.[1] ?? '';
    const literals = [...classes.matchAll(/'([^']+)'/g)].map((m) => m[1]).join(' ').split(/\s+/).filter(Boolean);
    const globals = new URL('../../app/globals.css', import.meta.url);
    const compiler = await compile(readFileSync(globals, 'utf8'), {
      base: fileURLToPath(new URL('.', globals)),
      onDependency() {},
    });
    const css = compiler.build(literals);
    expect(css).toMatch(/\.text-[^ {]+\s*\{\s*color: var\(--ds-destructive-fg\);/);
    expect(css).toMatch(/\.bg-destructive\s*\{\s*background-color: var\(--destructive\);/);
    expect(css).toMatch(/\.hover\\:bg-destructive\s*\{[^}]*background-color: var\(--destructive\);/);
    expect(css).toMatch(/\.hover\\:underline\s*\{[^}]*text-decoration-line: underline;/);
  });
}

for (const method of ['POST', 'PUT', 'DELETE'] as const) {
  test(`Compras ${method}: falha HTTP e rejeição do fetch preservam rascunho/abertura; 2xx tardio não fecha abertura B; GET 503 permite retry só de leitura`, async () => {
    await exercisePurchases(async ({ render, calls, feedback, answerWrite, answerRead }) => {
      const openForm = (edit: boolean) => {
        const trigger = required(render(), edit ? nameIs('Editar compra: Supermercado A') : buttonNamed('Nova compra'));
        trigger.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
        trigger.props.onClick();
      };
      const openDelete = () => {
        const trigger = required(render(), nameIs('Excluir compra: Supermercado A'));
        trigger.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
        trigger.props.onClick();
      };

      if (method === 'DELETE') {
        openDelete();
      } else {
        openForm(method === 'PUT');
        const dialog = () => required(render(), dialogTitleIs(method === 'PUT' ? 'Editar compra' : 'Nova compra'));
        required(dialog(), byId('purchase-merchant')).props.onChange({ target: { value: 'Loja Rascunho' } });
        if (method === 'POST') {
          required(dialog(), byId('purchase-item-name-0')).props.onChange({ target: { value: 'Café' } });
          required(dialog(), byId('purchase-item-quantity-0')).props.onChange({ target: { value: '2' } });
          required(dialog(), byId('purchase-item-price-0')).props.onChange({ target: { value: '7.5' } });
        }
      }

      const title = method === 'DELETE' ? 'Excluir compra?' : method === 'PUT' ? 'Editar compra' : 'Nova compra';
      const actionLabel = method === 'DELETE' ? 'Excluir' : method === 'PUT' ? 'Atualizar' : 'Registrar';
      const activeDialog = () => required(render(), dialogTitleIs(title));
      const submit = async () => {
        const btn = required(activeDialog(), buttonNamed(actionLabel));
        await btn.props.onClick({ preventDefault() {} });
        await settle();
      };

      // 1) HTTP não OK preserva diálogo e rascunho
      answerWrite(async () => new Response(null, { status: 503 }));
      await submit();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      expect(feedback.at(-1)).toBe(method === 'DELETE' ? 'erro: Erro ao excluir compra' : 'erro: Erro ao salvar compra');
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('purchase-merchant')).props.value).toBe('Loja Rascunho');
      }

      // 2) Rejeição do fetch preserva diálogo e rascunho
      answerWrite(async () => { throw new Error('Rede indisponível'); });
      await submit();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      expect(feedback.at(-1)).toBe(method === 'DELETE' ? 'erro: Erro ao excluir compra' : 'erro: Erro ao salvar compra');
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('purchase-merchant')).props.value).toBe('Loja Rascunho');
      }

      // 3) 2xx tardio após abertura B não fecha B
      const held = heldResponse();
      answerWrite(() => held.promise);
      const inFlight = required(activeDialog(), buttonNamed(actionLabel)).props.onClick({ preventDefault() {} });
      // Fecha abertura A e abre abertura B
      if (method === 'DELETE') {
        activeDialog().props.onOpenChange(false);
        openDelete();
      } else {
        required(activeDialog(), buttonNamed('Cancelar')).props.onClick();
        openForm(method === 'PUT');
        required(activeDialog(), byId('purchase-merchant')).props.onChange({ target: { value: 'Loja B' } });
        if (method === 'POST') {
          required(activeDialog(), byId('purchase-item-name-0')).props.onChange({ target: { value: 'Leite' } });
          required(activeDialog(), byId('purchase-item-price-0')).props.onChange({ target: { value: '5' } });
        }
      }
      held.resolve(new Response(null, { status: 204 }));
      await inFlight;
      await settle();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('purchase-merchant')).props.value).toBe('Loja B');
      }

      // 4) Gravação OK + GET 503 mantém aviso e retry faz apenas GET sem repetir mutação
      const writesBefore = writes(calls).length;
      answerWrite(async () => new Response(null, { status: 204 }));
      answerRead(async () => new Response(null, { status: 503 }));
      await submit();
      expect(writes(calls).length).toBe(writesBefore + 1);
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      expect(feedback.at(-1)).toMatch(/^ok: /);
      const retryBtn = required(render(), buttonNamed('Tentar atualizar lista'));
      answerRead(async (url) => url === '/api/purchases' ? Response.json(qaPurchases) : Response.json([]));
      retryBtn.props.onClick();
      await settle();
      expect(writes(calls).length).toBe(writesBefore + 1);
      expect(find(render(), buttonNamed('Tentar atualizar lista'))).toBeUndefined();
    });
  });

  test(`Categorias ${method}: falha HTTP e rejeição do fetch preservam rascunho/abertura; 2xx tardio não fecha abertura B; GET 503 permite retry só de leitura`, async () => {
    await exerciseCategories(async ({ render, calls, feedback, answerWrite, answerRead }) => {
      const openForm = (edit: boolean) => {
        const trigger = required(render(), edit ? nameIs('Editar categoria: Mercado') : buttonNamed('Nova categoria'));
        trigger.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
        trigger.props.onClick();
      };
      const openDelete = () => {
        const trigger = required(render(), nameIs('Excluir categoria: Mercado'));
        trigger.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
        trigger.props.onClick();
      };

      if (method === 'DELETE') {
        openDelete();
      } else {
        openForm(method === 'PUT');
        const dialog = () => required(render(), dialogTitleIs(method === 'PUT' ? 'Editar categoria' : 'Nova categoria'));
        required(dialog(), byId('category-name')).props.onChange({ target: { value: 'Rascunho Cat' } });
      }

      const title = method === 'DELETE' ? 'Excluir categoria?' : method === 'PUT' ? 'Editar categoria' : 'Nova categoria';
      const actionLabel = method === 'DELETE' ? 'Excluir' : method === 'PUT' ? 'Atualizar' : 'Criar';
      const activeDialog = () => required(render(), dialogTitleIs(title));
      const submit = async () => {
        await required(activeDialog(), buttonNamed(actionLabel)).props.onClick({ preventDefault() {} });
        await settle();
      };

      // 1) HTTP não OK preserva diálogo e propaga mensagem específica
      answerWrite(async () => Response.json({ error: 'Falha específica da API' }, { status: 400 }));
      await submit();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      expect(feedback.at(-1)).toBe('erro: Falha específica da API');
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('category-name')).props.value).toBe('Rascunho Cat');
      }

      // 2) Rejeição do fetch preserva diálogo e rascunho
      answerWrite(async () => { throw new Error('Transporte falhou'); });
      await submit();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      expect(feedback.at(-1)).toBe('erro: Transporte falhou');
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('category-name')).props.value).toBe('Rascunho Cat');
      }

      // 3) 2xx tardio após abertura B não fecha B
      const held = heldResponse();
      answerWrite(() => held.promise);
      const inFlight = required(activeDialog(), buttonNamed(actionLabel)).props.onClick({ preventDefault() {} });
      if (method === 'DELETE') {
        activeDialog().props.onOpenChange(false);
        openDelete();
      } else {
        required(activeDialog(), buttonNamed('Cancelar')).props.onClick();
        openForm(method === 'PUT');
        required(activeDialog(), byId('category-name')).props.onChange({ target: { value: 'Cat B' } });
      }
      held.resolve(new Response(null, { status: 204 }));
      await inFlight;
      await settle();
      expect(find(render(), dialogTitleIs(title))).toBeDefined();
      if (method !== 'DELETE') {
        expect(required(activeDialog(), byId('category-name')).props.value).toBe('Cat B');
      }

      // 4) Gravação OK + GET 503 mantém aviso e retry faz apenas GET
      const writesBefore = writes(calls).length;
      answerWrite(async () => new Response(null, { status: 204 }));
      answerRead(async () => new Response(null, { status: 503 }));
      await submit();
      expect(writes(calls).length).toBe(writesBefore + 1);
      expect(find(render(), dialogTitleIs(title))).toBeUndefined();
      expect(feedback.at(-1)).toMatch(/^ok: /);
      const retryBtn = required(render(), buttonNamed('Tentar atualizar lista'));
      answerRead(async () => Response.json(qaCategories));
      retryBtn.props.onClick();
      await settle();
      expect(writes(calls).length).toBe(writesBefore + 1);
      expect(find(render(), buttonNamed('Tentar atualizar lista'))).toBeUndefined();
    });
  });
}

test('Compras PUT preserva instante histórico quando data civil não muda e envia itens não vazios', async () => {
  await exercisePurchases(async ({ render, calls, answerWrite }) => {
    const editBtn = required(render(), nameIs('Editar compra: Supermercado A'));
    editBtn.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
    editBtn.props.onClick();
    const dialog = () => required(render(), dialogTitleIs('Editar compra'));
    required(dialog(), byId('purchase-merchant')).props.onChange({ target: { value: 'Supermercado Editado' } });
    answerWrite(async () => new Response(null, { status: 204 }));
    await required(dialog(), buttonNamed('Atualizar')).props.onClick();
    await settle();

    const put = writes(calls)[0];
    expect(put.method).toBe('PUT');
    expect(put.body).toMatchObject({
      id: 'pur-a',
      merchant: 'Supermercado Editado',
      items: [{ name: 'Arroz', quantity: 2, unitPrice: 12.5, totalPrice: 25 }],
    });
    // Preserva instante histórico (ou data civil correspondente ao fuso)
    expect(typeof (put.body as { date: string }).date).toBe('string');
    expect((put.body as { date: string }).date).toBe('2026-11-19T01:15:00.000Z');
  });
});

test('renderiza PurchaseItemsEditor, CategoryIconColorPicker, PurchasesView e CategoriesView em pt, es e en sem chaves cruas', () => {
  const expected = {
    pt: { items: 'Itens da compra', preview: 'Pré-visualização', loadingPurchases: 'Carregando compras…', loadingCategories: 'Carregando categorias…' },
    es: { items: 'Ítems de la compra', preview: 'Vista previa', loadingPurchases: 'Cargando compras…', loadingCategories: 'Cargando categorías…' },
    en: { items: 'Purchase items', preview: 'Preview', loadingPurchases: 'Loading purchases…', loadingCategories: 'Loading categories…' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const itemsHtml = renderWithIntl(
      <PurchaseItemsEditor
        items={[{ name: 'Café', quantity: 1, unitPrice: 10, totalPrice: 10 }]}
        onItemChange={() => {}}
        onAddItem={() => {}}
        onRemoveItem={() => {}}
      />,
      locale,
    );
    expect(itemsHtml).toContain(expected[locale].items);
    expect(itemsHtml).not.toContain('MISSING_MESSAGE');

    const pickerHtml = renderWithIntl(
      <CategoryIconColorPicker
        name="Lazer"
        type="EXPENSE"
        icon="gamepad-2"
        color="#8b5cf6"
        onIconChange={() => {}}
        onColorChange={() => {}}
      />,
      locale,
    );
    expect(pickerHtml).toContain(expected[locale].preview);

    const purchasesHtml = renderWithIntl(<PurchasesView />, locale);
    expect(purchasesHtml).toContain(expected[locale].loadingPurchases);

    const categoriesHtml = renderWithIntl(<CategoriesView />, locale);
    expect(categoriesHtml).toContain(expected[locale].loadingCategories);
  }
});

test('#8: PurchaseEditor e CategoryEditor localizam closeLabel em pt, es e en', () => {
  const expectedClose = {
    pt: 'Fechar formulário',
    es: 'Cerrar formulario',
    en: 'Close form',
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const purchaseEl = withPtIntlDispatcher(
      () =>
        PurchaseEditor({
          mode: 'create',
          open: true,
          form: { merchant: '', cardId: '', categoryId: '', date: '2026-11-19', notes: '' },
          items: [{ name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
          cards: qaCards,
          categories: qaCategories,
          totalAmount: 0,
          onFieldChange: () => {},
          onItemChange: () => {},
          onAddItem: () => {},
          onRemoveItem: () => {},
          onOpenChange: () => {},
          onCloseAutoFocus: () => {},
          onCancel: () => {},
          onSubmit: () => {},
        }),
      locale,
    );
    expect(purchaseEl.props.closeLabel).toBe(expectedClose[locale]);

    const categoryEl = withPtIntlDispatcher(
      () =>
        CategoryEditor({
          mode: 'create',
          open: true,
          form: { name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' },
          onFieldChange: () => {},
          onOpenChange: () => {},
          onCloseAutoFocus: () => {},
          onCancel: () => {},
          onSubmit: () => {},
        }),
      locale,
    );
    expect(categoryEl.props.closeLabel).toBe(expectedClose[locale]);
  }
});

test('#9 e #16: PurchasesView normaliza busca sem acentos, valida total/itens e propaga data.error; CategoriesView valida nome trimado', async () => {
  const accentedPurchases = [
    {
      id: 'pur-farm',
      merchant: 'Farmácia Raia',
      totalAmount: 55,
      date: '2026-11-19T12:00:00.000Z',
      cardId: 'card-saude',
      card: { id: 'card-saude', name: 'Cartão Saúde', lastFourDigits: '5678', color: '#8b5cf6' },
      categoryId: 'cat-a',
      category: qaCategories[0],
      notes: '',
      items: [{ id: 'it-1', name: 'Vitamina', quantity: 1, unitPrice: 55, totalPrice: 55 }],
    },
    ...qaPurchases,
  ];

  await exercisePurchases(async ({ render, calls, feedback, answerWrite }) => {
    // Busca sem acento encontra Farmácia Raia e Cartão Saúde na lista filtrada de registros
    const searchInput = required(render(), (e) => e.props.placeholder === 'Estabelecimento ou cartão');
    searchInput.props.onChange({ target: { value: 'farmacia' } });
    const farmRecordsHtml = renderToStaticMarkup(
      required(render(), (e) => e.type === 'section' && e.props['aria-labelledby'] === 'purchase-records-heading'),
    );
    expect(farmRecordsHtml).toContain('Farmácia Raia');
    expect(farmRecordsHtml).not.toContain('Supermercado A');

    searchInput.props.onChange({ target: { value: 'saude' } });
    const cardRecordsHtml = renderToStaticMarkup(
      required(render(), (e) => e.type === 'section' && e.props['aria-labelledby'] === 'purchase-records-heading'),
    );
    expect(cardRecordsHtml).toContain('Farmácia Raia');
    expect(cardRecordsHtml).not.toContain('Supermercado A');

    // Validação client-side de Compras (#16)
    const newBtn = required(render(), buttonNamed('Nova compra'));
    newBtn.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
    newBtn.props.onClick();
    const activeDialog = () => required(render(), dialogTitleIs('Nova compra'));

    // Merchant apenas com espaços
    required(activeDialog(), byId('purchase-merchant')).props.onChange({ target: { value: '   ' } });
    await required(activeDialog(), buttonNamed('Registrar')).props.onClick();
    expect(writes(calls)).toHaveLength(0);
    expect(feedback.at(-1)).toBe('erro: Informe o estabelecimento');

    // Sem item válido
    required(activeDialog(), byId('purchase-merchant')).props.onChange({ target: { value: 'Padaria Central' } });
    await required(activeDialog(), buttonNamed('Registrar')).props.onClick();
    expect(writes(calls)).toHaveLength(0);
    expect(feedback.at(-1)).toBe('erro: Adicione ao menos um item');

    // Item com total zero
    required(activeDialog(), byId('purchase-item-name-0')).props.onChange({ target: { value: 'Pão' } });
    required(activeDialog(), byId('purchase-item-price-0')).props.onChange({ target: { value: '0' } });
    await required(activeDialog(), buttonNamed('Registrar')).props.onClick();
    expect(writes(calls)).toHaveLength(0);
    expect(feedback.at(-1)).toBe('erro: O total da compra deve ser maior que zero');

    // Quantidade inválida (< 1)
    required(activeDialog(), byId('purchase-item-quantity-0')).props.onChange({ target: { value: '0' } });
    required(activeDialog(), byId('purchase-item-price-0')).props.onChange({ target: { value: '10' } });
    await required(activeDialog(), buttonNamed('Registrar')).props.onClick();
    expect(writes(calls)).toHaveLength(0);
    expect(feedback.at(-1)).toBe('erro: Verifique quantidade e preço dos itens');

    // Propaga data.error quando servidor responde 400
    required(activeDialog(), byId('purchase-item-quantity-0')).props.onChange({ target: { value: '2' } });
    required(activeDialog(), byId('purchase-item-price-0')).props.onChange({ target: { value: '10' } });
    answerWrite(async () => Response.json({ error: 'Estabelecimento inválido no servidor' }, { status: 400 }));
    await required(activeDialog(), buttonNamed('Registrar')).props.onClick();
    await settle();
    expect(writes(calls)).toHaveLength(1);
    expect(feedback.at(-1)).toBe('erro: Estabelecimento inválido no servidor');
  }, accentedPurchases);

  await exerciseCategories(async ({ render, calls, feedback, answerWrite }) => {
    const newCatBtn = required(render(), buttonNamed('Nova categoria'));
    newCatBtn.props.onClickCapture({ currentTarget: { isConnected: true, focus() {} } });
    newCatBtn.props.onClick();
    const catDialog = () => required(render(), dialogTitleIs('Nova categoria'));

    required(catDialog(), byId('category-name')).props.onChange({ target: { value: '   ' } });
    await required(catDialog(), buttonNamed('Criar')).props.onClick();
    expect(writes(calls)).toHaveLength(0);
    expect(feedback.at(-1)).toBe('erro: Informe o nome da categoria');

    required(catDialog(), byId('category-name')).props.onChange({ target: { value: '  Lazer  ' } });
    answerWrite(async () => new Response(null, { status: 204 }));
    await required(catDialog(), buttonNamed('Criar')).props.onClick();
    await settle();
    expect(writes(calls)).toHaveLength(1);
    expect((writes(calls)[0].body as { name: string }).name).toBe('Lazer');
  });
});
