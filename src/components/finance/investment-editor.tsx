'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeTranslations } from '@/i18n/provider';
import { INVESTMENT_TYPE_KEYS } from './portfolio-i18n';

export interface InvestmentDraft {
  name: string;
  type: string;
  description: string;
  investedAmount: string;
  yieldRate: string;
  brokerage: string;
  ticker: string;
  accountId: string;
  categoryId: string;
}

interface InvestmentEditorProps {
  mode: 'create' | 'edit-portfolio' | 'edit-detail';
  open: boolean;
  saving: boolean;
  form: InvestmentDraft;
  accounts: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
  onFieldChange: (field: keyof InvestmentDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSave: () => Promise<void>;
}

export function InvestmentEditor({
  mode, open, saving, form, accounts, categories, onFieldChange, onOpenChange, onCloseAutoFocus, onSave,
}: InvestmentEditorProps) {
  const t = useSafeTranslations('investments');
  const isEditing = mode !== 'create';
  const fromDetail = mode === 'edit-detail';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto"
      title={isEditing ? t('editor.editTitle') : t('editor.createTitle')}
      description={
        isEditing
          ? t('editor.editDescription')
          : t('editor.createDescription')
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('editor.cancel')}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? t('editor.saving') : isEditing ? t('editor.save') : t('editor.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="investment-form-name">{t('editor.nameLabel')}</Label>
          <Input id="investment-form-name"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder={fromDetail ? t('editor.namePlaceholderDetail') : t('editor.namePlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor="investment-form-type">{t('editor.typeLabel')}</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onFieldChange('type', v)}
          >
            <SelectTrigger id="investment-form-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_TYPE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{t(`types.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="investment-form-description">{t('editor.descriptionLabel')}</Label>
          <Input id="investment-form-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={fromDetail ? t('editor.descriptionPlaceholderDetail') : t('editor.descriptionPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-form-investedAmount">{t('editor.investedAmountLabel')}</Label>
            <Input id="investment-form-investedAmount"
              type="number"
              step="0.01"
              value={form.investedAmount}
              onChange={(e) => onFieldChange('investedAmount', e.target.value)}
              placeholder={fromDetail ? undefined : t('editor.decimalPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="investment-form-yieldRate">{t('editor.yieldRateLabel')}</Label>
            <Input id="investment-form-yieldRate"
              type="number"
              step="0.01"
              value={form.yieldRate}
              onChange={(e) => onFieldChange('yieldRate', e.target.value)}
              placeholder={fromDetail ? undefined : t('editor.decimalPlaceholder')}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-form-brokerage">{t('editor.brokerageLabel')}</Label>
            <Input id="investment-form-brokerage"
              value={form.brokerage}
              onChange={(e) => onFieldChange('brokerage', e.target.value)}
              placeholder={fromDetail ? t('editor.brokeragePlaceholderDetail') : t('editor.brokeragePlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="investment-form-ticker">{t('editor.tickerLabel')}</Label>
            <Input id="investment-form-ticker"
              value={form.ticker}
              onChange={(e) => onFieldChange('ticker', e.target.value)}
              placeholder={t('editor.tickerPlaceholder')}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="investment-form-accountId">{t('editor.accountLabel')}</Label>
          <Select
            value={form.accountId}
            onValueChange={(v) => onFieldChange('accountId', v)}
          >
            <SelectTrigger id="investment-form-accountId">
              <SelectValue placeholder={fromDetail ? t('editor.selectPlaceholder') : t('editor.accountPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="investment-form-categoryId">{t('editor.categoryLabel')}</Label>
          <Select
            value={form.categoryId}
            onValueChange={(v) => onFieldChange('categoryId', v)}
          >
            <SelectTrigger id="investment-form-categoryId">
              <SelectValue placeholder={fromDetail ? t('editor.selectPlaceholder') : t('editor.categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
