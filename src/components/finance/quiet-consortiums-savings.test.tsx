/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import * as consortiums from './consortiums-view';
import { ConsortiumEditor } from './consortium-editor';
import { ConsortiumDeleteConfirmation } from './consortium-delete-confirmation';
import { ConsortiumInstallmentPayment } from './consortium-installment-payment';
import * as savings from './savings-view';
import { SavingsGoalEditor } from './savings-goal-editor';
import { SavingsContributionDialog } from './savings-contribution-dialog';
import { FinanceProgress } from '@/components/shared/finance-progress';
import React, { type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FinanceConfirmationDialogShell, FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { renderToStaticMarkup } from 'react-dom/server';
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

const consortium = {
  id: 'c1', description: 'Cota sintética', group: '27', quota: '12', administrator: 'Administradora teste',
  totalAmount: 1000, fundedAmount: 250, monthlyPayment: 125, installmentCount: 8, paidInstallments: 2,
  startDate: '2026-01-01', endDate: null, nextAssemblyDate: '2026-05-15', assembliesAttended: 1,
  status: 'CONTEMPLATED', categoryId: null, category: null, accountId: null, isActive: true,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
};
const otherConsortium = { ...consortium, id: 'outra-cota', description: 'Outra cota sintética', assembliesAttended: 8 };
const goal = {
  id: 'g1', name: 'Reserva sintética', type: 'EMERGENCY_FUND', description: null,
  targetAmount: 500, currentAmount: 200, monthlyContribution: 50, yieldRate: null, targetDate: null,
  accountId: 'a1', color: '#f43f5e', isCompleted: false, createdAt: '2026-01-01',
  account: { id: 'a1', name: 'Conta sintética' },
};
const noop = () => {};

test('consórcio expõe detalhe, edição, exclusão e progresso sem cartão decorativo', () => {
  expect(consortiums).toHaveProperty('ConsortiumRow');
  const { ConsortiumRow } = consortiums;
  const html = renderToStaticMarkup(<ConsortiumRow consortium={consortium} onOpen={noop} onEdit={noop} onDelete={noop} />);
  expect(html).toMatch(/<li[ >]/);
  expect(html).toContain('Contemplado');
  expect(html).toMatch(/<button [^>]*aria-label="Abrir consórcio Cota sintética"/);
  expect(html).toContain('aria-label="Editar consórcio Cota sintética"');
  expect(html).toContain('aria-label="Excluir consórcio Cota sintética"');
  expect(html).toMatch(/role="progressbar"[^>]*aria-label="Progresso do financiamento de Cota sintética"[^>]*aria-valuenow="25"/);
  expect(html).toContain('R$ 125,00');
  expect(html).not.toMatch(/gradient|card-glow/);
});

test('caixinha expõe depósito, conta vinculada e progresso sem depender da cor salva', () => {
  expect(savings).toHaveProperty('SavingsGoalRow');
  const { SavingsGoalRow } = savings;
  const html = renderToStaticMarkup(<SavingsGoalRow goal={goal} onDeposit={noop} onEdit={noop} onDelete={noop} />);
  expect(html).toMatch(/<li[ >]/);
  expect(html).toContain('Conta sintética');
  expect(html).toMatch(/<button [^>]*aria-label="Depositar em Reserva sintética"/);
  expect(html).toContain('aria-label="Mais ações de Reserva sintética"');
  expect(html).toMatch(/<div\b(?=[^>]*\brole="progressbar")(?=[^>]*\baria-label="Progresso da meta Reserva sintética")(?=[^>]*\baria-valuenow="40")[^>]*>/);
  expect(html).toContain('R$ 200,00');
  expect(html).not.toMatch(/gradient|card-glow|#f43f5e/);
});

test('detalhe do consórcio renderiza progresso, assembleias e a ação da parcela pendente', () => {
  expect(consortiums).toHaveProperty('ConsortiumDetail');
  const { ConsortiumDetail } = consortiums;
  const installment = { id: 'i1', number: 3, amount: 125, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: consortium.id };
  const render = (fundedAmount: number, assembliesAttended: number) => renderToStaticMarkup(
    <ConsortiumDetail consortium={{ ...consortium, fundedAmount, assembliesAttended }} installments={[installment]} onPay={noop} />);
  const before = render(250, 1);
  const after = render(375, 2);
  expect(before).toContain('aria-valuenow="25"');
  expect(after).toContain('aria-valuenow="38"');
  expect(after).toContain('R$ 375,00');
  expect(after).toMatch(/Assembleias assistidas<\/dt><dd[^>]*>2<\/dd>/);
  expect(after).toContain('aria-label="Marcar parcela 3 como paga"');
});

test('detalhe não exibe nem oferece pagamento de parcela de outra cota', () => {
  const html = renderToStaticMarkup(<consortiums.ConsortiumDetail consortium={consortium} onPay={noop}
    installments={[{ id: 'i2', number: 42, amount: 125, dueDate: '2026-05-01', paidDate: null,
      status: 'PENDING', notes: 'Outra cota sintética', assemblyDate: null, assemblyResult: '', consortiumId: 'c2' }]} />);
  expect(html).not.toContain('Parcela 42');
  expect(html).not.toContain('Outra cota sintética');
  expect(html).not.toContain('Marcar como paga');
});

test('carregamento e erro não reaproveitam parcelas pendentes da seleção', () => {
  const installment = { id: 'i1', number: 3, amount: 125, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: consortium.id };
  for (const [installmentLoad, message] of [['loading', 'Carregando parcelas'], ['error', 'Não foi possível carregar as parcelas']] as const) {
    const html = renderToStaticMarkup(<consortiums.ConsortiumDetail consortium={consortium} onPay={noop}
      installments={[installment]} installmentLoad={installmentLoad} />);
    expect(html).toContain(message);
    expect(html).not.toContain('Marcar como paga');
  }
});

test('as duas telas colocam a faixa de dados antes dos registros e não usam gradiente ornamental', async () => {
  for (const name of ['consortiums-view.tsx', 'savings-view.tsx']) {
    const source = await Bun.file(new URL(name, import.meta.url)).text();
    const position = source.indexOf('<dl aria-label=');
    expect(position).toBeGreaterThan(-1);
    expect(source.indexOf('<ul', position)).toBeGreaterThan(position);
    expect(source).not.toMatch(/bg-gradient|linear-gradient|card-glow|<StatCard\b/);
  }
});

test('a view aplica os guards ao publicar parcelas, abrir diálogo e antes do POST', async () => {
  const source = await Bun.file(new URL('consortiums-view.tsx', import.meta.url)).text();
  const between = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end));
  const load = between('const fetchInstallments', 'const fetchCategories');
  expect(load).toMatch(/readConsortiumInstallments[\s\S]*isCurrentConsortiumSelection[\s\S]*setInstallments/);
  expect(between('const openPayDialog', 'const createConsortium')).toMatch(/findPayableConsortiumInstallment[\s\S]*if \(!installment\) return[\s\S]*setPayConfirmation/);
  expect(between('const markAsPaid', 'const dialogOrigin')).toMatch(/findPayableConsortiumInstallment[\s\S]*if \(!installment\) return[\s\S]*installmentId: installment.id[\s\S]*method: 'POST'/);
  const submit = between('const markAsPaid', 'const dialogOrigin');
  expect(submit).toMatch(/currentConfirmation.current !== confirmation[\s\S]*pendingConsortiumPayments.current.add[\s\S]*method: 'POST'/);
  expect(between('const closeConsortium', 'const openCreateDialog')).toMatch(/currentOpening.current = null[\s\S]*abort\(\)[\s\S]*closePayDialog\(\)/);
  expect(source).toContain('onClick={closeConsortium}');
});

test('a conclusão do pagamento relê a abertura vigente do alvo e atualiza a lista sem depender dela', async () => {
  const source = await Bun.file(new URL('consortiums-view.tsx', import.meta.url)).text();
  const submit = source.slice(source.indexOf('const markAsPaid'), source.indexOf('const dialogOrigin'));
  expect(submit).toMatch(/finally\s*\{[\s\S]*const refresh = resolveConsortiumPaymentRefresh\(currentOpening.current, opening, succeeded\);/);
  expect(submit).toMatch(/if \(refresh.detail\) void fetchInstallments\(refresh.detail\);/);
  expect(submit).toMatch(/if \(refresh.list\) void fetchConsortiums\(refresh.detail\);/);
  const collection = source.slice(source.indexOf('const fetchConsortiums'), source.indexOf('const closePayDialog'));
  expect(collection).toMatch(/if \(opening\) detailSummaryRequest.current = request/);
  expect(collection).toMatch(/request === listRequest.current\) setConsortiums\(rows\)/);
  expect(collection).toMatch(/opening && request === detailSummaryRequest.current\s*&& isCurrentConsortiumSelection\(currentOpening.current, opening\)/);
});

