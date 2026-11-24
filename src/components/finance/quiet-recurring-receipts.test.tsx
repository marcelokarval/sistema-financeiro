/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurringPanel, RecurringTransactionsWidget } from './recurring-transactions';
import { toast } from 'sonner';
import { ReceiptGenerator, ReceiptWorkspace } from './receipt-generator';

const noop = () => {};
const entries = [
  { id: 'r1', description: 'Assinatura sintética', type: 'EXPENSE', frequency: 'WEEKLY', amount: 125.4, nextDate: '2026-11-24T12:00:00Z', isActive: true, account: { id: 'a1', name: 'Conta sintética', color: '#888', icon: 'Wallet' } },
  { id: 'r2', description: 'Receita sintética', type: 'INCOME', frequency: 'MONTHLY', amount: 200, nextDate: '2026-11-25T12:00:00Z', isActive: true },
  { id: 'r3', description: 'Serviço pausado', type: 'EXPENSE', frequency: 'YEARLY', amount: 800, nextDate: '2026-12-01T12:00:00Z', isActive: false },
];

const purchase = {
  receiptType: 'purchase' as const, receiptNumber: 'QA-001', issuedAt: '2026-11-24T12:00:00Z',
  data: {
    id: 'p1', merchant: 'Loja sintética', totalAmount: 'R$ 42,50', totalAmountRaw: 42.5, date: '24/11/2026',
    category: 'Mercado', categoryColor: '#888', card: 'Cartão sintético ****1234', notes: 'Observação sintética',
    installment: '1/2', itemsCount: 1, items: [{ name: 'Item sintético', quantity: 2, unitPrice: 'R$ 21,25', totalPrice: 'R$ 42,50', totalPriceRaw: 42.5 }],
  },
};

function recurringMarkup(loading = false, fixture = entries) {
  return renderToStaticMarkup(<RecurringPanel
    recurring={fixture} loading={loading} processing={false}
    activeCount={2} inactiveCount={1} monthlyIncome={200} monthlyTotal={125.4}
    openNew={noop} processRecurring={noop} openEdit={noop} requestDelete={noop} toggleActive={noop}
  />);
}

function receiptMarkup(receiptData: React.ComponentProps<typeof ReceiptWorkspace>['receiptData'], error: string | null = null, isLoading = false, receiptId = 'p1') {
  return renderToStaticMarkup(<ReceiptWorkspace
    receiptType="purchase" setReceiptType={noop} receiptId={receiptId} setReceiptId={noop}
    receiptData={receiptData} error={error} isLoading={isLoading} copied={false}
    generateReceipt={noop} handlePrint={noop} handleDownload={noop} handleCopy={noop}
  />);
}

test('Recorrências mostra a faixa antes da lista e as ações nomeadas por registro', () => {
  const html = recurringMarkup();
  expect(html).toContain('Nova transação recorrente');
  expect(html).toContain('Processar');
  expect(html.indexOf('Receitas ativas')).toBeGreaterThan(-1);
  expect(html.indexOf('Receitas ativas')).toBeLessThan(html.indexOf('Recorrências cadastradas'));
  expect(html).toContain('R$ 125,40');
  expect(html).toContain('R$ 200,00');
  expect(html).not.toContain('R$ 925,40');
  expect(html).toMatch(/<ul[^>]*>[\s\S]*<li[^>]*>[\s\S]*Assinatura sintética/);
  for (const label of ['Semanal', 'Conta sintética', 'Próxima data', 'Pausar Assinatura sintética', 'Ativar Serviço pausado', 'Editar Assinatura sintética', 'Excluir Assinatura sintética']) {
    expect(html).toContain(label);
  }
  expect(html).not.toMatch(/bg-gradient|card-glow/);
});

test('Recorrências distingue a leitura inicial da lista sem registros', () => {
  const pending = recurringMarkup(true, []);
  expect(pending).toContain('Carregando recorrências');
  expect(pending).not.toContain('Nenhuma transação recorrente');
  expect(recurringMarkup(false, [])).toContain('Nenhuma transação recorrente');
});

