'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSafeTranslations } from '@/i18n/provider';
import { cn } from '@/lib/utils';

export type QueryPanelStatus = 'loading' | 'error' | 'empty' | 'success';

export interface QueryPanelProps {
  titleId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  controls?: ReactNode;
  status: QueryPanelStatus;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  emptyContent?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Presentational shell separating query/period controls from panel state and content. */
export function QueryPanel({
  titleId,
  title,
  subtitle,
  controls,
  status,
  loadingMessage,
  errorMessage,
  emptyMessage,
  emptyContent,
  onRetry,
  retryLabel,
  children,
  className,
  contentClassName,
}: QueryPanelProps) {
  const t = useSafeTranslations('shared');
  const resolvedLoadingMessage = loadingMessage ?? (t.has('queryPanel.loading') ? t('queryPanel.loading') : 'Carregando…');
  const resolvedErrorMessage = errorMessage ?? (t.has('queryPanel.error') ? t('queryPanel.error') : 'Não foi possível carregar os dados.');
  const resolvedEmptyMessage = emptyMessage ?? (t.has('queryPanel.empty') ? t('queryPanel.empty') : 'Nenhum dado disponível.');
  const resolvedRetryLabel = retryLabel ?? (t.has('queryPanel.retry') ? t('queryPanel.retry') : 'Tentar novamente');

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || undefined}
      className={cn('min-w-0 rounded-lg border border-border bg-card text-card-foreground', className)}
    >
      <header className="border-b border-border px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        </div>
      </header>

      {status === 'loading' && (
        <p role="status" className="px-3 py-3 text-sm text-muted-foreground sm:px-4">
          {resolvedLoadingMessage}
        </p>
      )}

      {status === 'error' && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
          <p role="alert" className="text-sm text-muted-foreground">{resolvedErrorMessage}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 mr-1.5" />
              {resolvedRetryLabel}
            </Button>
          )}
        </div>
      )}

      {status === 'empty' && (
        <div className="px-3 py-3 sm:px-4">
          {emptyContent ?? <p role="status" className="text-sm text-muted-foreground">{resolvedEmptyMessage}</p>}
        </div>
      )}

      {status === 'success' && (
        <div className={cn('space-y-4 px-3 py-3 sm:px-4', contentClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
