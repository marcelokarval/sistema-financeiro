/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import * as consortiums from './consortiums-view';
import * as savings from './savings-view';
import React, { type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog } from '@/components/ui/dialog';
import { renderToStaticMarkup } from 'react-dom/server';

const consortium = {
  id: 'c1', description: 'Cota sintética', group: '27', quota: '12', administrator: 'Administradora teste',
  totalAmount: 1000, fundedAmount: 250, monthlyPayment: 125, installmentCount: 8, paidInstallments: 2,
  startDate: '2026-01-01', endDate: null, nextAssemblyDate: '2026-05-15', assembliesAttended: 1,
  status: 'CONTEMPLATED', categoryId: null, category: null, accountId: null, isActive: true,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
};
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
  expect(html).toMatch(/role="progressbar"[^>]*aria-label="Progresso da meta Reserva sintética"[^>]*aria-valuenow="40"/);
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
    const position = source.indexOf('<dl aria-label="Resumo');
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
    const nested = findElement(child.props.children, matches);
    if (nested) return nested;
  }
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function exerciseConsortium(
  respond: (method: string) => Promise<Response>,
  run: (render: () => ViewElement, requests: [string, string, BodyInit | null | undefined][], feedback: string[]) => Promise<void>,
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
      return Response.json(url === '/api/consortiums' ? [{ ...consortium, id: 'outra-cota' }, consortium] : []);
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
const openFormDialog = (render: () => ViewElement) => findElement(render(), e => e.type === Dialog && e.props.open);
const formButton = (root: ViewElement, label: string) => findElement(root, e => e.props.onClick && React.Children.toArray(e.props.children).some(child => typeof child === 'string' && child.trim() === label))!;
const openForm = (render: () => ViewElement, method: 'POST' | 'PUT', id: string) => {
  if (method === 'POST') formButton(render(), 'Novo consórcio').props.onClick(trigger);
  else findElement(render(), e => e.type === consortiums.ConsortiumRow && e.props.consortium.id === id)!.props.onEdit(trigger);
};

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
for (const [file, count] of [["consortiums-view.tsx",2],["savings-view.tsx",1]] as const) {
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
