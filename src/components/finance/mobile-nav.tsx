'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore, type ViewType } from '@/lib/store';
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ShoppingCart,
  Plus,
  Tag,
  TrendingUp,
  CalendarClock,
  Building2,
  PiggyBank,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  view: ViewType;
  label: string;
  icon: React.ElementType;
  color: string;
  gradientFrom: string;
}

const mainNavItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-emerald-500', gradientFrom: 'from-emerald-500' },
  { view: 'accounts', label: 'Contas', icon: Wallet, color: 'text-violet-500', gradientFrom: 'from-violet-500' },
  { view: 'cards', label: 'Cartões', icon: CreditCard, color: 'text-orange-500', gradientFrom: 'from-orange-500' },
  { view: 'purchases', label: 'Compras', icon: ShoppingCart, color: 'text-sky-500', gradientFrom: 'from-sky-500' },
];

const moreNavItems: NavItem[] = [
  { view: 'categories', label: 'Categorias', icon: Tag, color: 'text-amber-500', gradientFrom: 'from-amber-500' },
  { view: 'investments', label: 'Investimentos', icon: TrendingUp, color: 'text-emerald-500', gradientFrom: 'from-emerald-500' },
  { view: 'installments', label: 'Parcelas', icon: CalendarClock, color: 'text-violet-500', gradientFrom: 'from-violet-500' },
  { view: 'consortiums', label: 'Consórcios', icon: Building2, color: 'text-teal-500', gradientFrom: 'from-teal-500' },
  { view: 'savings', label: 'Caixinhas', icon: PiggyBank, color: 'text-rose-500', gradientFrom: 'from-rose-500' },
];

export function MobileNav() {
  const { currentView, setCurrentView } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        {/* Top gradient fade */}
        <div className="h-6 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />

        {/* Nav bar container */}
        <div className="glass-enhanced border-t border-border/40 px-1 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-16">
            {mainNavItems.map((navItem) => {
              const isActive = currentView === navItem.view;
              const Icon = navItem.icon;
              return (
                <motion.button
                  key={navItem.view}
                  onClick={() => handleNavigate(navItem.view)}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-xl transition-all duration-200',
                    isActive
                      ? `bg-gradient-to-t ${navItem.gradientFrom}/15 to-transparent`
                      : 'hover:bg-accent/30'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-active"
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-gradient-to-r from-primary to-primary/60"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                      isActive
                        ? `bg-gradient-to-br ${navItem.gradientFrom} to-primary/70 shadow-md`
                        : 'bg-transparent'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4.5 h-4.5 transition-all duration-200',
                        isActive ? 'text-white' : navItem.color
                      )}
                    />
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="text-[9px] font-semibold text-primary leading-none"
                      >
                        {navItem.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}

            {/* More Button (+) */}
            <motion.button
              onClick={() => setMoreOpen(true)}
              whileTap={{ scale: 0.9, rotate: 90 }}
              className="flex flex-col items-center justify-center gap-0.5 w-16 h-12"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-500 shadow-lg shadow-primary/25">
                <Plus className="w-5 h-5 text-white" />
              </div>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* More Menu Bottom Sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-3xl glass-enhanced border-t border-border/40"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="text-base font-semibold">Mais Opções</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Nav Items Grid */}
              <div className="grid grid-cols-3 gap-3 px-5 pb-8 pt-2">
                {moreNavItems.map((navItem, index) => {
                  const isActive = currentView === navItem.view;
                  const Icon = navItem.icon;
                  return (
                    <motion.button
                      key={navItem.view}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleNavigate(navItem.view)}
                      className={cn(
                        'flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all duration-200',
                        isActive
                          ? `bg-gradient-to-b ${navItem.gradientFrom}/10 to-transparent border border-current/10`
                          : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200',
                          isActive
                            ? `bg-gradient-to-br ${navItem.gradientFrom} shadow-md`
                            : `bg-muted/60`
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-5 h-5 transition-all duration-200',
                            isActive ? 'text-white' : navItem.color
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium transition-colors duration-200',
                          isActive ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {navItem.label}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="more-nav-active"
                          className="w-1.5 h-1.5 rounded-full bg-primary"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