test('formulário de recorrência mantém Fechar no cabeçalho e Cancelar no rodapé, sem submissão', () => {
  // O conteúdo do portal Radix não é renderizado no SSR; aqui verificamos a ligação dos controles ao diálogo.
  const source = readFileSync(new URL('./recurring-transactions.tsx', import.meta.url), 'utf8');
  const dialog = source.match(/<Dialog open=\{showFormDialog\}[\s\S]*?<\/Dialog>/)?.[0] ?? '';
  const header = dialog.match(/<DialogHeader[\s\S]*?<\/DialogHeader>/)?.[0] ?? '';
  const footer = dialog.match(/<DialogFooter[\s\S]*?<\/DialogFooter>/)?.[0] ?? '';
  expect(header).toMatch(/<DialogClose asChild>\s*<Button(?=[^>]*type="button")(?=[^>]*aria-label="Fechar")[^>]*>/);
  expect(footer).toMatch(/<DialogClose asChild>\s*<Button[^>]*>Cancelar<\/Button>/);
  expect(dialog).toContain('onCloseAutoFocus={restoreFocus}');
});

test('Recibos identifica a origem, antecipa a prévia e só oferece saídas com documento', () => {
  const empty = receiptMarkup(null, null, false, '');
  expect(empty).toMatch(/<label[^>]*for="[^" ]+-receipt-type"[^>]*>Tipo de registro<\/label>/);
  expect(empty).toMatch(/<label[^>]*for="[^" ]+-receipt-id"[^>]*>ID do registro<\/label>/);
  expect(empty).toContain('Gerar recibo');
  expect(empty).toContain('Prévia do recibo');
  expect(empty).not.toContain('Imprimir');
  expect(receiptMarkup(null, null, true)).toContain('Gerando recibo');
  expect(receiptMarkup(null, 'Registro não encontrado')).toMatch(/role="alert"[^>]*>[\s\S]*Registro não encontrado/);
  const ready = receiptMarkup(purchase);
  for (const label of ['QA-001', 'Loja sintética', 'Item sintético', 'R$ 42,50', 'R$ 21,25', 'Observação sintética', 'Imprimir', 'Baixar .txt', 'Copiar']) {
    expect(ready).toContain(label);
  }
  expect(ready).not.toMatch(/bg-gradient|card-glow/);
  expect(ready).toMatch(/VALOR TOTAL<\/span><span[^>]*>R\$ 42,50<\/span>/u);
  expect(ready).not.toContain('NaN');
});
test('preserva zero como valor total no documento de compra', () => {
  const data = { ...purchase.data, totalAmount: 'R$ 0,00', totalAmountRaw: 0 };
  const html = receiptMarkup({ ...purchase, data });
  expect(html).toMatch(/VALOR TOTAL<\/span><span[^>]*>R\$\u00a00,00<\/span>/u);
  expect(html).not.toMatch(/NaN|undefined/);
});

