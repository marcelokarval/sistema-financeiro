'use client';

import type { ReactNode } from 'react';
import { useSafeTranslations } from '@/i18n/provider';
import { cn } from '@/lib/utils';

export interface FinanceChartTooltipRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
  color?: string;
  maskedValue?: string;
}

export interface FinanceChartTooltipProps {
  active?: boolean;
  title?: ReactNode;
  capitalizeTitle?: boolean;
  rows?: readonly FinanceChartTooltipRow[];
  children?: ReactNode;
  showValues?: boolean;
  maskedValue?: string;
  className?: string;
}

/** Presentational tooltip shell receiving already-formatted series rows from chart domains. */
export function FinanceChartTooltip({
  active = false,
  title,
  capitalizeTitle = false,
  rows,
  children,
  showValues = true,
  maskedValue,
  className,
}: FinanceChartTooltipProps) {
  const t = useSafeTranslations('shared');
  const resolvedMaskedValue = maskedValue ?? (t.has('maskedValue') ? t('maskedValue') : 'R$ ••••••');
  if (!active) return null;

  const validRows = (rows ?? []).filter(
    (row) => row.label != null && row.label !== '' && row.value != null && row.value !== '',
  );

  if (validRows.length === 0 && (!children || !showValues)) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-3 text-card-foreground',
        className,
      )}
    >
      {title != null && title !== '' && (
        <p className={cn('mb-2 text-xs font-medium text-card-foreground', capitalizeTitle && 'capitalize')}>
          {title}
        </p>
      )}
      {validRows.length > 0 && (
        <div className="space-y-1">
          {validRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                {row.color && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                )}
                <span className="text-muted-foreground">{row.label}:</span>
              </div>
              <span className="font-mono font-semibold tabular-nums text-card-foreground">
                {showValues ? row.value : (row.maskedValue ?? resolvedMaskedValue)}
              </span>
            </div>
          ))}
        </div>
      )}
      {showValues ? children : null}
    </div>
  );
}
