'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Repeat,
  BarChart3,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Lightbulb,
  CheckCircle2,
  Info,
  AlertCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import { useSafeTranslations } from '@/i18n/provider';
import { useAppStore, type ViewType } from '@/lib/store';
import { cn } from '@/lib/utils';
import { INSIGHT_TYPE_PRESENTATION } from './analytics-i18n';

// --- Types ---
interface FinancialInsight {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  title: string;
  description: string;
  action?: string;
  metric?: string;
  trend?: 'up' | 'down' | 'stable';
}

// --- Icon mapping ---
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Repeat,
  BarChart3,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
};

function getInsightIcon(iconName: string, type: string) {
  const Component = iconMap[iconName];
  if (Component) return <Component className="w-5 h-5" />;
  switch (type) {
    case 'success':
      return <CheckCircle2 className="w-5 h-5" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5" />;
    case 'danger':
      return <AlertTriangle className="w-5 h-5" />;
    default:
      return <Info className="w-5 h-5" />;
  }
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  const t = useSafeTranslations('goals');
  return <span className="text-xs text-muted-foreground">{t(`insights.trends.${trend}`)}</span>;
}

export function insightActionDestination(insight: Pick<FinancialInsight, 'id' | 'action'>): ViewType {
  if (insight.id.startsWith('card-') || insight.action === 'Pagar fatura') return 'cards';
  if (insight.id.startsWith('category-') || insight.action === 'Ver detalhes da categoria' || insight.action === 'Analisar gastos') return 'categories';
  if (insight.id.startsWith('goal-') || insight.id === 'emergency-fund' || insight.action === 'Contribuir agora' || insight.action === 'Rever orçamento') return 'savings';
  if (insight.id === 'income-vs-expense' || insight.action === 'Rever despesas') return 'accounts';
  return 'dashboard';
}

export function InsightCard({ insight, onNavigate }: { insight: FinancialInsight; onNavigate?: (view: ViewType) => void }) {
  const t = useSafeTranslations('goals');
  const { labelKey, color } = INSIGHT_TYPE_PRESENTATION[insight.type] ?? INSIGHT_TYPE_PRESENTATION.info;
  const navigate = onNavigate ?? ((view: ViewType) => useAppStore.getState().setCurrentView(view));
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4">
      <span aria-hidden="true" className={color}>{getInsightIcon(insight.icon, insight.type)}</span>
      <div className="min-w-0 space-y-1">
        <p className={cn('text-xs font-medium', color)}>{t(`insights.types.${labelKey}`)}</p>
        <h4 className="break-words text-sm font-semibold">{insight.title}</h4>
        <p className="break-words text-sm text-muted-foreground">{insight.description}</p>
        {insight.action && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 h-auto max-w-full whitespace-normal px-2 text-left text-xs"
            onClick={() => navigate(insightActionDestination(insight))}
          >
            <Lightbulb aria-hidden="true" className="size-3" />
            {insight.action}
          </Button>
        )}
      </div>
      {(insight.metric || insight.trend) && (
        <div className="col-start-2 flex min-w-0 flex-wrap items-baseline gap-x-2 sm:col-start-auto sm:flex-col sm:items-end">
          {insight.metric && <span className="break-words font-mono text-sm tabular-nums">{insight.metric}</span>}
          {insight.trend && <TrendIndicator trend={insight.trend} />}
        </div>
      )}
    </li>
  );
}

// --- Filter function ---
function filterInsights(insights: FinancialInsight[], tab: string): FinancialInsight[] {
  switch (tab) {
    case 'positive':
      return insights.filter((i) => i.type === 'success');
    case 'alerts':
      return insights.filter((i) => i.type === 'warning' || i.type === 'danger');
    case 'info':
      return insights.filter((i) => i.type === 'info');
    default:
      return insights;
  }
}

function EmptyState({ filtered = false }: { filtered?: boolean }) {
  const t = useSafeTranslations('goals');
  return (
    <p role="status" className="px-3 py-4 text-sm text-muted-foreground sm:px-4">
      {filtered ? t('insights.emptyFiltered') : t('insights.empty')}
    </p>
  );
}

// --- Main Component ---
export function SmartInsights() {
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch('/api/insights');
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error('Erro ao carregar insights:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <SmartInsightsContent
      insights={insights}
      loading={loading}
      error={error}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRetry={fetchInsights}
    />
  );
}

export function SmartInsightsContent({
  insights,
  loading,
  error,
  activeTab,
  onTabChange,
  onRetry,
}: {
  insights: FinancialInsight[];
  loading: boolean;
  error: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRetry: () => void;
}) {
  const t = useSafeTranslations('goals');
  const filteredInsights = filterInsights(insights, activeTab);
  const positiveCount = insights.filter((i) => i.type === 'success').length;
  const alertCount = insights.filter((i) => i.type === 'warning' || i.type === 'danger').length;
  const infoCount = insights.filter((i) => i.type === 'info').length;
  const status: QueryPanelStatus = loading
    ? 'loading'
    : error
      ? 'error'
      : !insights.length
        ? 'empty'
        : 'success';

  return (
    <QueryPanel
      titleId="quiet-insights"
      title={t('insights.title')}
      subtitle={t('insights.subtitle')}
      status={status}
      loadingMessage={t('insights.loading')}
      errorMessage={t('insights.error')}
      emptyMessage={t('insights.empty')}
      retryLabel={t('common.retry')}
      onRetry={onRetry}
      contentClassName="space-y-0 p-0 sm:p-0"
    >
      <Tabs value={activeTab} onValueChange={onTabChange} className="border-b border-border px-3 py-2 sm:px-4">
        <TabsList aria-label={t('insights.filterAria')} className="grid h-auto w-full grid-cols-2 gap-1 sm:w-fit sm:grid-cols-4">
          <TabsTrigger value="all" className="min-h-9 text-xs">{t('insights.tabs.all')} <span className="font-mono tabular-nums">{insights.length}</span></TabsTrigger>
          <TabsTrigger value="positive" className="min-h-9 text-xs">{t('insights.tabs.positive')} <span className="font-mono tabular-nums">{positiveCount}</span></TabsTrigger>
          <TabsTrigger value="alerts" className="min-h-9 text-xs">{t('insights.tabs.alerts')} <span className="font-mono tabular-nums">{alertCount}</span></TabsTrigger>
          <TabsTrigger value="info" className="min-h-9 text-xs">{t('insights.tabs.info')} <span className="font-mono tabular-nums">{infoCount}</span></TabsTrigger>
        </TabsList>
      </Tabs>
      {filteredInsights.length > 0 ? (
        <ul className="divide-y divide-border">
          {filteredInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
        </ul>
      ) : <EmptyState filtered />}
    </QueryPanel>
  );
}