test('copiar e baixar serializam o valor formatado de compra e transação', async () => {
  const transaction = {
    receiptType: 'transaction' as const, receiptNumber: 'TXN-001', issuedAt: purchase.issuedAt,
    data: { id: 't1', description: 'Transação sintética', type: 'Despesa', amount: 'R$ 17,30', amountRaw: 17.3, date: '24/11/2026', category: 'Mercado', categoryColor: '#888', account: 'Conta', card: null, notes: null },
  };
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = internals.H;
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  try {
    for (const [receipt, total] of [[purchase, 'R$ 42,50'], [transaction, 'R$ 17,30']] as const) {
      let stateIndex = 0;
      internals.H = {
        useState: (initial: unknown) => [stateIndex++ === 2 ? receipt : initial, noop],
        useRef: () => ({ current: null }),
        useCallback: (callback: unknown) => callback,
      };
      let copied = '';
      let downloaded: Blob | undefined;
      let clicked = false;
      const anchor = { href: '', download: '', click: () => { clicked = true; } };
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text: string) => { copied = text; } } } });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => anchor, body: { appendChild: noop, removeChild: noop } } });
      const createObjectURL = URL.createObjectURL;
      const revokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = (value) => {
        if (!(value instanceof Blob)) throw new TypeError('O recibo baixado deve ser um Blob');
        downloaded = value;
        return 'blob:synthetic';
      };
      URL.revokeObjectURL = noop;
      try {
        const element = ReceiptGenerator();
        element.props.handleDownload();
        await element.props.handleCopy();
        expect(clicked).toBe(true);
        expect(anchor.download).toBe(`recibo-${receipt.receiptNumber}.txt`);
        expect(downloaded).toBeDefined();
        const text = await downloaded!.text();
        expect(text).toContain(`  VALOR TOTAL:  ${total}\n`);
        expect(text).not.toContain('undefined');
        expect(copied).toBe(text);
      } finally {
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
      }
    }
  } finally {
    internals.H = previousDispatcher;
    for (const key of ['navigator', 'document'] as const) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

// Exercita os handlers reais com respostas HTTP sintéticas, sem servidor ou banco.
for (const method of ['POST', 'PUT'] as const) {
 for (const status of [503, 200]) {
  test(`${method} HTTP ${status} respeita o resultado do formulário`, async () => {
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const previousDispatcher = internals.H;
    const originalFetch = globalThis.fetch;
    const originalSuccess = toast.success;
    const originalError = toast.error;
    const states: any[] = [];
    const refs: any[] = [];
    let refIndex = 0;
    let index = 0;
    let successes = 0;
    let errors = 0;
    const requests: { url: string; method?: string; body?: string }[] = [];
    const render = () => {
      index = 0; refIndex = 0;
      internals.H = {
        useState: (initial: unknown) => {
          const i = index++;
          if (!(i in states)) states[i] = initial;
          return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
        },
        useId: () => 'test-id',
        useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; },
        useCallback: (fn: unknown) => fn,
        useEffect: noop,
      };
      return RecurringTransactionsWidget();
    };
    const find = (node: any, predicate: (element: any) => boolean): any => {
      if (!node || typeof node !== 'object') return undefined;
      if (predicate(node)) return node;
      for (const child of React.Children.toArray(node.props?.children)) {
        const found = find(child, predicate);
        if (found) return found;
      }
      return undefined;
    };
    try {
      globalThis.fetch = (async (url: any, init?: any) => {
        requests.push({ url: String(url), method: init?.method, body: init?.body });
        return init?.method ? new Response('{}', { status }) : Response.json([]);
      }) as typeof fetch;
      toast.success = (() => { successes++; return 1; }) as typeof toast.success;
      toast.error = (() => { errors++; return 1; }) as typeof toast.error;
      let view = render();
      const panel = find(view, (e) => e.type === RecurringPanel);
      if (method === 'POST') panel.props.openNew({ currentTarget: null });
      else panel.props.openEdit(entries[0], { currentTarget: null });
      view = render();
      const description = find(view, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...');
      description.props.onChange({ target: { value: 'Rascunho preservado' } });
      view = render();
      const amount = find(view, (e) => e.props?.placeholder === '0,00');
      amount.props.onChange({ target: { value: '5.25' } });
      view = render();
      const dialog = find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange);
      const submit = find(dialog, (e) => e.props?.children === (method === 'POST' ? 'Criar' : 'Salvar'));
      await submit.props.onClick();
      view = render();
      const after = find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange);
      expect(after.props.open).toBe(status === 503);
      expect(requests.map((request) => request.method ?? 'GET')).toEqual(status === 503 ? [method] : [method, 'GET']);
      expect(JSON.parse(requests[0].body!).description).toBe('Rascunho preservado');
      if (status === 503) {
        expect(find(after, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...').props.value).toBe('Rascunho preservado');
        expect(find(after, (e) => e.props?.placeholder === '0,00').props.value).toBe('5.25');
      }
      expect(successes).toBe(status === 200 ? 1 : 0);
      expect(errors).toBe(status === 503 ? 1 : 0);
    } finally {
      internals.H = previousDispatcher;
      globalThis.fetch = originalFetch;
      toast.success = originalSuccess;
      toast.error = originalError;
    }
  });
 }
}

for (const operation of ['pause', 'activate', 'delete'] as const) {
  for (const status of [503, 200]) {
    test(`${operation} HTTP ${status} respeita resultado da gravação`, async () => {
      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      const previousDispatcher = internals.H;
      const originalFetch = globalThis.fetch;
      const originalSuccess = toast.success;
      const originalError = toast.error;
      const states: any[] = [];
      const refs: any[] = [];
      let index = 0;
      let refIndex = 0;
      const messages: string[] = [];
      const requests: { method: string; body?: string }[] = [];
      const render = () => {
        index = 0; refIndex = 0;
        internals.H = {
          useState: (initial: unknown) => {
            const i = index++;
            if (!(i in states)) states[i] = initial;
            return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
          },
          useId: () => 'test-id',
          useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; },
          useCallback: (fn: unknown) => fn,
          useEffect: noop,
        };
        return RecurringTransactionsWidget();
      };
      const find = (node: any, predicate: (element: any) => boolean): any => {
        if (!node || typeof node !== 'object') return undefined;
        if (predicate(node)) return node;
        for (const child of React.Children.toArray(node.props?.children)) {
          const found = find(child, predicate);
          if (found) return found;
        }
        return undefined;
      };
      try {
        globalThis.fetch = (async (_url: any, init?: any) => {
          requests.push({ method: init?.method ?? 'GET', body: init?.body });
          return init?.method ? new Response(null, { status }) : Response.json([]);
        }) as typeof fetch;
        toast.success = ((message: string) => { messages.push(`success:${message}`); return 1; }) as typeof toast.success;
        toast.error = ((message: string) => { messages.push(`error:${message}`); return 1; }) as typeof toast.error;
        let view = render();
        const panel = find(view, (e) => e.type === RecurringPanel);
        if (operation === 'delete') {
          panel.props.requestDelete('r1', { currentTarget: null });
          view = render();
          const dialog = find(view, (e) => e.props?.open === true && e.props?.onOpenChange);
          const action = find(dialog, (e) => e.props?.children === 'Excluir');
          const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
          const pending = action.props.onClick(event);
          if (!event.defaultPrevented) dialog.props.onOpenChange(false);
          await pending;
          view = render();
          const confirmation = find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange && find(e, (child: any) => child.props?.children === 'Excluir'));
          expect(confirmation.props.open).toBe(status === 503);
          expect(requests[0]).toEqual({ method: 'DELETE', body: JSON.stringify({ id: 'r1' }) });
        } else {
          const entry = operation === 'pause' ? entries[0] : entries[2];
          await panel.props.toggleActive(entry);
          expect(requests[0]).toEqual({ method: 'PUT', body: JSON.stringify({ id: entry.id, isActive: !entry.isActive }) });
        }
        expect(messages).toHaveLength(1);
        expect(messages[0]).toStartWith(status === 503 ? 'error:' : 'success:');
        expect(requests.map((request) => request.method)).toEqual(status === 503 ? [operation === 'delete' ? 'DELETE' : 'PUT'] : [operation === 'delete' ? 'DELETE' : 'PUT', 'GET']);
      } finally {
        internals.H = previousDispatcher;
        globalThis.fetch = originalFetch;
        toast.success = originalSuccess;
        toast.error = originalError;
      }
    });
  }
}

