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
import { currencyFmt } from '@/lib/helpers';

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
  value,
  excludedAccountId,
  accounts,
  onValueChange,
}: {
  id: string;
  label: string;
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
          <SelectValue placeholder="Selecione a conta..." />
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
                    {currencyFmt(acc.balance)}
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
  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      title={
        <span className="flex items-center gap-2">
          <ArrowLeftRight aria-hidden="true" className="w-5 h-5" />
          Transferir entre Contas
        </span>
      }
      description="Mova dinheiro de uma conta para outra"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
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
            Transferir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {renderTransferAccountSelect({
          id: 'transfer-from',
          label: 'De (Origem)',
          value: form.fromAccountId,
          excludedAccountId: form.toAccountId,
          accounts,
          onValueChange: (v) => onFieldChange('fromAccountId', v),
        })}
        {renderTransferAccountSelect({
          id: 'transfer-to',
          label: 'Para (Destino)',
          value: form.toAccountId,
          excludedAccountId: form.fromAccountId,
          accounts,
          onValueChange: (v) => onFieldChange('toAccountId', v),
        })}
        <div>
          <Label htmlFor="transfer-amount">Valor (R$)</Label>
          <Input
            id="transfer-amount"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div>
          <Label htmlFor="transfer-date">Data</Label>
          <Input
            id="transfer-date"
            type="date"
            value={form.date}
            onChange={(e) => onFieldChange('date', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="transfer-description">Descrição (opcional)</Label>
          <Input
            id="transfer-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder="Ex: Transferência para investimento"
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
