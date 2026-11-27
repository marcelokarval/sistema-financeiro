'use client';

import type { ElementType } from 'react';
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

export interface InstallmentPlanDraft {
  description: string;
  totalAmount: string;
  installmentCount: string;
  monthlyValue: string;
  interestRate: string;
  type: string;
  startDate: string;
  cardId: string;
  categoryId: string;
}

export interface InstallmentPlanEditorProps {
  open: boolean;
  creating: boolean;
  form: InstallmentPlanDraft;
  cards: readonly { id: string; name: string; color: string }[];
  categories: readonly { id: string; name: string; type: string; color: string }[];
  planTypes: Readonly<Record<string, { label: string; icon: ElementType }>>;
  onFieldChange: (field: keyof InstallmentPlanDraft, value: string) => void;
  onAmountChange: (amount: string) => void;
  onCountChange: (count: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

/** Form dialog for creating a new installment plan. */
export function InstallmentPlanEditor({
  open,
  creating,
  form,
  cards,
  categories,
  planTypes,
  onFieldChange,
  onAmountChange,
  onCountChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: InstallmentPlanEditorProps) {
  const t = useSafeTranslations('installments');
  const tShared = useSafeTranslations('shared');

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      title={t('editor.title')}
      description={t('editor.description')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('editor.cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={creating || !form.description || !form.totalAmount || !form.installmentCount}
          >
            {creating ? t('editor.creating') : t('editor.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="plan-form-description">{t('editor.descriptionLabel')}</Label>
          <Input
            id="plan-form-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={t('editor.descriptionPlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="plan-form-type">{t('editor.typeLabel')}</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onFieldChange('type', v)}
          >
            <SelectTrigger id="plan-form-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(planTypes).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <cfg.icon className="w-4 h-4" />
                    {cfg.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="plan-form-totalAmount">{t('editor.totalAmountLabel')}</Label>
            <Input
              id="plan-form-totalAmount"
              type="number"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={t('editor.decimalPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="plan-form-installmentCount">{t('editor.countLabel')}</Label>
            <Input
              id="plan-form-installmentCount"
              type="number"
              min="1"
              value={form.installmentCount}
              onChange={(e) => onCountChange(e.target.value)}
              placeholder={t('editor.countPlaceholder')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="plan-form-monthlyValue">{t('editor.monthlyValueLabel')}</Label>
          <Input
            id="plan-form-monthlyValue"
            type="number"
            step="0.01"
            value={form.monthlyValue}
            onChange={(e) => onFieldChange('monthlyValue', e.target.value)}
            placeholder={t('editor.monthlyValuePlaceholder')}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {t('editor.monthlyValueHint')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="plan-form-interestRate">{t('editor.interestRateLabel')}</Label>
            <Input
              id="plan-form-interestRate"
              type="number"
              step="0.01"
              value={form.interestRate}
              onChange={(e) => onFieldChange('interestRate', e.target.value)}
              placeholder={t('editor.decimalPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="plan-form-startDate">{t('editor.startDateLabel')}</Label>
            <Input
              id="plan-form-startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => onFieldChange('startDate', e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="plan-form-cardId">{t('editor.cardLabel')}</Label>
          <Select
            value={form.cardId || 'none'}
            onValueChange={(v) => onFieldChange('cardId', v === 'none' ? '' : v)}
          >
            <SelectTrigger id="plan-form-cardId">
              <SelectValue placeholder={t('editor.cardPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tShared('noneOption')}</SelectItem>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="plan-form-categoryId">{t('editor.categoryLabel')}</Label>
          <Select
            value={form.categoryId || 'none'}
            onValueChange={(v) => onFieldChange('categoryId', v === 'none' ? '' : v)}
          >
            <SelectTrigger id="plan-form-categoryId">
              <SelectValue placeholder={t('editor.categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tShared('noneOption')}</SelectItem>
              {categories
                .filter((c) => c.type === 'EXPENSE')
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
