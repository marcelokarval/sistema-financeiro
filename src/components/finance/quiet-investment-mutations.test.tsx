/// <reference types="bun-types" />
import { expect, test } from 'bun:test';
import React, { type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FinanceConfirmationDialogShell, FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { InvestmentEntries, InvestmentPortfolio, InvestmentsView } from './investments-view';
import { InvestmentDeleteConfirmation } from './investment-delete-confirmation';
import { InvestmentEditor } from './investment-editor';
import { InvestmentEntryEditor } from './investment-entry-editor';
import { InstallmentEntries, InstallmentPortfolio, InstallmentsView } from './installments-view';
import { InstallmentPlanEditor } from './installment-plan-editor';
import { InstallmentDeleteConfirmation } from './installment-delete-confirmation';
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
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => {}],
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
  };
  try {
    return fn();
  } finally {
    internals.H = previous;
  }
}

const a = { id: 'a', name: 'Investimento A', type: 'CDB', investedAmount: 1200, currentBalance: 1350, yieldRate: 0 };
const b = { ...a, id: 'b', name: 'Investimento B' };
const plan = { id: 'p', description: 'Plano sintético', type: 'FINANCING', totalAmount: 900, installmentCount: 2, monthlyValue: 450, paidInstallments: 0, interestRate: 0, startDate: '2026-05-01', status: 'ACTIVE', cardId: null, categoryId: null, installments: [] };
const history = (id: string) => Response.json([{ id, type: 'DIVIDENDO', amount: 12.34, date: '2026-05-01', description: id }]);
type Element = ReactElement<Record<string, any>>;
type Request = { url: string; method: string; body?: string };

function find(node: ReactNode, matches: (element: Element) => boolean): Element | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, any>>(child)) continue;
    if (matches(child)) return child;
    // Evaluate only the leaf components we own; do not emulate Radix portals or focus.
    const expanded = withPtIntlDispatcher(() =>
      child.type === InvestmentEditor
        ? InvestmentEditor(child.props as Parameters<typeof InvestmentEditor>[0])
        : child.type === InvestmentEntryEditor
          ? InvestmentEntryEditor(child.props as Parameters<typeof InvestmentEntryEditor>[0])
          : child.type === InvestmentDeleteConfirmation
            ? InvestmentDeleteConfirmation(child.props as Parameters<typeof InvestmentDeleteConfirmation>[0])
            : child.type === InstallmentPlanEditor
              ? InstallmentPlanEditor(child.props as Parameters<typeof InstallmentPlanEditor>[0])
              : child.type === InstallmentDeleteConfirmation
                ? InstallmentDeleteConfirmation(child.props as Parameters<typeof InstallmentDeleteConfirmation>[0])
                : child.type === FinanceFormDialogShell
                  ? FinanceFormDialogShell(child.props as Parameters<typeof FinanceFormDialogShell>[0])
                  : child.type === FinanceConfirmationDialogShell
                    ? FinanceConfirmationDialogShell(child.props as Parameters<typeof FinanceConfirmationDialogShell>[0])
                    : child.props.children,
    );
    const nested = find(expanded, matches);
    if (nested) return nested;
  }
}

const byType = (type: Element["type"]) => (element: Element) => element.type === type;
const withText = (label: string) => (element: Element) => React.Children.toArray(element.props.children).some((child) => typeof child === 'string' && child.trim() === label.trim());
const formField = (placeholder: string) => (element: Element) => element.props.placeholder === placeholder && element.props.onChange;
const isOpen = (element: Element) => element.props.open === true && element.props.onOpenChange;
const openDialog = (element: Element) =>
  element.type !== InvestmentEditor
  && element.type !== InvestmentEntryEditor
  && element.type !== InvestmentDeleteConfirmation
  && element.type !== InstallmentPlanEditor
  && element.type !== InstallmentDeleteConfirmation
  && element.type !== FinanceFormDialogShell
  && element.type !== FinanceConfirmationDialogShell
  && isOpen(element);
const trigger = { currentTarget: null };
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Executa a view e seus handlers; substitui apenas o ciclo React/DOM, a rede e os toasts.
async function exercise(
  View: () => Element,
  respond: (request: Request) => Response | Promise<Response>,
  run: (render: () => Element, requests: Request[], feedback: string[]) => Promise<void>,
) {
  const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = internals;
  const fetch = globalThis.fetch;
  const { success, error } = toast;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const requests: Request[] = [];
  const feedback: string[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0;
    let refIndex = 0;
    const effects: (() => void)[] = [];
    internals.H = {
      useState(initial: unknown) {
        const i = stateIndex++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (next: unknown) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[refIndex++] ??= { current }),
      useCallback: (fn: unknown) => fn,
      useMemo: (factory: () => unknown) => factory(),
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx),
      useId: () => 'test-id',
      useEffect: (effect: () => void) => { if (!mounted) effects.push(effect); },
      useLayoutEffect: () => {},
    };
    try {
      const view = View();
      mounted = true;
      effects.forEach((effect) => effect());
      return view;
    } finally { internals.H = H; }
  }
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const request = { url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined };
      requests.push(request);
      return respond(request);
    }) as typeof fetch;
    toast.success = () => { feedback.push('success'); return 'success'; };
    toast.error = () => { feedback.push('error'); return 'error'; };
    render();
    await settle();
    await run(render, requests, feedback);
  } finally {
    globalThis.fetch = fetch;
    toast.success = success;
    toast.error = error;
  }
}

