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
import { useSafeTranslations } from '@/i18n/provider';
import { MONTH_NUMBER_KEYS } from './analytics-i18n';

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
  const t = useSafeTranslations('goals');
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('monthlyBudget.editor.closeLabel')}
      contentClassName="sm:max-w-[420px]"
      title={isEditing ? t('monthlyBudget.editor.editTitle') : t('monthlyBudget.editor.createTitle')}
      description={t('monthlyBudget.editor.description')}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('monthlyBudget.editor.cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !form.categoryId || !form.amount}
          >
            {submitting
              ? t('monthlyBudget.editor.saving')
              : isEditing
                ? t('monthlyBudget.editor.update')
                : t('monthlyBudget.editor.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-category`}>{t('monthlyBudget.editor.category')}</Label>
          <Select
            value={form.categoryId}
            onValueChange={(value) => onFieldChange('categoryId', value)}
          >
            <SelectTrigger id={`${fieldId}-category`} className="w-full">
              <SelectValue placeholder={t('monthlyBudget.editor.categoryPlaceholder')} />
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
          <Label htmlFor={`${fieldId}-amount`}>{t('monthlyBudget.editor.limitAmount')}</Label>
          <Input
            id={`${fieldId}-amount`}
            type="number"
            placeholder={t('monthlyBudget.editor.amountPlaceholder')}
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-month`}>{t('monthlyBudget.editor.month')}</Label>
            <Select
              value={form.month}
              onValueChange={(value) => onFieldChange('month', value)}
            >
              <SelectTrigger id={`${fieldId}-month`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NUMBER_KEYS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`months.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-year`}>{t('monthlyBudget.editor.year')}</Label>
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
