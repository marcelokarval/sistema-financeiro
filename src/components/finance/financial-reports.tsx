'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import {
  FinancialReportsAnalysisTab,
  FinancialReportsMonthlyTab,
  type ReportsData,
} from './financial-report-tabs';

export { FinancialReportsTooltip } from './financial-report-tabs';

function ReportsLoadingSkeleton() {
  const t = useSafeTranslations('analytics');
  return (
    <Card role="status" aria-label={t('reports.loadingAria')} className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-44" />
            <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-32" />
          </div>
        </div>
        <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-64 mt-2" />
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
        <Skeleton className="max-w-full motion-reduce:animate-none h-64 w-full rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-12 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type FinancialReportsRequest = Record<string, never>;
export type FinancialReportsStatus =
  | { status: 'ready'; data: ReportsData }
  | { status: 'error' };
export type FinancialReportsResult = {
  request: FinancialReportsRequest;
  result: FinancialReportsStatus;
};

export async function requestFinancialReports(
  request: FinancialReportsRequest,
  signal: AbortSignal,
  publish: (response: FinancialReportsResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: FinancialReportsStatus;
  try {
    const res = await fetcher('/api/reports?months=6', { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentFinancialReports(
  request: FinancialReportsRequest,
  settled: FinancialReportsResult | null,
): FinancialReportsStatus | { status: 'loading' } {
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function FinancialReportsWidget({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [request, setRequest] = useState<FinancialReportsRequest>(() => ({}));
  const [settled, setSettled] = useState<FinancialReportsResult | null>(null);
  const [activeTab, setActiveTab] = useState('monthly');
  const query = currentFinancialReports(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';

  const fetchReports = useCallback(() => {
    setRequest({});
  }, []);

  useEffect(() => {
    void locale;
    const controller = new AbortController();
    void requestFinancialReports(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request, locale]);

  return (
    <FinancialReportsContent
      data={data}
      loading={loading}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fetchReports={fetchReports}
      onRetry={fetchReports}
      showValues={showValues}
    />
  );
}

export function FinancialReportsContent({
  data,
  loading,
  activeTab,
  onTabChange,
  fetchReports,
  onRetry,
  showValues = true,
}: {
  data: ReportsData | null;
  loading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  fetchReports?: () => void;
  onRetry?: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const handleRetry = onRetry ?? fetchReports;

  if (loading) return <ReportsLoadingSkeleton />;

  if (!data) {
    return (
      <section aria-labelledby="financial-reports-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="financial-reports-heading" className="text-base font-semibold">{t('reports.title')}</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">{t('reports.error')}</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="financial-reports-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="financial-reports-heading" className="text-base font-semibold">{t('reports.title')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('reports.subtitle', { count: data.monthlyData.length })}
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-9" aria-label={t('reports.refreshAria')} onClick={fetchReports}>
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 px-4 sm:px-5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="min-h-9 text-xs">{t('reports.tabs.monthly')}</TabsTrigger>
              <TabsTrigger value="analysis" className="min-h-9 text-xs">{t('reports.tabs.analysis')}</TabsTrigger>
            </TabsList>
            <FinancialReportsMonthlyTab monthlyData={data.monthlyData} showValues={showValues} />
            <FinancialReportsAnalysisTab data={data} showValues={showValues} />
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