const investmentsUrl = '/api/investments';
const transactionsUrl = `${investmentsUrl}/transactions`;
const installmentsUrl = '/api/installments';
function readFixture({ url }: Request) {
  if (url === investmentsUrl) return Response.json([a, b]);
  if (url === installmentsUrl) return Response.json([plan]);
  if (url === `${installmentsUrl}?id=p`) return Response.json(plan);
  if (url === `${transactionsUrl}?investmentId=a`) return history("Histórico A");
  return Response.json([]);
}

const field = (name: string) => (element: Element) => {
  const id = `investment-form-${name}`;
  return Boolean((element.props.id === id && element.props.onChange) ||
    (element.props.onValueChange && find(element.props.children, (child) => child.props.id === id)));
};
const editor = (view: Element) => find(view, openDialog)!;
const click = (node: ReactNode, label: string) => find(node, (element) => withText(label)(element) && element.props.onClick)!.props.onClick;
const portfolio = (view: Element) => find(view, byType(InvestmentPortfolio))!;
const edit = (view: Element, record: typeof a, detail: boolean) => detail
  ? click(view, ' Editar investimento')(trigger)
  : portfolio(view).props.onEdit(record, trigger);
const confirmDelete = (view: Element, detail: boolean) => detail
  ? click(view, ' Excluir investimento')(trigger)
  : portfolio(view).props.onDelete(a.id, trigger);
const controlledResponse = () => Promise.withResolvers<Response>();
const historyUrl = (id: string) => `${transactionsUrl}?investmentId=${id}`;

for (const [mode, detail, method, submit] of [
  ['criação', false, 'POST', 'Criar'],
  ['edição na carteira', false, 'PUT', 'Salvar'],
  ['edição no detalhe', true, 'PUT', 'Salvar'],
] as const) {
  const editMode = method === 'PUT';
  const record = {
    ...a, yieldRate: 4.2, description: 'Descrição A', brokerage: 'Corretora A', ticker: 'QA1',
    accountId: 'conta-a', categoryId: 'categoria-a',
  };
  for (const outcome of ['HTTP 503', 'fetch rejeitado', 'OK, GET 503'] as const) {
    test(`${mode}: campos, validação e payload com ${outcome}`, async () => {
      const reread = controlledResponse();
      let reads = 0;
      await exercise(InvestmentsView, (request) => {
        if (request.method === method) {
          if (outcome === 'fetch rejeitado') return Promise.reject(new Error('Transporte sintético'));
          return outcome === 'HTTP 503' ? Response.json({ error: 'Indisponível' }, { status: 503 }) : Response.json({});
        }
        if (request.url === investmentsUrl) return ++reads === 1 ? Response.json([record, b]) : reread.promise;
        return readFixture(request);
      }, async (render, requests, feedback) => {
        if (detail) { portfolio(render()).props.onOpen(record); await settle(); }
        if (editMode) edit(render(), record, detail);
        else portfolio(render()).props.onNew(trigger);
        const formValues = () => Object.fromEntries([
          'name', 'type', 'description', 'investedAmount', 'yieldRate', 'brokerage', 'ticker', 'accountId', 'categoryId',
        ].map((name) => [name, find(editor(render()), field(name))!.props.value]));
        expect(formValues()).toEqual(editMode ? {
          name: 'Investimento A', type: 'CDB', description: 'Descrição A', investedAmount: '1200', yieldRate: '4.2',
          brokerage: 'Corretora A', ticker: 'QA1', accountId: 'conta-a', categoryId: 'categoria-a',
        } : {
          name: '', type: 'STOCK', description: '', investedAmount: '', yieldRate: '0', brokerage: '', ticker: '',
          accountId: '', categoryId: '',
        });
        const change = (name: string, value: string) => {
          const props = find(editor(render()), field(name))!.props;
          if (props.onValueChange) props.onValueChange(value);
          else props.onChange({ target: { value } });
        };
        const before = requests.length;
        const save = () => click(editor(render()), submit)();
        change('name', '  ');
        await save();
        expect(feedback).toEqual(['error']);
        expect(requests).toHaveLength(before);
        expect(formValues().name).toBe('  ');
        // Valores exatos: omissão dos opcionais vazios; texto opcional não é normalizado.
        change('name', '  Rascunho QA  ');
        change('type', 'ETF');
        change('investedAmount', '12.75');
        change('yieldRate', '');
        change('description', '   ');
        change('brokerage', '');
        change('ticker', 'QA2');
        change('accountId', 'conta-b');
        change('categoryId', 'categoria-b');
        const draft = formValues();
        await save();
        const [mutation, ...gets] = requests.slice(before);
        expect(mutation).toMatchObject({ url: investmentsUrl, method });
        expect(JSON.parse(mutation.body!)).toEqual({
          ...(editMode ? { id: 'a' } : {}), name: 'Rascunho QA', type: 'ETF', description: '   ',
          investedAmount: 12.75, yieldRate: 0, ticker: 'QA2', accountId: 'conta-b', categoryId: 'categoria-b',
        });
        if (outcome === 'OK, GET 503') {
          expect(feedback).toEqual(['error', 'success']);
          expect(find(render(), openDialog)).toBeUndefined();
          expect(gets.map(({ method, url }) => [method, url])).toEqual([
            ['GET', investmentsUrl], ...(detail ? [['GET', historyUrl('a')]] : []),
          ]);
          reread.resolve(Response.json({ error: 'Indisponível' }, { status: 503 }));
          await settle();
          expect(find(render(), openDialog)).toBeUndefined();
          expect(feedback).toEqual(['error', 'success']);
          expect(detail ? find(render(), (node) => node.type === 'h2')?.props.children : portfolio(render()).props.loadError)
            .toBe(detail ? a.name : true);
        } else {
          expect(feedback).toEqual(['error', 'error']);
          expect(gets).toEqual([]);
          expect(formValues()).toEqual(draft);
        }
      });
    });
  }
}

