/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React, { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet } from 'lucide-react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { QuickStatsOverview } from './quick-stats-overview';
import { AppHeader } from './app-header';
import { AppOverlays } from './app-overlays';
import { GlobalSearchResult, SearchResults } from './global-search-result';
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
    expect(notifSrc).toContain('QueryPanel');
  });

  test('AppHeader separa o cabeçalho com ações globais, notificação sem papel de dialog e indicador offline', () => {
    const html = renderToStaticMarkup(
      <AppHeader
        currentView="cards"
        isConnected={false}
        darkTheme={false}
        onToggleTheme={noop}
        searchButtonRef={createRef()}
        onOpenSearch={noop}
        advisorButtonRef={createRef()}
        aiAssistantVisible={false}
        onOpenAdvisor={noop}
        notificationButtonRef={createRef()}
        showNotifications={true}
        onToggleNotifications={noop}
        onCloseNotifications={noop}
        onDismissNotifications={noop}
        onQuickNavigate={noop}
        onNewGoal={noop}
        onExport={noop}
        newEntryButtonRef={createRef()}
        onNewEntry={noop}
      />,
    );

    expect(html).toContain('Cartões');
    expect(html).toContain('Acompanhe cartões e faturas');
    expect(html).toContain('Tempo real indisponível');
    expect(html).toContain('aria-label="Abrir busca global"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-label="Usar tema escuro"');
    expect(html).toContain('aria-label="Abrir assistente financeiro IA"');
    expect(html).toContain('aria-label="Notificações"');
    expect(html).toContain('aria-label="Ações rápidas"');
    expect(html).toContain('aria-label="Novo lançamento"');
    expect(html).toContain('data-quiet-notifications');
    expect(html).not.toMatch(/data-quiet-notifications[^>]*role="dialog"/);
  });

  test('AppOverlays monta AIAdvisor sob demanda em dialog nativo e preserva inert quando fechado', () => {
    const closedHtml = renderToStaticMarkup(
      <AppOverlays
        advisorDialogRef={createRef()}
        aiAssistantVisible={false}
        advisorOpened={false}
        onCloseAdvisor={noop}
        onAdvisorDialogClose={noop}
        showSearch={false}
        onCloseSearch={noop}
        onSelectSearch={noop}
      />,
    );
    expect(closedHtml).toContain('<dialog');
    expect(closedHtml).toContain('inert=""');
    expect(closedHtml).not.toContain('data-quiet-advisor');

    const demandHtml = renderToStaticMarkup(
      <AppOverlays
        advisorDialogRef={createRef()}
        aiAssistantVisible={true}
        advisorOpened={true}
        onCloseAdvisor={noop}
        onAdvisorDialogClose={noop}
        showSearch={false}
        onCloseSearch={noop}
        onSelectSearch={noop}
      />,
    );
    expect(demandHtml).toContain('data-quiet-advisor');
    expect(demandHtml).toContain('aria-label="Fechar assistente financeiro"');
  });

  test('GlobalSearchResult e SearchResults preservam marcação tabular fora de categorias e estado ativo', () => {
    const itemHtml = renderToStaticMarkup(
      <ul>
        <GlobalSearchResult
          result={{ id: 'acc-1', type: 'accounts', label: 'Conta Principal', secondary: 'R$ 100,00 · Banco', icon: Wallet }}
          index={0}
          active={true}
          onActivate={noop}
          onSelect={noop}
        />
        <GlobalSearchResult
          result={{ id: 'cat-1', type: 'categories', label: 'Mercado', secondary: 'Despesa', icon: Wallet }}
          index={1}
          active={false}
          onActivate={noop}
          onSelect={noop}
        />
      </ul>,
    );
    expect(itemHtml).toContain('data-result-index="0"');
    expect(itemHtml).toContain('data-active="true"');
    expect(itemHtml).toContain('font-mono tabular-nums');
    expect(itemHtml).toContain('Mercado');

    const statusHtml = renderToStaticMarkup(
      <SearchResults groups={[]} query="" loading={false} activeIndex={0} onActivate={noop} onSelect={noop} />,
    );
    expect(statusHtml).toContain('Comece a digitar para buscar');
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
