/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import * as investments from './investments-view';
import * as installments from './installments-view';

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
for (const file of ['investment-editor.tsx', 'investments-view.tsx', 'installments-view.tsx']) {
  test(`${file}: formulário tem saída superior nomeada`, () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const headers = source.split(/<DialogHeader[^>]*>/).slice(1).map((part) => part.split('</DialogHeader>')[0]);
    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain('<DialogClose asChild>');
    expect(headers[0]).toContain('aria-label="Fechar formulário"');
  });
}

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
for (const [file, count] of [["investment-delete-confirmation.tsx",1],["investments-view.tsx",1],["installments-view.tsx",2]] as const) {
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