for (const detail of [false, true]) {
  for (const outcome of ['OK', 'HTTP 503', 'fetch rejeitado'] as const) {
    test(`${detail ? 'detalhe' : 'carteira'} A→B: resposta ${outcome} de A preserva identidade e segue o fechamento do baseline`, async () => {
      const mutation = controlledResponse();
      const reread = controlledResponse();
      let reads = 0;
      await exercise(InvestmentsView, (request) => {
        if (request.method === 'PUT') return mutation.promise;
        if (request.url === investmentsUrl && ++reads > 1) return reread.promise;
        if (request.url === historyUrl('b')) return history('Histórico B');
        return readFixture(request);
      }, async (render, requests, feedback) => {
        if (detail) { portfolio(render()).props.onOpen(a); await settle(); }
        edit(render(), a, detail);
        find(editor(render()), field('name'))!.props.onChange({ target: { value: 'Rascunho A' } });
        const save = click(editor(render()), 'Salvar');
        const first = save();
        const duplicate = save();
        expect(find(editor(render()), withText('Salvando…'))?.props.disabled).toBe(true);
        click(editor(render()), 'Cancelar')();
        expect(find(render(), openDialog)).toBeUndefined();
        if (detail) {
          click(render(), ' Voltar aos investimentos')();
          portfolio(render()).props.onOpen(b);
          await settle();
        }
        edit(render(), b, detail);
        find(editor(render()), field('name'))!.props.onChange({ target: { value: 'Rascunho B' } });
        const beforeReply = requests.length;
        if (outcome === 'fetch rejeitado') mutation.reject(new Error('Transporte sintético'));
        else mutation.resolve(Response.json({}, { status: outcome === 'OK' ? 200 : 503 }));
        await Promise.all([first, duplicate]);
        expect(requests.filter((request) => request.method === 'PUT').map((request) => [request.url, JSON.parse(request.body!)])).toEqual([
          [investmentsUrl, { id: 'a', name: 'Rascunho A', type: 'CDB', investedAmount: 1200, yieldRate: 0 }],
        ]);
        if (outcome === 'OK') {
          expect(feedback).toEqual(['success']);
          // A identidade da consulta é protegida, não a abertura do editor.
          expect(find(render(), openDialog)).toBeUndefined();
          expect(requests.slice(beforeReply).map(({ url }) => url)).toEqual([investmentsUrl]);
          reread.resolve(Response.json([{ ...a, name: 'A confirmado' }, b]));
          await settle();
        } else {
          expect(feedback).toEqual(['error']);
          expect(find(editor(render()), field('name'))?.props.value).toBe('Rascunho B');
          expect(requests.slice(beforeReply)).toEqual([]);
        }
        if (detail) {
          expect(find(render(), (node) => node.type === 'h2')?.props.children).toBe(b.name);
          expect(find(render(), byType(InvestmentEntries))?.props.transactions[0]?.description).toBe('Histórico B');
        }
      });
    });
  }
}

test('carteira e detalhe instanciam o mesmo editor e confirmador de domínio, não a primitiva diretamente', async () => {
  await exercise(InvestmentsView, readFixture, async (render) => {
    edit(render(), a, false);
    const listEditor = find(render(), isOpen)!;
    listEditor.props.onOpenChange(false);
    confirmDelete(render(), false);
    const listConfirmation = find(render(), isOpen)!;
    listConfirmation.props.onOpenChange(false);
    portfolio(render()).props.onOpen(a);
    await settle();
    edit(render(), a, true);
    const detailEditor = find(render(), isOpen)!;
    detailEditor.props.onOpenChange(false);
    confirmDelete(render(), true);
    const detailConfirmation = find(render(), isOpen)!;
    expect(detailEditor.type).toBe(listEditor.type);
    expect(detailConfirmation.type).toBe(listConfirmation.type);
    expect(listEditor.type).toBe(InvestmentEditor);
    expect(listConfirmation.type).toBe(InvestmentDeleteConfirmation);
  });
});

