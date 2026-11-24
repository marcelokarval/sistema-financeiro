/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import * as investments from './investments-view';
import * as installments from './installments-view';
import { InstallmentPlanEditor } from './installment-plan-editor';
import { InstallmentDeleteConfirmation } from './installment-delete-confirmation';
import { FinanceConfirmationDialogShell, FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

test('Investimentos identifica a tela e anuncia carregamento sem mostrar totais fictícios', () => {
  const html = renderToStaticMarkup(<investments.InvestmentsView />);
  expect(html).toContain('>Investimentos</h2>');
  expect(html).toContain('role="status"');
  expect(html).toContain('Carregando investimentos');
  expect(html).not.toContain('R$');
});

test('Parcelas identifica a tela e anuncia carregamento sem mostrar totais fictícios', () => {
  const html = renderToStaticMarkup(<installments.InstallmentsView />);
  expect(html).toContain('>Parcelas e financiamentos</h2>');
  expect(html).toContain('role="status"');
  expect(html).toContain('Carregando planos');
  expect(html).not.toContain('R$');
});

const investment = { id: 'inv-1', name: 'CDB sintético', type: 'CDB', investedAmount: 1200, currentBalance: 1350, yieldRate: 0, brokerage: 'Corretora de teste' };
const first = { id: 'p1-1', installmentPlanId: 'p1', number: 1, amount: 450, status: 'PAID' as const, dueDate: '2026-05-01T12:00:00Z', paidDate: '2026-05-01T12:00:00Z' };
const second = { ...first, id: 'p1-2', number: 2, dueDate: '2026-06-01T12:00:00Z', status: 'OVERDUE' as const, paidDate: null };
const plan = { id: 'p1', description: 'Plano sintético', type: 'FINANCING', totalAmount: 900, installmentCount: 2, monthlyValue: 450, paidInstallments: 1, interestRate: 0, startDate: first.dueDate, status: 'ACTIVE', cardId: null, categoryId: null, installments: [first, second] };
const noop = () => {};

test('Investimentos põe a posição da carteira antes dos registros e nomeia suas ações', () => {
  expect(investments).toHaveProperty('InvestmentPortfolio');
  const html = renderToStaticMarkup(<investments.InvestmentPortfolio summary={{ totalInvested: 1200, currentTotal: 1350, rentabilidade: 12.5, dividendsReceived: 0 }} count={1} records={[investment]} filter="BOND" onFilter={noop} onNew={noop} onOpen={noop} onEdit={noop} onDelete={noop} />);
  expect(html).toContain('role="tablist"');
  expect(html.indexOf('Valor atual')).toBeGreaterThan(html.indexOf('Novo investimento'));
  expect(html.indexOf('CDB sintético')).toBeGreaterThan(html.indexOf('Dividendos recebidos'));
  expect(html).toContain('R$ 1.350,00');
  expect(html).toContain('aria-label="Abrir investimento: CDB sintético"');
  expect(html).toContain('aria-label="Editar investimento: CDB sintético"');
  expect(html).toContain('aria-label="Excluir investimento: CDB sintético"');
});

test('Parcelas põe o saldo devedor antes dos registros e mantém o filtro selecionado', () => {
  expect(installments).toHaveProperty('InstallmentPortfolio');
  const html = renderToStaticMarkup(<installments.InstallmentPortfolio summary={{ totalFinanced: 900, totalPaid: 450, remaining: 450, overdueCount: 1 }} count={1} records={[plan]} filter="OVERDUE" onFilter={noop} onNew={noop} onOpen={noop} />);
  expect(html.indexOf('Valor restante')).toBeGreaterThan(html.indexOf('Novo plano'));
  expect(html.indexOf('Plano sintético')).toBeGreaterThan(html.indexOf('Parcelas em atraso'));
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-label="Abrir plano: Plano sintético"');
  expect(html).toContain('R$ 900,00');
});

test('histórico mostra a criação de transação e os valores do registro sintético', () => {
  expect(investments).toHaveProperty('InvestmentEntries');
  const html = renderToStaticMarkup(<investments.InvestmentEntries transactions={[{ id: 't1', type: 'DIVIDENDO', amount: 12.34, date: first.dueDate, description: 'Provento sintético' }]} onNew={noop} />);
  expect(html).toContain('Nova transação');
  expect(html).toContain('Provento sintético');
  expect(html).toContain('Dividendo');
  expect(html).toContain('R$ 12,34');
});

test('pagamento só é apresentado em parcela não paga e fica indisponível durante envio', () => {
  expect(installments).toHaveProperty('InstallmentEntries');
  const html = renderToStaticMarkup(<installments.InstallmentEntries plan={plan} paying={second.id} onPay={noop} />);
  expect(html).toContain('>Pago<');
  expect(html).toContain('>Atrasado<');
  expect(html).not.toContain('aria-label="Pagar parcela 1 de 2"');
  expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Pagar parcela 2 de 2"[^>]*>/);
});

test('detalhe renderiza a numeração produzida pela rota, sem duplicar o envio durante pagamento', () => {
  const pending = { id: 'p1-3', installmentPlanId: 'p1', number: 3, amount: 450, status: 'PENDING' as const, dueDate: second.dueDate, paidDate: null };
  const overdue = { ...pending, id: 'p1-2', number: 2, status: 'OVERDUE' as const };
  const html = renderToStaticMarkup(<installments.InstallmentEntries plan={{ ...plan, installmentCount: 3, installments: [overdue, pending] }} paying={overdue.id} onPay={noop} />);
  expect(html).toContain('Parcela 2 de 3');
  expect(html).toContain('Parcela 3 de 3');
  expect(html).not.toContain('undefined');
  expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Pagar parcela 3 de 3"[^>]*>/);
});

test('detalhe não oferece pagamento de parcela de outro plano', () => {
  const foreign = { ...second, installmentPlanId: 'p2' };
  const html = renderToStaticMarkup(<installments.InstallmentEntries plan={{ ...plan, installments: [foreign] }} paying={null} onPay={noop} />);
  expect(html).not.toContain('aria-label="Pagar');
});

// SSR não renderiza os portais Radix. Este contrato de markup não prova foco:
// a interação do editor/confirmador pelos dois caminhos pertence ao QA no DOM.
for (const editorFile of ['investment-editor.tsx', 'installment-plan-editor.tsx'] as const) {
  test(`${editorFile}: formulário usa FinanceFormDialogShell com saída superior nomeada`, () => {
    const editorSource = readFileSync(new URL(editorFile, import.meta.url), 'utf8');
    expect(editorSource).toContain('<FinanceFormDialogShell');
    expect(editorSource).toContain('closeLabel="Fechar formulário"');
    const shellSource = readFileSync(new URL('../shared/finance-dialog-shell.tsx', import.meta.url), 'utf8');
    const headers = shellSource.split(/<DialogHeader[^>]*>/).slice(1).map((part) => part.split('</DialogHeader>')[0]);
    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain('<DialogClose asChild>');
    expect(headers[0]).toContain('aria-label={closeLabel}');
  });
}

test('investments-view.tsx: formulário tem saída superior nomeada', () => {
  const source = readFileSync(new URL('investments-view.tsx', import.meta.url), 'utf8');
  const headers = source.split(/<DialogHeader[^>]*>/).slice(1).map((part) => part.split('</DialogHeader>')[0]);
  expect(headers).toHaveLength(1);
  expect(headers[0]).toContain('<DialogClose asChild>');
  expect(headers[0]).toContain('aria-label="Fechar formulário"');
});

for (const [file, detailTitle, rowPrefix] of [
  ['investments-view.tsx', 'investment-detail-title', 'investment-row'],
  ['installments-view.tsx', 'plan-detail-title', 'plan-row'],
] as const) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  test(`${file}: detalhe e retorno têm alvos de foco`, () => {
    expect(source).toContain(`id="${detailTitle}" tabIndex={-1}`);
    expect(source).toContain(rowPrefix);
    expect(source).toContain(`document.getElementById('${detailTitle}')?.focus()`);
    expect(source).toContain('const row = document.getElementById(origin);');
    expect(source).toContain('if (row) row.focus();');
  });
  test(`${file}: retorno dos diálogos captura o botão acionado, não o foco do navegador`, () => {
    expect(source).not.toContain('document.activeElement');
    expect(source).toContain('rememberDialogOrigin(event.currentTarget,');
  });

}

