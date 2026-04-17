'use client';

import { useState, useSyncExternalStore, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAppStore, type ViewType } from '@/lib/store';
import { useRealtime } from '@/hooks/use-realtime';
import { Sidebar } from '@/components/finance/sidebar';
import { DashboardView } from '@/components/finance/dashboard-view';
import { AccountsView } from '@/components/finance/accounts-view';
import { CardsView } from '@/components/finance/cards-view';
import { PurchasesView } from '@/components/finance/purchases-view';
import { CategoriesView } from '@/components/finance/categories-view';
import { NotificationPanel } from '@/components/finance/notification-panel';
import { GlobalSearch } from '@/components/finance/global-search';
import { QuickActions } from '@/components/finance/quick-actions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  Moon,
  Sun,
  Bell,
  Sparkles,
  Wallet,
  CreditCard,
  ShoppingCart,
  Tag,
  LayoutDashboard,
  Search,
  Heart,
  Zap,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const viewLabels: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  accounts: 'Contas',
  cards: 'Cartões',
  purchases: 'Compras',
  categories: 'Categorias',
};

const viewSubtitles: Record<ViewType, string> = {
  dashboard: 'Visão geral das suas finanças',
  accounts: 'Gerencie suas contas e saldos',
  cards: 'Acompanhe cartões e faturas',
  purchases: 'Controle detalhado de compras',
  categories: 'Organize receitas e despesas',
};

const viewIcons: Record<ViewType, React.ElementType> = {
  dashboard: LayoutDashboard,
  accounts: Wallet,
  cards: CreditCard,
  purchases: ShoppingCart,
  categories: Tag,
};

const viewColors: Record<ViewType, string> = {
  dashboard: 'from-emerald-500 to-cyan-500',
  accounts: 'from-violet-500 to-purple-500',
  cards: 'from-orange-500 to-rose-500',
  purchases: 'from-blue-500 to-indigo-500',
  categories: 'from-amber-500 to-orange-500',
};

function MobileSidebarContent({ onNavigate, onClose }: { onNavigate: (v: ViewType) => void; onClose: () => void }) {
  const { currentView } = useAppStore();
  const views: ViewType[] = ['dashboard', 'accounts', 'cards', 'purchases', 'categories'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight">FinanceApp</span>
          <p className="text-[10px] text-muted-foreground -mt-0.5">Gestão Inteligente</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {views.map((view, i) => {
          const isActive = currentView === view;
          const Icon = viewIcons[view];
          return (
            <motion.button
              key={view}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              onClick={() => { onNavigate(view); onClose(); }}
              className={`flex items-center w-full gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{viewLabels[view]}</span>
            </motion.button>
          );
        })}
      </nav>
      <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          <span>Dados seguros localmente</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          <span>v2.0.0</span>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { currentView, setCurrentView } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsedState, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const toastShownRef = useRef<string | null>(null);
  const { isConnected, refreshCounter } = useRealtime({
    onEvent: (event) => {
      if (toastShownRef.current !== event.timestamp) {
        toastShownRef.current = event.timestamp;
        const isDashboardEvent = event.type === 'dashboard:updated' || event.type === 'dashboard:refresh';
        if (isDashboardEvent) {
          toast.success('Dados atualizados');
        }
      }
    },
  });

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!mounted) return null;

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'accounts': return <AccountsView />;
      case 'cards': return <CardsView />;
      case 'purchases': return <PurchasesView />;
      case 'categories': return <CategoriesView />;
      default: return <DashboardView />;
    }
  };

  const currentIcon = viewIcons[currentView];
  const currentLabel = viewLabels[currentView];
  const currentSubtitle = viewSubtitles[currentView];
  const currentGradient = viewColors[currentView];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsedState}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsedState)}
        onNavigate={handleNavigate}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/40 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden hover:bg-accent/50">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                <MobileSidebarContent
                  onNavigate={handleNavigate}
                  onClose={() => {}}
                />
              </SheetContent>
            </Sheet>

            {/* Page title with icon */}
            <div className="flex items-center gap-3">
              <motion.div
                key={currentView}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${currentGradient} shadow-lg`}
              >
                <currentIcon className="w-4.5 h-4.5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-base font-semibold leading-tight">{currentLabel}</h1>
                <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">{currentSubtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5 mr-1">
              <motion.div
                initial={false}
                animate={{ scale: isConnected ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center w-7 h-7 rounded-full"
              >
                <div className={`relative flex items-center justify-center`}>
                  {isConnected ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-rose-400" />
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-background ${
                    isConnected ? 'bg-emerald-500' : 'bg-rose-400'
                  }`} />
                </div>
              </motion.div>
            </div>

            {/* Search trigger */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-2 h-9 px-3 bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-xs">Buscar...</span>
                <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </motion.div>

            {/* Mobile search */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setShowSearch(true)}
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative hover:bg-accent/50"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              </Button>

              {/* Notification dropdown */}
              <NotificationPanel
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hover:bg-accent/50"
            >
              <AnimatePresence mode="wait">
                {theme === 'dark' ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Sun className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Moon className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ml-0.5 shadow-lg shadow-violet-500/20">
              <span className="text-[11px] font-bold text-white">FA</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto main-gradient">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentView}-${refreshCounter}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer - Polished */}
        <footer className="border-t border-border/50 bg-card/40 backdrop-blur-sm px-4 lg:px-6 py-3 flex items-center justify-between text-xs text-muted-foreground shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
              <span className="font-medium">FinanceApp</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">v2.1</Badge>
            </div>
            <span className="hidden sm:block text-muted-foreground/60">·</span>
            <span className="hidden sm:flex items-center gap-1">
              Feito com <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> no Brasil
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 text-muted-foreground/70">
              <Shield className="w-3 h-3" />
              Dados seguros
            </span>
            <span className="hidden lg:block text-muted-foreground/60">·</span>
            <span className="hidden lg:block">© {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>

      {/* Quick Actions FAB */}
      <QuickActions
        onNavigate={(view) => setCurrentView(view as ViewType)}
        onExport={() => { window.open('/api/export?type=transactions&format=csv', '_blank'); }}
      />

      {/* Global Search Overlay */}
      <GlobalSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={(type, id) => {
          setShowSearch(false);
          if (type === 'account') setCurrentView('accounts');
          else if (type === 'card') setCurrentView('cards');
          else if (type === 'purchase') setCurrentView('purchases');
          else if (type === 'transaction') setCurrentView('accounts');
          else if (type === 'category') setCurrentView('categories');
        }}
      />
    </div>
  );
}
