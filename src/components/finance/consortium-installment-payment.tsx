'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import type { ConsortiumInstallment } from '@/lib/consortium-selection';

export interface ConsortiumInstallmentPaymentDraft {
  paidDate: string;
  notes: string;
  assemblyDate: string;
  assemblyResult: string;
}

interface ConsortiumInstallmentPaymentProps {
  open: boolean;
  installment: Pick<ConsortiumInstallment, 'number' | 'amount'> | null;
  form: ConsortiumInstallmentPaymentDraft;
  submitting: boolean;
  onFieldChange: (field: keyof ConsortiumInstallmentPaymentDraft, value: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}

/** Modal dialog for confirming payment of a consortium installment. */
export function ConsortiumInstallmentPayment({
  open,
  installment,
  form,
  submitting,
  onFieldChange,
  onCancel,
  onConfirm,
  onCloseAutoFocus,
}: ConsortiumInstallmentPaymentProps) {
  const t = useSafeTranslations('consortiums');
  const locale = useSafeLocale();

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[85dvh] overflow-y-auto"
      title={t('payment.title')}
      description={
        installment
          ? t('payment.description', { number: installment.number, amount: currencyFmt(installment.amount, locale) })
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {t('payment.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {t('payment.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="consortium-paid-date">{t('payment.paidDateLabel')}</Label>
          <Input
            id="consortium-paid-date"
            type="date"
            value={form.paidDate}
            onChange={(e) => onFieldChange('paidDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="consortium-payment-notes">{t('payment.notesLabel')}</Label>
          <Input
            id="consortium-payment-notes"
            value={form.notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            placeholder={t('payment.notesPlaceholder')}
          />
        </div>
        <Separator />
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t('payment.assemblySection')}
        </div>
        <div>
          <Label htmlFor="consortium-assembly-date">{t('payment.assemblyDateLabel')}</Label>
          <Input
            id="consortium-assembly-date"
            type="date"
            value={form.assemblyDate}
            onChange={(e) => onFieldChange('assemblyDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="consortium-assembly-result">{t('payment.assemblyResultLabel')}</Label>
          <Input
            id="consortium-assembly-result"
            value={form.assemblyResult}
            onChange={(e) => onFieldChange('assemblyResult', e.target.value)}
            placeholder={t('payment.assemblyResultPlaceholder')}
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