// Estilos semânticos de todas as ações destrutivas, incluindo as não migradas.
for (const [file, count] of [["investment-delete-confirmation.tsx",1],["investments-view.tsx",1],["installment-delete-confirmation.tsx",1]] as const) {
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

test('installments-view.tsx usa tokens --ds-accent-* no status das parcelas em vez de cores Tailwind fixas', async () => {
  const source = await Bun.file(new URL('installments-view.tsx', import.meta.url)).text();
  expect(source).not.toMatch(/bg-green-500\/10|bg-amber-500\/10|bg-rose-500\/10|text-green-600|text-amber-600|text-rose-600/);
  expect(source).toContain('--ds-accent-positive');
  expect(source).toContain('--ds-accent-warning');
  expect(source).toContain('--ds-accent-danger');
});

test('Parcelas filtra OVERDUE apenas para planos atrasados ou com parcelas vencidas', async () => {
  const source = await Bun.file(new URL('installments-view.tsx', import.meta.url)).text();
  expect(source).not.toContain("p.status === 'OVERDUE' || p.status === 'ACTIVE'");
  expect(source).toContain('selectedInstallmentPlanId');
  expect(source).toContain('Skeleton');
  expect(source).toContain('Não foi possível carregar os planos');
  expect(source).toContain('createInFlight');
});

test('Investimentos consome selectedInvestmentId, usa Skeleton/erro/retry e calcula dividendos reais', async () => {
  const source = await Bun.file(new URL('investments-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedInvestmentId');
  expect(source).toContain('Skeleton');
  expect(source).toContain('Não foi possível carregar os investimentos');
  expect(source).not.toContain('dividendsReceived: 0');
  expect(source).toContain('Informe o nome do investimento');
  expect(source).toContain('Informe um valor maior que zero');
});

type ViewElement = React.ReactElement<Record<string, any>>;
const findElement = (node: React.ReactNode, matches: (element: ViewElement) => boolean): ViewElement | undefined => {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, any>>(child)) continue;
    if (matches(child)) return child;
    let content = child.props.children;
    if (child.type === InstallmentPlanEditor) {
      content = InstallmentPlanEditor((child as React.ReactElement<React.ComponentProps<typeof InstallmentPlanEditor>>).props);
    } else if (child.type === InstallmentDeleteConfirmation) {
      content = InstallmentDeleteConfirmation((child as React.ReactElement<React.ComponentProps<typeof InstallmentDeleteConfirmation>>).props);
    } else if (child.type === FinanceFormDialogShell) {
      content = FinanceFormDialogShell((child as React.ReactElement<React.ComponentProps<typeof FinanceFormDialogShell>>).props);
    } else if (child.type === FinanceConfirmationDialogShell) {
      content = FinanceConfirmationDialogShell((child as React.ReactElement<React.ComponentProps<typeof FinanceConfirmationDialogShell>>).props);
    }
    const nested = findElement(content, matches);
    if (nested) return nested;
  }
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function exerciseInstallments(
  respond: (method: string, url: string) => Promise<Response>,
  run: (render: () => ViewElement, requests: [string, string, BodyInit | null | undefined][], feedback: string[]) => Promise<void>,
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
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
      useLayoutEffect: () => {},
    };
    try {
      const view = installments.InstallmentsView();
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
      if (url === '/api/installments' && method === 'GET') return respond(method, url);
      if (url === '/api/cards' || url === '/api/categories') return Response.json([]);
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
  }
}