for (const [kind, method, failure, url, submitLabel, placeholder, draft] of [
  ['criar investimento', 'POST', 400, investmentsUrl, 'Criar', 'Ex: PETR4, Tesouro IPCA, MXRF11...', 'Novo rascunho'],
  ['editar investimento', 'PUT', 400, investmentsUrl, 'Salvar', 'Ex: PETR4, Tesouro IPCA, MXRF11...', 'Nome editado'],
  ['registrar transação', 'POST', 500, transactionsUrl, 'Registrar', '0,00', '23.5'],
] as const) {
  for (const status of [failure, method === 'PUT' ? 200 : 201]) {
    test(`${kind}: HTTP ${status} determina se o formulário fecha ou mantém o rascunho`, async () => {
      await exercise(InvestmentsView, (request) => request.method === method ? new Response(null, { status }) : readFixture(request), async (render, requests, feedback) => {
        const portfolio = find(render(), byType(InvestmentPortfolio))!;
        if (url === transactionsUrl) {
          portfolio.props.onOpen(a);
          await settle();
          find(render(), byType(InvestmentEntries))!.props.onNew(trigger);
        } else if (method === 'PUT') portfolio.props.onEdit(a, trigger);
        else portfolio.props.onNew(trigger);
        find(render(), formField(placeholder))!.props.onChange({ target: { value: draft } });
        const before = requests.length;
        await find(find(render(), openDialog), withText(submitLabel))!.props.onClick();
        const dialog = find(render(), openDialog);
        expect(Boolean(dialog)).toBe(status === failure);
        expect(feedback).toEqual([status === failure ? 'error' : 'success']);
        const writes = requests.slice(before);
        expect(writes[0]).toMatchObject({ method, url });
        expect(JSON.parse(writes[0].body!)).toMatchObject(url === transactionsUrl
          ? { investmentId: a.id, amount: 23.5, type: "APORTE", quantity: null, unitPrice: null }
          : method === "PUT" ? { id: a.id, name: draft, investedAmount: 1200 } : { name: draft, investedAmount: 0 });
        if (status === failure) {
          expect(find(dialog, formField(placeholder))?.props.value).toBe(draft);
          expect(writes).toHaveLength(1);
        } else {
          expect(writes.slice(1).map(({ method, url }) => [method, url])).toEqual(url === transactionsUrl
            ? [['GET', `${transactionsUrl}?investmentId=a`], ['GET', investmentsUrl]] : [['GET', investmentsUrl]]);
        }
      });
    });
  }
}

for (const flow of ['carteira', 'detalhe investimento', 'detalhe plano'] as const) {
  for (const status of [500, 204]) {
    test(`excluir (${flow}): HTTP ${status} controla confirmação, detalhe e releitura`, async () => {
      const fromPlan = flow === 'detalhe plano';
      const fromList = flow === 'carteira';
      const url = fromPlan ? installmentsUrl : investmentsUrl;
      await exercise(fromPlan ? InstallmentsView : InvestmentsView, (request) => request.method === 'DELETE' ? new Response(null, { status }) : readFixture(request), async (render, requests, feedback) => {
        const portfolio = find(render(), byType(fromPlan ? InstallmentPortfolio : InvestmentPortfolio))!;
        if (!fromList) {
          portfolio.props.onOpen(fromPlan ? plan : a);
          await settle();
          find(render(), withText(fromPlan ? ' Excluir plano' : ' Excluir investimento'))!.props.onClick(trigger);
        } else portfolio.props.onDelete(a.id, trigger);
        const dialog = find(render(), openDialog)!;
        const before = requests.length;
        const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
        const pending = find(dialog, withText('Excluir'))!.props.onClick(event);
        if (!event.defaultPrevented) dialog.props.onOpenChange(false);
        await pending;
        await settle();
        const view = render();
        expect(Boolean(find(view, openDialog))).toBe(status === 500);
        expect(feedback).toEqual([status === 500 ? 'error' : 'success']);
        if (!fromList) expect(Boolean(find(view, byType(fromPlan ? InstallmentPortfolio : InvestmentPortfolio)))).toBe(status === 204);
        expect(requests.slice(before)).toEqual([
          { method: 'DELETE', url, body: JSON.stringify({ id: fromPlan ? plan.id : a.id }) },
          ...(status === 204 ? [{ method: 'GET', url, body: undefined }] : []),
        ]);
      });
    });
  }
}

