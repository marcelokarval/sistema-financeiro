'use client';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';

interface InvestmentDeleteConfirmationProps {
  open: boolean;
  deleting: boolean;
  investmentName?: string;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => Promise<void> | undefined;
}

export function InvestmentDeleteConfirmation({
  open, deleting, investmentName, onOpenChange, onCloseAutoFocus, onConfirm,
}: InvestmentDeleteConfirmationProps) {
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="motion-reduce:animate-none"
      title="Excluir Investimento"
      description={
        investmentName === undefined
          ? 'Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.'
          : <>Tem certeza que deseja excluir <strong>{investmentName}</strong>? Esta ação não pode ser desfeita e todas as transações associadas serão perdidas.</>
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              return onConfirm();
            }}
            className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
          >
            Excluir
          </AlertDialogAction>
        </>
      }
    />
  );
}
