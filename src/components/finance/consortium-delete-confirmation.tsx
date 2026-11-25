'use client';

import type { MouseEvent } from 'react';
import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';

interface ConsortiumDeleteConfirmationProps {
  context: { origin: 'list' } | { origin: 'detail'; description: string };
  open: boolean;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}

export function ConsortiumDeleteConfirmation({ context, open, deleting, onOpenChange, onConfirm, onCloseAutoFocus }: ConsortiumDeleteConfirmationProps) {
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Excluir Consórcio"
      description={
        context.origin === 'detail' ? (
          <>Tem certeza que deseja excluir o consórcio &quot;{context.description}&quot;? Esta ação não pode ser desfeita.</>
        ) : (
          <>Tem certeza que deseja excluir este consórcio? Esta ação não pode ser desfeita e todas as parcelas associadas serão removidas.</>
        )
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            disabled={deleting} onClick={onConfirm}
          >
            Excluir
          </AlertDialogAction>
        </>
      }
    />
  );
}
