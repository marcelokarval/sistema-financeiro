'use client';

import { Plus } from 'lucide-react';
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

export interface BudgetGoalDraft {
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  categoryId: string;
  endDate: string;
}

export interface BudgetGoalCategoryOption {
  id: string;
  name: string;
  color: string;
}

export interface BudgetGoalEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  submitting: boolean;
  form: BudgetGoalDraft;
  categories: readonly BudgetGoalCategoryOption[];
  onFieldChange: (field: keyof BudgetGoalDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

/** Form dialog for creating or editing a budget goal. */
export function BudgetGoalEditor({
  mode,
  open,
  submitting,
  form,
  categories,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: BudgetGoalEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[85dvh] overflow-y-auto sm:max-w-md"
      title={isEditing ? 'Editar Meta' : 'Nova Meta de Orçamento'}
      description={
        isEditing
          ? 'Atualize os dados da sua meta de orçamento.'
          : 'Defina um objetivo financeiro para acompanhar seu progresso.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? (
              <>Salvando...</>
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
            placeholder="Ex: Reserva de emergência"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
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

        <div className="grid gap-3 min-[400px]:grid-cols-2">
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
            <Label htmlFor="goal-category">Categoria</Label>
            <Select
              value={form.categoryId}
              onValueChange={(val) => onFieldChange('categoryId', val)}
            >
              <SelectTrigger id="goal-category" className="w-full min-w-0">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-end">Data limite</Label>
            <Input
              id="goal-end"
              type="date"
              value={form.endDate}
              onChange={(e) => onFieldChange('endDate', e.target.value)}
            />
          </div>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