type ViewElement = ReactElement<Record<string, any>>;
const findElement = (node: ReactNode, matches: (element: ViewElement) => boolean): ViewElement | undefined => {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, any>>(child)) continue;
    if (matches(child)) return child;
    let content = child.props.children;
    if (child.type === ConsortiumEditor) {
      content = withPtIntlDispatcher(() => ConsortiumEditor((child as ReactElement<React.ComponentProps<typeof ConsortiumEditor>>).props));
    } else if (child.type === ConsortiumDeleteConfirmation) {
      content = withPtIntlDispatcher(() => ConsortiumDeleteConfirmation((child as ReactElement<React.ComponentProps<typeof ConsortiumDeleteConfirmation>>).props));
    } else if (child.type === ConsortiumInstallmentPayment) {
      content = withPtIntlDispatcher(() => ConsortiumInstallmentPayment((child as ReactElement<React.ComponentProps<typeof ConsortiumInstallmentPayment>>).props));
    } else if (child.type === SavingsGoalEditor) {
      content = withPtIntlDispatcher(() => SavingsGoalEditor((child as ReactElement<React.ComponentProps<typeof SavingsGoalEditor>>).props));
    } else if (child.type === SavingsContributionDialog) {
      content = withPtIntlDispatcher(() => SavingsContributionDialog((child as ReactElement<React.ComponentProps<typeof SavingsContributionDialog>>).props));
    } else if (child.type === FinanceFormDialogShell) {
      content = withPtIntlDispatcher(() => FinanceFormDialogShell((child as ReactElement<React.ComponentProps<typeof FinanceFormDialogShell>>).props));
    } else if (child.type === FinanceConfirmationDialogShell) {
      content = withPtIntlDispatcher(() => FinanceConfirmationDialogShell((child as ReactElement<React.ComponentProps<typeof FinanceConfirmationDialogShell>>).props));
    }
    const nested = findElement(content, matches);
    if (nested) return nested;
  }
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function exerciseConsortium(
  respond: (method: string) => Promise<Response>,
  run: (render: () => ViewElement, requests: [string, string, BodyInit | null | undefined][], feedback: string[]) => Promise<void>,
  readCollection = () => Response.json([otherConsortium, { ...consortium, nextAssemblyDate: '2026-05-15T00:00:00.000Z' }]),
) {
  // Executa o estado/handlers do componente sem DOM; a rede nunca chega ao serviço.
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const { success, error } = toast;
  const originalFetch = globalThis.fetch;
  const states: unknown[] = [], refs: { current: unknown }[] = [];
  const requests: [string, string, BodyInit | null | undefined][] = [];
  const feedback: string[] = [];
  const cleanups: (() => void)[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0, refIndex = 0;
    const effects: (() => void)[] = [];
    dispatcher.H = {
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    };
    try {
      const view = consortiums.ConsortiumsView();
      mounted = true;
      effects.forEach((effect) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      });
      return view;
    } finally { dispatcher.H = H; }
  }
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      requests.push([method, url, init?.body]);
      if (method !== 'GET') return respond(method);
      if (url === '/api/consortiums') return readCollection();
      return Response.json([]);
    }) as typeof fetch;
    toast.success = () => { feedback.push('success'); return 'success'; };
    toast.error = () => { feedback.push('error'); return 'error'; };
    render();
    await settle();
    await run(render, requests, feedback);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    globalThis.fetch = originalFetch;
    toast.success = success;
    toast.error = error;
  }
}

const trigger = { currentTarget: null };

test('lista e detalhe montam as mesmas folhas de edição e confirmação de consórcio', async () => {
  await exerciseConsortium(async () => { throw new Error('Nenhuma gravação esperada'); }, async (render, requests) => {
    const leaf = (type: typeof ConsortiumEditor | typeof ConsortiumDeleteConfirmation) => findElement(render(), (e) => e.type === type && e.props.open)?.type;
    const row = findElement(render(), (e) => e.type === consortiums.ConsortiumRow && e.props.consortium.id === consortium.id)!;
    row.props.onEdit(trigger);
    const listEditor = leaf(ConsortiumEditor);
    row.props.onDelete(trigger);
    const listConfirmation = leaf(ConsortiumDeleteConfirmation);
    row.props.onOpen(trigger);
    formButton(render(), 'Editar').props.onClick(trigger);
    const detailEditor = leaf(ConsortiumEditor);
    formButton(render(), 'Excluir').props.onClick(trigger);
    const detailConfirmation = leaf(ConsortiumDeleteConfirmation);
    expect([listEditor, listConfirmation, detailEditor, detailConfirmation].map((type) => typeof type)).toEqual([
      'function', 'function', 'function', 'function',
    ]);
    expect(listEditor).toBe(detailEditor);
    expect(listConfirmation).toBe(detailConfirmation);
    expect(requests.every(([method]) => method === 'GET')).toBe(true);
  });
});

const openFormDialog = (render: () => ViewElement) => findElement(render(), e => e.type === Dialog && e.props.open);
const formButton = (root: ViewElement, label: string) => findElement(root, e => e.props.onClick && React.Children.toArray(e.props.children).some(child => typeof child === 'string' && child.trim() === label))!;
const openForm = (render: () => ViewElement, method: 'POST' | 'PUT', id: string) => {
  if (method === 'POST') formButton(render(), 'Novo consórcio').props.onClick(trigger);
  else findElement(render(), e => e.type === consortiums.ConsortiumRow && e.props.consortium.id === id)!.props.onEdit(trigger);
};

const rowById = (view: ViewElement, id = consortium.id) => findElement(view, (e) => e.type === consortiums.ConsortiumRow && e.props.consortium.id === id);
const activeDetail = (view: ViewElement) => findElement(view, (e) => e.type === consortiums.ConsortiumDetail)?.props.consortium;
const activeConfirmation = (render: () => ViewElement) => findElement(render(), (e) => e.type === AlertDialog && e.props.open);
const openByOrigin = (render: () => ViewElement, origin: 'list' | 'detail', action: 'Edit' | 'Delete') => {
  const row = rowById(render())!;
  if (origin === 'list') row.props[`on${action}`](trigger);
  else {
    row.props.onOpen();
    formButton(render(), action === 'Edit' ? 'Editar' : 'Excluir').props.onClick(trigger);
  }
};

for (const origin of ['list', 'detail'] as const) {
  test(`DELETE (${origin}): cancelar sem escrever conserva o contexto e a descrição própria`, async () => {
    await exerciseConsortium(async () => { throw new Error('Nenhuma gravação esperada'); }, async (render, requests) => {
      openByOrigin(render, origin, 'Delete');
      const confirmation = activeConfirmation(render)!;
      const explanation = findElement(confirmation, (e) => e.type === AlertDialogDescription)!;
      const html = renderToStaticMarkup(<>{explanation.props.children}</>);
      if (origin === 'list') {
        expect(html).toContain('todas as parcelas associadas serão removidas');
        expect(html).not.toContain(consortium.description);
      } else {
        expect(html).toContain(consortium.description);
        expect(html).not.toContain('todas as parcelas associadas');
      }
      const offset = requests.length;
      confirmation.props.onOpenChange(false);
      expect(activeConfirmation(render)).toBeUndefined();
      expect(requests.slice(offset)).toEqual([]);
      expect(activeDetail(render())?.id).toBe(origin === 'detail' ? consortium.id : undefined);
    });
  });

  for (const switchToB of [false, true]) {
    test(`DELETE (${origin}): A capturado e travado; sucesso atualiza lista ${switchToB ? 'sem fechar ou reidratar B' : 'e fecha a seleção de A'}`, async () => {
      const response = Promise.withResolvers<Response>();
      let deleted = false;
      await exerciseConsortium(() => response.promise, async (render, requests, feedback) => {
        openByOrigin(render, origin, 'Delete');
        const confirmation = activeConfirmation(render)!;
        const submit = findElement(confirmation, (e) => e.type === AlertDialogAction)!;
        const offset = requests.length;
        const pending = submit.props.onClick({ preventDefault: noop });
        await submit.props.onClick({ preventDefault: noop });
        confirmation.props.onOpenChange(false);
        expect(activeConfirmation(render)).toBeDefined();
        expect(findElement(activeConfirmation(render), (e) => e.type === AlertDialogAction)?.props.disabled).toBe(true);
        if (switchToB) {
          useAppStore.getState().setSelectedConsortiumId(otherConsortium.id);
          await settle();
          expect(activeDetail(render())).toEqual(otherConsortium);
        }
        deleted = true;
        response.resolve(new Response(null, { status: 204 }));
        await pending;
        await settle();
        const installmentsReads: typeof requests = switchToB
          ? [['GET', '/api/consortiums/installments?consortiumId=outra-cota', undefined]]
          : [];
        expect(requests.slice(offset)).toEqual([
          ['DELETE', '/api/consortiums', '{"id":"c1"}'],
          ...installmentsReads,
          ['GET', '/api/consortiums', undefined],
        ]);
        expect(feedback).toEqual(['success']);
        expect(activeConfirmation(render)).toBeUndefined();
        expect(activeDetail(render())).toEqual(switchToB ? otherConsortium : undefined);
        if (switchToB) formButton(render(), 'Voltar aos consórcios').props.onClick();
        expect(rowById(render())).toBeUndefined();
        expect(rowById(render(), otherConsortium.id)?.props.consortium.assembliesAttended).toBe(99);
      }, () => Response.json(deleted ? [{ ...otherConsortium, assembliesAttended: 99 }] : [consortium, otherConsortium]));
    });
  }
}

