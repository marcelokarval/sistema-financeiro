'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';

const MONTH_OPTIONS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const;

export interface MonthlyBudgetDraft {
  categoryId: string;
  amount: string;
  month: string;
  year: string;
}

export interface MonthlyBudgetCategoryOption {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface MonthlyBudgetEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  submitting: boolean;
  fieldId: string;
  form: MonthlyBudgetDraft;
  categories: readonly MonthlyBudgetCategoryOption[];
  years: readonly string[];
  onFieldChange: (field: keyof MonthlyBudgetDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

const defaultCloseAutoFocus = () => {};

/** Form dialog for creating or editing a monthly category budget limit. */
export function MonthlyBudgetEditor({
  mode,
  open,
  submitting,
  fieldId,
  form,
  categories,
  years,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus = defaultCloseAutoFocus,
  onSubmit,
}: MonthlyBudgetEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="sm:max-w-[420px]"
      title={isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
      description="Informe a categoria, o valor e o período do limite."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !form.categoryId || !form.amount}
          >
            {submitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-category`}>Categoria</Label>
          <Select
            value={form.categoryId}
            onValueChange={(value) => onFieldChange('categoryId', value)}
          >
            <SelectTrigger id={`${fieldId}-category`} className="w-full">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-amount`}>Valor do Limite (R$)</Label>
          <Input
            id={`${fieldId}-amount`}
            type="number"
            placeholder="0,00"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-month`}>Mês</Label>
            <Select
              value={form.month}
              onValueChange={(value) => onFieldChange('month', value)}
            >
              <SelectTrigger id={`${fieldId}-month`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-year`}>Ano</Label>
            <Select
              value={form.year}
              onValueChange={(value) => onFieldChange('year', value)}
            >
              <SelectTrigger id={`${fieldId}-year`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
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
