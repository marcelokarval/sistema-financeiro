'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSafeTranslations } from '@/i18n/provider';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES } from './operations-i18n';

export interface AccountPickerAccount {
  id: string;
  name: string;
}

interface AccountPickerProps<T extends AccountPickerAccount> {
  open: boolean;
  loading: boolean;
  loadFailed: boolean;
  accounts: readonly T[];
  onRetry: () => void;
  onCreateAccount: () => void;
  onSelectAccount: (account: T) => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** Modal account selector for launching a new transaction from global shortcuts. */
export function AccountPicker<T extends AccountPickerAccount>({
  open,
  loading,
  loadFailed,
  accounts,
  onRetry,
  onCreateAccount,
  onSelectAccount,
  onClose,
  onCloseAutoFocus,
}: AccountPickerProps<T>) {
  const t = createFallbackTranslator(useSafeTranslations('accounts'), PT_OPERATIONS_MESSAGES.accounts);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t('picker.title')}</DialogTitle>
          <DialogDescription>{t('picker.description')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">{t('picker.loading')}</p>
        ) : loadFailed ? (
          <div className="space-y-2 text-sm">
            <p role="alert">{t('picker.loadFailed')}</p>
            <Button variant="outline" onClick={onRetry}>
              {t('picker.retry')}
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-2 text-sm">
            <p>{t('picker.noAccounts')}</p>
            <Button onClick={onCreateAccount}>{t('picker.createAccount')}</Button>
          </div>
        ) : (
          <ul className="space-y-1" aria-label={t('picker.availableAria')}>
            {accounts.map((account) => (
              <li key={account.id}>
                <Button
                  variant="outline"
                  className="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
                  onClick={() => onSelectAccount(account)}
                >
                  <span className="min-w-0 wrap-anywhere">{account.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('picker.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
