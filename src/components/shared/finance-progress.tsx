'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface FinanceProgressProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  valueText?: string;
  displayValue?: string;
  description?: string;
  ariaLabel?: string;
  showHeader?: boolean;
  showRange?: boolean;
  className?: string;
  trackClassName?: string;
}

function formatBound(value: number, unit?: string): string {
  if (!unit) return String(value);
  return unit === '%' ? `${value}%` : `${value} ${unit}`;
}

/** Accessible determinate progress bar built on the app Progress primitive. */
export function FinanceProgress({
  label,
  value,
  min = 0,
  max = 100,
  unit,
  valueText,
  displayValue,
  description,
  ariaLabel,
  showHeader = true,
  showRange = false,
  className,
  trackClassName,
}: FinanceProgressProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const clamped = Math.min(safeMax, Math.max(safeMin, Number.isFinite(value) ? value : safeMin));
  const span = safeMax - safeMin;
  const percent = span > 0 ? ((clamped - safeMin) / span) * 100 : 0;
  const resolvedValueText = valueText ?? formatBound(clamped, unit);
  const resolvedDisplayValue = displayValue ?? resolvedValueText;

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      {showHeader && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
          <span className="min-w-0 break-words">{label}</span>
          <span className="font-mono tabular-nums">{resolvedDisplayValue}</span>
        </div>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <Progress
        value={percent}
        aria-label={ariaLabel ?? label}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={resolvedValueText}
        className={cn('h-1.5 bg-muted', trackClassName)}
      />
      {showRange && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{formatBound(safeMin, unit)}</span>
          <span className="font-mono tabular-nums">{formatBound(safeMax, unit)}</span>
        </div>
      )}
    </div>
  );
}