for (const operation of ['POST', 'PUT', 'DELETE-same', 'DELETE-other'] as const) {
  test(`${operation}: sucesso tardio atualiza lista sem fechar nova abertura`, async () => {
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const previousDispatcher = internals.H;
    const originalFetch = globalThis.fetch;
    const originalSuccess = toast.success;
    const originalError = toast.error;
    const states: any[] = [], refs: any[] = [];
    let index = 0, refIndex = 0;
    const requests: string[] = [];
    const response = Promise.withResolvers<Response>();
    const render = () => {
      index = 0; refIndex = 0;
      internals.H = {
        useState: (initial: unknown) => {
          const i = index++;
          if (!(i in states)) states[i] = initial;
          return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
        },
        useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; },
        useId: () => 'test-id', useCallback: (fn: unknown) => fn, useEffect: noop,
      };
      return RecurringTransactionsWidget();
    };
    const find = (node: any, predicate: (element: any) => boolean): any => {
      if (!node || typeof node !== 'object') return undefined;
      if (predicate(node)) return node;
      for (const child of React.Children.toArray(node.props?.children)) {
        const found = find(child, predicate);
        if (found) return found;
      }
      return undefined;
    };
    const panel = (view: any) => find(view, (e) => e.type === RecurringPanel);
    const formDialog = (view: any) => find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange && find(e, (child: any) => child.props?.placeholder === '0,00'));
    const deleteDialog = (view: any) => find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange && find(e, (child: any) => child.props?.children === 'Excluir'));
    try {
      globalThis.fetch = (async (_url: any, init?: any) => {
        requests.push(init?.method ?? 'GET');
        return init?.method ? response.promise : Response.json([entries[1]]);
      }) as typeof fetch;
      toast.success = (() => 1) as typeof toast.success; toast.error = (() => 1) as typeof toast.error;
      let view = render();
      const event = { currentTarget: null };
      if (operation.startsWith('DELETE')) {
        panel(view).props.requestDelete('r1', event); view = render();
        const dialog = deleteDialog(view);
        const action = find(dialog, (e) => e.props?.children === 'Excluir');
        const pending = action.props.onClick({ preventDefault: noop });
        dialog.props.onOpenChange(false); view = render();
        panel(view).props.requestDelete(operation === 'DELETE-same' ? 'r1' : 'r2', event); view = render();
        response.resolve(new Response(null, { status: 200 })); await pending;
        view = render();
        expect(deleteDialog(view).props.open).toBe(true);
      } else {
        if (operation === 'POST') panel(view).props.openNew(event); else panel(view).props.openEdit(entries[0], event);
        view = render();
        let dialog = formDialog(view);
        find(dialog, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...').props.onChange({ target: { value: 'Primeiro' } }); view = render();
        dialog = formDialog(view);
        find(dialog, (e) => e.props?.placeholder === '0,00').props.onChange({ target: { value: '10' } }); view = render();
        dialog = formDialog(view);
        const pending = find(dialog, (e) => e.props?.children === (operation === 'POST' ? 'Criar' : 'Salvar')).props.onClick();
        dialog.props.onOpenChange(false); view = render();
        if (operation === 'POST') panel(view).props.openNew(event); else panel(view).props.openEdit(entries[0], event);
        view = render(); dialog = formDialog(view);
        find(dialog, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...').props.onChange({ target: { value: 'Segundo rascunho' } });
        response.resolve(new Response(null, { status: operation === 'POST' ? 201 : 200 })); await pending;
        view = render(); dialog = formDialog(view);
        expect(dialog.props.open).toBe(true);
        expect(find(dialog, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...').props.value).toBe('Segundo rascunho');
      }
      await Promise.resolve();
      expect(requests).toEqual([operation.startsWith('DELETE') ? 'DELETE' : operation, 'GET']);
      expect(panel(render()).props.recurring).toEqual([entries[1]]);
    } finally {
      internals.H = previousDispatcher; globalThis.fetch = originalFetch; toast.success = originalSuccess; toast.error = originalError;
    }
  });
}

test('DELETE impede cliques repetidos por id pendente e permite retry após 503', async () => {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = internals.H, originalFetch = globalThis.fetch;
  const originalSuccess = toast.success, originalError = toast.error;
  const states: any[] = [], refs: any[] = [];
  let index = 0, refIndex = 0;
  const requests: string[] = [];
  const first = Promise.withResolvers<Response>();
  const render = () => {
    index = 0; refIndex = 0;
    internals.H = {
      useState: (initial: unknown) => {
        const i = index++; if (!(i in states)) states[i] = initial;
        return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
      },
      useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; },
      useId: () => 'test-id', useCallback: (fn: unknown) => fn, useEffect: noop,
    };
    return RecurringTransactionsWidget();
  };
  const find = (node: any, predicate: (element: any) => boolean): any => {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = find(child, predicate); if (found) return found;
    }
    return undefined;
  };
  try {
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (!init?.method) return Response.json([]);
      requests.push(JSON.parse(init.body).id);
      return requests.length === 1 ? first.promise : new Response(null, { status: 200 });
    }) as typeof fetch;
    toast.success = (() => 1) as typeof toast.success; toast.error = (() => 1) as typeof toast.error;
    let view = render();
    find(view, (e) => e.type === RecurringPanel).props.requestDelete('r1', { currentTarget: null });
    view = render();
    let dialog = find(view, (e) => e.props?.open === true && find(e, (child: any) => child.props?.children === 'Excluir'));
    let action = find(dialog, (e) => e.props?.children === 'Excluir');
    const click = () => action.props.onClick({ preventDefault: noop });
    const pending = click(); await click();
    expect(requests).toEqual(['r1']);
    dialog.props.onOpenChange(false); view = render();
    find(view, (e) => e.type === RecurringPanel).props.requestDelete('r1', { currentTarget: null }); view = render();
    dialog = find(view, (e) => e.props?.open === true && find(e, (child: any) => child.props?.children === 'Excluir'));
    action = find(dialog, (e) => e.props?.children === 'Excluir'); await click();
    expect(requests).toEqual(['r1']);
    first.resolve(new Response(null, { status: 503 })); await pending;
    await click();
    expect(requests).toEqual(['r1', 'r1']);
    expect(find(render(), (e) => e.props?.open === false && find(e, (child: any) => child.props?.children === 'Excluir'))).toBeDefined();
  } finally {
    internals.H = previousDispatcher; globalThis.fetch = originalFetch; toast.success = originalSuccess; toast.error = originalError;
  }
});

