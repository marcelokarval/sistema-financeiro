'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Sidebar } from '@/components/finance/sidebar';
import { DashboardView } from '@/components/finance/dashboard-view';
import { AccountsView } from '@/components/finance/accounts-view';
import { CardsView } from '@/components/finance/cards-view';
import { PurchasesView } from '@/components/finance/purchases-view';
import { CategoriesView } from '@/components/finance/categories-view';
import { InvestmentsView } from '@/components/finance/investments-view';
import { InstallmentsView } from '@/components/finance/installments-view';
import { ConsortiumsView } from '@/components/finance/consortiums-view';
import { SavingsView } from '@/components/finance/savings-view';
import { searchDestination, type SearchResultType } from '@/components/finance/global-search';
import { MobileNav } from '@/components/finance/mobile-nav';
import { CashFlowForecast } from '@/components/finance/cash-flow-forecast';
import { SmartInsights } from '@/components/finance/smart-insights';
import { SpendingTimeline } from '@/components/finance/spending-timeline';
import { SavingsChallenge } from '@/components/finance/savings-challenge';
import { ExpenseBreakdown } from '@/components/finance/expense-breakdown';
import { FinancialCalendar } from '@/components/finance/financial-calendar';
import { BalanceProjection } from '@/components/finance/balance-projection';
import { NetworthEvolution } from '@/components/finance/networth-evolution';
import { DebtOverview } from '@/components/finance/debt-overview';
import { TransactionAnalytics } from '@/components/finance/transaction-analytics';
import { ReceiptGenerator } from '@/components/finance/receipt-generator';
import { AchievementBadges } from '@/components/finance/achievement-badges';
import { GoalsDashboard } from '@/components/finance/goals-dashboard';
import { QuickStatsOverview } from '@/components/finance/quick-stats-overview';
import { AppHeader } from '@/components/finance/app-header';
import { AppOverlays } from '@/components/finance/app-overlays';
import { useAppStore, type ViewType } from '@/lib/store';
import { useRealtime } from '@/hooks/use-realtime';

export interface SearchSelectionActions {
  setCurrentView: (view: ViewType) => void;
  setSelectedAccountId: (id: string | null) => void;
  setSelectedCardId: (id: string | null) => void;
  setSelectedPurchaseId: (id: string | null) => void;
  setSelectedInvestmentId: (id: string | null) => void;
  setSelectedInstallmentPlanId: (id: string | null) => void;
  setSelectedConsortiumId: (id: string | null) => void;
}

/** Maps a global search selection to its destination view and direct item selector when applicable. */
export function applySearchSelection(
  type: SearchResultType | string,
  id: string,
  meta?: { accountId?: string },
  actions: SearchSelectionActions = useAppStore.getState(),
  resolveDestination: (type: string) => ViewType | undefined = searchDestination,
) {
  const destination = resolveDestination(type);
  if (!destination) return;
  if (type === 'accounts') actions.setSelectedAccountId(id);
  else if (type === 'transactions' && meta?.accountId) actions.setSelectedAccountId(meta.accountId);
  else if (type === 'cards') actions.setSelectedCardId(id);
  else if (type === 'purchases') actions.setSelectedPurchaseId(id);
  else if (destination === 'investments') actions.setSelectedInvestmentId(id);
  else if (destination === 'installments') actions.setSelectedInstallmentPlanId(id);
  else if (destination === 'consortiums') actions.setSelectedConsortiumId(id);
  actions.setCurrentView(destination);
}

function DashboardWithWidgets({ refreshCounter }: { refreshCounter: number }) {
  return (
    <DashboardView refreshCounter={refreshCounter}>
      <div key={refreshCounter} className="space-y-4">
        <QuickStatsOverview refreshCounter={refreshCounter} />
        <SmartInsights />
        <CashFlowForecast />
        <SpendingTimeline />
        <SavingsChallenge />
        <ExpenseBreakdown />
        <BalanceProjection />
        <FinancialCalendar />
        <NetworthEvolution />
        <DebtOverview />
        <TransactionAnalytics />
        <GoalsDashboard />
        <ReceiptGenerator />
        <AchievementBadges />
      </div>
    </DashboardView>
  );
}

