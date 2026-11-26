'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { RECURRING_FREQUENCY_KEYS, RECURRING_TYPE_KEYS } from './portfolio-i18n';

const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] motion-reduce:transition-none';

export interface RecurringTransactionDraft {
  description: string;
  amount: string;
  type: string;
  frequency: string;
  nextDate: string;
  categoryId: string;
  accountId: string;
  cardId: string;
}

export interface RecurringCategoryOption {
  id: string;
  name: string;
  type: string;
}

export interface RecurringAccountOption {
  id: string;
  name: string;
}

export interface RecurringCardOption {
  id: string;
  name: string;
  lastFourDigits: string;
}

export interface RecurringTransactionEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  submitting: boolean;
  form: RecurringTransactionDraft;
  categories: readonly RecurringCategoryOption[];
  accounts: readonly RecurringAccountOption[];
  cards: readonly RecurringCardOption[];
  onFieldChange: (field: keyof RecurringTransactionDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSave: () => Promise<void> | void;
}

/** Form dialog for creating or editing a recurring transaction. */
export function RecurringTransactionEditor({
  mode,
  open,
  submitting,
  form,
  categories,
  accounts,
  cards,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSave,
}: RecurringTransactionEditorProps) {
  const t = useSafeTranslations('recurring');
  const formId = useId();
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none"
      title={
        isEditing
          ? t('editor.editTitle')
          : t('editor.createTitle')
      }
      description={
        isEditing
          ? t('editor.editDescription')
          : t('editor.createDescription')
      }
      footer={
        <>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className={focusClass}
            >
              {t('editor.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className={focusClass}
          >
            {submitting ? t('editor.saving') : isEditing ? t('editor.save') : t('editor.create')}
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${formId}-type`}>{t('editor.typeLabel')}</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onFieldChange('type', v)}
          >
            <SelectTrigger id={`${formId}-type`} className={cn('w-full', focusClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRING_TYPE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{t(`types.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${formId}-description`}>{t('editor.descriptionLabel')}</Label>
          <Input
            id={`${formId}-description`}
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={t('editor.descriptionPlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor={`${formId}-amount`}>{t('editor.amountLabel')}</Label>
          <Input
            id={`${formId}-amount`}
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
            placeholder={t('editor.amountPlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor={`${formId}-frequency`}>{t('editor.frequencyLabel')}</Label>
          <Select
            value={form.frequency}
            onValueChange={(v) => onFieldChange('frequency', v)}
          >
            <SelectTrigger id={`${formId}-frequency`} className={cn('w-full', focusClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRING_FREQUENCY_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{t(`frequencies.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${formId}-next-date`}>{t('editor.nextDateLabel')}</Label>
          <Input
            id={`${formId}-next-date`}
            type="date"
            value={form.nextDate}
            onChange={(e) => onFieldChange('nextDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${formId}-category`}>{t('editor.categoryLabel')}</Label>
          <Select
            value={form.categoryId}
            onValueChange={(v) => onFieldChange('categoryId', v)}
          >
            <SelectTrigger id={`${formId}-category`} className={cn('w-full', focusClass)}>
              <SelectValue placeholder={t('editor.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((c) => c.type === form.type)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${formId}-account`}>{t('editor.accountLabel')}</Label>
          <Select
            value={form.accountId}
            onValueChange={(v) => onFieldChange('accountId', v)}
          >
            <SelectTrigger id={`${formId}-account`} className={cn('w-full', focusClass)}>
              <SelectValue placeholder={t('editor.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${formId}-card`}>{t('editor.cardLabel')}</Label>
          <Select
            value={form.cardId}
            onValueChange={(v) => onFieldChange('cardId', v)}
          >
            <SelectTrigger id={`${formId}-card`} className={cn('w-full', focusClass)}>
              <SelectValue placeholder={t('editor.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ****{c.lastFourDigits}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