for (const origin of ['list', 'detail'] as const) {
  for (const failure of ['http', 'invalid-json', 'transport'] as const) {
    test(`PUT (${origin}): ${failure} conserva rascunho, permite retry e não confunde GET malsucedido com PUT`, async () => {
      let retry = false;
      await exerciseConsortium(async () => {
        if (retry) return new Response(null, { status: 204 });
        if (failure === 'transport') throw new Error('Rede sintética');
        if (failure === 'invalid-json') return new Response('não JSON', { status: 503 });
        return Response.json({ error: 'Falha sintética' }, { status: 503 });
      }, async (render, requests, feedback) => {
        openByOrigin(render, origin, 'Edit');
        const draftField = (suffix: string) => findElement(openFormDialog(render), (e) => e.props.id === `consortium-${origin}-${suffix}`)!;
        expect(draftField('next-assembly').props.value).toBe('2026-05-15');
        expect(draftField('assemblies-attended').props.value).toBe('1');
        draftField('next-assembly').props.onChange({ target: { value: '2027-01-02' } });
        draftField('assemblies-attended').props.onChange({ target: { value: '0' } });
        const offset = requests.length;
        const put: (typeof requests)[number] = ['PUT', '/api/consortiums', '{"id":"c1","nextAssemblyDate":"2027-01-02","assembliesAttended":0}'];
        await formButton(openFormDialog(render)!, 'Salvar').props.onClick();
        expect(requests.slice(offset)).toEqual([put]);
        expect(feedback).toEqual(['error']);
        expect(draftField('next-assembly').props.value).toBe('2027-01-02');
        expect(draftField('assemblies-attended').props.value).toBe('0');
        retry = true;
        await formButton(openFormDialog(render)!, 'Salvar').props.onClick();
        await settle();
        expect(requests.slice(offset)).toEqual([put, put, ['GET', '/api/consortiums', undefined]]);
        expect(feedback).toEqual(['error', 'success']);
        expect(openFormDialog(render)).toBeUndefined();
        expect(activeDetail(render())?.id).toBe(origin === 'detail' ? consortium.id : undefined);
      }, () => retry ? new Response(null, { status: 503 }) : Response.json([
        { ...consortium, nextAssemblyDate: '2026-05-15T00:00:00.000Z' }, otherConsortium,
      ]));
    });
  }
}

for (const later of ['same', 'closed', 'other'] as const) {
  test(`PUT detalhe: releitura de A respeita seleção ${later}`, async () => {
    const response = Promise.withResolvers<Response>();
    let updated = false;
    await exerciseConsortium(() => response.promise, async (render, requests) => {
      openByOrigin(render, 'detail', 'Edit');
      findElement(openFormDialog(render), (e) => e.props.id === 'consortium-detail-next-assembly')!.props.onChange({ target: { value: '' } });
      const offset = requests.length;
      const pending = formButton(openFormDialog(render)!, 'Salvar').props.onClick();
      if (later === 'closed') formButton(render(), 'Voltar aos consórcios').props.onClick();
      if (later === 'other') useAppStore.getState().setSelectedConsortiumId(otherConsortium.id);
      updated = true;
      response.resolve(new Response(null, { status: 204 }));
      await pending;
      await settle();
      expect(requests.slice(offset).filter(([method, url]) => method !== 'GET' || url === '/api/consortiums')).toEqual([
        ['PUT', '/api/consortiums', '{"id":"c1","nextAssemblyDate":null,"assembliesAttended":1}'],
        ['GET', '/api/consortiums', undefined],
      ]);
      expect(activeDetail(render())?.assembliesAttended).toBe(later === 'same' ? 7 : later === 'other' ? 8 : undefined);
      expect(openFormDialog(render)).toBeUndefined();
    }, () => Response.json(updated ? [{ ...consortium, assembliesAttended: 7 }, { ...otherConsortium, assembliesAttended: 99 }] : [consortium, otherConsortium]));
  });
}

for (const origin of ['lista', 'detalhe']) {
  test(`DELETE 503 (${origin}): envia a cota selecionada, mantém confirmação e não anuncia sucesso`, async () => {
    const response = Promise.withResolvers<Response>();
    await exerciseConsortium(() => response.promise, async (render, requests, feedback) => {
      const confirmation = () => findElement(render(), (element) => element.type === AlertDialog && element.props.open);
      const row = findElement(render(), (element) => element.type === consortiums.ConsortiumRow && element.props.consortium.id === 'c1')!;
      if (origin === 'detalhe') {
        row.props.onOpen(trigger);
        formButton(render(), 'Excluir').props.onClick(trigger);
      } else row.props.onDelete(trigger);
      const dialog = confirmation()!;
      const submit = findElement(dialog, (element) => element.type === AlertDialogAction)!;
      const offset = requests.length;
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      const pending = submit.props.onClick(event);
      // Dialog.Close do Radix só fecha automaticamente se o click não foi cancelado.
      if (!event.defaultPrevented) dialog.props.onOpenChange(false);
      const openWhilePending = Boolean(confirmation());
      response.resolve(new Response(null, { status: 503 }));
      await pending;
      await settle();
      expect(requests[offset]).toEqual(['DELETE', '/api/consortiums', '{"id":"c1"}']);
      expect({ openWhilePending, openAfter503: Boolean(confirmation()), feedback, additionalRequests: requests.slice(offset + 1) }).toEqual({
        openWhilePending: true, openAfter503: true, feedback: ['error'], additionalRequests: [],
      });
      if (origin === 'detalhe') expect(findElement(render(), (element) => element.type === consortiums.ConsortiumDetail)?.props.consortium.id).toBe('c1');
    });
  });
}

test('próxima assembleia é dia civil na lista e no detalhe, mesmo a oeste de UTC', () => {
  const previousTz = process.env.TZ;
  process.env.TZ = 'America/Bahia';
  try {
    const c = { ...consortium, nextAssemblyDate: '2026-12-10T00:00:00.000Z' };
    const row = renderToStaticMarkup(<consortiums.ConsortiumRow consortium={c} onOpen={noop} onEdit={noop} onDelete={noop} />);
    const detail = renderToStaticMarkup(<consortiums.ConsortiumDetail consortium={c} installments={[]} onPay={noop} />);
    expect([row.includes('10/12/2026'), detail.includes('10/12/2026')]).toEqual([true, true]);
  } finally {
    if (previousTz === undefined) delete process.env.TZ; else process.env.TZ = previousTz;
  }
});