test('ao abrir B, esconde o histórico e os totais de A durante o GET e após erro', async () => {
  let completeB!: (response: Response) => void;
  const pendingB = new Promise<Response>((resolve) => { completeB = resolve; });
  await exercise(InvestmentsView, (request) => request.url === `${transactionsUrl}?investmentId=b` ? pendingB : readFixture(request), async (render) => {
    const open = (record: typeof a) => find(render(), byType(InvestmentPortfolio))!.props.onOpen(record);
    open(a);
    await settle();
    expect(find(render(), byType(InvestmentEntries))?.props.transactions[0]?.description).toBe("Histórico A");
    find(render(), withText(' Voltar aos investimentos'))!.props.onClick();
    open(b);
    expect(find(render(), (element) => element.type === 'h2')?.props.children).toBe(b.name);
    expect(find(render(), byType(InvestmentEntries))).toBeUndefined();
    expect(find(render(), (element) => element.props.label === 'Resumo das transações')).toBeUndefined();
    expect(find(render(), (element) => element.props.role === 'status')).toBeDefined();
    completeB(new Response(null, { status: 503 }));
    await settle();
    expect(find(render(), byType(InvestmentEntries))).toBeUndefined();
    expect(find(render(), (element) => element.props.role === 'alert')).toBeDefined();
  });
});

test('A → B → A só publica o histórico da segunda abertura de A, mesmo se as duas respostas antigas chegarem depois', async () => {
  const complete: ((response: Response) => void)[] = [];
  await exercise(InvestmentsView, (request) => request.url.startsWith(`${transactionsUrl}?`) ? new Promise<Response>((resolve) => { complete.push(resolve); }) : readFixture(request), async (render) => {
    const open = (record: typeof a) => find(render(), byType(InvestmentPortfolio))!.props.onOpen(record);
    const back = () => find(render(), withText(' Voltar aos investimentos'))!.props.onClick();
    open(a); back(); open(b); back(); open(a);
    complete[2](history("A atual"));
    await settle();
    const displayed = () => find(render(), byType(InvestmentEntries))?.props.transactions[0]?.description;
    expect(displayed()).toBe("A atual");
    complete[1](history("B atrasado"));
    await settle();
    const afterB = displayed();
    complete[0](history("A atrasado"));
    await settle();
    expect([afterB, displayed()]).toEqual(["A atual", "A atual"]);
  });
});

for (const [label, View, url, id] of [
  ['investimento', InvestmentsView, investmentsUrl, a.id],
  ['plano', InstallmentsView, installmentsUrl, plan.id],
] as const) {
  test(`a confirmação pendente não reenvia DELETE de ${label}`, async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { finish = resolve; });
    await exercise(View, (request) => request.method === 'DELETE' ? response : readFixture(request), async (render, requests, feedback) => {
      if (View === InvestmentsView) find(render(), byType(InvestmentPortfolio))!.props.onDelete(id, trigger);
      else {
        find(render(), byType(InstallmentPortfolio))!.props.onOpen(plan);
        await settle();
        find(render(), withText(' Excluir plano'))!.props.onClick(trigger);
      }
      const confirm = () => find(find(render(), openDialog), withText('Excluir'))!.props.onClick({ preventDefault() {} });
      const first = confirm();
      const duplicate = confirm();
      finish(new Response(null, { status: 500 }));
      await Promise.all([first, duplicate]);
      expect(requests.filter((request) => request.method === 'DELETE').map((request) => request.url)).toEqual([url]);
      expect(feedback).toEqual(['error']);
      expect(find(render(), openDialog)).toBeDefined();
    });
  });
}

for (const operation of ['edição', 'aporte'] as const) {
  test(`${operation}: sincroniza o detalhe aberto com o registro de mesmo ID na coleção`, async () => {
    let saved = false;
    await exercise(InvestmentsView, (request) => {
      if (request.method === (operation === 'edição' ? 'PUT' : 'POST')) {
        saved = true;
        return new Response(null, { status: operation === 'edição' ? 200 : 201 });
      }
      if (saved && request.url === investmentsUrl) return Response.json([b, { ...a, name: "A confirmado", currentBalance: 1567 }]);
      if (saved && request.url === `${transactionsUrl}?investmentId=a`) return history("Histórico atualizado");
      return readFixture(request);
    }, async (render) => {
      find(render(), byType(InvestmentPortfolio))!.props.onOpen(a);
      await settle();
      if (operation === 'edição') {
        find(render(), withText(' Editar investimento'))!.props.onClick(trigger);
        find(render(), (element) => element.props.id === 'investment-form-name')!.props.onChange({ target: { value: 'A editado' } });
      } else {
        find(render(), byType(InvestmentEntries))!.props.onNew(trigger);
        find(render(), formField('0,00'))!.props.onChange({ target: { value: '217' } });
      }
      await find(find(render(), openDialog), withText(operation === 'edição' ? 'Salvar' : 'Registrar'))!.props.onClick();
      await settle();
      const detail = render();
      const position = find(detail, (element) => element.props.label === 'Posição do investimento');
      expect(find(detail, (element) => element.type === "h2")?.props.children).toBe("A confirmado");
      expect(position?.props.metrics[0].value).toBe('R$ 1.567,00');
      expect(find(detail, byType(InvestmentEntries))?.props.transactions[0]?.description).toBe("Histórico atualizado");
    });
  });
}

