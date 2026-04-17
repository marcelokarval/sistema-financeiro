'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

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

// --- Color config per type ---
function getTypeColors(type: string) {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/25',
        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/25',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'danger':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500/25',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        dot: 'bg-rose-500',
      };
    default:
      return {
        bg: 'bg-sky-500/10',
        text: 'text-sky-600 dark:text-sky-400',
        border: 'border-sky-500/25',
        badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        dot: 'bg-sky-500',
      };
  }
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <TrendingUp className="w-3.5 h-3.5 text-rose-500" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
  }
  return <span className="w-3.5 h-3.5 block rounded-full bg-muted-foreground/30" />;
}

// --- Animation variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// --- Insight Card ---
function InsightCard({ insight }: { insight: FinancialInsight }) {
  const colors = getTypeColors(insight.type);

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center shrink-0 ${colors.text}`}
            >
              {getInsightIcon(insight.icon, insight.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium leading-tight">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {insight.description}
                  </p>
                </div>

                {/* Metric badge + trend */}
                {(insight.metric || insight.trend) && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {insight.metric && (
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold border ${colors.badge} px-2 py-0.5`}
                      >
                        {insight.metric}
                      </Badge>
                    )}
                    {insight.trend && (
                      <div className="flex items-center gap-0.5">
                        <TrendIndicator trend={insight.trend} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action button */}
              {insight.action && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: 0.3 }}
                  className="mt-3 pt-2 border-t border-border/50"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs px-3 ${colors.text} hover:${colors.bg} gap-1.5`}
                  >
                    <Lightbulb className="w-3 h-3" />
                    {insight.action}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
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

// --- Loading skeleton ---
function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-80 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Empty state ---
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Brain className="w-8 h-8 text-muted-foreground" />
      </div>
      <h4 className="text-sm font-medium text-muted-foreground">Nenhum insight disponível</h4>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-[240px]">
        Adicione transações e contas para receber análises automáticas das suas finanças.
      </p>
    </motion.div>
  );
}

// --- Main Component ---
export function SmartInsights() {
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (e) {
      console.error('Erro ao carregar insights:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error / empty data state
  if (!insights.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Insights Inteligentes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análise automática das suas finanças
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  const filteredInsights = filterInsights(insights, activeTab);
  const positiveCount = insights.filter((i) => i.type === 'success').length;
  const alertCount = insights.filter((i) => i.type === 'warning' || i.type === 'danger').length;
  const infoCount = insights.filter((i) => i.type === 'info').length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md">
        {/* Header */}
        <CardHeader className="pb-3">
          <motion.div
            variants={headerVariants}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Insights Inteligentes</CardTitle>
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análise automática das suas finanças
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-medium tabular-nums">
              {insights.length} insight{insights.length !== 1 ? 's' : ''}
            </Badge>
          </motion.div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Filter tabs */}
          <motion.div variants={itemVariants} className="mb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-9 p-1">
                <TabsTrigger value="all" className="text-xs px-3 h-7 gap-1.5">
                  Todos
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                    {insights.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="positive" className="text-xs px-3 h-7 gap-1.5">
                  Positivos
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                    {positiveCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs px-3 h-7 gap-1.5">
                  Alertas
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                    {alertCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs px-3 h-7 gap-1.5">
                  Info
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                    {infoCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Insights grid */}
          <AnimatePresence mode="wait">
            {filteredInsights.length > 0 ? (
              <motion.div
                key={activeTab}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {filteredInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