for (const method of ['POST', 'PUT'] as const) {
  test(`${method}: clique duplo na mesma abertura envia uma requisição`, async () => {
    const response = Promise.withResolvers<Response>();
    await exerciseConsortium(() => response.promise, async (render, requests) => {
      openForm(render, method, 'c1');
      const submit = formButton(openFormDialog(render)!, method === 'POST' ? 'Criar Consórcio' : 'Salvar');
      const first = submit.props.onClick();
      const second = submit.props.onClick();
      response.resolve(new Response(null, { status: 204 }));
      await Promise.all([first, second]);
      expect(requests.filter(([m]) => m === method)).toHaveLength(1);
    });
  });

  for (const laterId of method === 'POST' ? ['c1'] : ['c1', 'outra-cota']) {
    test(`${method}: sucesso tardio não fecha nem sobrescreve a nova abertura (${laterId})`, async () => {
      const response = Promise.withResolvers<Response>();
      await exerciseConsortium(() => response.promise, async (render, requests) => {
        const submitLabel = method === 'POST' ? 'Criar Consórcio' : 'Salvar';
        const fieldId = method === 'POST' ? 'consortium-next-assembly' : 'consortium-list-next-assembly';
        openForm(render, method, 'c1');
        const first = formButton(openFormDialog(render)!, submitLabel).props.onClick();
        openFormDialog(render)!.props.onOpenChange(false);
        openForm(render, method, laterId);
        findElement(openFormDialog(render), e => e.props.id === fieldId)!.props.onChange({ target: { value: '2026-12-10' } });
        response.resolve(new Response(null, { status: 204 }));
        await first;
        const later = openFormDialog(render);
        expect(later?.props.open).toBe(true);
        expect(findElement(later, e => e.props.id === fieldId)?.props.value).toBe('2026-12-10');
        expect(requests.filter(([m]) => m === method)).toHaveLength(1);
      });
    });
  }
}

test('cadastro independente e PUT de outra cota podem enviar enquanto a primeira abertura está pendente', async () => {
  for (const method of ['POST', 'PUT'] as const) {
    const response = Promise.withResolvers<Response>();
    await exerciseConsortium(() => response.promise, async (render, requests) => {
      const submitLabel = method === 'POST' ? 'Criar Consórcio' : 'Salvar';
      openForm(render, method, 'c1');
      const first = formButton(openFormDialog(render)!, submitLabel).props.onClick();
      openFormDialog(render)!.props.onOpenChange(false);
      openForm(render, method, 'outra-cota');
      const second = formButton(openFormDialog(render)!, submitLabel).props.onClick();
      response.resolve(new Response(null, { status: 204 }));
      await Promise.all([first, second]);
      const writes = requests.filter(([m]) => m === method);
      expect(writes).toHaveLength(2);
      if (method === 'PUT') expect(writes.map(([, , body]) => JSON.parse(String(body)).id)).toEqual(['c1', 'outra-cota']);
    });
  }
});

// Portais Radix não aparecem no SSR; verificar o contrato das confirmações na view.
for (const [file, count] of [["consortium-delete-confirmation.tsx",1],["savings-view.tsx",1]] as const) {
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

import { useAppStore } from '@/lib/store';

test('consortiums-view exibe erro com retry quando /api/consortiums falha, usa Select de contas e consome selectedConsortiumId', async () => {
  const source = await Bun.file(new URL('consortiums-view.tsx', import.meta.url)).text();
  expect(source).not.toContain('<Input id="consortium-account"');
  expect(source).toContain('/api/accounts');
  expect(source).toContain('selectedConsortiumId');

  // Test error state on list fetch 503
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const originalFetch = globalThis.fetch;
  const states: unknown[] = [], refs: { current: unknown }[] = [];
  const cleanups: (() => void)[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0, refIndex = 0;
    const effects: (() => void)[] = [];
    dispatcher.H = {
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    };
    try {
      const view = consortiums.ConsortiumsView();
      mounted = true;
      effects.forEach((effect) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      });
      return view;
    } finally { dispatcher.H = H; }
  }
  try {
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    render();
    await settle();
    const html = renderToStaticMarkup(render());
    expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('Nenhum consórcio cadastrado');
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    globalThis.fetch = originalFetch;
  }

  // Test selectedConsortiumId opens detail and clears store selection
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.getState().setSelectedConsortiumId('c1');
  await exerciseConsortium(async () => new Response(null, { status: 204 }), async (renderWithStore) => {
    const detail = findElement(renderWithStore(), (e) => e.type === consortiums.ConsortiumDetail);
    expect(detail?.props.consortium.id).toBe('c1');
    expect(useAppStore.getState().selectedConsortiumId).toBeNull();
  });
});

test('savings-view exibe erro com retry quando /api/savings falha e consome newGoalRequested da store', async () => {
  const source = await Bun.file(new URL('savings-view.tsx', import.meta.url)).text();
  expect(source).toContain('newGoalRequested');
  expect(source).toContain('clearNewGoalRequest');

  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const originalFetch = globalThis.fetch;
  const states: unknown[] = [], refs: { current: unknown }[] = [];
  const cleanups: (() => void)[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0, refIndex = 0;
    const effects: (() => void)[] = [];
    dispatcher.H = {
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    };
    try {
      const view = savings.SavingsView();
      mounted = true;
      effects.forEach((effect) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      });
      return view;
    } finally { dispatcher.H = H; }
  }
  try {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.getState().requestNewGoal();
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    render();
    await settle();
    const view = render();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('Nenhuma meta de poupança cadastrada');
    const goalDialog = findElement(view, (e) => e.type === Dialog && e.props.open === true);
    expect(goalDialog).toBeDefined();
    expect(useAppStore.getState().newGoalRequested).toBe(false);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    globalThis.fetch = originalFetch;
    useAppStore.setState(useAppStore.getInitialState(), true);
  }
});

