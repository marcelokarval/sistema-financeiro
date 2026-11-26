/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React, { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet, ArrowLeftRight, TrendingUp, CalendarClock, Building2 } from 'lucide-react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { QuickStatsOverview } from './quick-stats-overview';
import { AppHeader } from './app-header';
import { AppOverlays } from './app-overlays';
import { GlobalSearchResult, SearchResults, searchGroupMeta } from './global-search-result';
import { readFileSync } from 'node:fs';
import { useAppStore, type ViewType } from '@/lib/store';
import * as globalSearchModule from './global-search';
import { searchDestination, type SearchResultType } from './global-search';
import { QuickActions } from './quick-actions';
import * as pageModule from '@/app/page';
import { renderWithIntl } from '@/test-utils/intl';

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
    expect(searchSrc).toContain("t('retry')");
    expect(searchSrc).toContain("formatPurchaseDate(tx.date, 'date', locale)");
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

describe('contrato alinhado da Busca Global (Alternativa A)', () => {
  test('applySearchSelection encaminha destino, seleciona registros por domínio e ignora transação sem accountId', () => {
    const initial = useAppStore.getState();
    const applySearchSelection = (pageModule as {
      applySearchSelection?: (
        type: SearchResultType | string,
        id: string,
        meta?: { accountId?: string },
        actions?: ReturnType<typeof useAppStore.getState>,
        resolveDestination?: (type: string) => ViewType | undefined,
      ) => void;
    }).applySearchSelection;

    expect(typeof applySearchSelection).toBe('function');

    const emptySelections = {
      selectedAccountId: null,
      selectedCardId: null,
      selectedPurchaseId: null,
      selectedInvestmentId: null,
      selectedInstallmentPlanId: null,
      selectedConsortiumId: null,
    };

    const resetStore = () => {
      useAppStore.setState({
        currentView: 'dashboard',
        ...emptySelections,
      });
    };

    try {
      resetStore();
      applySearchSelection!('accounts', 'acc-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'accounts',
        selectedAccountId: 'acc-1',
      });

      resetStore();
      applySearchSelection!('transactions', 'tx-1', { accountId: 'acc-9' });
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'accounts',
        selectedAccountId: 'acc-9',
      });

      resetStore();
      applySearchSelection!('transactions', 'tx-2');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'accounts',
      });

      resetStore();
      applySearchSelection!('cards', 'card-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'cards',
        selectedCardId: 'card-1',
      });

      resetStore();
      applySearchSelection!('purchases', 'pur-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'purchases',
        selectedPurchaseId: 'pur-1',
      });

      resetStore();
      applySearchSelection!('categories', 'cat-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'categories',
      });

      resetStore();
      applySearchSelection!('investments', 'inv-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'investments',
        selectedInvestmentId: 'inv-1',
      });

      resetStore();
      applySearchSelection!('installments', 'ins-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'installments',
        selectedInstallmentPlanId: 'ins-1',
      });

      resetStore();
      applySearchSelection!('consortiums', 'con-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'consortiums',
        selectedConsortiumId: 'con-1',
      });

      resetStore();
      applySearchSelection!('desconhecido', 'x-1');
      expect(useAppStore.getState()).toMatchObject({
        ...emptySelections,
        currentView: 'dashboard',
      });
    } finally {
      useAppStore.setState(initial, true);
    }
  });

  test('docs/reference/design-system.contract.md ratifica abertura/expansão direta com fallback seguro e retorno de foco no Escape', () => {
    const contract = readFileSync(new URL('../../../docs/reference/design-system.contract.md', import.meta.url), 'utf8');
    expect(contract).not.toContain('sem abrir automaticamente o registro');
    expect(contract).toMatch(/Na busca global,[\s\S]*abertura ou expansão direta[\s\S]*quando o ID existir/);
    expect(contract).toMatch(/Na busca global,[\s\S]*Categorias apenas navega/);
    expect(contract).toMatch(/Na busca global,[\s\S]*ID inexistente[\s\S]*sem abrir nem expandir outro registro/);
    expect(contract).toMatch(/Na busca global,[\s\S]*Escape devolve o foco/);
  });

  test('quiet-search-parity.qa.mjs remove historicalAutoOpenDeviation mantendo os cenários da busca', () => {
    const qaScript = readFileSync(new URL('./quiet-search-parity.qa.mjs', import.meta.url), 'utf8');
    expect(qaScript).not.toContain('historicalAutoOpenDeviation');
    for (const scenario of [
      'busca-accounts-existente',
      'busca-transactions-accountId-valido',
      'busca-cards-existente',
      'busca-purchases-existente',
    ]) {
      expect(qaScript).toContain(scenario);
    }
  });

  test('docs/reference/frontend-componentization-coverage.md (Seção 5.1) ratifica a Busca Global conforme Alternativa A sem historicalAutoOpenDeviation', () => {
    const coverage = readFileSync(
      new URL('../../../docs/reference/frontend-componentization-coverage.md', import.meta.url),
      'utf8',
    );
    const sec51Match = coverage.match(/### 5\.1[\s\S]*?(?=### 5\.2)/);
    expect(sec51Match).not.toBeNull();
    const sec51 = sec51Match![0];
    const searchRow = sec51.split('\n').find((line) => line.includes('**Busca Global**'));
    expect(searchRow).toBeDefined();
    expect(searchRow).not.toContain('historicalAutoOpenDeviation');
    expect(searchRow).not.toContain('Não afirma conformidade Quiet');
    expect(searchRow).toMatch(/Alternativa A/i);
    expect(searchRow).toMatch(/Conforme Quiet/i);
  });

  test('Task 1.2: searchDestination e searchGroupMeta cobrem os 8 domínios da Alternativa A preservando singular e __proto__', () => {
    const expectedDestinations: Record<string, ViewType> = {
      transactions: 'accounts',
      purchases: 'purchases',
      accounts: 'accounts',
      cards: 'cards',
      categories: 'categories',
      investments: 'investments',
      installments: 'installments',
      consortiums: 'consortiums',
    };
    for (const [key, view] of Object.entries(expectedDestinations)) {
      expect(searchDestination(key)).toBe(view);
      expect(searchGroupMeta[key]).toBeDefined();
    }
    expect(searchGroupMeta.investments?.icon).toBe(TrendingUp);
    expect(searchGroupMeta.installments?.icon).toBe(CalendarClock);
    expect(searchGroupMeta.consortiums?.icon).toBe(Building2);
    expect(searchDestination('investment')).toBeUndefined();
    expect(searchDestination('__proto__')).toBeUndefined();
  });

  test('Task 1.2: requestGlobalSearch consulta os 8 endpoints, descarta abortados e buildSearchResults indexa novos domínios e TRANSFER neutro', async () => {
    const requestGlobalSearch = (globalSearchModule as Record<string, any>).requestGlobalSearch;
    const buildSearchResults = (globalSearchModule as Record<string, any>).buildSearchResults;
    expect(typeof requestGlobalSearch).toBe('function');
    expect(typeof buildSearchResults).toBe('function');

    const requested: Array<{ url: string; signal?: AbortSignal | null }> = [];
    const published: Array<Record<string, any>> = [];
    const controller = new AbortController();

    await requestGlobalSearch(
      controller.signal,
      (res: Record<string, any>) => published.push(res),
      async (url: string, init?: RequestInit) => {
        requested.push({ url, signal: init?.signal });
        if (url === '/api/investments') {
          return Response.json([{ id: 'inv-1', name: 'Tesouro Selic', ticker: 'SELIC', type: 'RENDA_FIXA', brokerage: 'XP', currentBalance: 5000 }]);
        }
        if (url === '/api/installments') {
          return Response.json([{ id: 'ins-1', description: 'Notebook Parcelado', monthlyValue: 350, installmentCount: 10, paidInstallments: 4, type: 'CARD_INSTALLMENT', status: 'ACTIVE', card: { name: 'Nubank' } }]);
        }
        if (url === '/api/consortiums') {
          return Response.json([{ id: 'con-1', description: 'Consórcio Imóvel', totalAmount: 200000, group: '101', quota: '22', administrator: 'Porto', status: 'ACTIVE' }]);
        }
        return Response.json([]);
      },
    );

    expect(requested.map((r) => r.url)).toEqual([
      '/api/transactions',
      '/api/purchases',
      '/api/accounts',
      '/api/cards',
      '/api/categories',
      '/api/investments',
      '/api/installments',
      '/api/consortiums',
    ]);
    expect(requested.every((r) => r.signal === controller.signal)).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0].error).toBe(false);

    // AbortController deve descartar publicação tardia mesmo em falha
    const abortedController = new AbortController();
    const abortedPublished: Array<Record<string, any>> = [];
    abortedController.abort();
    await requestGlobalSearch(
      abortedController.signal,
      (res: Record<string, any>) => abortedPublished.push(res),
      async () => new Response(null, { status: 503 }),
    );
    expect(abortedPublished).toEqual([]);

    const built = buildSearchResults(
      {
        ...published[0].rawData,
        transactions: [
          { id: 'tx-t', description: 'Transferência Reserva', amount: 300, type: 'TRANSFER', date: '2026-11-10', accountId: 'acc-1' },
          { id: 'tx-e', description: 'Mercado', amount: 120, type: 'EXPENSE', date: '2026-11-10', accountId: 'acc-1' },
        ],
      },
      '',
    );

    const transfer = built.find((item: any) => item.id === 'tx-t');
    expect(transfer).toBeDefined();
    expect(transfer.icon).toBe(ArrowLeftRight);
    expect(transfer.iconTone).toBe('text-muted-foreground');
    expect(transfer.secondary).not.toMatch(/^-/);
    expect(transfer.secondary).toContain('Transferência');

    const transferHtml = renderToStaticMarkup(
      <ul>
        <GlobalSearchResult result={transfer} index={0} active={false} onActivate={noop} onSelect={noop} />
      </ul>,
    );
    expect(transferHtml).not.toContain('text-(--ds-accent-danger)');
    expect(transferHtml).toContain('text-muted-foreground');

    const expense = built.find((item: any) => item.id === 'tx-e');
    expect(expense.iconTone).toBe('text-(--ds-accent-danger)');
    expect(expense.secondary).toMatch(/^-/);

    expect(built.some((item: any) => item.type === 'investments' && item.id === 'inv-1' && item.label === 'Tesouro Selic')).toBe(true);
    expect(built.some((item: any) => item.type === 'installments' && item.id === 'ins-1' && item.label === 'Notebook Parcelado')).toBe(true);
    expect(built.some((item: any) => item.type === 'consortiums' && item.id === 'con-1' && item.label === 'Consórcio Imóvel')).toBe(true);
  });
});

