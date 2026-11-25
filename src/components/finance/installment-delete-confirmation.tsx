'use client';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';

export interface InstallmentDeleteConfirmationProps {
  open: boolean;
  deleting: boolean;
  planDescription?: string;
  actionDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => Promise<void> | undefined | void;
}

/** Confirmation alert dialog for deleting an installment plan. */
export function InstallmentDeleteConfirmation({
  open,
  deleting,
  planDescription,
  actionDisabled,
  onOpenChange,
  onCloseAutoFocus,
  onConfirm,
}: InstallmentDeleteConfirmationProps) {
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="motion-reduce:animate-none"
      title="Excluir plano"
      description={
        planDescription === undefined ? (
          'Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.'
        ) : (
          <>
            Tem certeza que deseja excluir o plano &quot;{planDescription}&quot;? Esta ação
            não pode ser desfeita.
          </>
        )
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            aria-disabled={actionDisabled}
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
