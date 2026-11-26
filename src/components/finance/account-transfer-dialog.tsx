'use client';

import { ArrowLeftRight } from 'lucide-react';
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
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES } from './operations-i18n';

export interface AccountTransferDraft {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: string;
  description: string;
}

export interface TransferAccountOption {
  id: string;
  name: string;
  balance: number;
  color: string;
}

interface AccountTransferDialogProps {
  open: boolean;
  pending: boolean;
  form: AccountTransferDraft;
  accounts: readonly TransferAccountOption[];
  onFieldChange: (field: keyof AccountTransferDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void>;
}

function renderTransferAccountSelect({
  id,
  label,
  placeholder,
  locale,
  value,
  excludedAccountId,
  accounts,
  onValueChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  locale: string;
  value: string;
  excludedAccountId: string;
  accounts: readonly TransferAccountOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts
            .filter((acc) => acc.id !== excludedAccountId)
            .map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span>{acc.name}</span>
                  <span className="text-muted-foreground text-xs ml-1">
                    {currencyFmt(acc.balance, locale)}
                  </span>
                </div>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Modal dialog for transferring funds between two accounts. */
export function AccountTransferDialog({
  open,
  pending,
  form,
  accounts,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: AccountTransferDialogProps) {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('accounts'), PT_OPERATIONS_MESSAGES.accounts);

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('transfer.closeLabel')}
      contentClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      title={
        <span className="flex items-center gap-2">
          <ArrowLeftRight aria-hidden="true" className="w-5 h-5" />
          {t('transfer.title')}
        </span>
      }
      description={t('transfer.description')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('transfer.cancel')}
          </Button>
          <Button
            aria-disabled={pending}
            onClick={onSubmit}
            disabled={
              !form.fromAccountId ||
              !form.toAccountId ||
              !form.amount ||
              parseFloat(form.amount) <= 0
            }
          >
            {t('transfer.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {renderTransferAccountSelect({
          id: 'transfer-from',
          label: t('transfer.fromLabel'),
          placeholder: t('transfer.selectAccountPlaceholder'),
          locale,
          value: form.fromAccountId,
          excludedAccountId: form.toAccountId,
          accounts,
          onValueChange: (v) => onFieldChange('fromAccountId', v),
        })}
        {renderTransferAccountSelect({
          id: 'transfer-to',
          label: t('transfer.toLabel'),
          placeholder: t('transfer.selectAccountPlaceholder'),
          locale,
          value: form.toAccountId,
          excludedAccountId: form.fromAccountId,
          accounts,
          onValueChange: (v) => onFieldChange('toAccountId', v),
        })}
        <div>
          <Label htmlFor="transfer-amount">{t('transfer.amountLabel')}</Label>
          <Input
            id="transfer-amount"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
            placeholder={t('transfer.amountPlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor="transfer-date">{t('transfer.dateLabel')}</Label>
          <Input
            id="transfer-date"
            type="date"
            value={form.date}
            onChange={(e) => onFieldChange('date', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="transfer-description">{t('transfer.descriptionLabel')}</Label>
          <Input
            id="transfer-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={t('transfer.descriptionPlaceholder')}
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