test('releitura tardia da edição em A atualiza a coleção sem publicar A no detalhe B', async () => {
  let saved = false;
  let finish!: (response: Response) => void;
  const refreshed = new Promise<Response>((resolve) => { finish = resolve; });
  await exercise(InvestmentsView, (request) => {
    if (request.method === 'PUT') { saved = true; return new Response(null, { status: 200 }); }
    if (saved && request.url === investmentsUrl) return refreshed;
    if (request.url === `${transactionsUrl}?investmentId=b`) return history("Histórico B");
    return readFixture(request);
  }, async (render) => {
    const open = (record: typeof a) => find(render(), byType(InvestmentPortfolio))!.props.onOpen(record);
    const back = () => find(render(), withText(' Voltar aos investimentos'))!.props.onClick();
    open(a);
    await settle();
    find(render(), withText(' Editar investimento'))!.props.onClick(trigger);
    await find(find(render(), openDialog), withText('Salvar'))!.props.onClick();
    back(); open(b);
    await settle();
    finish(Response.json([{ ...a, name: "A confirmado", currentBalance: 1567 }, b]));
    await settle();
    expect(find(render(), (element) => element.type === "h2")?.props.children).toBe(b.name);
    expect(find(render(), byType(InvestmentEntries))?.props.transactions[0]?.description).toBe("Histórico B");
    back();
    expect(find(render(), byType(InvestmentPortfolio))?.props.records[0].name).toBe("A confirmado");
  });
});

for (const hadFocus of [true, false]) {
  test(`pagamento ${hadFocus ? 'protege foco do botão que será desabilitado' : 'não captura foco de outro controle'}`, async () => {
    const installment = { id: "p-1", installmentPlanId: plan.id, number: 1, dueDate: plan.startDate, paidDate: null, amount: plan.monthlyValue, status: "PENDING" };
    let paid = false;
    const fallback = { focus: () => { ownerDocument.activeElement = fallback; } };
    const deliberateFocus = {};
    const ownerDocument = { activeElement: deliberateFocus, getElementById: (id: string) => id === "plan-detail-title" ? fallback : null };
    const button = { ownerDocument };
    if (hadFocus) ownerDocument.activeElement = button;
    await exercise(InstallmentsView, (request) => {
      if (request.method === 'POST') { paid = true; return Response.json({}); }
      if (request.url === `${installmentsUrl}?id=p`) return Response.json({ ...plan, installments: [paid ? { ...installment, status: "PAID" } : installment] });
      return readFixture(request);
    }, async (render, requests) => {
      find(render(), byType(InstallmentPortfolio))!.props.onOpen(plan);
      await settle();
      const entries = find(render(), byType(InstallmentEntries))!;
      const buttonElement = find(withPtIntlDispatcher(() => InstallmentEntries(entries.props as Parameters<typeof InstallmentEntries>[0])), (element) => element.props["aria-label"] === "Pagar parcela 1 de 2")!;
      const payment = buttonElement.props.onClick({ currentTarget: button });
      expect(ownerDocument.activeElement).toBe(hadFocus ? fallback : deliberateFocus);
      ownerDocument.activeElement = deliberateFocus;
      await payment;
      await settle();
      expect(ownerDocument.activeElement).toBe(deliberateFocus);
      expect(requests.find((request) => request.method === "POST")).toEqual({ method: "POST", url: `${installmentsUrl}/pay`, body: JSON.stringify({ installmentId: "p-1" }) });
      const refreshed = find(render(), byType(InstallmentEntries))!;
      expect(refreshed.props.plan.installments[0].status).toBe("PAID");
    });
  });
}

function elementPath(node: ReactNode, predicate: (element: Element) => boolean): Element[] | undefined {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, any>>(element)) continue;
    if (predicate(element)) return [element];
    const path = elementPath(element.props.children, predicate);
    if (path) return [element, ...path];
  }
}

