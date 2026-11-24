'use client';

import { ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { currencyFmt } from '@/lib/helpers';

export interface SavingsContributionDraft {
  amount: string;
  description: string;
}

export interface SavingsContributionTarget {
  id: string;
  name: string;
  currentAmount: number;
  accountId: string | null;
  account?: { id: string; name: string } | null;
}

export interface SavingsContributionDialogProps {
  open: boolean;
  submitting: boolean;
  goal: SavingsContributionTarget | null;
  form: SavingsContributionDraft;
  onFieldChange: (field: keyof SavingsContributionDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

/** Form dialog for contributing/depositing into a savings goal. */
export function SavingsContributionDialog({
  open,
  submitting,
  goal,
  form,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: SavingsContributionDialogProps) {
  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="sm:max-w-md max-h-[85dvh] overflow-y-auto"
      title="Depositar"
      description={
        goal
          ? `Adicione um valor à meta "${goal.name}". Atual: ${currencyFmt(goal.currentAmount)}`
          : 'Adicione um valor à meta selecionada.'
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? (
              <>
                Depositando...
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4" />
                Depositar
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {goal && (
          <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            Conta vinculada: {goal.account?.name ?? (goal.accountId ? 'Conta vinculada à meta' : 'Nenhuma')}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Valor do depósito (R$) *</Label>
          <Input
            id="deposit-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deposit-desc">Descrição (opcional)</Label>
          <Input
            id="deposit-desc"
            placeholder="Ex: Bônus, Economia do mês..."
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
