'use client';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeTranslations } from '@/i18n/provider';

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
  const t = useSafeTranslations('investments');
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="motion-reduce:animate-none"
      title={t('delete.title')}
      description={
        investmentName === undefined
          ? t('delete.descriptionGeneric')
          : t.rich('delete.descriptionNamed', {
              name: investmentName,
              strong: (chunks) => <strong>{chunks}</strong>,
            })
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
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