test('InstallmentPlanEditor usa FinanceFormDialogShell, closeLabel e preserva pendência/obrigatoriedade', () => {
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const element = InstallmentPlanEditor({
    open: true,
    creating: true,
    form: {
      description: 'Financiamento teste',
      totalAmount: '1200',
      installmentCount: '12',
      monthlyValue: '100.00',
      interestRate: '',
      type: 'FINANCING',
      startDate: '2026-05-01',
      cardId: '',
      categoryId: '',
    },
    cards: [],
    categories: [],
    planTypes: { FINANCING: { label: 'Financiamento', icon: () => null } },
    onFieldChange: () => {},
    onAmountChange: () => {},
    onCountChange: () => {},
    onOpenChange,
    onCloseAutoFocus,
    onSubmit,
  });

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBe('Fechar formulário');
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const dialog = findElement(element, (e) => e.type === Dialog);
  expect(dialog).toBeDefined();
  expect(findElement(element, (e) => e.type === AlertDialog)).toBeUndefined();
  const content = findElement(element, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(false);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const submit = findElement(element, (e) => e.props.onClick === onSubmit);
  expect(submit?.props.disabled).toBe(true);
});

test('InstallmentDeleteConfirmation usa FinanceConfirmationDialogShell com pendência, aria-disabled e tokens destrutivos', () => {
  let confirmed = 0;
  let prevented = 0;
  const onOpenChange = () => {};
  const onCloseAutoFocus = () => {};
  const element = InstallmentDeleteConfirmation({
    open: true,
    deleting: false,
    planDescription: 'Plano sintético',
    actionDisabled: true,
    onOpenChange,
    onCloseAutoFocus,
    onConfirm: () => { confirmed++; },
  });

  expect(element.type).toBe(FinanceConfirmationDialogShell);
  expect(element.props.onOpenChange).toBe(onOpenChange);
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const alertDialog = findElement(element, (e) => e.type === AlertDialog);
  expect(alertDialog).toBeDefined();
  expect(findElement(element, (e) => e.type === Dialog)).toBeUndefined();
  const content = findElement(element, (e) => e.type === AlertDialogContent);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  const description = findElement(element, (e) => e.type === AlertDialogDescription);
  expect(renderToStaticMarkup(<>{description?.props.children}</>)).toContain('Plano sintético');
  expect(findElement(element, (e) => e.type === AlertDialogCancel)?.props.disabled).toBe(false);
  const action = findElement(element, (e) => e.type === AlertDialogAction)!;
  expect(action.props['aria-disabled']).toBe(true);
  expect(action.props.className).toContain('bg-destructive');
  expect(action.props.className).toContain('text-[var(--ds-destructive-fg)]');
  action.props.onClick({ preventDefault: () => { prevented++; } });
  expect(prevented).toBe(1);
  expect(confirmed).toBe(1);
});

test('Parcelas: plano confirmado mantém Excluir focável e bloqueado durante erro na releitura e oculta detalhe antigo', async () => {
  const detailCalls = [0];
  await exerciseInstallments(async (method, url) => {
    if (url === '/api/installments' && method === 'GET') return Response.json([plan]);
    if (url === '/api/installments?id=p1') {
      detailCalls[0]++;
      if (detailCalls[0] === 1) return Response.json(plan);
      return new Response(null, { status: 503 });
    }
    if (url === '/api/installments/pay' && method === 'POST') return Response.json({ ok: true });
    throw new Error(`Unexpected: ${method} ${url}`);
  }, async (render, requests) => {
    const portfolio = findElement(render(), (e) => e.type === installments.InstallmentPortfolio)!;
    portfolio.props.onOpen(plan);
    await settle();
    let detailView = render();
    let deleteBtn = findElement(detailView, (e) => typeof e.props.onClick === 'function' && React.Children.toArray(e.props.children).some((c) => typeof c === 'string' && c.includes('Excluir plano')))!;
    expect(deleteBtn.props['aria-disabled']).toBe(false);
    expect(findElement(detailView, (e) => e.type === installments.InstallmentEntries)).toBeDefined();

    // Dispara pagamento que faz refresh do detalhe retornando 503
    const entries = findElement(detailView, (e) => e.type === installments.InstallmentEntries)!;
    await entries.props.onPay(second.id);
    await settle();

    detailView = render();
    deleteBtn = findElement(detailView, (e) => typeof e.props.onClick === 'function' && React.Children.toArray(e.props.children).some((c) => typeof c === 'string' && c.includes('Excluir plano')))!;
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn.props.disabled).toBeUndefined();
    expect(deleteBtn.props['aria-disabled']).toBe(true);
    expect(findElement(detailView, (e) => e.type === installments.InstallmentEntries)).toBeUndefined();
    expect(renderToStaticMarkup(detailView)).toContain('Não foi possível carregar os detalhes do plano.');

    const beforeClick = requests.length;
    deleteBtn.props.onClick({ currentTarget: null });
    expect(findElement(render(), (e) => e.type === InstallmentDeleteConfirmation && e.props.open)).toBeUndefined();
    expect(requests.slice(beforeClick)).toEqual([]);
  });
});

