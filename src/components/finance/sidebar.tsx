'use client';

import {
  ArrowUpRight, Building2, CalendarClock, ChevronLeft, ChevronRight, CreditCard,
  LayoutDashboard, PiggyBank, RefreshCw, ShoppingCart, Tag, TrendingUp, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSafeTranslations } from '@/i18n/provider';
import { useAppStore, type ViewType } from '@/lib/store';
import { cn } from '@/lib/utils';

type NavGroupKey = 'overview' | 'activity' | 'wealth';
type NavItem = { view: ViewType; label: string; icon: LucideIcon };

export const navigationGroups: { key: NavGroupKey; label: string; items: NavItem[] }[] = [
  { key: 'overview', label: 'Visão', items: [{ view: 'dashboard', label: 'Resumo', icon: LayoutDashboard }] },
  { key: 'activity', label: 'Movimentação', items: [
    { view: 'accounts', label: 'Contas', icon: Wallet },
    { view: 'cards', label: 'Cartões', icon: CreditCard },
    { view: 'purchases', label: 'Compras', icon: ShoppingCart },
    { view: 'categories', label: 'Categorias', icon: Tag },
  ] },
  { key: 'wealth', label: 'Patrimônio', items: [
    { view: 'investments', label: 'Investimentos', icon: TrendingUp },
    { view: 'installments', label: 'Parcelas', icon: CalendarClock },
    { view: 'consortiums', label: 'Consórcios', icon: Building2 },
    { view: 'savings', label: 'Caixinhas', icon: PiggyBank },
  ] },
];

export const navigationItems = navigationGroups.flatMap(({ items }) => items);

interface SidebarProps {
  collapsed: boolean;
  isConnected: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewType) => void;
}

export function Sidebar({ collapsed, isConnected, onToggle, onNavigate }: SidebarProps) {
  const currentView = useAppStore((state) => state.currentView);
  const t = useSafeTranslations('shell.navigation');
  const collapseLabel = collapsed ? t('expandNavigation') : t('collapseNavigation');
  const connectionLabel = isConnected ? t('realtimeActive') : t('realtimeUnavailable');

  return (
    <TooltipProvider delayDuration={200}>
      <aside className={cn(
        'hidden h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex',
        collapsed ? 'w-[72px]' : 'w-[218px] xl:w-[248px]',
      )}>
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border', collapsed ? 'justify-center' : 'px-5')}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-primary/35 bg-sidebar-primary/10 text-sidebar-primary">
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </span>
          <div className={cn(collapsed && 'sr-only')}>
            <p className="text-sm font-semibold tracking-tight">{t('brandName')}</p>
            <p className="text-xs text-muted-foreground">{t('brandSubtitle')}</p>
          </div>
        </div>

        <nav id="desktop-navigation" aria-label={t('desktopAriaLabel')} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navigationGroups.map((group) => (
            <div key={group.key} className="space-y-1">
              <p className={cn('px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', collapsed && 'sr-only')}>
                {t(`groups.${group.key}`)}
              </p>
              {group.items.map(({ view, icon: Icon }) => {
                const label = t(`items.${view}`);
                const active = currentView === view;
                const button = (
                  <Button
                    key={view}
                    variant="ghost"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative h-9 w-full gap-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed ? 'justify-center px-0' : 'justify-start px-2.5',
                      active && 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary',
                    )}
                    onClick={() => onNavigate(view)}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className={cn(collapsed && 'sr-only')}>{label}</span>
                  </Button>
                );
                return collapsed ? (
                  <Tooltip key={view}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                ) : button;
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', collapsed ? 'justify-center' : 'px-2')}>
            <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', isConnected ? 'bg-[var(--ds-accent-positive)]' : 'bg-muted-foreground')} />
            <span className={cn(collapsed && 'sr-only')}>{connectionLabel}</span>
          </div>
          <div className={cn('flex items-center gap-1', !collapsed && 'justify-between')}>
            {!collapsed && <span className="px-2 text-xs text-muted-foreground">{t('personalSpace')}</span>}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6" aria-label={t('reload')} onClick={() => window.location.reload()}>
                    <RefreshCw aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('reload')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6" aria-label={collapseLabel} onClick={onToggle}>
                    {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{collapseLabel}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
