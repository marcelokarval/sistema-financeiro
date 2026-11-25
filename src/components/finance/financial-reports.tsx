'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FinancialReportsAnalysisTab,
  FinancialReportsMonthlyTab,
  type ReportsData,
} from './financial-report-tabs';

export { FinancialReportsTooltip } from './financial-report-tabs';

function ReportsLoadingSkeleton() {
  return (
    <Card role="status" aria-label="Carregando relatórios financeiros" className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
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

export function FinancialReportsWidget() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monthly');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports?months=6');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch reports', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <FinancialReportsContent
      data={data}
      loading={loading}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fetchReports={fetchReports}
      onRetry={fetchReports}
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
}: {
  data: ReportsData | null;
  loading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  fetchReports?: () => void;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? fetchReports;

  if (loading) return <ReportsLoadingSkeleton />;

  if (!data) {
    return (
      <section aria-labelledby="financial-reports-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="financial-reports-heading" className="text-base font-semibold">Relatórios Financeiros</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os relatórios financeiros.</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
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
              <h3 id="financial-reports-heading" className="text-base font-semibold">Relatórios Financeiros</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análise comparativa dos últimos {data.monthlyData.length} meses
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-9" aria-label="Atualizar relatórios" onClick={fetchReports}>
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 px-4 sm:px-5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="min-h-9 text-xs">Visão Mensal</TabsTrigger>
              <TabsTrigger value="analysis" className="min-h-9 text-xs">Análise</TabsTrigger>
            </TabsList>
            <FinancialReportsMonthlyTab monthlyData={data.monthlyData} />
            <FinancialReportsAnalysisTab data={data} />
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
