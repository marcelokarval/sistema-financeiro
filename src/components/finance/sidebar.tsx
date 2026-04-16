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
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems: { view: ViewType; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'accounts', label: 'Contas', icon: Wallet },
  { view: 'cards', label: 'Cartões', icon: CreditCard },
  { view: 'purchases', label: 'Compras', icon: ShoppingCart },
  { view: 'categories', label: 'Categorias', icon: Tag },
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
          'hidden md:flex flex-col h-screen border-r border-border bg-card transition-all duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[240px]'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">
              FinanceApp
            </span>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            const Icon = item.icon;

            const button = (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={cn(
                  'flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-2">
          <Separator className="mb-3" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onToggle}
          >
            <ChevronLeft
              className={cn(
                'w-4 h-4 transition-transform duration-300',
                collapsed && 'rotate-180'
              )}
            />
          </Button>
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
              <Settings className="w-3.5 h-3.5" />
              <span>v1.0.0</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
