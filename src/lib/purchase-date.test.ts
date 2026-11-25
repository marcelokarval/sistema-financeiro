/// <reference types="bun-types" />

import { expect, setSystemTime, spyOn, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardsView } from '@/components/finance/cards-view';
import { formatPurchaseDate, purchaseDateForInput, purchaseDateForSave } from './purchase-date';
import { existsSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { DashboardContent } from '@/components/finance/dashboard-view';

test.each(['2026-11-19', '2026-11-19T00:00:00.000Z', new Date('2026-11-19T00:00:00Z')])(
  'mantém a data civil %s no campo, na exibição e no recibo sem hora',
  (date) => {
    expect(purchaseDateForInput(date)).toBe('2026-11-19');
    expect(formatPurchaseDate(date)).toBe('19/11/2026');
    expect(formatPurchaseDate(date, 'receipt')).toBe('19/11/2026');
  },
);

const bahia = Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Bahia';
const utc = Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC';
const timeZoneTest = bahia || utc ? test : test.skip;

timeZoneTest('data inicial usa o dia local perto da virada UTC', () => {
  expect(purchaseDateForInput(undefined, new Date('2026-11-19T00:30:00Z'))).toBe(
    bahia ? '2026-11-18' : '2026-11-19',
  );
});

timeZoneTest.each(['2026-11-19T01:15:00Z', new Date('2026-11-19T01:15:00Z')])(
  'preserva a data e a hora locais do instante histórico %s',
  (date) => {
    expect(purchaseDateForInput(date)).toBe(bahia ? '2026-11-18' : '2026-11-19');
    expect(formatPurchaseDate(date)).toBe(bahia ? '18/11/2026' : '19/11/2026');
    expect(formatPurchaseDate(date, 'receipt')).toBe(bahia ? '18/11/2026, 22:15' : '19/11/2026, 01:15');
  },
);

timeZoneTest('fração de segundo não vira data civil', () => {
  expect(formatPurchaseDate('2026-11-19T00:00:00.001Z', 'receipt')).toBe(
    bahia ? '18/11/2026, 21:00' : '19/11/2026, 00:00',
  );
});

timeZoneTest('salvar uma edição de outros campos não reescreve o instante histórico', () => {
  const instant = '2026-11-19T01:15:00.000Z';
  expect(purchaseDateForSave(bahia ? '2026-11-18' : '2026-11-19', instant)).toBe(instant);
  expect(purchaseDateForSave('2026-11-20', instant)).toBe('2026-11-20');
  expect(purchaseDateForSave('2026-11-19')).toBe('2026-11-19');
});

timeZoneTest('Compras no cartão renderiza data civil e mantém o dia local do instante histórico', () => {
  const card = { id: 'card', name: 'Cartão sintético', type: 'CREDIT', brand: 'VISA', lastFourDigits: '1234', creditLimit: 100, currentBalance: 10, closingDay: 7, dueDay: 16, color: '#8b5cf6', flag: '' };
  const purchases = [
    { id: 'civil', merchant: 'Compra civil', date: '2026-11-19T00:00:00.000Z', totalAmount: 6, category: { name: 'Civil' }, items: [] },
    { id: 'instant', merchant: 'Compra histórica', date: '2026-11-19T01:15:00.000Z', totalAmount: 4, category: { name: 'Histórica' }, items: [] },
  ];
  // SSR não roda efeitos: simula o estado após selecionar um cartão e receber as compras.
  function RenderDetail() {
    const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: { useState: (initial: unknown) => unknown } } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const dispatcher = internals.H;
    const original = dispatcher.useState;
    const initialStates = [[card], { cardId: card.id, purchases }, card, false];
    const state = spyOn(dispatcher, 'useState').mockImplementation((initial) => (
      original(initialStates.length ? initialStates.shift() : initial)
    ));
    try { return CardsView(); } finally { state.mockRestore(); }
  }
  const markup = renderToStaticMarkup(React.createElement(RenderDetail));
  expect(markup).toContain('Compras no cartão');
  expect(markup).toContain('19/11/2026 · Civil');
  expect(markup).toContain(`${bahia ? '18/11/2026' : '19/11/2026'} · Histórica`);
  expect(markup).toContain('Dia 07');
  expect(markup).toContain('Dia 16');
});

