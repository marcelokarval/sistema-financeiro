'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSafeTranslations } from '@/i18n/provider';
import { TRANSACTION_TYPE_FILTER_KEYS } from './analytics-i18n';
import {
  TransactionDistributionTab,
  TransactionOverviewTab,
  TransactionPatternsTab,
  type AnalyticsData,
} from './transaction-analysis-tabs';

export { TransactionAnalyticsTooltip } from './transaction-analysis-tabs';

function AnalyticsLoadingSkeleton() {
  const t = useSafeTranslations('analytics');
  return (
    <Card role="status" aria-label={t('transactions.loadingAria')} className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
              <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-36" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-24" />
            <Skeleton className="max-w-full motion-reduce:animate-none size-9" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
        <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-80 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 border-y border-border py-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="max-w-full motion-reduce:animate-none h-48 rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-12 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type TransactionAnalyticsRequest = { typeFilter: 'ALL' | 'INCOME' | 'EXPENSE' };
export type TransactionAnalyticsStatus =
  | { status: 'ready'; data: AnalyticsData }
  | { status: 'error' };
export type TransactionAnalyticsResult = {
  request: TransactionAnalyticsRequest;
  result: TransactionAnalyticsStatus;
};

export async function requestTransactionAnalytics(
  request: TransactionAnalyticsRequest,
  signal: AbortSignal,
  publish: (response: TransactionAnalyticsResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: TransactionAnalyticsStatus;
  try {
    const params = new URLSearchParams({ months: '6' });
    if (request.typeFilter !== 'ALL') params.set('type', request.typeFilter);
    const res = await fetcher(`/api/transaction-analytics?${params}`, { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentTransactionAnalytics(
  request: TransactionAnalyticsRequest,
  settled: TransactionAnalyticsResult | null,
): TransactionAnalyticsStatus | { status: 'loading' } {
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function TransactionAnalytics() {
  const [request, setRequest] = useState<TransactionAnalyticsRequest>({ typeFilter: 'ALL' });
  const [settled, setSettled] = useState<TransactionAnalyticsResult | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const query = currentTransactionAnalytics(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';

  const fetchData = useCallback(() => {
    setRequest((prev) => ({ typeFilter: prev.typeFilter }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void requestTransactionAnalytics(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request]);

  return (
    <TransactionAnalyticsContent
      data={data}
      loading={loading}
      typeFilter={request.typeFilter}
      onTypeFilterChange={(typeFilter) => {
        if (typeFilter !== request.typeFilter) setRequest({ typeFilter });
      }}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fetchData={fetchData}
      onRetry={fetchData}
    />
  );
}

export function TransactionAnalyticsContent({
  data,
  loading,
  typeFilter,
  onTypeFilterChange,
  activeTab,
  onTabChange,
  fetchData,
  onRetry,
}: {
  data: AnalyticsData | null;
  loading: boolean;
  typeFilter: 'ALL' | 'INCOME' | 'EXPENSE';
  onTypeFilterChange: (t: 'ALL' | 'INCOME' | 'EXPENSE') => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  fetchData?: () => void;
  onRetry?: () => void;
}) {
  const t = useSafeTranslations('analytics');
  const handleRetry = onRetry ?? fetchData;

  const maxMerchantTotal = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.topMerchants.map((m) => m.total), 1);
  }, [data]);

  const maxDistCount = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.amountDistribution.map((d) => d.count), 1);
  }, [data]);

  if (loading) return <AnalyticsLoadingSkeleton />;

  if (!data) {
    return (
      <section aria-labelledby="transaction-analytics-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="transaction-analytics-heading" className="text-base font-semibold">{t('transactions.title')}</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">
              {t('transactions.error')}
            </p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const { overview, monthlyComparison, topMerchants, amountDistribution, dailyPattern } = data;

  return (
    <section aria-labelledby="transaction-analytics-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h3 id="transaction-analytics-heading" className="text-base font-semibold">{t('transactions.title')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('transactions.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={t('transactions.typeFilterAria')} className="flex flex-wrap items-center gap-1">
                {TRANSACTION_TYPE_FILTER_KEYS.map((filterKey) => (
                  <Button
                    key={filterKey}
                    variant={typeFilter === filterKey ? 'default' : 'ghost'}
                    size="sm"
                    className="min-h-9 text-xs px-2.5"
                    aria-pressed={typeFilter === filterKey}
                    onClick={() => onTypeFilterChange(filterKey)}
                  >
                    {t(`transactions.types.${filterKey}`)}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label={t('transactions.refreshAria')}
                onClick={fetchData}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-w-0 px-4 sm:px-5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="mb-3 grid h-auto w-full grid-cols-3 gap-0.5 p-1">
              <TabsTrigger value="overview" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                {t('transactions.tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value="distribution" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                {t('transactions.tabs.distribution')}
              </TabsTrigger>
              <TabsTrigger value="patterns" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                {t('transactions.tabs.patterns')}
              </TabsTrigger>
            </TabsList>

            <TransactionOverviewTab overview={overview} />
            <TransactionDistributionTab
              amountDistribution={amountDistribution}
              maxDistCount={maxDistCount}
              weekdayBreakdown={overview.weekdayBreakdown}
            />
            <TransactionPatternsTab
              dailyPattern={dailyPattern}
              topMerchants={topMerchants}
              maxMerchantTotal={maxMerchantTotal}
              monthlyComparison={monthlyComparison}
            />
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
