'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Bell, Brain, Moon, Plus, Search, Sun, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar, navigationItems } from '@/components/finance/sidebar';
import { DashboardView } from '@/components/finance/dashboard-view';
import { AccountsView } from '@/components/finance/accounts-view';
import { CardsView } from '@/components/finance/cards-view';
import { PurchasesView } from '@/components/finance/purchases-view';
import { CategoriesView } from '@/components/finance/categories-view';
import { InvestmentsView } from '@/components/finance/investments-view';
import { InstallmentsView } from '@/components/finance/installments-view';
import { ConsortiumsView } from '@/components/finance/consortiums-view';
import { SavingsView } from '@/components/finance/savings-view';
import { NotificationPanel } from '@/components/finance/notification-panel';
import { GlobalSearch, searchDestination } from '@/components/finance/global-search';
import { QuickActions } from '@/components/finance/quick-actions';
import { MobileNav } from '@/components/finance/mobile-nav';
import { CashFlowForecast } from '@/components/finance/cash-flow-forecast';
import { SmartInsights } from '@/components/finance/smart-insights';
import { AIAdvisor } from '@/components/finance/ai-advisor';
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
import { Button } from '@/components/ui/button';
import { useAppStore, type ViewType } from '@/lib/store';
import { useRealtime } from '@/hooks/use-realtime';

const viewContext: Record<ViewType, string> = {
  dashboard: 'Visão geral das suas finanças',
  accounts: 'Gerencie suas contas e saldos',
  cards: 'Acompanhe cartões e faturas',
  purchases: 'Controle detalhado de compras',
  categories: 'Organize receitas e despesas',
  investments: 'Aportes, dividendos e rendimentos',
  installments: 'Financiamentos e parcelamentos',
  consortiums: 'Controle de consórcios',
  savings: 'Metas e caixinhas de poupança',
};

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

  const currentLabel = currentView === 'dashboard' ? 'Resumo financeiro' : navigationItems.find(({ view }) => view === currentView)?.label;
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
          <header className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border bg-card px-3 py-1.5 sm:min-h-16 sm:flex-nowrap sm:px-5 lg:px-6">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight tracking-tight sm:text-base">{currentLabel}</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">{viewContext[currentView]}</p>
            </div>
            <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-0.5 sm:flex-nowrap sm:gap-1">
              {!isConnected && (
                <span className="mr-1 hidden text-muted-foreground sm:max-md:inline-flex" title="Tempo real indisponível">
                  <WifiOff aria-hidden="true" className="size-4" />
                  <span className="sr-only">Tempo real indisponível</span>
                </span>
              )}
              <Button
                ref={searchButton}
                variant="ghost"
                className="size-9 px-0 text-muted-foreground lg:w-auto lg:gap-2 lg:border lg:border-border lg:px-3"
                aria-label="Abrir busca global"
                aria-keyshortcuts="Control+K Meta+K"
                aria-haspopup="dialog"
                onClick={(event) => {
                  searchOrigin.current = event.currentTarget;
                  setShowNotifications(false);
                  setShowSearch(true);
                }}
              >
                <Search aria-hidden="true" />
                <span className="hidden lg:inline">Buscar em tudo</span>
                <kbd aria-hidden="true" className="hidden rounded border border-border px-1 font-mono text-[10px] lg:inline">Ctrl/⌘ K</kbd>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                aria-label={darkTheme ? "Usar tema claro" : "Usar tema escuro"}
                onClick={() => setTheme(darkTheme ? "light" : "dark")}
              >
                {darkTheme ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </Button>

              <Button
                ref={advisorButton}
                variant="ghost"
                size="icon"
                aria-label="Abrir assistente financeiro IA"
                aria-haspopup="dialog"
                aria-expanded={aiAssistantVisible}
                onClick={() => {
                  setShowNotifications(false);
                  setAdvisorOpened(true);
                  setAiAssistantVisible(true);
                }}
              >
                <Brain aria-hidden="true" />
              </Button>

              <div
                onKeyDown={(event) => { if (event.key === "Escape" && showNotifications) closeNotifications(); }}
                className="[&>div]:!right-3 md:[&>div]:!right-6"
              >
                <Button
                  ref={notificationButton}
                  variant="ghost"
                  size="icon"
                  aria-label="Notificações"
                  aria-expanded={showNotifications}
                  onClick={() => setShowNotifications((open) => !open)}
                >
                  <Bell aria-hidden="true" />
                </Button>
                <NotificationPanel isOpen={showNotifications} onClose={closeNotifications} />
              </div>

              <QuickActions
                onOpenChange={(open) => { if (open) setShowNotifications(false); }}
                onNavigate={(view, origin) => {
                  if (view === "accounts") {
                    startLaunch(origin);
                  } else {
                    setCurrentView(view);
                  }
                }}
                onNewGoal={() => {
                  setShowNotifications(false);
                  requestNewGoal();
                }}
                onExport={() => { window.open("/api/export?type=transactions&format=csv", "_blank"); }}
              />

              <Button
                ref={newEntryButton}
                size="sm"
                className="ml-1 h-9 px-2.5"
                aria-label="Novo lançamento"
                aria-haspopup="dialog"
                onClick={(event) => startLaunch(event.currentTarget)}
              >
                <Plus aria-hidden="true" />
                <span>Novo lançamento</span>
              </Button>
            </div>
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div key={currentView === "dashboard" || currentView === "accounts" ? currentView : `${currentView}-${refreshCounter}`} className="mx-auto min-w-0 max-w-[1440px] px-3 py-4 sm:px-5 lg:px-6">
              {renderView()}
            </div>
          </main>
          <MobileNav />
        </div>

        <dialog
          ref={advisorDialog}
          inert={!aiAssistantVisible}
          aria-labelledby="advisor-title"
          className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/50"
          onCancel={(event) => {
            event.preventDefault();
            setAiAssistantVisible(false);
          }}
          onClose={() => advisorButton.current?.focus()}
        >
          <h2 id="advisor-title" className="sr-only">Assistente financeiro IA</h2>
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" size="icon" aria-label="Fechar assistente financeiro" onClick={() => setAiAssistantVisible(false)}>
              <X aria-hidden="true" />
            </Button>
          </div>
          {(advisorOpened || aiAssistantVisible) && <AIAdvisor />}
        </dialog>

        <GlobalSearch
          isOpen={showSearch}
          onClose={closeSearch}
          onSelect={(type, id, meta) => {
            const destination = searchDestination(type);
            if (!destination) return;
            if (type === 'accounts') setSelectedAccountId(id);
            else if (type === 'transactions' && meta?.accountId) setSelectedAccountId(meta.accountId);
            else if (type === 'cards') setSelectedCardId(id);
            else if (type === 'purchases') setSelectedPurchaseId(id);
            else if (destination === 'investments') setSelectedInvestmentId(id);
            else if (destination === 'installments') setSelectedInstallmentPlanId(id);
            else if (destination === 'consortiums') setSelectedConsortiumId(id);
            setCurrentView(destination);
          }}
        />
      </div>
  );
}
