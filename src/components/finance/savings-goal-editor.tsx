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
import { cn } from '@/lib/utils';
import { SAVINGS_EDITOR_TYPES, SAVINGS_GOAL_COLORS } from './portfolio-i18n';

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
  const t = useSafeTranslations('savings');
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="sm:max-w-lg max-h-[85dvh] overflow-y-auto"
      title={isEditing ? t('editor.editTitle') : t('editor.createTitle')}
      description={
        isEditing
          ? t('editor.editDescription')
          : t('editor.createDescription')
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('editor.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? (
              t('editor.saving')
            ) : isEditing ? (
              t('editor.saveChanges')
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('editor.createGoal')}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="goal-name">{t('editor.nameLabel')}</Label>
          <Input
            id="goal-name"
            placeholder={t('editor.namePlaceholder')}
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-type">{t('editor.typeLabel')}</Label>
            <Select
              value={form.type}
              onValueChange={(v) => onFieldChange('type', v)}
            >
              <SelectTrigger id="goal-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVINGS_EDITOR_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <span className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {t(item.labelKey)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p id="goal-color-label" className="text-sm font-medium">{t('editor.colorLabel')}</p>
            <div role="group" aria-labelledby="goal-color-label" className="mt-1 flex flex-wrap gap-2">
              {SAVINGS_GOAL_COLORS.map(({ value: c, labelKey }) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t(labelKey)}
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
          <Label htmlFor="goal-desc">{t('editor.descriptionLabel')}</Label>
          <Textarea
            id="goal-desc"
            placeholder={t('editor.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target">{t('editor.targetLabel')}</Label>
            <Input
              id="goal-target"
              type="number"
              min="0.01"
              step="0.01"
              placeholder={t('editor.decimalPlaceholder')}
              value={form.targetAmount}
              onChange={(e) => onFieldChange('targetAmount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-current">{t('editor.currentLabel')}</Label>
            <Input
              id="goal-current"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('editor.decimalPlaceholder')}
              value={form.currentAmount}
              onChange={(e) => onFieldChange('currentAmount', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-monthly">{t('editor.monthlyLabel')}</Label>
            <Input
              id="goal-monthly"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('editor.decimalPlaceholder')}
              value={form.monthlyContribution}
              onChange={(e) => onFieldChange('monthlyContribution', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-yield">{t('editor.yieldLabel')}</Label>
            <Input
              id="goal-yield"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('editor.decimalPlaceholder')}
              value={form.yieldRate}
              onChange={(e) => onFieldChange('yieldRate', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-date">{t('editor.targetDateLabel')}</Label>
            <Input
              id="goal-date"
              type="date"
              value={form.targetDate}
              onChange={(e) => onFieldChange('targetDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-account">{t('editor.accountLabel')}</Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => onFieldChange('accountId', v)}
            >
              <SelectTrigger id="goal-account" className="w-full">
                <SelectValue placeholder={t('editor.accountNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('editor.accountNone')}</SelectItem>
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