test('ConsortiumEditor adota FinanceFormDialogShell com papel dialog, sem closeLabel extra e com rodapé específico', () => {
  let cancelled = 0;
  const onCloseAutoFocus = () => {};
  const element = withPtIntlDispatcher(() =>
    ConsortiumEditor({
      origin: 'list',
      open: true,
      draft: { nextAssemblyDate: '2026-05-15', assembliesAttended: '1' },
      saving: true,
      onFieldChange: () => {},
      onCancel: () => { cancelled++; },
      onSave: async () => {},
      onCloseAutoFocus,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBeUndefined();
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);

  const dialog = findElement(element, (e) => e.type === Dialog);
  expect(dialog).toBeDefined();
  expect(findElement(element, (e) => e.type === AlertDialog)).toBeUndefined();
  const content = findElement(element, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(true);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(content?.props.className).toContain('max-h-[85dvh]');
  expect(findElement(element, (e) => React.Children.toArray(e.props.children).includes('Editar Consórcio'))).toBeDefined();
  const saveButton = findElement(element, (e) => e.props.onClick && React.Children.toArray(e.props.children).includes('Salvar'));
  expect(saveButton?.props.disabled).toBe(true);

  dialog?.props.onOpenChange(false);
  expect(cancelled).toBe(1);
});

test('ConsortiumDeleteConfirmation adota FinanceConfirmationDialogShell com papel alertdialog, pendência e tokens destrutivos', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onConfirm = async () => {};
  const element = withPtIntlDispatcher(() =>
    ConsortiumDeleteConfirmation({
      context: { origin: 'detail', description: 'Cota sintética' },
      open: true,
      deleting: true,
      onOpenChange,
      onConfirm,
      onCloseAutoFocus,
    }),
  );

  expect(element.type).toBe(FinanceConfirmationDialogShell);
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(element.props.onOpenChange).toBe(onOpenChange);

  const alertDialog = findElement(element, (e) => e.type === AlertDialog);
  expect(alertDialog).toBeDefined();
  expect(findElement(element, (e) => e.type === Dialog)).toBeUndefined();
  const content = findElement(element, (e) => e.type === AlertDialogContent);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(findElement(element, (e) => React.Children.toArray(e.props.children).includes('Excluir Consórcio'))).toBeDefined();
  expect(findElement(element, (e) => e.type === AlertDialogCancel)?.props.disabled).toBe(true);
  const action = findElement(element, (e) => e.type === AlertDialogAction);
  expect(action?.props.disabled).toBe(true);
  expect(action?.props.onClick).toBe(onConfirm);
  expect(action?.props.className).toContain('bg-destructive');
  expect(action?.props.className).toContain('text-[var(--ds-destructive-fg)]');
  expect(action?.props.className).toContain('hover:bg-destructive');
  expect(action?.props.className).toContain('hover:underline');
});

test('savings-view adota FinanceProgress em SavingsGoalRow preservando percentual, saldo e valores acessíveis', async () => {
  const source = await Bun.file(new URL('savings-view.tsx', import.meta.url)).text();
  expect(source).toContain("from '@/components/shared/finance-progress'");
  expect(source).toContain('<FinanceProgress');
  const html = renderToStaticMarkup(<savings.SavingsGoalRow goal={goal} onDeposit={noop} onEdit={noop} onDelete={noop} />);
  expect(html).toContain('data-slot="progress"');
  expect(html).toContain('aria-label="Progresso da meta Reserva sintética"');
  expect(html).toContain('aria-valuenow="40"');
  expect(html).toContain('aria-valuetext="40% · R$ 200,00 de R$ 500,00"');
  expect(html).toContain('Faltam R$ 300,00');
  const zeroHtml = renderToStaticMarkup(
    <savings.SavingsGoalRow goal={{ ...goal, currentAmount: 0 }} onDeposit={noop} onEdit={noop} onDelete={noop} />,
  );
  expect(zeroHtml).toContain('aria-valuenow="0"');
  expect(zeroHtml).toContain('0%');
});

test('SavingsGoalEditor adota FinanceFormDialogShell em criação e edição, sem closeLabel extra e com pendência', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const editEl = withPtIntlDispatcher(() =>
    SavingsGoalEditor({
      mode: 'edit',
      open: true,
      submitting: true,
      form: {
        name: 'Reserva sintética',
        type: 'EMERGENCY_FUND',
        description: '',
        targetAmount: '500',
        currentAmount: '0',
        monthlyContribution: '',
        yieldRate: '0',
        targetDate: '',
        accountId: 'none',
        color: '#10b981',
      },
      accounts: [{ id: 'a1', name: 'Conta sintética' }],
      onFieldChange: () => {},
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );

  expect(editEl.type).toBe(FinanceFormDialogShell);
  expect(editEl.props.closeLabel).toBeUndefined();
  expect(editEl.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const content = findElement(editEl, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(true);
  expect(content?.props.className).toContain('max-h-[85dvh]');
  expect(findElement(editEl, (e) => React.Children.toArray(e.props.children).includes('Editar Meta'))).toBeDefined();
  const submitBtn = findElement(editEl, (e) => e.props.onClick === onSubmit);
  expect(submitBtn?.props.disabled).toBe(true);

  const createEl = withPtIntlDispatcher(() =>
    SavingsGoalEditor({
      mode: 'create',
      open: true,
      submitting: false,
      form: {
        name: '',
        type: 'SAVINGS',
        description: '',
        targetAmount: '',
        currentAmount: '0',
        monthlyContribution: '',
        yieldRate: '',
        targetDate: '',
        accountId: 'none',
        color: '#10b981',
      },
      accounts: [],
      onFieldChange: () => {},
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );
  expect(findElement(createEl, (e) => React.Children.toArray(e.props.children).includes('Nova Meta de Poupança'))).toBeDefined();
  expect(findElement(createEl, (e) => e.props.onClick === onSubmit)?.props.disabled).toBe(false);
});

test('SavingsContributionDialog adota FinanceFormDialogShell preservando conta vinculada, saldo atual e pendência', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const element = withPtIntlDispatcher(() =>
    SavingsContributionDialog({
      open: true,
      submitting: true,
      goal,
      form: { amount: '50', description: '' },
      onFieldChange: () => {},
      onOpenChange,
      onCloseAutoFocus,
      onSubmit,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBeUndefined();
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const content = findElement(element, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(true);
  expect(content?.props.className).toContain('max-h-[85dvh]');
  expect(renderToStaticMarkup(<>{element.props.children}</>)).toContain('Conta vinculada: Conta sintética');
  expect(renderToStaticMarkup(<>{element.props.description}</>)).toContain('R$ 200,00');
  expect(findElement(element, (e) => e.props.onClick === onSubmit)?.props.disabled).toBe(true);
});

async function exerciseSavings(
  respond: (method: string, url: string) => Promise<Response>,
  run: (render: () => ViewElement, requests: [string, string, BodyInit | null | undefined][], feedback: string[]) => Promise<void>,
  initialGoals = [goal],
) {
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const { success, error } = toast;
  const originalFetch = globalThis.fetch;
  const states: unknown[] = [], refs: { current: unknown }[] = [];
  const requests: [string, string, BodyInit | null | undefined][] = [];
  const feedback: string[] = [];
  const cleanups: (() => void)[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0, refIndex = 0;
    const effects: (() => void)[] = [];
    dispatcher.H = {
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    };
    try {
      const view = savings.SavingsView();
      mounted = true;
      effects.forEach((effect) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      });
      return view;
    } finally { dispatcher.H = H; }
  }
  try {
    useAppStore.setState(useAppStore.getInitialState(), true);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      requests.push([method, url, init?.body]);
      if (url === '/api/savings' && method === 'GET') return Response.json(initialGoals);
      if (url === '/api/accounts' && method === 'GET') return Response.json([{ id: 'a1', name: 'Conta sintética' }]);
      return respond(method, url);
    }) as typeof fetch;
    toast.success = () => { feedback.push('success'); return 'success'; };
    toast.error = () => { feedback.push('error'); return 'error'; };
    render();
    await settle();
    await run(render, requests, feedback);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    globalThis.fetch = originalFetch;
    toast.success = success;
    toast.error = error;
    useAppStore.setState(useAppStore.getInitialState(), true);
  }
}

test('Caixinhas PUT preserva saldo, opcionais limpos como null e zero explícito', async () => {
  await exerciseSavings(async () => Response.json(goal), async (render, requests, feedback) => {
    const row = findElement(render(), (e) => e.type === savings.SavingsGoalRow && e.props.goal.id === 'g1')!;
    row.props.onEdit(null);
    let editor = findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open)!;
    expect(editor.props.form.currentAmount).toBe('200');
    editor.props.onFieldChange('description', '   ');
    editor.props.onFieldChange('monthlyContribution', '');
    editor.props.onFieldChange('yieldRate', '0');
    editor.props.onFieldChange('accountId', 'none');
    editor = findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open)!;
    const offset = requests.length;
    await editor.props.onSubmit();
    await settle();

    const putReq = requests.slice(offset).find(([m]) => m === 'PUT')!;
    expect(JSON.parse(String(putReq[2]))).toEqual({
      id: 'g1',
      name: 'Reserva sintética',
      type: 'EMERGENCY_FUND',
      description: null,
      targetAmount: 500,
      currentAmount: 200,
      monthlyContribution: null,
      yieldRate: 0,
      targetDate: null,
      accountId: null,
      color: '#f43f5e',
    });
    expect(feedback).toEqual(['success']);
    expect(findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open)).toBeUndefined();
  });
});

test('Caixinhas depósito omite description quando vazia e preserva saldo/erros sem fechar em falha', async () => {
  let failNext = true;
  await exerciseSavings(async () => {
    if (failNext) return Response.json({ error: 'Falha sintética' }, { status: 503 });
    return Response.json({ ...goal, currentAmount: 250 });
  }, async (render, requests, feedback) => {
    const row = findElement(render(), (e) => e.type === savings.SavingsGoalRow && e.props.goal.id === 'g1')!;
    row.props.onDeposit(null);
    let dialog = findElement(render(), (e) => e.type === SavingsContributionDialog && e.props.open)!;
    dialog.props.onFieldChange('amount', '50');
    dialog.props.onFieldChange('description', '   ');
    dialog = findElement(render(), (e) => e.type === SavingsContributionDialog && e.props.open)!;
    const offset = requests.length;
    await dialog.props.onSubmit();

    expect(findElement(render(), (e) => e.type === SavingsContributionDialog && e.props.open)?.props.form.amount).toBe('50');
    expect(feedback).toEqual(['error']);
    expect(requests.slice(offset).map(([m, u]) => [m, u])).toEqual([['POST', '/api/savings/deposit']]);

    failNext = false;
    await findElement(render(), (e) => e.type === SavingsContributionDialog && e.props.open)!.props.onSubmit();
    await settle();
    const postReq = requests.slice(offset + 1).find(([m]) => m === 'POST')!;
    expect(JSON.parse(String(postReq[2]))).toEqual({ savingsGoalId: 'g1', amount: 50 });
    expect(feedback).toEqual(['error', 'success']);
    expect(findElement(render(), (e) => e.type === SavingsContributionDialog && e.props.open)).toBeUndefined();
  });
});

for (const failure of ['http', 'transport'] as const) {
  test(`Caixinhas editor (${failure}): preserva aberto, rascunho e não dispara GET de sucesso`, async () => {
    await exerciseSavings(async () => {
      if (failure === 'transport') throw new Error('Rede sintética');
      return Response.json({ error: 'Falha sintética' }, { status: 503 });
    }, async (render, requests, feedback) => {
      formButton(render(), 'Nova meta').props.onClick({ currentTarget: null });
      let editor = findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open)!;
      editor.props.onFieldChange('name', 'Meta rascunho');
      editor.props.onFieldChange('targetAmount', '1000');
      editor = findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open)!;
      const offset = requests.length;
      await editor.props.onSubmit();

      const after = findElement(render(), (e) => e.type === SavingsGoalEditor && e.props.open);
      expect(after?.props.form.name).toBe('Meta rascunho');
      expect(after?.props.form.targetAmount).toBe('1000');
      expect(feedback).toEqual(['error']);
      expect(requests.slice(offset).map(([m, u]) => [m, u])).toEqual([['POST', '/api/savings']]);
    });
  });
}

test('Caixinhas exclusão: AlertDialogAction mantém fechamento automático sem preventDefault e não relê no erro', async () => {
  await exerciseSavings(async () => Response.json({ error: 'Falha' }, { status: 503 }), async (render, requests, feedback) => {
    const row = findElement(render(), (e) => e.type === savings.SavingsGoalRow && e.props.goal.id === 'g1')!;
    row.props.onDelete(null);
    const confirmation = activeConfirmation(render)!;
    const action = findElement(confirmation, (e) => e.type === AlertDialogAction)!;
    const offset = requests.length;
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    const pending = action.props.onClick(event);
    expect(event.defaultPrevented).toBe(false);
    await pending;
    expect(feedback).toEqual(['error']);
    expect(requests.slice(offset).map(([m, u]) => [m, u])).toEqual([['DELETE', '/api/savings']]);
  });
});

test('ConsortiumInstallmentPayment adota FinanceFormDialogShell com papel dialog, descrição da parcela e pendência', () => {
  let cancelled = 0;
  const onCloseAutoFocus = () => {};
  const onConfirm = async () => {};
  const element = withPtIntlDispatcher(() =>
    ConsortiumInstallmentPayment({
      open: true,
      installment: { number: 3, amount: 125 },
      form: {
        paidDate: '2026-05-10',
        notes: 'Pago via app',
        assemblyDate: '',
        assemblyResult: '',
      },
      submitting: true,
      onFieldChange: () => {},
      onCancel: () => { cancelled++; },
      onConfirm,
      onCloseAutoFocus,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBeUndefined();
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const dialog = findElement(element, (e) => e.type === Dialog);
  expect(dialog).toBeDefined();
  expect(findElement(element, (e) => e.type === AlertDialog)).toBeUndefined();
  const content = findElement(element, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(true);
  expect(content?.props.className).toContain('max-h-[85dvh]');
  expect(renderToStaticMarkup(<>{element.props.description}</>)).toContain('Parcela 3 — R$ 125,00');
  const confirmBtn = findElement(element, (e) => e.props.onClick === onConfirm);
  expect(confirmBtn?.props.disabled).toBe(true);
  dialog?.props.onOpenChange(false);
  expect(cancelled).toBe(1);
});

test('Baixa de consórcio A/B: trocar para B ou fechar A antes de confirmar não emite POST obsoleto', async () => {
  const instA = {
    id: 'inst-a-1', number: 1, amount: 125, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: consortium.id,
  };
  const instB = {
    id: 'inst-b-1', number: 1, amount: 250, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: otherConsortium.id,
  };
  const originalFetch = globalThis.fetch;
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const states: unknown[] = [], refs: { current: unknown }[] = [];
  const requests: [string, string, BodyInit | null | undefined][] = [];
  const cleanups: (() => void)[] = [];
  let mounted = false;
  function render() {
    let stateIndex = 0, refIndex = 0;
    const effects: (() => void)[] = [];
    dispatcher.H = {
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    };
    try {
      const view = consortiums.ConsortiumsView();
      mounted = true;
      effects.forEach((effect) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      });
      return view;
    } finally { dispatcher.H = H; }
  }
  try {
    useAppStore.setState(useAppStore.getInitialState(), true);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      requests.push([method, url, init?.body]);
      if (url === '/api/consortiums') return Response.json([consortium, otherConsortium]);
      if (url === `/api/consortiums/installments?consortiumId=${consortium.id}`) return Response.json([instA]);
      if (url === `/api/consortiums/installments?consortiumId=${otherConsortium.id}`) return Response.json([instB]);
      if (url === '/api/categories' || url === '/api/accounts') return Response.json([]);
      throw new Error(`Unexpected: ${method} ${url}`);
    }) as typeof fetch;

    render();
    await settle();
    rowById(render(), consortium.id)!.props.onOpen();
    await settle();
    const detailA = findElement(render(), (e) => e.type === consortiums.ConsortiumDetail)!;
    detailA.props.onPay(detailA.props.installments[0], trigger);
    const staleConfirm = findElement(render(), (e) => e.type === ConsortiumInstallmentPayment && e.props.open)!;
    expect(staleConfirm.props.installment.id).toBe(instA.id);

    // Troca para B antes de confirmar -> confirmação obsoleta de A fecha e onConfirm não dispara POST
    useAppStore.getState().setSelectedConsortiumId(otherConsortium.id);
    await settle();
    expect(activeDetail(render())?.id).toBe(otherConsortium.id);
    expect(findElement(render(), (e) => e.type === ConsortiumInstallmentPayment && e.props.open)).toBeUndefined();
    const beforeStale = requests.length;
    await staleConfirm.props.onConfirm();
    expect(requests.slice(beforeStale)).toEqual([]);

    // Abre confirmação em B, fecha B antes de confirmar -> confirmação obsoleta não dispara POST
    const detailB = findElement(render(), (e) => e.type === consortiums.ConsortiumDetail)!;
    detailB.props.onPay(detailB.props.installments[0], trigger);
    const closedConfirm = findElement(render(), (e) => e.type === ConsortiumInstallmentPayment && e.props.open)!;
    formButton(render(), 'Voltar aos consórcios').props.onClick();
    await settle();
    const beforeClosed = requests.length;
    await closedConfirm.props.onConfirm();
    expect(requests.slice(beforeClosed)).toEqual([]);
  } finally {
    cleanups.forEach((c) => c());
    globalThis.fetch = originalFetch;
    useAppStore.setState(useAppStore.getInitialState(), true);
  }
});

for (const outcome of ['ok', 'http503'] as const) {
  test(`Baixa de consórcio A→B durante POST (${outcome}): reconcilia finally sem repovoar B com A e trava clique repetido`, async () => {
    const instA = {
      id: 'inst-a-1', number: 1, amount: 125, dueDate: '2026-05-01', paidDate: null,
      status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: consortium.id,
    };
    const instB = {
      id: 'inst-b-1', number: 1, amount: 250, dueDate: '2026-05-01', paidDate: null,
      status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: otherConsortium.id,
    };
    const postDeferred = Promise.withResolvers<Response>();
    const originalFetch = globalThis.fetch;
    const { success, error } = toast;
    const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const { H } = dispatcher;
    const states: unknown[] = [], refs: { current: unknown }[] = [];
    const requests: [string, string, BodyInit | null | undefined][] = [];
    const feedback: string[] = [];
    const cleanups: (() => void)[] = [];
    let mounted = false;
    let updatedList = false;
    function render() {
      let stateIndex = 0, refIndex = 0;
      const effects: (() => void)[] = [];
      dispatcher.H = {
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
        useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
      };
      try {
        const view = consortiums.ConsortiumsView();
        mounted = true;
        effects.forEach((effect) => {
          const cleanup = effect();
          if (typeof cleanup === 'function') cleanups.push(cleanup);
        });
        return view;
      } finally { dispatcher.H = H; }
    }
    try {
      useAppStore.setState(useAppStore.getInitialState(), true);
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        requests.push([method, url, init?.body]);
        if (method === 'POST' && url === '/api/consortiums/installments') return postDeferred.promise;
        if (url === '/api/consortiums') {
          return Response.json(
            updatedList
              ? [{ ...consortium, paidInstallments: 3 }, { ...otherConsortium, assembliesAttended: 77 }]
              : [consortium, otherConsortium],
          );
        }
        if (url === `/api/consortiums/installments?consortiumId=${consortium.id}`) return Response.json([instA]);
        if (url === `/api/consortiums/installments?consortiumId=${otherConsortium.id}`) return Response.json([instB]);
        if (url === '/api/categories' || url === '/api/accounts') return Response.json([]);
        throw new Error(`Unexpected: ${method} ${url}`);
      }) as typeof fetch;
      toast.success = () => { feedback.push('success'); return 'success'; };
      toast.error = () => { feedback.push('error'); return 'error'; };

      render();
      await settle();
      rowById(render(), consortium.id)!.props.onOpen();
      await settle();
      const detailA = findElement(render(), (e) => e.type === consortiums.ConsortiumDetail)!;
      detailA.props.onPay(detailA.props.installments[0], trigger);
      const payDialog = findElement(render(), (e) => e.type === ConsortiumInstallmentPayment && e.props.open)!;
      const offset = requests.length;
      const p1 = payDialog.props.onConfirm();
      const p2 = payDialog.props.onConfirm(); // clique repetido bloqueado pela guarda

      useAppStore.getState().setSelectedConsortiumId(otherConsortium.id);
      await settle();
      expect(activeDetail(render())?.id).toBe(otherConsortium.id);

      updatedList = outcome === 'ok';
      postDeferred.resolve(outcome === 'ok' ? Response.json({ ok: true }) : Response.json({ error: 'Falha' }, { status: 503 }));
      await Promise.all([p1, p2]);
      await settle();

      const after = requests.slice(offset).map(([m, u]) => [m, u]);
      expect(after.filter(([m, u]) => m === 'POST' && u === '/api/consortiums/installments')).toHaveLength(1);
      expect(after.filter(([, u]) => u === `/api/consortiums/installments?consortiumId=${consortium.id}`)).toEqual([]);
      expect(after.filter(([, u]) => u === '/api/consortiums')).toHaveLength(outcome === 'ok' ? 1 : 0);
      expect(activeDetail(render())?.id).toBe(otherConsortium.id);
      const detailB = findElement(render(), (e) => e.type === consortiums.ConsortiumDetail)!;
      expect(detailB.props.installments).toEqual([instB]);
      expect(feedback).toEqual([]);
    } finally {
      cleanups.forEach((c) => c());
      globalThis.fetch = originalFetch;
      toast.success = success;
      toast.error = error;
      useAppStore.setState(useAppStore.getInitialState(), true);
    }
  });
}

async function withMockDocument<T>(
  doc: Record<string, unknown>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: doc });
  try {
    return await fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else delete (globalThis as Record<string, unknown>).document;
  }
}

