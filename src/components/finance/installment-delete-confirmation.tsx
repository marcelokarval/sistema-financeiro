'use client';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeTranslations } from '@/i18n/provider';

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
  const t = useSafeTranslations('installments');

  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="motion-reduce:animate-none"
      title={t('delete.title')}
      description={
        planDescription === undefined
          ? t('delete.descriptionGeneric')
          : t('delete.descriptionNamed', { description: planDescription })
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            aria-disabled={actionDisabled}
            onClick={(event) => {
              event.preventDefault();
              return onConfirm();
            }}
            className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
          >
            {t('delete.confirm')}
          </AlertDialogAction>
        </>
      }
    />
  );
}
