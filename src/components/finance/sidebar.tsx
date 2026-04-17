'use client';

import { cn } from '@/lib/utils';
import { useAppStore, type ViewType } from '@/lib/store';
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ShoppingCart,
  Tag,
  ChevronLeft,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'framer-motion';

const navItems: { view: ViewType; label: string; icon: React.ElementType; color: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'from-emerald-500 to-teal-500' },
  { view: 'accounts', label: 'Contas', icon: Wallet, color: 'from-violet-500 to-purple-500' },
  { view: 'cards', label: 'Cartões', icon: CreditCard, color: 'from-orange-500 to-rose-500' },
  { view: 'purchases', label: 'Compras', icon: ShoppingCart, color: 'from-sky-500 to-cyan-500' },
  { view: 'categories', label: 'Categorias', icon: Tag, color: 'from-amber-500 to-orange-500' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewType) => void;
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const { currentView } = useAppStore();

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'hidden md:flex flex-col h-screen border-r border-border/60 bg-gradient-to-b from-card via-card to-card/80 transition-all duration-300 ease-in-out relative',
          collapsed ? 'w-[72px]' : 'w-[250px]'
        )}
      >
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/40" />

        {/* Logo */}
        <div className="flex items-center h-[72px] px-4 gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25 flex-shrink-0"
          >
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </motion.div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <span className="font-bold text-[17px] tracking-tight whitespace-nowrap block leading-tight">
                FinanceApp
              </span>
              <span className="text-[10px] text-muted-foreground/80 block leading-tight">
                Gestão Inteligente
              </span>
            </motion.div>
          )}
        </div>

        <Separator className="opacity-50" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 mb-2">
              Menu
            </p>
          )}
          {navItems.map((item, index) => {
            const isActive = currentView === item.view;
            const Icon = item.icon;

            const button = (
              <motion.button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                initial={false}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground/80 hover:text-foreground hover:bg-accent/40'
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all duration-200',
                  isActive
                    ? `bg-gradient-to-br ${item.color} shadow-md shadow-primary/10`
                    : 'bg-muted/50'
                )}>
                  <Icon className={cn(
                    'w-4 h-4 transition-all duration-200',
                    isActive ? 'text-white' : ''
                  )} />
                </div>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      'whitespace-nowrap transition-colors duration-200',
                      isActive ? 'text-foreground font-semibold' : ''
                    )}
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </nav>

        {/* Status card */}
        {!collapsed && (
          <div className="px-3 mb-2">
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3 space-y-2 card-elevated">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-foreground/80">Status do Sistema</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="relative status-glow-success rounded-full">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                  </div>
                  <span className="text-[10px] text-muted-foreground/70">Conectado</span>
                </div>
                <span className="text-[10px] font-mono text-primary/60 font-semibold">v2.4.0</span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="px-3 pb-3">
          <Separator className="mb-2 opacity-50" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-center text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 rounded-lg',
              collapsed && 'px-0'
            )}
            onClick={onToggle}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
            {!collapsed && <span className="ml-2 text-xs">Recolher</span>}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
