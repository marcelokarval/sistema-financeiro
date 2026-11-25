'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
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
  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[85dvh] overflow-y-auto"
      title="Marcar Parcela como Paga"
      description={
        installment
          ? `Parcela ${installment.number} — ${currencyFmt(installment.amount)}`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            Confirmar Pagamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="consortium-paid-date">Data do Pagamento</Label>
          <Input
            id="consortium-paid-date"
            type="date"
            value={form.paidDate}
            onChange={(e) => onFieldChange('paidDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="consortium-payment-notes">Observações</Label>
          <Input
            id="consortium-payment-notes"
            value={form.notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            placeholder="Nota opcional..."
          />
        </div>
        <Separator />
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Informações da Assembleia (opcional)
        </div>
        <div>
          <Label htmlFor="consortium-assembly-date">Data da Assembleia</Label>
          <Input
            id="consortium-assembly-date"
            type="date"
            value={form.assemblyDate}
            onChange={(e) => onFieldChange('assemblyDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="consortium-assembly-result">Resultado da Assembleia</Label>
          <Input
            id="consortium-assembly-result"
            value={form.assemblyResult}
            onChange={(e) => onFieldChange('assemblyResult', e.target.value)}
            placeholder="Ex: Contemplado na assembleia..."
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