test('Consórcios lista DELETE: res.ok limpa origem conectada antes do fechamento e foca #consortium-create, mantendo retorno em cancelamento e 503', async () => {
  let deleteStatus = 204;
  await exerciseConsortium(async () => new Response(null, { status: deleteStatus }), async (render) => {
    const focused: string[] = [];
    const rowTrigger = { isConnected: true, focus() { focused.push('row-delete'); } };
    const createTarget = { isConnected: true, focus() { focused.push('consortium-create'); } };
    const fakeCloseEvent = { preventDefault() {} } as unknown as Event;

    await withMockDocument({
      getElementById: (id: string) => (id === 'consortium-create' ? createTarget : null),
    }, async () => {
      const confirmation = () => findElement(render(), (e) => e.type === ConsortiumDeleteConfirmation && e.props.open)!;

      // 1) Cancelamento mantém retorno ao acionador conectado da linha
      rowById(render())!.props.onDelete({ currentTarget: rowTrigger });
      const cancelDialog = confirmation();
      cancelDialog.props.onOpenChange(false);
      cancelDialog.props.onCloseAutoFocus(fakeCloseEvent);
      expect(focused).toEqual(['row-delete']);

      // 2) Falha HTTP 503 preserva origem e retorna ao acionador ao fechar
      deleteStatus = 503;
      rowById(render())!.props.onDelete({ currentTarget: rowTrigger });
      const errorDialog = confirmation();
      await errorDialog.props.onConfirm({ preventDefault: noop });
      await settle();
      expect(findElement(render(), (e) => e.type === ConsortiumDeleteConfirmation && e.props.open)).toBeDefined();
      errorDialog.props.onOpenChange(false);
      errorDialog.props.onCloseAutoFocus(fakeCloseEvent);
      expect(focused).toEqual(['row-delete', 'row-delete']);

      // 3) res.ok com botão da linha ainda conectado (GET tardio) limpa dialogOrigin e foca #consortium-create
      deleteStatus = 204;
      rowById(render())!.props.onDelete({ currentTarget: rowTrigger });
      const okDialog = confirmation();
      await okDialog.props.onConfirm({ preventDefault: noop });
      await settle();
      expect(findElement(render(), (e) => e.type === ConsortiumDeleteConfirmation && e.props.open)).toBeUndefined();
      okDialog.props.onCloseAutoFocus(fakeCloseEvent);
      expect(focused).toEqual(['row-delete', 'row-delete', 'consortium-create']);
    });
  });
});