export default function Page() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const requestNewTransaction = useAppStore((state) => state.requestNewTransaction);
  const requestNewGoal = useAppStore((state) => state.requestNewGoal);
  const setSelectedAccountId = useAppStore((state) => state.setSelectedAccountId);
  const setSelectedCardId = useAppStore((state) => state.setSelectedCardId);
  const setSelectedPurchaseId = useAppStore((state) => state.setSelectedPurchaseId);
  const setSelectedInvestmentId = useAppStore((state) => state.setSelectedInvestmentId);
  const setSelectedInstallmentPlanId = useAppStore((state) => state.setSelectedInstallmentPlanId);
  const setSelectedConsortiumId = useAppStore((state) => state.setSelectedConsortiumId);
  const aiAssistantVisible = useAppStore((state) => state.aiAssistantVisible);
  const setAiAssistantVisible = useAppStore((state) => state.setAiAssistantVisible);
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const advisorDialog = useRef<HTMLDialogElement>(null);
  const advisorButton = useRef<HTMLButtonElement>(null);
  const [advisorOpened, setAdvisorOpened] = useState(false);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const newEntryButton = useRef<HTMLButtonElement>(null);
  const launchOrigin = useRef<HTMLElement | null>(null);
  const searchOrigin = useRef<HTMLElement | null>(null);
  const toastShownRef = useRef<string | null>(null);

  const { isConnected, refreshCounter } = useRealtime({
    onEvent: (event) => {
      if (toastShownRef.current !== event.timestamp) {
        toastShownRef.current = event.timestamp;
        if (event.type === 'dashboard:updated' || event.type === 'dashboard:refresh') {
          toast.success('Dados atualizados');
        }
      }
    },
  });

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      if (document.querySelector('dialog[open], [data-state="open"][data-slot="dialog-content"], [data-state="open"][data-slot="sheet-content"], [data-state="open"][data-slot="dropdown-menu-content"]')) return;
      searchOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setShowNotifications(false);
      setShowSearch(true);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const dialog = advisorDialog.current;
    if (!dialog) return;
    if (aiAssistantVisible && !dialog.open) dialog.showModal();
    if (!aiAssistantVisible && dialog.open) dialog.close();
  }, [aiAssistantVisible, mounted]);

  if (!mounted) {
    return (
      <div role="status" className="flex h-dvh min-w-0 items-center justify-center bg-background text-sm text-muted-foreground">
        <span>Carregando FinanceApp…</span>
      </div>
    );
  }

  const startLaunch = (origin: HTMLElement | null) => {
    launchOrigin.current = origin;
    setShowNotifications(false);
    requestNewTransaction();
  };

  const restoreLaunchFocus = () => {
    (launchOrigin.current?.isConnected ? launchOrigin.current : newEntryButton.current)?.focus();
    launchOrigin.current = null;
  };

  const closeNotifications = () => {
    setShowNotifications(false);
    notificationButton.current?.focus();
  };

  const closeSearch = () => {
    setShowSearch(false);
    const origin = searchOrigin.current;
    searchOrigin.current = null;
    // Radix restores focus after its close animation; wait until the portal unmounts.
    const dialog = document.querySelector('[data-slot="dialog-content"][data-state="open"]');
    const restoreFocus = () => (origin?.isConnected && origin !== document.body ? origin : searchButton.current)?.focus();
    if (!dialog) {
      restoreFocus();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!dialog.isConnected) {
        observer.disconnect();
        requestAnimationFrame(restoreFocus);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const handleSearchSelect = (type: SearchResultType, id: string, meta?: { accountId?: string }) => {
    applySearchSelection(type, id, meta, {
      setCurrentView,
      setSelectedAccountId,
      setSelectedCardId,
      setSelectedPurchaseId,
      setSelectedInvestmentId,
      setSelectedInstallmentPlanId,
      setSelectedConsortiumId,
    });
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardWithWidgets refreshCounter={refreshCounter} />;
      case 'accounts': return <AccountsView refreshCounter={refreshCounter} onLaunchClose={restoreLaunchFocus} />;
      case 'cards': return <CardsView />;
      case 'purchases': return <PurchasesView />;
      case 'categories': return <CategoriesView />;
      case 'investments': return <InvestmentsView />;
      case 'installments': return <InstallmentsView />;
      case 'consortiums': return <ConsortiumsView />;
      case 'savings': return <SavingsView />;
    }
  };

  const darkTheme = resolvedTheme === 'dark';

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        isConnected={isConnected}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onNavigate={setCurrentView}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          currentView={currentView}
          isConnected={isConnected}
          darkTheme={darkTheme}
          onToggleTheme={() => setTheme(darkTheme ? 'light' : 'dark')}
          searchButtonRef={searchButton}
          onOpenSearch={(origin) => {
            searchOrigin.current = origin;
            setShowNotifications(false);
            setShowSearch(true);
          }}
          advisorButtonRef={advisorButton}
          aiAssistantVisible={aiAssistantVisible}
          onOpenAdvisor={() => {
            setShowNotifications(false);
            setAdvisorOpened(true);
            setAiAssistantVisible(true);
          }}
          notificationButtonRef={notificationButton}
          showNotifications={showNotifications}
          onToggleNotifications={() => setShowNotifications((open) => !open)}
          onCloseNotifications={closeNotifications}
          onDismissNotifications={() => setShowNotifications(false)}
          onQuickNavigate={(view, origin) => {
            if (view === 'accounts') {
              startLaunch(origin);
            } else {
              setCurrentView(view);
            }
          }}
          onNewGoal={() => {
            setShowNotifications(false);
            requestNewGoal();
          }}
          onExport={() => { window.open('/api/export?type=transactions&format=csv', '_blank'); }}
          newEntryButtonRef={newEntryButton}
          onNewEntry={startLaunch}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div key={currentView === 'dashboard' || currentView === 'accounts' ? currentView : `${currentView}-${refreshCounter}`} className="mx-auto min-w-0 max-w-[1440px] px-3 py-4 sm:px-5 lg:px-6">
            {renderView()}
          </div>
        </main>
        <MobileNav />
      </div>

      <AppOverlays
        advisorDialogRef={advisorDialog}
        aiAssistantVisible={aiAssistantVisible}
        advisorOpened={advisorOpened}
        onCloseAdvisor={() => setAiAssistantVisible(false)}
        onAdvisorDialogClose={() => advisorButton.current?.focus()}
        showSearch={showSearch}
        onCloseSearch={closeSearch}
        onSelectSearch={handleSearchSelect}
      />
    </div>
  );
}