for (const status of [200, 503]) {
  test(`refresh HTTP ${status} após pagar preserva o controle Excluir e bloqueia ações obsoletas`, async () => {
    const pending = { id: 'p-1', installmentPlanId: plan.id, number: 1, dueDate: plan.startDate, paidDate: null, amount: plan.monthlyValue, status: 'PENDING' };
    let finishPayment!: (response: Response) => void;
    let finishRefresh!: (response: Response) => void;
    const payment = new Promise<Response>((resolve) => { finishPayment = resolve; });
    const refresh = new Promise<Response>((resolve) => { finishRefresh = resolve; });
    let detailReads = 0;
    await exercise(InstallmentsView, (request) => {
      if (request.method === 'POST') return payment;
      if (request.url === `${installmentsUrl}?id=p`) return ++detailReads === 1 ? Response.json({ ...plan, installments: [pending] }) : refresh;
      return readFixture(request);
    }, async (render, requests) => {
      const deletePath = () => elementPath(render(), (element) => withText(' Excluir plano')(element) && !!element.props.onClick);
      const identity = (path: Element[]) => path.map((element) => [element.type, element.key]);
      find(render(), byType(InstallmentPortfolio))!.props.onOpen(plan);
      await settle();
      const pay = find(render(), byType(InstallmentEntries))!.props.onPay(pending.id);
      // O navegador pode mover o foco para Excluir enquanto o POST está retido.
      const beforeRefresh = identity(deletePath()!);
      finishPayment(Response.json({}));
      await settle();
      expect(deletePath()).toBeDefined();
      expect(identity(deletePath()!)).toEqual(beforeRefresh);
      expect(deletePath()!.at(-1)?.props.disabled).toBeFalsy();
      expect(deletePath()!.at(-1)?.props['aria-disabled']).toBe(true);
      deletePath()!.at(-1)!.props.onClick(trigger);
      expect(find(render(), openDialog)).toBeUndefined();
      expect(find(render(), byType(InstallmentEntries))).toBeUndefined();
      expect(find(render(), (element) => element.props.role === 'status')).toBeDefined();
      finishRefresh(status === 200 ? Response.json({ ...plan, installments: [{ ...pending, status: "PAID" }] }) : new Response(null, { status }));
      await pay;
      await settle();
      expect(identity(deletePath()!)).toEqual(beforeRefresh);
      expect(Boolean(deletePath()!.at(-1)?.props['aria-disabled'])).toBe(status !== 200);
      expect(find(render(), byType(InstallmentEntries))?.props.plan.installments[0].status).toBe(status === 200 ? 'PAID' : undefined);
      expect(requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    });
  });
}

test('createPlan bloqueia envio duplicado enquanto o POST está pendente', async () => {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => { finish = resolve; });
  await exercise(InstallmentsView, (request) => request.method === 'POST' ? response : readFixture(request), async (render, requests) => {
    find(render(), byType(InstallmentPortfolio))!.props.onNew(trigger);
    find(render(), formField('Ex: Financiamento do Apartamento...'))!.props.onChange({ target: { value: 'Financiamento' } });
    find(render(), formField('0,00'))!.props.onChange({ target: { value: '1000' } });
    find(render(), formField('12'))!.props.onChange({ target: { value: '10' } });
    const submitBtn = find(find(render(), openDialog), withText('Criar Plano'))!;
    const first = submitBtn.props.onClick();
    expect(find(find(render(), openDialog), withText('Criando…'))?.props.disabled).toBe(true);
    const second = submitBtn.props.onClick();
    finish(new Response(null, { status: 201 }));
    await Promise.all([first, second]);
    expect(requests.filter((request) => request.method === 'POST' && request.url === installmentsUrl)).toHaveLength(1);
  });
});

test('saveInvestment e saveTransaction validam campos obrigatórios antes de enviar POST', async () => {
  await exercise(InvestmentsView, (request) => readFixture(request), async (render, requests, feedback) => {
    const before = requests.length;
    find(render(), byType(InvestmentPortfolio))!.props.onNew(trigger);
    await find(find(render(), openDialog), withText('Criar'))!.props.onClick();
    expect(feedback).toEqual(['error']);
    expect(requests.slice(before)).toHaveLength(0);

    find(find(render(), openDialog), withText('Cancelar'))!.props.onClick();
    find(render(), byType(InvestmentPortfolio))!.props.onOpen(a);
    await settle();
    find(render(), byType(InvestmentEntries))!.props.onNew(trigger);
    await find(find(render(), openDialog), withText('Registrar'))!.props.onClick();
    expect(feedback).toEqual(['error', 'error']);
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });
});

test('Investimentos calcula dividendos recebidos reais a partir das transações de dividendo', async () => {
  await exercise(InvestmentsView, (request) => {
    if (request.url === transactionsUrl) {
      return Response.json([
        { id: 'd1', investmentId: a.id, type: 'DIVIDENDO', amount: 45.5, date: '2026-05-01' },
        { id: 'd2', investmentId: b.id, type: 'DIVIDENDO', amount: 14.5, date: '2026-05-02' },
        { id: 'x1', investmentId: a.id, type: 'APORTE', amount: 500, date: '2026-05-03' },
      ]);
    }
    return readFixture(request);
  }, async (render) => {
    const portfolio = find(render(), byType(InvestmentPortfolio))!;
    expect(portfolio.props.summary.dividendsReceived).toBe(60);
  });
});

test('InvestmentsView edita e exclui transação individual via PUT/DELETE /api/investments/transactions', async () => {
  const tx = { id: 'tx-edit', type: 'APORTE', amount: 100, date: '2026-05-01', description: 'Aporte inicial' };
  await exercise(InvestmentsView, (request) => {
    if (request.url === `${transactionsUrl}?investmentId=a`) return Response.json([tx]);
    if (request.method === 'PUT' && request.url === transactionsUrl) return Response.json({ ...tx, amount: 250 });
    if (request.method === 'DELETE' && request.url.startsWith(`${transactionsUrl}?id=`)) return Response.json({ success: true });
    return readFixture(request);
  }, async (render, requests, feedback) => {
    find(render(), byType(InvestmentPortfolio))!.props.onOpen(a);
    await settle();
    const entries = find(render(), byType(InvestmentEntries))!;
    entries.props.onEdit(tx, trigger);
    find(render(), formField('0,00'))!.props.onChange({ target: { value: '250' } });
    await find(find(render(), openDialog), withText('Salvar'))!.props.onClick();
    await settle();

    expect(requests.some((r) => r.method === 'PUT' && r.url === transactionsUrl && JSON.parse(r.body!).id === tx.id && JSON.parse(r.body!).amount === 250)).toBe(true);
    expect(feedback).toContain('success');

    find(render(), byType(InvestmentEntries))!.props.onDelete(tx, trigger);
    const deleteDialog = find(render(), openDialog)!;
    await find(deleteDialog, withText('Excluir'))!.props.onClick({ preventDefault() {} });
    await settle();

    expect(requests.some((r) => r.method === 'DELETE' && r.url === `${transactionsUrl}?id=${tx.id}`)).toBe(true);
  });
});