// Portais Radix não aparecem no SSR; verificar o contrato das confirmações na view.
for (const [file, count] of [["recurring-transactions.tsx",1]] as const) {
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

import * as receiptModule from './receipt-generator';

test('recurring-transactions exibe erro com retry e bloqueia duplo clique durante saveForm', async () => {
  const errHtml = renderToStaticMarkup(
    <RecurringPanel
      recurring={[]}
      loading={false}
      error
      processing={false}
      activeCount={0}
      inactiveCount={0}
      monthlyIncome={0}
      monthlyTotal={0}
      openNew={noop}
      processRecurring={noop}
      openEdit={noop}
      requestDelete={noop}
      toggleActive={noop}
      onRetry={noop}
    /> as React.ReactElement,
  );
  expect(errHtml).toContain('Tentar novamente');
  expect(errHtml).not.toContain('Nenhuma transação recorrente');

  // Double-click lock on saveForm
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = internals.H, originalFetch = globalThis.fetch;
  const originalSuccess = toast.success, originalError = toast.error;
  const states: any[] = [], refs: any[] = [];
  let index = 0, refIndex = 0;
  let postCount = 0;
  const pendingPost = Promise.withResolvers<Response>();
  const render = () => {
    index = 0; refIndex = 0;
    internals.H = {
      useState: (initial: unknown) => {
        const i = index++; if (!(i in states)) states[i] = initial;
        return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
      },
      useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; },
      useId: () => 'test-id', useCallback: (fn: unknown) => fn, useEffect: noop,
    };
    return RecurringTransactionsWidget();
  };
  const find = (node: any, predicate: (element: any) => boolean): any => {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = find(child, predicate); if (found) return found;
    }
    return undefined;
  };
  try {
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'POST') {
        postCount++;
        return pendingPost.promise;
      }
      return Response.json([]);
    }) as typeof fetch;
    toast.success = (() => 1) as typeof toast.success;
    toast.error = (() => 1) as typeof toast.error;

    let view = render();
    find(view, (e) => e.type === RecurringPanel).props.openNew({ currentTarget: null });
    view = render();
    find(view, (e) => e.props?.placeholder === 'Ex: Salário, Aluguel, Netflix...').props.onChange({ target: { value: 'Internet' } });
    view = render();
    find(view, (e) => e.props?.placeholder === '0,00').props.onChange({ target: { value: '99' } });
    view = render();
    const dialog = find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange);
    const submit = find(dialog, (e) => e.props?.children === 'Criar');
    const p1 = submit.props.onClick();
    const p2 = submit.props.onClick();
    view = render();
    const dialogWhilePending = find(view, (e) => typeof e.props?.open === 'boolean' && e.props?.onOpenChange);
    const submitWhilePending = find(dialogWhilePending, (e) => e.props?.onClick === submit.props.onClick || e.props?.children === 'Salvando…' || e.props?.children === 'Criar');
    expect(submitWhilePending?.props?.disabled).toBe(true);
    pendingPost.resolve(new Response('{}', { status: 201 }));
    await Promise.all([p1, p2]);
    expect(postCount).toBe(1);
  } finally {
    internals.H = previousDispatcher; globalThis.fetch = originalFetch; toast.success = originalSuccess; toast.error = originalError;
  }
});

