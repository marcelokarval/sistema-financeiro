'use client';

import { ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';

export interface SavingsContributionDraft {
  amount: string;
  description: string;
}

export interface SavingsContributionTarget {
  id: string;
  name: string;
  currentAmount: number;
  accountId: string | null;
  account?: { id: string; name: string } | null;
}

export interface SavingsContributionDialogProps {
  open: boolean;
  submitting: boolean;
  goal: SavingsContributionTarget | null;
  form: SavingsContributionDraft;
  onFieldChange: (field: keyof SavingsContributionDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => Promise<void> | void;
}

/** Form dialog for contributing/depositing into a savings goal. */
export function SavingsContributionDialog({
  open,
  submitting,
  goal,
  form,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: SavingsContributionDialogProps) {
  const t = useSafeTranslations('savings');
  const locale = useSafeLocale();

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('contribution.closeLabel')}
      contentClassName="sm:max-w-md max-h-[85dvh] overflow-y-auto"
      title={t('contribution.title')}
      description={
        goal
          ? t('contribution.descriptionWithGoal', {
              name: goal.name,
              amount: currencyFmt(goal.currentAmount, locale),
            })
          : t('contribution.descriptionFallback')
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('contribution.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? (
              t('contribution.submitting')
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4" />
                {t('contribution.submit')}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {goal && (
          <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            {t('contribution.linkedAccountLabel', {
              account:
                goal.account?.name ??
                (goal.accountId ? t('contribution.linkedAccountFallback') : t('contribution.accountNone')),
            })}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="deposit-amount">{t('contribution.amountLabel')}</Label>
          <Input
            id="deposit-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder={t('contribution.amountPlaceholder')}
            value={form.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deposit-desc">{t('contribution.descriptionLabel')}</Label>
          <Input
            id="deposit-desc"
            placeholder={t('contribution.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