timeZoneTest('Dashboard mantém o dia civil de Compras recentes sem mudar a data da transação', () => {
  const date = '2026-11-19T00:00:00.000Z';
  const markup = renderToStaticMarkup(React.createElement(DashboardContent, {
    query: { status: 'ready', data: {
      totalBalance: 0, totalCardBalance: 0, totalCardLimit: 0, monthIncome: 0, monthExpense: 0,
      monthlyTrend: [], accountBalances: [], expenseByCategory: [],
      recentTransactions: [{ id: 'txn', description: 'Transação controle', date, type: 'EXPENSE', amount: 5 }],
      recentPurchases: [{ id: 'civil', merchant: 'Compra civil', date, totalAmount: 5, items: [] },
        { id: 'instant', merchant: 'Compra histórica', date: '2026-11-19T01:15:00Z', totalAmount: 5, items: [] }],
    } }, showValues: true, retry: () => {},
  }));
  const local = bahia ? '18/11/2026' : '19/11/2026';
  expect(markup).toMatch(new RegExp("Compra civil<span[^>]*>19/11/2026 · 0 itens"));
  expect(markup).toContain(`>${local} · 0 itens</span>`);
  expect(markup).toMatch(new RegExp(`Transação controle</p><(?:p|div)[^>]*>${local}`));
});

// Opt-in: provisione uma base nova em bwrap com /tmp privado, sem .env e sem rede.
const calendarFixture = '/tmp/calendar-d3.sqlite';
test.skipIf(!(bahia || utc) || process.env.CALENDAR_D3_SQLITE !== '1')(
  'Calendário agrupa compra civil no dia escolhido sem hora e preserva instantes e transações',
  async () => {
    expect(process.env.DATABASE_URL).toBe(`file:${calendarFixture}`);
    expect(existsSync(calendarFixture)).toBe(true);
    expect(existsSync('.env')).toBe(false);
    expect(existsSync('prisma/.env')).toBe(false);
    const { db } = await import('@/lib/db');
    try {
      expect(await db.$queryRaw<{ seq: bigint; name: string; file: string }[]>`PRAGMA database_list`).toContainEqual({ seq: BigInt(0), name: 'main', file: calendarFixture });
      expect(await db.$queryRaw<{ foreign_keys: bigint }[]>`PRAGMA foreign_keys`).toEqual([{ foreign_keys: BigInt(1) }]);
      expect(await db.purchase.count()).toBe(0);
      expect(await db.transaction.count()).toBe(0);
      const { GET } = await import('@/app/api/financial-calendar/route');
      setSystemTime(new Date('2026-11-17T12:00:00Z'));
      const midnight = new Date('2026-11-19T00:00:00Z');
      expect((await db.purchase.create({ data: { id: 'civil', date: midnight, merchant: 'Compra civil', totalAmount: 12 } })).date.toISOString()).toBe('2026-11-19T00:00:00.000Z');
      await db.purchase.create({ data: { id: 'instant', date: new Date('2026-11-19T01:15:00Z'), merchant: 'Compra histórica', totalAmount: 5 } });
      await db.purchase.create({ data: { id: 'edge', date: new Date('2026-11-17T00:00:00Z'), merchant: 'Borda da consulta', totalAmount: 1 } });
      await db.transaction.create({ data: { id: 'txn', date: midnight, description: 'Transação controle', type: 'EXPENSE', amount: 5 } });
      const response = await GET(new NextRequest('http://fixture.invalid/api/financial-calendar?days=7'));
      expect(response.status).toBe(200);
      const { days } = await response.json() as { days: { date: string; events: { id: string; type: string; time?: string }[] }[] };
      const events = Object.fromEntries(days.flatMap(({ date, events }) => events.map((event) => [event.id, { date, ...event }])));
      const local = bahia ? '2026-11-18' : '2026-11-19';
      expect(events.civil).toMatchObject({ date: '2026-11-19', type: 'purchase' });
      expect(events.civil).not.toHaveProperty('time');
      expect(events.instant).toMatchObject({ date: local, time: bahia ? '22:15' : '01:15' });
      expect(events.txn).toMatchObject({ date: local, time: bahia ? '21:00' : '00:00', type: 'transaction' });
      expect(days.map(({ date }) => date)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']);
      if (bahia) expect(events.edge).toBeUndefined();
      else expect(events.edge).toMatchObject({ date: '2026-11-17', type: 'purchase' });
    } finally {
      setSystemTime();
      await db.$disconnect();
    }
  },
);
