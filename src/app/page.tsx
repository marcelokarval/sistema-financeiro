'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useAppStore, type ViewType } from '@/lib/store';
import { Sidebar } from '@/components/finance/sidebar';
import { DashboardView } from '@/components/finance/dashboard-view';
import { AccountsView } from '@/components/finance/accounts-view';
import { CardsView } from '@/components/finance/cards-view';
import { PurchasesView } from '@/components/finance/purchases-view';
import { CategoriesView } from '@/components/finance/categories-view';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const viewLabels: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  accounts: 'Contas',
  cards: 'Cartões',
  purchases: 'Compras',
  categories: 'Categorias',
};

const viewIcons: Record<ViewType, React.ElementType> = {
  dashboard: LayoutDashboard,
  accounts: Wallet,
  cards: CreditCard,
  purchases: ShoppingCart,
  categories: Tag,
};

function MobileSidebarContent({ onNavigate, onClose }: { onNavigate: (v: ViewType) => void; onClose: () => void }) {
  const { currentView } = useAppStore();
  const views: ViewType[] = ['dashboard', 'accounts', 'cards', 'purchases', 'categories'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight">FinanceApp</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {views.map((view) => {
          const isActive = currentView === view;
          const Icon = viewIcons[view];
          return (
            <button
              key={view}
              onClick={() => { onNavigate(view); onClose(); }}
              className={`flex items-center w-full gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{viewLabels[view]}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-4 pb-4 text-xs text-muted-foreground border-t border-border pt-3">
        <span>FinanceApp v1.0.0</span>
      </div>
    </div>
  );
}

export default function Page() {
  const { currentView, setCurrentView } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsedState, setSidebarCollapsed] = useState(false);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                <MobileSidebarContent
                  onNavigate={handleNavigate}
                  onClose={() => {}}
                />
              </SheetContent>
            </Sheet>

            {/* Page title */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                {(() => { const Icon = viewIcons[currentView]; return <Icon className="w-4 h-4 text-primary" />; })()}
              </div>
              <h1 className="text-base font-semibold">{viewLabels[currentView]}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
            </Button>

            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ml-1">
              <span className="text-xs font-bold text-primary-foreground">U</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
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

        {/* Footer */}
        <footer className="border-t border-border bg-card/30 px-4 lg:px-6 py-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>© 2025 FinanceApp</span>
          <span className="hidden sm:block">Gestão Financeira Inteligente</span>
        </footer>
      </div>
    </div>
  );
}