test('receipt-generator gera HTML standalone para impressão, remove micro-tipografia e oferece seletor de registros', () => {
  const src = readFileSync(new URL('./receipt-generator.tsx', import.meta.url), 'utf8');
  expect(src).not.toMatch(/text-\[(10|11)px\]/);
  expect(typeof (receiptModule as Record<string, any>).buildReceiptPrintHtml).toBe('function');
  const html = (receiptModule as Record<string, any>).buildReceiptPrintHtml(purchase);
  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('@media print');
  expect(html).toContain('QA-001');
  expect(html).toContain('Loja sintética');
  expect(html).toContain('R$ 42,50');
  expect(html).not.toMatch(/text-muted-foreground|bg-background|text-foreground/);

  const workspaceHtml = renderToStaticMarkup(
    <ReceiptWorkspace
      receiptType="purchase"
      setReceiptType={noop}
      receiptId=""
      setReceiptId={noop}
      receiptData={null}
      isLoading={false}
      error={null}
      copied={false}
      records={[{ id: 'p1', label: 'Loja sintética · R$ 42,50' }]}
      generateReceipt={noop}
      handlePrint={noop}
      handleDownload={noop}
      handleCopy={noop}
    /> as React.ReactElement,
  );
  expect(workspaceHtml).toContain('Selecionar registro recente');
});