test('Consórcios detalhe DELETE: res.ok foca #consortium-create ao fechar A e #consortium-detail-title na troca A -> B', async () => {
  const focused: string[] = [];
  const detailTrigger = { isConnected: true, focus() { focused.push('detail-delete'); } };
  const createTarget = { isConnected: true, focus() { focused.push('consortium-create'); } };
  const detailTitleTarget = { isConnected: true, focus() { focused.push('consortium-detail-title'); } };
  const fakeCloseEvent = { preventDefault() {} } as unknown as Event;

  // Caso A: exclusão no detalhe sem troca fecha detalhe e foca #consortium-create
  await exerciseConsortium(async () => new Response(null, { status: 204 }), async (render) => {
    await withMockDocument({
      getElementById: (id: string) => {
        const hasDetail = Boolean(activeDetail(render()));
        if (id === 'consortium-detail-title') return hasDetail ? detailTitleTarget : null;
        if (id === 'consortium-create') return hasDetail ? null : createTarget;
        return null;
      },
    }, async () => {
      rowById(render())!.props.onOpen();
      formButton(render(), 'Excluir').props.onClick({ currentTarget: detailTrigger });
      const okDialog = findElement(render(), (e) => e.type === ConsortiumDeleteConfirmation && e.props.open)!;
      await okDialog.props.onConfirm({ preventDefault: noop });
      await settle();
      expect(activeDetail(render())).toBeUndefined();
      okDialog.props.onCloseAutoFocus(fakeCloseEvent);
      expect(focused).toEqual(['consortium-create']);
    });
  });

  // Caso B: troca A -> B com DELETE de A em voo foca #consortium-detail-title de B (e não o trigger reutilizado nem #consortium-create)
  const deferred = Promise.withResolvers<Response>();
  await exerciseConsortium(() => deferred.promise, async (render) => {
    await withMockDocument({
      getElementById: (id: string) => {
        const hasDetail = Boolean(activeDetail(render()));
        if (id === 'consortium-detail-title') return hasDetail ? detailTitleTarget : null;
        if (id === 'consortium-create') return hasDetail ? null : createTarget;
        return null;
      },
    }, async () => {
      rowById(render())!.props.onOpen();
      formButton(render(), 'Excluir').props.onClick({ currentTarget: detailTrigger });
      const okDialog = findElement(render(), (e) => e.type === ConsortiumDeleteConfirmation && e.props.open)!;
      const pending = okDialog.props.onConfirm({ preventDefault: noop });
      useAppStore.getState().setSelectedConsortiumId(otherConsortium.id);
      await settle();
      expect(activeDetail(render())?.id).toBe(otherConsortium.id);

      deferred.resolve(new Response(null, { status: 204 }));
      await pending;
      await settle();
      expect(activeDetail(render())?.id).toBe(otherConsortium.id);
      okDialog.props.onCloseAutoFocus(fakeCloseEvent);
      expect(focused).toEqual(['consortium-create', 'consortium-detail-title']);
    });
  });
});