test('InvestmentEditor adota FinanceFormDialogShell com papel dialog, closeLabel e rodapé específico', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSave = async () => {};
  const element = withPtIntlDispatcher(() =>
    InvestmentEditor({
      mode: 'create',
      open: true,
      saving: true,
      form: {
        name: '', type: 'STOCK', description: '', investedAmount: '', yieldRate: '0',
        brokerage: '', ticker: '', accountId: '', categoryId: '',
      },
      accounts: [],
      categories: [],
      onFieldChange: () => {},
      onOpenChange,
      onCloseAutoFocus,
      onSave,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBe('Fechar formulário');
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(element.props.onOpenChange).toBe(onOpenChange);

  const dialog = find(element, byType(Dialog));
  expect(dialog).toBeDefined();
  expect(find(element, byType(AlertDialog))).toBeUndefined();
  const content = find(element, byType(DialogContent));
  expect(content?.props.showCloseButton).toBe(false);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(content?.props.className).toContain('motion-reduce:animate-none');
  const closeButton = find(find(element, byType(DialogClose)), (node) => node.props['aria-label'] === 'Fechar formulário');
  expect(closeButton).toBeDefined();
  expect(find(element, withText('Novo Investimento'))).toBeDefined();
  expect(find(element, withText('Preencha os dados do novo investimento'))).toBeDefined();
  expect(find(element, withText('Cancelar'))).toBeDefined();
  expect(find(element, withText('Salvando…'))?.props.disabled).toBe(true);
});

test('InvestmentDeleteConfirmation adota FinanceConfirmationDialogShell com papel alertdialog, pendência e tokens destrutivos', () => {
  let confirmed = 0;
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const element = withPtIntlDispatcher(() =>
    InvestmentDeleteConfirmation({
      open: true,
      deleting: true,
      investmentName: 'Tesouro QA',
      onOpenChange,
      onCloseAutoFocus,
      onConfirm: async () => { confirmed++; },
    }),
  );

  expect(element.type).toBe(FinanceConfirmationDialogShell);
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(element.props.onOpenChange).toBe(onOpenChange);

  const alertDialog = find(element, byType(AlertDialog));
  expect(alertDialog).toBeDefined();
  expect(find(element, byType(Dialog))).toBeUndefined();
  const content = find(element, byType(AlertDialogContent));
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(content?.props.className).toContain('motion-reduce:animate-none');
  expect(find(element, withText('Excluir Investimento'))).toBeDefined();
  expect(find(element, byType(AlertDialogCancel))?.props.disabled).toBe(true);
  const action = find(element, byType(AlertDialogAction));
  expect(action?.props.disabled).toBe(true);
  expect(action?.props.className).toContain('bg-destructive');
  expect(action?.props.className).toContain('text-[var(--ds-destructive-fg)]');
  expect(action?.props.className).toContain('hover:bg-destructive');
  expect(action?.props.className).toContain('hover:underline');

  const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  void action?.props.onClick(event);
  expect(event.defaultPrevented).toBe(true);
  expect(confirmed).toBe(1);
});

test('renderiza InvestmentPortfolio e InstallmentPortfolio em pt, es e en sem chaves cruas', () => {
  const expected = {
    pt: { invest: 'Investimentos', installment: 'Parcelas e financiamentos' },
    es: { invest: 'Inversiones', installment: 'Cuotas y financiamientos' },
    en: { invest: 'Investments', installment: 'Installments &amp; financing' },
  } as const;
  for (const locale of CANONICAL_LOCALES) {
    const invHtml = renderWithIntl(
      <InvestmentPortfolio
        summary={{ totalInvested: 1200, currentTotal: 1350, rentabilidade: 12.5, dividendsReceived: 12.34 }}
        count={1}
        records={[a]}
        filter="all"
        onFilter={() => {}}
        onNew={() => {}}
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
      locale,
    );
    expect(invHtml).toContain(expected[locale].invest);
    expect(invHtml).not.toContain('MISSING_MESSAGE');

    const instHtml = renderWithIntl(
      <InstallmentPortfolio
        count={1}
        records={[plan]}
        summary={{ totalFinanced: 900, totalPaid: 0, remaining: 900, overdueCount: 0 }}
        filter="all"
        onFilter={() => {}}
        onNew={() => {}}
        onOpen={() => {}}
      />,
      locale,
    );
    expect(instHtml).toContain(expected[locale].installment);
    expect(instHtml).not.toContain('MISSING_MESSAGE');
  }
});
