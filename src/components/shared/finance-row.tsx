'use client';

import type { ReactNode } from 'react';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';

export type FinanceRowTone = 'positive' | 'negative' | 'neutral';
export type FinanceRowVariant = 'compact' | 'default' | 'timeline';

export interface FinanceRowProps {
  description: ReactNode;
  metadata?: ReactNode;
  amount: number;
  tone?: FinanceRowTone;
  variant?: FinanceRowVariant;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  showValues?: boolean;
  maskedValue?: string;
  showSign?: boolean;
  ariaLabel?: string;
  className?: string;
}

const rowVariants: Record<FinanceRowVariant, string> = {
  compact: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5',
  default: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3',
  timeline: 'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30',
};

const leadingWrapperVariants: Record<FinanceRowVariant, string> = {
  compact: 'flex min-w-0 flex-1 basis-40 items-start gap-2',
  default: 'flex min-w-0 flex-1 basis-32 items-start gap-2.5',
  timeline: 'flex min-w-0 flex-1 items-center gap-2.5',
};

const descriptionVariants: Record<FinanceRowVariant, string> = {
  compact: 'break-words text-sm font-medium',
  default: 'wrap-anywhere text-sm font-medium',
  timeline: 'break-words text-sm font-medium',
};

const metadataVariants: Record<FinanceRowVariant, string> = {
  compact: 'text-xs leading-relaxed text-muted-foreground',
  default: 'wrap-anywhere text-xs text-muted-foreground',
  timeline: 'mt-0.5 text-xs text-muted-foreground',
};

const amountVariants: Record<FinanceRowVariant, string> = {
  compact: 'ml-auto font-mono text-sm font-medium tabular-nums tracking-tight',
  default: 'mr-1 wrap-anywhere font-mono text-sm font-medium tabular-nums',
  timeline: 'ml-2 whitespace-nowrap font-mono text-sm font-semibold tabular-nums',
};

const toneClasses: Record<FinanceRowTone, string> = {
  positive: 'text-[var(--ds-accent-positive)]',
  negative: 'text-[var(--ds-accent-danger)]',
  neutral: 'text-foreground',
};

function sanitizeMaskedLabel(label: string): string {
  return label.replace(/\d+(?:[.,]\d+)*/g, '••••••');
}

/** Shared financial activity/transaction row with semantic tones, privacy mask, and optional action slots. */
export function FinanceRow({
  description,
  metadata,
  amount,
  tone,
  variant = 'default',
  leading,
  actions,
  children,
  showValues = true,
  maskedValue = 'R$ ••••••',
  showSign = true,
  ariaLabel,
  className,
}: FinanceRowProps) {
  const resolvedTone: FinanceRowTone = tone ?? (amount >= 0 ? 'positive' : 'negative');
  const sign = !showSign || resolvedTone === 'neutral' ? '' : resolvedTone === 'positive' ? '+' : '−';
  const displayAmount = showValues ? `${sign}${currencyFmt(Math.abs(amount))}` : maskedValue;
  const resolvedAriaLabel = ariaLabel ? (showValues ? ariaLabel : sanitizeMaskedLabel(ariaLabel)) : undefined;
  const hasActions = Boolean(actions) || Boolean(children);

  const amountNode = (
    <span className={cn(amountVariants[variant], toneClasses[resolvedTone])}>
      {displayAmount}
    </span>
  );

  return (
    <li aria-label={resolvedAriaLabel} className={cn(rowVariants[variant], className)}>
      <div className={leadingWrapperVariants[variant]}>
        {leading}
        <div className="min-w-0">
          <p className={descriptionVariants[variant]}>{description}</p>
          {metadata != null && metadata !== '' && (
            <div className={metadataVariants[variant]}>{metadata}</div>
          )}
        </div>
      </div>
      {hasActions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {amountNode}
          {actions}
          {children}
        </div>
      ) : (
        amountNode
      )}
    </li>
  );
}
