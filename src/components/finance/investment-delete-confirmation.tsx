'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} className="motion-reduce:animate-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Investimento</AlertDialogTitle>
          <AlertDialogDescription>
            {investmentName === undefined
              ? 'Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.'
              : <>Tem certeza que deseja excluir <strong>{investmentName}</strong>? Esta ação não pode ser desfeita e todas as transações associadas serão perdidas.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
