'use client';

import { useRef } from 'react';
import { Download, Ellipsis, Plus, ShoppingBag, Target, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppStore, type ViewType } from '@/lib/store';

type QuickAction = { label: string; icon: LucideIcon } & (
  | { view: ViewType; action?: never }
  | { action: 'export' | 'goal'; view?: never }
);

const actions: QuickAction[] = [
  { label: 'Nova Transação', icon: Plus, view: 'accounts' },
  { label: 'Nova Compra', icon: ShoppingBag, view: 'purchases' },
  { label: 'Nova Meta', icon: Target, action: 'goal' },
  { label: 'Exportar Dados', icon: Download, action: 'export' },
];

interface QuickActionsProps {
  onNavigate?: (view: ViewType, origin: HTMLButtonElement | null) => void;
  onExport?: () => void;
  onNewGoal?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function QuickActions({ onNavigate, onExport, onNewGoal, onOpenChange }: QuickActionsProps) {
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const trigger = useRef<HTMLButtonElement>(null);
  const openingTransaction = useRef(false);

  const handleAction = (action: QuickAction) => {
    if (action.action === 'export') {
      onExport?.();
    } else if (action.action === 'goal') {
      onNewGoal?.();
    } else if (action.view) {
      if (onNavigate) {
        openingTransaction.current = action.view === 'accounts';
        onNavigate(action.view, trigger.current);
      } else {
        setCurrentView(action.view);
      }
    }
  };

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} variant="ghost" size="icon" className="text-muted-foreground lg:w-auto lg:px-2.5" aria-label="Ações rápidas">
          <Ellipsis aria-hidden="true" />
          <span className="hidden lg:inline">Ações rápidas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-44 motion-reduce:animate-none"
        onCloseAutoFocus={(event) => {
          if (openingTransaction.current) {
            // The launch dialog takes focus and restores it to this menu trigger.
            event.preventDefault();
            openingTransaction.current = false;
          }
        }}
      >
        {actions.map((action) => (
          <DropdownMenuItem key={action.label} onSelect={() => handleAction(action)}>
            <action.icon aria-hidden="true" />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
