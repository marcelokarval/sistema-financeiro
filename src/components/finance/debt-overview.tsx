'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingDown, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, percentFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { PIE_COLORS } from './analytics-i18n';
import {
  DebtChartTooltip,
  DebtExpandedSection,
  DebtIncomeRatioCard,
  DebtTypeToggleButton,
  type DebtsData,
} from './debt-sections';

export { DebtChartTooltip } from './debt-sections';

function DonutCenterLabel({ total, showValues = true }: { total: number; showValues?: boolean }) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <p className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-foreground">
        {showValues ? currencyFmt(total, locale) : maskedValue}
      </p>
      <p className="text-xs sm:text-xs text-muted-foreground font-medium">
        {t('debts.totalInDebts')}
      </p>
    </div>
  );
}

function DebtCompositionChart({
  hasDebt,
  totalDebt,
  pieData,
  showValues = true,
}: {
  hasDebt: boolean;
  totalDebt: number;
  pieData: Array<{ name: string; value: number }>;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  return (
    <div className="relative mx-auto h-52 w-full max-w-64 lg:order-last">
      {hasDebt ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} className="stroke-0" />
              ))}
            </Pie>
            <RechartsTooltip content={<DebtChartTooltip showValues={showValues} />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={[{ name: t('debts.noDebts'), value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                fill="var(--muted)"
                strokeWidth={0}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <DonutCenterLabel total={totalDebt} showValues={showValues} />
    </div>
  );
}

function DebtLoadingSkeleton() {
  const t = useSafeTranslations('analytics');
  return (
    <Card role="status" aria-label={t('debts.loadingAria')} className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
              <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-32" />
            </div>
          </div>
          <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-36 rounded-lg" />
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <Skeleton className="max-w-full motion-reduce:animate-none h-56 w-56 sm:h-64 sm:w-64 rounded-full shrink-0" />
          <div className="min-w-0 divide-y divide-border border-y border-border">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="motion-reduce:animate-none h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="max-w-full motion-reduce:animate-none h-32 w-full rounded-lg" />
        <Skeleton className="max-w-full motion-reduce:animate-none h-24 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export type DebtOverviewRequest = Record<string, never>;
export type DebtOverviewStatus =
  | { status: 'ready'; data: DebtsData }
  | { status: 'error' };
export type DebtOverviewResult = {
  request: DebtOverviewRequest;
  result: DebtOverviewStatus;
};

export async function requestDebtOverview(
  request: DebtOverviewRequest,
  signal: AbortSignal,
  publish: (response: DebtOverviewResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: DebtOverviewStatus;
  try {
    const res = await fetcher('/api/debts', { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentDebtOverview(
  request: DebtOverviewRequest,
  settled: DebtOverviewResult | null,
): DebtOverviewStatus | { status: 'loading' } {
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function DebtOverview({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [request, setRequest] = useState<DebtOverviewRequest>(() => ({}));
  const [settled, setSettled] = useState<DebtOverviewResult | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const query = currentDebtOverview(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';

  const fetchData = useCallback(() => {
    setRequest({});
  }, []);

  useEffect(() => {
    void locale;
    const controller = new AbortController();
    void requestDebtOverview(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request, locale]);

  return (
    <DebtOverviewContent
      data={data}
      loading={loading}
      expandedType={expandedType}
      onToggleExpand={(type) => setExpandedType((prev) => (prev === type ? null : type))}
      fetchData={fetchData}
      onRetry={fetchData}
      showValues={showValues}
    />
  );
}

export function DebtOverviewContent({
  data,
  loading,
  expandedType,
  onToggleExpand,
  fetchData,
  onRetry,
  showValues = true,
}: {
  data: DebtsData | null;
  loading: boolean;
  expandedType: string | null;
  onToggleExpand: (type: string) => void;
  fetchData?: () => void;
  onRetry?: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const handleRetry = onRetry ?? fetchData;

  if (loading) return <DebtLoadingSkeleton />;

  if (!data) {
    return (
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardContent className="space-y-3 px-4 py-4 text-sm">
          <Activity className="w-10 h-10 text-muted-foreground" />
          <p role="alert" className="text-sm text-muted-foreground">
            {t('debts.error')}
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasDebt = data.totalDebt > 0;
  const pieData = hasDebt
    ? [
        { name: t('debts.pie.cards'), value: data.cardDebt },
        { name: t('debts.pie.installments'), value: data.installmentDebt },
        { name: t('debts.pie.consortiums'), value: data.consortiumDebt },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <section aria-labelledby="debt-overview-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <h3 id="debt-overview-heading" className="text-base font-semibold">{t('debts.title')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('debts.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  'font-mono text-xs tabular-nums px-3 py-1 border',
                  data.totalDebt > 0
                    ? 'bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20'
                    : 'bg-[var(--money)]/10 text-[var(--money)] border-[var(--money)]/20',
                )}
              >
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                {showValues ? currencyFmt(data.totalDebt, locale) : maskedValue}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label={t('debts.refreshAria')}
                onClick={fetchData}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
          <div>
            <div role="group" aria-label={t('debts.compositionAria')} className="grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <DebtCompositionChart hasDebt={hasDebt} totalDebt={data.totalDebt} pieData={pieData} showValues={showValues} />

              <div className="min-w-0 divide-y divide-border border-y border-border">
                <DebtTypeToggleButton
                  label={t('debts.categories.cards')}
                  count={data.cards.length}
                  amount={data.cardDebt}
                  expanded={expandedType === 'cards'}
                  ringClass="ring-2 ring-[var(--debt)]/30"
                  onClick={() => onToggleExpand('cards')}
                  showValues={showValues}
                />
                <DebtTypeToggleButton
                  label={t('debts.categories.installments')}
                  count={data.installments.length}
                  amount={data.installmentDebt}
                  expanded={expandedType === 'installments'}
                  ringClass="ring-2 ring-[var(--obligation)]/30"
                  onClick={() => onToggleExpand('installments')}
                  showValues={showValues}
                />
                <DebtTypeToggleButton
                  label={t('debts.categories.consortiums')}
                  count={data.consortiums.length}
                  amount={data.consortiumDebt}
                  expanded={expandedType === 'consortiums'}
                  ringClass="ring-2 ring-[var(--obligation)]/30"
                  onClick={() => onToggleExpand('consortiums')}
                  showValues={showValues}
                />
              </div>
            </div>
          </div>

          <DebtIncomeRatioCard ratio={data.debtToIncomeRatio} monthlyIncome={data.monthlyIncome} showValues={showValues} />

          <DebtExpandedSection expandedType={expandedType} data={data} showValues={showValues} />

          {hasDebt && (
            <div className="flex items-center justify-center gap-5 flex-wrap">
              {pieData.map((entry, index) => {
                const share = data.totalDebt > 0 ? (entry.value / data.totalDebt) * 100 : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums">{showValues ? percentFmt(share, locale, { signed: false }) : '•••'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
