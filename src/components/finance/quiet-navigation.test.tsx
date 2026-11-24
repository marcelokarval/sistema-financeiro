/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { QuickStatsOverview } from './quick-stats-overview';
import { readFileSync } from 'node:fs';
import { useAppStore } from '@/lib/store';

const noop = () => {};

describe('navegação e shell transversal Quiet Financial OS', () => {
  test('Sidebar renderiza grupos, indicador SSE e botão Recarregar nos modos expandido e colapsado', () => {
    const expanded = renderToStaticMarkup(
      <Sidebar collapsed={false} isConnected={true} onToggle={noop} onNavigate={noop} />,
    );
    const collapsed = renderToStaticMarkup(
      <Sidebar collapsed={true} isConnected={false} onToggle={noop} onNavigate={noop} />,
    );

    for (const group of ['Visão', 'Movimentação', 'Patrimônio']) {
      expect(expanded).toContain(group);
    }
    expect(expanded).toContain('aria-current="page"');
    expect(expanded).toContain('bg-[var(--ds-accent-positive)]');
    expect(expanded).toContain('aria-label="Recarregar"');
    expect(collapsed).toContain('aria-label="Recarregar"');
    expect(expanded).not.toMatch(/bg-gradient|glass-card|card-glow/);
  });

  test('MobileNav renderiza 4 atalhos principais e botão Mais', () => {
    const html = renderToStaticMarkup(<MobileNav />);
    for (const label of ['Resumo', 'Contas', 'Cartões', 'Compras', 'Mais']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-current="page"');
    expect(html).not.toMatch(/bg-gradient|glass-card|card-glow/);
  });

  test('QuickStatsOverview aceita refreshCounter e oferece retry no estado de erro', () => {
    const quickStatsSrc = readFileSync(new URL('./quick-stats-overview.tsx', import.meta.url), 'utf8');
    expect(quickStatsSrc).toContain('refreshCounter');
    expect(quickStatsSrc).toContain('Tentar novamente');
    const html = renderToStaticMarkup(<QuickStatsOverview refreshCounter={1} />);
    expect(html).toContain('Resumo rápido');
  });

  test('GlobalSearch e NotificationPanel possuem tratamento de erro com retry e persistência/data civil', () => {
    const searchSrc = readFileSync(new URL('./global-search.tsx', import.meta.url), 'utf8');
    const notifSrc = readFileSync(new URL('./notification-panel.tsx', import.meta.url), 'utf8');
    expect(searchSrc).toContain('Tentar novamente');
    expect(searchSrc).toContain('formatPurchaseDate(t.date)');
    expect(notifSrc).toContain('Tentar novamente');
    expect(notifSrc).toContain('localStorage');
  });
});


test('a solicitação de lançamento navega para Contas sem escolher conta e pode ser cancelada', () => {
  const initial = useAppStore.getState();
  try {
    useAppStore.setState({ currentView: 'dashboard', selectedAccountId: null, newTransactionRequested: false });
    useAppStore.getState().requestNewTransaction();
    expect(useAppStore.getState()).toMatchObject({
      currentView: 'accounts', selectedAccountId: null, newTransactionRequested: true,
    });
    useAppStore.getState().clearNewTransactionRequest();
    expect(useAppStore.getState()).toMatchObject({
      currentView: 'accounts', selectedAccountId: null, newTransactionRequested: false,
    });
    useAppStore.getState().requestNewTransaction();
    useAppStore.getState().setCurrentView('purchases');
    expect(useAppStore.getState()).toMatchObject({ currentView: 'purchases', newTransactionRequested: false });
  } finally {
    useAppStore.setState(initial, true);
  }
});
