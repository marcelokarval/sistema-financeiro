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
import { useSafeTranslations } from '@/i18n/provider';

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
  const t = useSafeTranslations('goals');
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('budgetGoals.editor.closeLabel')}
      contentClassName="max-h-[85dvh] overflow-y-auto sm:max-w-md"
      title={isEditing ? t('budgetGoals.editor.editTitle') : t('budgetGoals.editor.createTitle')}
      description={
        isEditing
          ? t('budgetGoals.editor.editDescription')
          : t('budgetGoals.editor.createDescription')
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('budgetGoals.editor.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? (
              <>{t('budgetGoals.editor.saving')}</>
            ) : isEditing ? (
              t('budgetGoals.editor.saveChanges')
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('budgetGoals.editor.createSubmit')}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="goal-name">{t('budgetGoals.editor.fields.name')}</Label>
          <Input
            id="goal-name"
            placeholder={t('budgetGoals.editor.fields.namePlaceholder')}
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal-desc">{t('budgetGoals.editor.fields.description')}</Label>
          <Textarea
            id="goal-desc"
            placeholder={t('budgetGoals.editor.fields.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid gap-3 min-[400px]:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target">{t('budgetGoals.editor.fields.targetAmount')}</Label>
            <Input
              id="goal-target"
              type="number"
              min="0.01"
              step="0.01"
              placeholder={t('budgetGoals.editor.fields.amountPlaceholder')}
              value={form.targetAmount}
              onChange={(e) => onFieldChange('targetAmount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-current">{t('budgetGoals.editor.fields.currentAmount')}</Label>
            <Input
              id="goal-current"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('budgetGoals.editor.fields.amountPlaceholder')}
              value={form.currentAmount}
              onChange={(e) => onFieldChange('currentAmount', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-category">{t('budgetGoals.editor.fields.category')}</Label>
            <Select
              value={form.categoryId}
              onValueChange={(val) => onFieldChange('categoryId', val)}
            >
              <SelectTrigger id="goal-category" className="w-full min-w-0">
                <SelectValue placeholder={t('budgetGoals.editor.fields.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('budgetGoals.editor.fields.categoryNone')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-end">{t('budgetGoals.editor.fields.endDate')}</Label>
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
