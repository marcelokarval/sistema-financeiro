'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSafeTranslations } from '@/i18n/provider';

export interface FinanceFormDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  closeLabel?: string;
  contentClassName?: string;
}

/** Shared modal shell for finance form dialogs (`role="dialog"`). */
export function FinanceFormDialogShell({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  children,
  footer,
  closeLabel: closeLabelProp,
  contentClassName,
}: FinanceFormDialogShellProps) {
  const tShared = useSafeTranslations('shared');
  const closeLabel =
    closeLabelProp ??
    (tShared.has('dialogCloseLabel') ? tShared('dialogCloseLabel') : 'Fechar formulário');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className={contentClassName}
      >
        <DialogHeader className="relative pr-10 text-left">
          <DialogClose asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={closeLabel}
              className="absolute right-0 top-0"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface FinanceConfirmationDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  title: ReactNode;
  description: ReactNode;
  footer: ReactNode;
  contentClassName?: string;
}

/** Shared confirmation shell for finance alerts (`role="alertdialog"`). */
export function FinanceConfirmationDialogShell({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  footer,
  contentClassName,
}: FinanceConfirmationDialogShellProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>{footer}</AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
