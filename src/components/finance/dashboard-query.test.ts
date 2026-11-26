/// <reference types="bun-types" />

import { expect, test } from 'bun:test';

// A consulta só usa a assinatura chamável de fetch, não métodos do runtime Bun.
const preconnect = () => {};

const previous = { from: '2026-01-01', to: '2026-01-31' };
const next = { from: '2026-02-01', to: '2026-02-28' };
const empty = { totalBalance: 0, totalCardBalance: 0, totalCardLimit: 0, monthIncome: 0, monthExpense: 0, accountBalances: [], recentTransactions: [], recentPurchases: [], expenseByCategory: [], monthlyTrend: [] };

test('envia o mesmo contrato de datas e preserva zeros do payload', async () => {
  const { fetchDashboard } = await import('./dashboard-query');
  const signal = new AbortController().signal;
  const fetcher: typeof fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    expect(input).toBe('/api/dashboard?from=2026-01-01&to=2026-01-31');
    expect(init?.signal).toBe(signal);
    return Response.json(empty);
  }, { preconnect });
  expect(await fetchDashboard(previous, signal, fetcher)).toEqual(empty);
});

test('não transforma HTTP, conexão ou conteúdo inválido em números zerados', async () => {
  const { fetchDashboard } = await import('./dashboard-query');
  const signal = new AbortController().signal;
  const unavailable = Object.assign(async () => new Response('erro', { status: 503 }), { preconnect });
  const disconnected = Object.assign(async () => { throw new TypeError('offline'); }, { preconnect });
  const invalid = Object.assign(async () => Response.json({}), { preconnect });
  await expect(fetchDashboard(previous, signal, unavailable)).rejects.toThrow();
  await expect(fetchDashboard(previous, signal, disconnected)).rejects.toThrow();
  await expect(fetchDashboard(previous, signal, invalid)).rejects.toThrow();
});

test('suprime sucesso e falha atrasados mesmo quando o transporte ignora cancelamento', async () => {
  const { observeQuery } = await import('./dashboard-query');
  const staleSuccess = Promise.withResolvers<string>();
  const staleFailure = Promise.withResolvers<string>();
  const newResult = Promise.withResolvers<string>();
  const events: string[] = [];
  const load = (range: typeof previous, promise: Promise<string>) => observeQuery(
    () => promise,
    (result) => events.push(`${range.from} ${result.status}${result.status === 'ready' ? ` ${result.data}` : ''}`),
  );
  const cancelSuccess = load(previous, staleSuccess.promise);
  cancelSuccess();
  const cancelFailure = load(previous, staleFailure.promise);
  cancelFailure();
  load(next, newResult.promise);
  newResult.resolve('fevereiro');
  await newResult.promise;
  staleSuccess.resolve('janeiro');
  staleFailure.reject(new Error('falha de janeiro'));
  await Promise.allSettled([staleSuccess.promise, staleFailure.promise]);
  expect(events).toEqual(['2026-02-01 ready fevereiro']);
});

test('só expõe a resposta se ela for da solicitação ativa, inclusive voltando ao mesmo intervalo', async () => {
  const { currentDashboardResult } = await import('./dashboard-query');
  const oldRequest = { range: previous };
  const settled = { request: oldRequest, refreshCounter: 0, result: { status: 'ready' as const, data: empty } };
  expect(currentDashboardResult(oldRequest, settled, 0)).toEqual(settled.result);
  expect(currentDashboardResult({ range: next }, settled, 0)).toEqual({ status: 'loading' });
  expect(currentDashboardResult({ range: previous }, settled, 0)).toEqual({ status: 'loading' });
});

test('invalida o resultado do mesmo intervalo quando o contador externo avança', async () => {
  const { currentDashboardResult } = await import('./dashboard-query');
  const request = { range: previous };
  const result = { status: 'ready' as const, data: empty };
  const settled = { request, refreshCounter: 2, result };
  expect(currentDashboardResult(request, settled, 2)).toEqual(result);
  expect(currentDashboardResult(request, settled, 3)).toEqual({ status: 'loading' });
});

test('QUICK_FILTERS expõe chaves estáveis independentes do idioma', async () => {
  const { QUICK_FILTERS } = await import('./dashboard-query');
  expect(QUICK_FILTERS.map((item) => item.key)).toEqual(['month', 'quarter', 'halfyear', 'year', 'all']);
});