describe('internacionalização do shell em pt, es e en', () => {
  test('Sidebar, MobileNav, QuickActions, AppHeader e AppOverlays traduzem rótulos em es e en com LanguageSwitcher integrado', () => {
    const esSidebar = renderWithIntl(
      <Sidebar collapsed={false} isConnected={true} onToggle={noop} onNavigate={noop} />,
      'es',
    );
    expect(esSidebar).toContain('Patrimonio personal');
    expect(esSidebar).toContain('Cuentas');
    expect(esSidebar).toContain('Tarjetas');
    expect(esSidebar).toContain('aria-label="Recargar"');

    const enSidebar = renderWithIntl(
      <Sidebar collapsed={false} isConnected={false} onToggle={noop} onNavigate={noop} />,
      'en',
    );
    expect(enSidebar).toContain('Personal wealth');
    expect(enSidebar).toContain('Accounts');
    expect(enSidebar).toContain('Cards');
    expect(enSidebar).toContain('Real-time unavailable');
    expect(enSidebar).toContain('aria-label="Reload"');

    const enMobileNav = renderWithIntl(<MobileNav />, 'en');
    expect(enMobileNav).toContain('aria-label="Mobile navigation"');
    expect(enMobileNav).toContain('Overview');
    expect(enMobileNav).toContain('Accounts');
    expect(enMobileNav).toContain('More');

    const esQuickActions = renderWithIntl(<QuickActions />, 'es');
    expect(esQuickActions).toContain('Acciones rápidas');
    const enQuickActions = renderWithIntl(<QuickActions />, 'en');
    expect(enQuickActions).toContain('Quick actions');

    const enHeader = renderWithIntl(
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
        showNotifications={false}
        onToggleNotifications={noop}
        onCloseNotifications={noop}
        onDismissNotifications={noop}
        onQuickNavigate={noop}
        onNewGoal={noop}
        onExport={noop}
        newEntryButtonRef={createRef()}
        onNewEntry={noop}
      />,
      'en',
    );
    expect(enHeader).toContain('Track cards and statements');
    expect(enHeader).toContain('aria-label="Open global search"');
    expect(enHeader).toContain('aria-label="New entry"');
    expect(enHeader).toContain('data-language-switcher="compact"');
    expect(enHeader).toContain('src="/locale-flags/en.svg"');

    const esOverlays = renderWithIntl(
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
      'es',
    );
    expect(esOverlays).toContain('Asistente financiero IA');
    expect(esOverlays).toContain('aria-label="Cerrar asistente financiero"');
  });

  test('SearchResults e buildSearchResults respeitam locale na formatação e rótulos', () => {
    const enStatusHtml = renderWithIntl(
      <SearchResults groups={[]} query="" loading={false} activeIndex={0} onActivate={noop} onSelect={noop} />,
      'en',
    );
    expect(enStatusHtml).toContain('Start typing to search');

    const esLoadingHtml = renderWithIntl(
      <SearchResults groups={[]} query="abc" loading={false} activeIndex={0} onActivate={noop} onSelect={noop} />,
      'es',
    );
    expect(esLoadingHtml).toContain('No se encontraron resultados');

    const buildSearchResults = (globalSearchModule as {
      buildSearchResults: (
        rawData: Record<string, any[]>,
        query: string,
        options?: { locale?: string },
      ) => Array<{ id: string; secondary: string }>;
    }).buildSearchResults;

    const enResults = buildSearchResults(
      {
        transactions: [
          { id: 'tx-1', description: 'Transfer', amount: 300, type: 'TRANSFER', date: '2026-11-19', accountId: 'acc-1' },
        ],
        cards: [
          { id: 'card-1', name: 'Main Card', type: 'CREDIT', brand: 'VISA', lastFourDigits: '1234', currentBalance: 250 },
        ],
      },
      '',
      { locale: 'en' },
    );

    const tx = enResults.find((item) => item.id === 'tx-1');
    expect(tx?.secondary).toContain('Transfer');
    expect(tx?.secondary).toContain('11/19/2026');
    expect(tx?.secondary).toContain('R$');

    const card = enResults.find((item) => item.id === 'card-1');
    expect(card?.secondary).toContain('Credit');
    expect(card?.secondary).toContain('Statement:');
  });
});
