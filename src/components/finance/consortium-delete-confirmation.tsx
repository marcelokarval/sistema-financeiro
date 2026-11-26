'use client';

import type { MouseEvent } from 'react';
import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeTranslations } from '@/i18n/provider';

interface ConsortiumDeleteConfirmationProps {
  context: { origin: 'list' } | { origin: 'detail'; description: string };
  open: boolean;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}

export function ConsortiumDeleteConfirmation({ context, open, deleting, onOpenChange, onConfirm, onCloseAutoFocus }: ConsortiumDeleteConfirmationProps) {
  const t = useSafeTranslations('consortiums');
  return (
    <FinanceConfirmationDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={t('delete.title')}
      description={
        context.origin === 'detail'
          ? t('delete.descriptionDetail', { description: context.description })
          : t('delete.descriptionList')
      }
      footer={
        <>
          <AlertDialogCancel disabled={deleting}>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            disabled={deleting} onClick={onConfirm}
          >
            {t('delete.confirm')}
          </AlertDialogAction>
        </>
      }
    />
  );
}
