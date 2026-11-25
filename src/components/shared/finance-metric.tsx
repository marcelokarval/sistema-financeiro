'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type FinanceMetricVariant = 'cell' | 'strip' | 'compact';
export type FinanceMetricTone = 'default' | 'positive' | 'danger';

export interface FinanceMetricProps {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  variant?: FinanceMetricVariant;
  tone?: FinanceMetricTone;
  showValues?: boolean;
  maskedValue?: string;
  ariaLabel?: string;
  className?: string;
  valueClassName?: string;
}

const containerVariants: Record<FinanceMetricVariant, string> = {
  cell: 'min-w-0 p-3 sm:p-4',
  strip: 'min-w-0 border-b border-border p-3 even:border-l nth-[n+3]:border-b-0 sm:border-b-0 sm:p-4 sm:[&:not(:first-child)]:border-l',
  compact: 'min-w-0',
};

const labelVariants: Record<FinanceMetricVariant, string> = {
  cell: 'text-xs font-medium text-muted-foreground',
  strip: 'text-xs font-medium text-muted-foreground',
  compact: 'text-muted-foreground',
};

const valueVariants: Record<FinanceMetricVariant, string> = {
  cell: 'mt-1 wrap-anywhere font-mono text-base font-semibold tabular-nums sm:text-lg',
  strip: 'mt-1 wrap-anywhere font-mono text-base font-semibold tabular-nums sm:text-lg',
  compact: 'wrap-anywhere font-mono font-semibold tabular-nums',
};

const toneClasses: Record<FinanceMetricTone, string> = {
  default: '',
  positive: 'text-[var(--ds-accent-positive)]',
  danger: 'text-[var(--ds-accent-danger)]',
};

function sanitizeMaskedLabel(label: string): string {
  return label.replace(/\d+(?:[.,]\d+)*/g, '••••••');
}

/** Shared definition-list metric item preserving <dt>/<dd> semantics, variants, and privacy masking. */
export function FinanceMetric({
  label,
  value,
  caption,
  variant = 'cell',
  tone = 'default',
  showValues = true,
  maskedValue = 'R$ ••••••',
  ariaLabel,
  className,
  valueClassName,
}: FinanceMetricProps) {
  const displayValue = showValues ? value : maskedValue;
  const displayCaption = !showValues && typeof caption === 'string' && /\d/.test(caption)
    ? maskedValue
    : caption;
  const resolvedAriaLabel = ariaLabel ? (showValues ? ariaLabel : sanitizeMaskedLabel(ariaLabel)) : undefined;

  return (
    <div aria-label={resolvedAriaLabel} className={cn(containerVariants[variant], className)}>
      <dt className={labelVariants[variant]}>{label}</dt>
      <dd className={cn(valueVariants[variant], toneClasses[tone], valueClassName)}>
        {displayValue}
      </dd>
      {displayCaption != null && displayCaption !== '' && (
        <dd className="mt-1 text-xs text-muted-foreground">{displayCaption}</dd>
      )}
    </div>
  );
}