test('Caixinhas: restoreSavingsFocusAfterDeletion não age antes da remoção, não rouba foco conectado e foca fallback em body/desconectado', () => {
  expect(savings).toHaveProperty('restoreSavingsFocusAfterDeletion');
  const restore = (savings as unknown as {
    restoreSavingsFocusAfterDeletion: (
      deletedId: string,
      goals: readonly { id: string }[],
      activeElement: { isConnected: boolean } | null,
      body: object,
      fallback: { isConnected: boolean; focus: () => void } | null,
    ) => boolean;
  }).restoreSavingsFocusAfterDeletion;

  let focusCount = 0;
  const fallback = { isConnected: true, focus: () => { focusCount++; } };
  const body = { isConnected: true };
  const otherControl = { isConnected: true };
  const disconnected = { isConnected: false };

  // Não age enquanto id ainda está em goals
  expect(restore('g1', [{ id: 'g1' }, { id: 'g2' }], body, body, fallback)).toBe(false);
  expect(focusCount).toBe(0);

  // Não rouba foco de outro controle conectado
  expect(restore('g1', [{ id: 'g2' }], otherControl, body, fallback)).toBe(false);
  expect(focusCount).toBe(0);

  // Foca fallback quando activeElement === body
  expect(restore('g1', [{ id: 'g2' }], body, body, fallback)).toBe(true);
  expect(focusCount).toBe(1);

  // Foca fallback quando activeElement está desconectado
  expect(restore('g1', [{ id: 'g2' }], disconnected, body, fallback)).toBe(true);
  expect(focusCount).toBe(2);

  // Não falha com fallback ausente ou desconectado
  expect(restore('g1', [{ id: 'g2' }], body, body, { isConnected: false, focus: () => { focusCount++; } })).toBe(false);
  expect(restore('g1', [{ id: 'g2' }], body, body, null)).toBe(false);
  expect(focusCount).toBe(2);
});

test('Caixinhas fluxo handleDeleteGoal: restaura #savings-create após res.ok + fetchGoals quando foco cai em body/desconectado, sem agir em falha HTTP ou controle conectado', async () => {
  const otherGoal = { ...goal, id: 'g2', name: 'Meta reserva 2' };
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const { success, error } = toast;
  const originalFetch = globalThis.fetch;

  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const callbackSlots: { fn: unknown; deps?: unknown[] }[] = [];
  const effectSlots: { deps?: unknown[]; cleanup?: () => void }[] = [];
  let goalsList = [goal, otherGoal];
  let deleteMode: 'error' | 'hold' = 'error';
  let deleteDeferred = Promise.withResolvers<Response>();
  let readDeferred: PromiseWithResolvers<Response> | null = null;
  let focusCount = 0;

  const body = { isConnected: true };
  const otherControl = { isConnected: true };
  const disconnectedTrigger = { isConnected: false };
  const createTarget = { isConnected: true, focus: () => { focusCount++; } };
  const mockDoc = {
    body,
    activeElement: otherControl as { isConnected: boolean } | null,
    getElementById: (id: string) => (id === 'savings-create' ? createTarget : null),
  };

  function render() {
    let stateIndex = 0;
    let refIndex = 0;
    let callbackIndex = 0;
    let effectIndex = 0;
    const pendingEffects: (() => void)[] = [];
    const depsChanged = (prev: unknown[] | undefined, next: unknown[] | undefined) =>
      !next || !prev || next.length !== prev.length || next.some((dep, idx) => !Object.is(dep, prev[idx]));
    dispatcher.H = {
      useState(initial: unknown) {
        const i = stateIndex++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (next: unknown) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[refIndex++] ??= { current }),
      useCallback: (fn: unknown, deps?: unknown[]) => {
        const idx = callbackIndex++;
        const slot = callbackSlots[idx];
        if (!slot || depsChanged(slot.deps, deps)) {
          callbackSlots[idx] = { fn, deps: deps ? [...deps] : undefined };
        }
        return callbackSlots[idx].fn;
      },
      useMemo: (factory: () => unknown) => factory(),
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx),
      useId: () => 'test-id',
      useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        const idx = effectIndex++;
        const slot = (effectSlots[idx] ??= {});
        if (depsChanged(slot.deps, deps)) {
          slot.deps = deps ? [...deps] : undefined;
          pendingEffects.push(() => {
            slot.cleanup?.();
            const cleanup = effect();
            slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
          });
        }
      },
    };
    try {
      const view = savings.SavingsView();
      const createBtn = findElement(view, (e) => e.props.id === 'savings-create');
      const ref = (createBtn?.props.ref ?? (createBtn as unknown as { ref?: { current: unknown } } | undefined)?.ref) as { current: unknown } | undefined;
      if (ref) ref.current = createTarget;
      pendingEffects.forEach((run) => run());
      return view;
    } finally {
      dispatcher.H = H;
    }
  }

  try {
    useAppStore.setState(useAppStore.getInitialState(), true);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/savings' && method === 'GET') {
        if (readDeferred) return readDeferred.promise;
        return Response.json(goalsList);
      }
      if (url === '/api/accounts' && method === 'GET') return Response.json([{ id: 'a1', name: 'Conta sintética' }]);
      if (url === '/api/savings' && method === 'DELETE') {
        if (deleteMode === 'error') return Response.json({ error: 'Falha' }, { status: 503 });
        return deleteDeferred.promise;
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof fetch;
    toast.success = () => 'success';
    toast.error = () => 'error';

    await withMockDocument(mockDoc, async () => {
      render();
      await settle();

      // 1) Falha HTTP não registra pendingDeletionFocus
      const row1 = findElement(render(), (e) => e.type === savings.SavingsGoalRow && e.props.goal.id === 'g1')!;
      row1.props.onDelete(null);
      await findElement(activeConfirmation(render), (e) => e.type === AlertDialogAction)!.props.onClick({ preventDefault: noop });
      await settle();
      mockDoc.activeElement = body;
      render();
      expect(focusCount).toBe(0);

      // 2) res.ok registra pendingDeletionFocus; não age enquanto g1 está em goals; restaura após fetchGoals remover g1
      deleteMode = 'hold';
      deleteDeferred = Promise.withResolvers<Response>();
      readDeferred = Promise.withResolvers<Response>();
      mockDoc.activeElement = otherControl;
      row1.props.onDelete(null);
      const pendingDelete = findElement(activeConfirmation(render), (e) => e.type === AlertDialogAction)!.props.onClick({ preventDefault: noop });
      goalsList = [otherGoal];
      deleteDeferred.resolve(Response.json({ success: true }, { status: 200 }));
      await pendingDelete;
      await settle();

      // GET ainda pendente: g1 segue em goals -> não restaura mesmo se activeElement === body
      mockDoc.activeElement = body;
      render();
      expect(focusCount).toBe(0);

      // GET resolve sem g1 e activeElement ficou desconectado -> restaura #savings-create
      mockDoc.activeElement = disconnectedTrigger;
      readDeferred.resolve(Response.json(goalsList));
      readDeferred = null;
      await settle();
      render();
      expect(focusCount).toBe(1);

      // 3) res.ok + remoção com usuário já em outro controle conectado -> não rouba foco e consome pendência
      deleteDeferred = Promise.withResolvers<Response>();
      readDeferred = null;
      const row2 = findElement(render(), (e) => e.type === savings.SavingsGoalRow && e.props.goal.id === 'g2')!;
      row2.props.onDelete(null);
      const pendingDelete2 = findElement(activeConfirmation(render), (e) => e.type === AlertDialogAction)!.props.onClick({ preventDefault: noop });
      goalsList = [];
      mockDoc.activeElement = otherControl;
      deleteDeferred.resolve(Response.json({ success: true }, { status: 200 }));
      await pendingDelete2;
      await settle();
      render();
      expect(focusCount).toBe(1);

      mockDoc.activeElement = body;
      render();
      expect(focusCount).toBe(1);
    });
  } finally {
    effectSlots.forEach((slot) => slot.cleanup?.());
    globalThis.fetch = originalFetch;
    toast.success = success;
    toast.error = error;
    useAppStore.setState(useAppStore.getInitialState(), true);
  }
});

test('renderiza ConsortiumRow, ConsortiumDetail e SavingsGoalRow em pt, es e en sem chaves cruas', () => {
  const expected = {
    pt: { contemplated: 'Contemplado', goalAria: 'Progresso da meta Reserva sintética' },
    es: { contemplated: 'Adjudicado', goalAria: 'Progreso de la meta Reserva sintética' },
    en: { contemplated: 'Awarded', goalAria: 'Progress for goal Reserva sintética' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const rowHtml = renderWithIntl(<consortiums.ConsortiumRow consortium={consortium} onOpen={noop} onEdit={noop} onDelete={noop} />, locale);
    expect(rowHtml).toContain(expected[locale].contemplated);
    expect(rowHtml).not.toContain('MISSING_MESSAGE');

    const detailHtml = renderWithIntl(<consortiums.ConsortiumDetail consortium={consortium} installments={[]} onPay={noop} />, locale);
    expect(detailHtml).toContain('Cota sintética');

    const savingsHtml = renderWithIntl(<savings.SavingsGoalRow goal={goal} onDeposit={noop} onEdit={noop} onDelete={noop} />, locale);
    expect(savingsHtml).toContain(`aria-label="${expected[locale].goalAria}"`);
  }
});
