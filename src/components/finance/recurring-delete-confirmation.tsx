'use client';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { cn } from '@/lib/utils';

const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] motion-reduce:transition-none';

export interface RecurringDeleteConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => Promise<void> | undefined | void;
}

/** Confirmation alert dialog for deleting a recurring transaction. */
export function RecurringDeleteConfirmation({
  open,
  onOpenChange,
  onCloseAutoFocus,
  onConfirm,
}: RecurringDeleteConfirmationProps) {
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="motion-reduce:animate-none"
      title="Excluir Transação Recorrente"
      description="Tem certeza que deseja excluir esta transação recorrente? Esta ação não pode ser desfeita."
      footer={
        <>
          <AlertDialogCancel className={focusClass}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              return onConfirm();
            }}
            className={cn(
              'bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline',
              focusClass,
            )}
          >
            Excluir
          </AlertDialogAction>
        </>
      }
    />
  );
}
