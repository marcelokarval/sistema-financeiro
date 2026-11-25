'use client';

import { PiggyBank, Gift, Landmark, TrendingUp, ShieldCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { cn } from '@/lib/utils';

const SAVINGS_TYPES = [
  { value: 'SAVINGS', label: 'Poupança', icon: PiggyBank },
  { value: 'PIGGY_BANK', label: 'Porquinho', icon: Gift },
  { value: 'CDI', label: 'Conta CDI', icon: Landmark },
  { value: 'INVESTMENT', label: 'Investimento', icon: TrendingUp },
  { value: 'EMERGENCY_FUND', label: 'Reserva', icon: ShieldCheck },
] as const;

const GOAL_COLORS = [
  { value: '#10b981', label: 'Verde' }, { value: '#0ea5e9', label: 'Azul' },
  { value: '#8b5cf6', label: 'Violeta' }, { value: '#f59e0b', label: 'Âmbar' },
  { value: '#f43f5e', label: 'Rosa coral' }, { value: '#06b6d4', label: 'Ciano' },
  { value: '#6366f1', label: 'Índigo' }, { value: '#ec4899', label: 'Rosa' },
  { value: '#14b8a6', label: 'Verde-azulado' }, { value: '#84cc16', label: 'Verde-lima' },
] as const;

export interface SavingsGoalDraft {
  name: string;
  type: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  yieldRate: string;
  targetDate: string;
  accountId: string;
  color: string;
}

export interface SavingsGoalEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  submitting: boolean;
  form: SavingsGoalDraft;
  accounts: readonly { id: string; name: string }[];
  onFieldChange: (field: keyof SavingsGoalDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

/** Form dialog for creating or editing a savings goal. */
export function SavingsGoalEditor({
  mode,
  open,
  submitting,
  form,
  accounts,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: SavingsGoalEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="sm:max-w-lg max-h-[85dvh] overflow-y-auto"
      title={isEditing ? 'Editar Meta' : 'Nova Meta de Poupança'}
      description={
        isEditing
          ? 'Atualize os dados da sua meta de poupança.'
          : 'Defina um objetivo financeiro para começar a poupar.'
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
                Salvando...
              </>
            ) : isEditing ? (
              'Salvar Alterações'
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Criar Meta
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="goal-name">Nome da meta *</Label>
          <Input
            id="goal-name"
            placeholder="Ex: Viagem, Carro novo..."
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-type">Tipo *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => onFieldChange('type', v)}
            >
              <SelectTrigger id="goal-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVINGS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p id="goal-color-label" className="text-sm font-medium">Cor</p>
            <div role="group" aria-labelledby="goal-color-label" className="mt-1 flex flex-wrap gap-2">
              {GOAL_COLORS.map(({ value: c, label }) => (
                <button
                  key={c}
                  type="button"
                  aria-label={label}
                  aria-pressed={form.color === c}
                  className={cn(
                    'size-8 rounded-full border-2',
                    form.color === c ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => onFieldChange('color', c)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal-desc">Descrição</Label>
          <Textarea
            id="goal-desc"
            placeholder="Descreva sua meta (opcional)"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target">Valor alvo (R$) *</Label>
            <Input
              id="goal-target"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.targetAmount}
              onChange={(e) => onFieldChange('targetAmount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-current">Valor atual (R$)</Label>
            <Input
              id="goal-current"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.currentAmount}
              onChange={(e) => onFieldChange('currentAmount', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-monthly">Contribuição mensal (R$)</Label>
            <Input
              id="goal-monthly"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.monthlyContribution}
              onChange={(e) => onFieldChange('monthlyContribution', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-yield">Rendimento (% a.a.)</Label>
            <Input
              id="goal-yield"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.yieldRate}
              onChange={(e) => onFieldChange('yieldRate', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-date">Data alvo</Label>
            <Input
              id="goal-date"
              type="date"
              value={form.targetDate}
              onChange={(e) => onFieldChange('targetDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-account">Conta vinculada</Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => onFieldChange('accountId', v)}
            >
              <SelectTrigger id="goal-account" className="w-full">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