for (const failure of ['http', 'transport'] as const) {
  test(`Parcelas POST (${failure}): preserva diálogo aberto, rascunho e não dispara releitura de sucesso`, async () => {
    await exerciseInstallments(async (method, url) => {
      if (url === '/api/installments' && method === 'GET') return Response.json([plan]);
      if (url === '/api/installments' && method === 'POST') {
        if (failure === 'transport') throw new Error('Rede sintética');
        return Response.json({ error: 'Falha ao criar' }, { status: 503 });
      }
      throw new Error(`Unexpected: ${method} ${url}`);
    }, async (render, requests, feedback) => {
      const portfolio = findElement(render(), (e) => e.type === installments.InstallmentPortfolio)!;
      portfolio.props.onNew({ currentTarget: null });
      let editor = findElement(render(), (e) => e.type === InstallmentPlanEditor && e.props.open)!;
      editor.props.onFieldChange('description', 'Notebook sintético');
      editor.props.onAmountChange('2400');
      editor.props.onCountChange('12');
      editor = findElement(render(), (e) => e.type === InstallmentPlanEditor && e.props.open)!;
      const offset = requests.length;
      await editor.props.onSubmit();
      await settle();

      const after = findElement(render(), (e) => e.type === InstallmentPlanEditor && e.props.open);
      expect(after).toBeDefined();
      expect(after?.props.form.description).toBe('Notebook sintético');
      expect(after?.props.form.totalAmount).toBe('2400');
      expect(after?.props.form.monthlyValue).toBe('200.00');
      expect(feedback).toEqual(['error']);
      expect(requests.slice(offset).map(([m, u]) => [m, u])).toEqual([['POST', '/api/installments']]);
    });
  });
}
