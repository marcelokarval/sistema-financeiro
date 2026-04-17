'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Clock,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  Wallet,
  Landmark,
  Gift,
  ShieldCheck,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Bitcoin,
  BadgeDollarSign,
  CircleDollarSign,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currencyFmt, containerVariants, itemVariants } from '@/lib/helpers';

// ── Types ──────────────────────────────────────────────────────

interface Summary {
  totalGoals: number;
  completedGoals: number;
  inProgressGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  overallProgress: number;
  estimatedCompletion: string | null;
}

interface BudgetGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  isCompleted: boolean;
  categoryName: string | null;
  categoryColor: string | null;
  startDate: string;
  endDate: string | null;
}

interface SavingsGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  isCompleted: boolean;
  monthlyContribution: number;
  type: string;
  color: string;
  startDate: string;
  targetDate: string | null;
  yieldRate: number;
}

interface InvestmentItem {
  id: string;
  name: string;
  type: string;
  currentAmount: number;
  totalInvested: number;
  returnRate: number;
  progress: number;
  ticker: string | null;
}

interface DashboardData {
  summary: Summary;
  budgetGoals: BudgetGoalItem[];
  savingsGoals: SavingsGoalItem[];
  investments: InvestmentItem[];
}

// ── Constants ──────────────────────────────────────────────────

const INVESTMENT_TYPES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  STOCK: { label: 'Ações', color: '#10b981', icon: TrendingUp },
  BOND: { label: 'Renda Fixa', color: '#0ea5e9', icon: Landmark },
  FII: { label: 'FIIs', color: '#8b5cf6', icon: Building2 },
  CDB: { label: 'CDB', color: '#f59e0b', icon: BadgeDollarSign },
  LCI: { label: 'LCI', color: '#14b8a6', icon: CircleDollarSign },
  LCA: { label: 'LCA', color: '#14b8a6', icon: CircleDollarSign },
  TESOURO: { label: 'Tesouro', color: '#f43f5e', icon: BarChart3 },
  CRYPTO: { label: 'Cripto', color: '#f97316', icon: Bitcoin },
  ETF: { label: 'ETF', color: '#06b6d4', icon: RefreshCw },
  OTHER: { label: 'Outro', color: '#64748b', icon: Wallet },
};

const SAVINGS_TYPE_ICONS: Record<string, React.ElementType> = {
  SAVINGS: PiggyBank,
  PIGGY_BANK: Gift,
  CDI: Landmark,
  INVESTMENT: TrendingUp,
  EMERGENCY_FUND: ShieldCheck,
};

const SAVINGS_TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Poupança',
  PIGGY_BANK: 'Porquinho',
  CDI: 'Conta CDI',
  INVESTMENT: 'Investimento',
  EMERGENCY_FUND: 'Reserva',
};

// ── Helpers ────────────────────────────────────────────────────

function getProgressColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 60) return '#06b6d4';
  if (pct >= 25) return '#f59e0b';
  return '#f43f5e';
}

function getProgressColorClass(pct: number): string {
  if (pct >= 90) return 'text-emerald-500';
  if (pct >= 60) return 'text-cyan-500';
  if (pct >= 25) return 'text-amber-500';
  return 'text-rose-500';
}

function getProgressLabel(pct: number): string {
  if (pct >= 90) return 'Excelente';
  if (pct >= 60) return 'Bom';
  if (pct >= 25) return 'Em andamento';
  return 'Início';
}

// ── Mini Progress Ring (Header) ────────────────────────────────

function MiniProgressRing({ percent }: { percent: number }) {
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const color = getProgressColor(percent);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${getProgressColorClass(percent)}`}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

// ── Large Progress Ring (Overview Tab) ─────────────────────────

function LargeProgressRing({ percent }: { percent: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const color = getProgressColor(percent);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-20"
        style={{ backgroundColor: color }}
      />
      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <motion.span
          className={`text-2xl font-bold ${getProgressColorClass(percent)}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {Math.round(percent)}%
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-medium">Concluído</span>
      </div>
    </div>
  );
}

// ── Sparkline Bar (Investments) ────────────────────────────────

function MiniSparkBar({ value }: { value: number }) {
  const isPositive = value >= 0;
  const barHeight = Math.min(Math.max(Math.abs(value) * 3, 4), 40);
  const color = isPositive ? '#22c55e' : '#f43f5e';

  return (
    <div className="flex items-end justify-center" style={{ width: 32, height: 44 }}>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: barHeight }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
        className="w-4 rounded-t-sm"
        style={{ backgroundColor: color, opacity: 0.7 }}
      />
    </div>
  );
}

// ── Combined goal item for Tab 2 ───────────────────────────────

interface CombinedGoal {
  id: string;
  source: 'budget' | 'savings';
  name: string;
  progress: number;
  isCompleted: boolean;
  currentAmount: number;
  targetAmount: number;
  categoryName: string | null;
  categoryColor: string | null;
  goalColor: string;
  monthlyContribution: number;
  startDate: string;
  endDate: string | null;
  targetDate: string | null;
  type: string;
}

// ── Loading Skeleton ───────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md card-glow">
      <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-64 mt-1" />
            </div>
          </div>
          <Skeleton className="w-[60px] h-[60px] rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary row skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-80 rounded-lg mb-6" />
        <Skeleton className="h-48 rounded-xl" />
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────

export function GoalsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/goals-dashboard');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Erro ao carregar central de metas', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) return <LoadingSkeleton />;

  const { summary, budgetGoals, savingsGoals, investments } = data;

  // Combine budget + savings goals sorted by progress ascending
  const combinedGoals: CombinedGoal[] = [
    ...budgetGoals.map((g) => ({
      id: g.id,
      source: 'budget' as const,
      name: g.name,
      progress: g.progress,
      isCompleted: g.isCompleted,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      categoryName: g.categoryName,
      categoryColor: g.categoryColor,
      goalColor: g.categoryColor || '#6366f1',
      monthlyContribution: 0,
      startDate: g.startDate,
      endDate: g.endDate,
      targetDate: g.endDate,
      type: 'budget',
    })),
    ...savingsGoals.map((g) => ({
      id: g.id,
      source: 'savings' as const,
      name: g.name,
      progress: g.progress,
      isCompleted: g.isCompleted,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      categoryName: SAVINGS_TYPE_LABELS[g.type] || g.type,
      categoryColor: g.color,
      goalColor: g.color,
      monthlyContribution: g.monthlyContribution,
      startDate: g.startDate,
      endDate: null,
      targetDate: g.targetDate,
      type: g.type,
    })),
  ].sort((a, b) => a.progress - b.progress);

  // Latest 3 goals by creation date for overview
  const recentGoals = [
    ...budgetGoals.map((g) => ({ ...g, source: 'budget' as const })),
    ...savingsGoals.map((g) => ({ ...g, source: 'savings' as const })),
  ].slice(0, 3);

  const progressColor = getProgressColor(summary.overallProgress);
  const progressClass = getProgressColorClass(summary.overallProgress);

  return (
    <Card className="border-0 shadow-md card-glow">
      {/* Gradient top border */}
      <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Central de Metas</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe todos os seus objetivos financeiros
              </p>
            </div>
          </div>
          <MiniProgressRing percent={summary.overallProgress} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Summary Row ──────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {/* Total de Metas */}
          <motion.div variants={itemVariants}>
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Total de Metas
                  </p>
                  <p className="text-xl font-bold mt-1 text-primary">{summary.totalGoals}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Em Progresso */}
          <motion.div variants={itemVariants}>
            <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Em Progresso
                  </p>
                  <p className="text-xl font-bold mt-1 text-cyan-500">{summary.inProgressGoals}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Concluídas */}
          <motion.div variants={itemVariants}>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Concluídas
                  </p>
                  <p className="text-xl font-bold mt-1 text-emerald-500">{summary.completedGoals}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Patrimônio Acumulado */}
          <motion.div variants={itemVariants}>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Patrimônio Acumulado
                  </p>
                  <p className="text-base font-bold mt-1 text-amber-600 tabular-nums truncate">
                    {currencyFmt(summary.totalCurrentAmount)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs">Metas e Economias</TabsTrigger>
            <TabsTrigger value="investments" className="text-xs">Investimentos</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Visão Geral ─────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-5">
            {/* Large Overall Progress Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <LargeProgressRing percent={summary.overallProgress} />
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">{getProgressLabel(summary.overallProgress)}</h3>
                    {summary.estimatedCompletion && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Previsão de conclusão: <span className="font-medium text-foreground">{summary.estimatedCompletion}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total alvo</span>
                    <span className="font-semibold tabular-nums">{currencyFmt(summary.totalTargetAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Acumulado</span>
                    <span className={`font-semibold tabular-nums ${progressClass}`}>
                      {currencyFmt(summary.totalCurrentAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Restante</span>
                    <span className="font-medium text-rose-500 tabular-nums">
                      {currencyFmt(Math.max(summary.totalTargetAmount - summary.totalCurrentAmount, 0))}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Progress
                      value={summary.overallProgress}
                      className="h-2.5"
                    />
                  </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Metas Orçamento</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">
                      {currencyFmt(budgetGoals.reduce((s, g) => s + g.currentAmount, 0))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{budgetGoals.length} meta{budgetGoals.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Economias</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">
                      {currencyFmt(savingsGoals.reduce((s, g) => s + g.currentAmount, 0))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{savingsGoals.length} meta{ savingsGoals.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Investimentos</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">
                      {currencyFmt(investments.reduce((s, i) => s + i.currentAmount, 0))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{investments.length} investimento{investments.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rendimento Invest.</p>
                    <p className={`text-sm font-bold mt-1 tabular-nums ${
                      investments.reduce((s, i) => s + (i.currentAmount - i.totalInvested), 0) >= 0
                        ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {currencyFmt(investments.reduce((s, i) => s + (i.currentAmount - i.totalInvested), 0))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lucro / Prejuízo</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <h4 className="text-sm font-semibold mb-3">Atividade Recente</h4>
              {recentGoals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma meta registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentGoals.map((goal, idx) => {
                    const goalColor = goal.source === 'savings'
                      ? (goal as SavingsGoalItem).color
                      : (goal as BudgetGoalItem).categoryColor || '#6366f1';
                    const Icon = goal.source === 'savings'
                      ? (SAVINGS_TYPE_ICONS[(goal as SavingsGoalItem).type] || PiggyBank)
                      : Target;

                    return (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 + idx * 0.06 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-default"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${goalColor}15` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: goalColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{goal.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {goal.source === 'budget' ? 'Meta orçamento' : SAVINGS_TYPE_LABELS[(goal as SavingsGoalItem).type] || 'Meta poupança'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${getProgressColorClass(goal.progress)}`}>
                            {Math.round(goal.progress)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {currencyFmt(goal.currentAmount)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── Tab 2: Metas e Economias ────────────────────────── */}
          <TabsContent value="goals" className="mt-4">
            {combinedGoals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Target className="w-7 h-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">Nenhuma meta cadastrada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Crie metas de orçamento ou poupança para acompanhar aqui
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <AnimatePresence>
                  {combinedGoals.map((goal, idx) => {
                    const isExpanded = expandedGoal === goal.id;
                    const Icon = goal.source === 'savings'
                      ? (SAVINGS_TYPE_ICONS[goal.type] || PiggyBank)
                      : Target;
                    const goalProgressColor = getProgressColor(goal.progress);

                    return (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                        layout
                      >
                        <motion.div
                          className={`rounded-xl border p-4 transition-all ${
                            goal.isCompleted
                              ? 'bg-emerald-500/5 border-emerald-500/15 opacity-80'
                              : 'bg-card hover:shadow-md border-border'
                          }`}
                          whileHover={{ y: -1, transition: { duration: 0.15 } }}
                          onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                        >
                          {/* Row */}
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${goal.goalColor}15` }}
                            >
                              {goal.isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Icon className="w-4 h-4" style={{ color: goal.goalColor }} />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{goal.name}</p>
                                {goal.isCompleted && (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[9px] px-1.5 py-0 shrink-0">
                                    Concluída
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {goal.categoryName && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1.5 py-0"
                                    style={{
                                      backgroundColor: `${goal.categoryColor}15`,
                                      color: goal.categoryColor,
                                    }}
                                  >
                                    {goal.categoryName}
                                  </Badge>
                                )}
                                {goal.source === 'budget' && goal.type === 'budget' && (
                                  <span className="text-[9px] text-muted-foreground">Orçamento</span>
                                )}
                              </div>
                            </div>

                            {/* Progress */}
                            <div className="text-right shrink-0 min-w-[60px]">
                              <p className={`text-sm font-bold tabular-nums ${getProgressColorClass(goal.progress)}`}>
                                {Math.round(goal.progress)}%
                              </p>
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                {currencyFmt(goal.currentAmount)}
                              </p>
                            </div>

                            {/* Expand icon */}
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="shrink-0"
                            >
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </motion.div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(goal.progress, 100)}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.04 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: goalProgressColor }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {currencyFmt(goal.currentAmount)}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {currencyFmt(goal.targetAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="text-[11px]">
                                      <span className="text-muted-foreground">Valor alvo: </span>
                                      <span className="font-medium tabular-nums">{currencyFmt(goal.targetAmount)}</span>
                                    </div>
                                    <div className="text-[11px]">
                                      <span className="text-muted-foreground">Faltam: </span>
                                      <span className="font-medium text-rose-500 tabular-nums">
                                        {currencyFmt(Math.max(goal.targetAmount - goal.currentAmount, 0))}
                                      </span>
                                    </div>
                                  </div>
                                  {goal.monthlyContribution > 0 && (
                                    <div className="text-[11px]">
                                      <span className="text-muted-foreground">Contribuição mensal: </span>
                                      <span className="font-medium tabular-nums">
                                        {currencyFmt(goal.monthlyContribution)}/mês
                                      </span>
                                      {goal.monthlyContribution > 0 && Math.max(goal.targetAmount - goal.currentAmount, 0) > 0 && (
                                        <span className="text-muted-foreground ml-1">
                                          (~{Math.ceil(Math.max(goal.targetAmount - goal.currentAmount, 0) / goal.monthlyContribution)} meses)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {goal.startDate && (
                                    <div className="text-[11px]">
                                      <span className="text-muted-foreground">Início: </span>
                                      <span className="font-medium">
                                        {new Date(goal.startDate).toLocaleDateString('pt-BR')}
                                      </span>
                                    </div>
                                  )}
                                  {(goal.endDate || goal.targetDate) && (
                                    <div className="text-[11px]">
                                      <span className="text-muted-foreground">Prazo: </span>
                                      <span className="font-medium">
                                        {new Date((goal.endDate || goal.targetDate)!).toLocaleDateString('pt-BR')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 3: Investimentos ────────────────────────────── */}
          <TabsContent value="investments" className="mt-4">
            {investments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-7 h-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">Nenhum investimento cadastrado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Comece a investir para acompanhar sua carteira aqui
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <AnimatePresence>
                  {investments.map((inv, idx) => {
                    const invType = INVESTMENT_TYPES[inv.type] || INVESTMENT_TYPES.OTHER;
                    const InvIcon = invType.icon;
                    const isPositive = inv.returnRate >= 0;
                    const profit = inv.currentAmount - inv.totalInvested;

                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                      >
                        <motion.div
                          className="rounded-xl border p-4 bg-card hover:shadow-md border-border transition-all"
                          whileHover={{ y: -1, transition: { duration: 0.15 } }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${invType.color}15` }}
                            >
                              <InvIcon className="w-4 h-4" style={{ color: invType.color }} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{inv.name}</p>
                                {inv.ticker && (
                                  <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 shrink-0">
                                    {inv.ticker}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0"
                                  style={{
                                    borderColor: `${invType.color}40`,
                                    color: invType.color,
                                  }}
                                >
                                  {invType.label}
                                </Badge>
                              </div>
                            </div>

                            {/* Spark bar */}
                            <MiniSparkBar value={inv.returnRate} />

                            {/* Values */}
                            <div className="text-right shrink-0 min-w-[90px]">
                              <p className="text-sm font-bold tabular-nums">
                                {currencyFmt(inv.currentAmount)}
                              </p>
                              <div className="flex items-center justify-end gap-1">
                                {isPositive ? (
                                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3 text-rose-500" />
                                )}
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  isPositive ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {isPositive ? '+' : ''}{inv.returnRate.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Details row */}
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                            <div className="text-[10px] text-muted-foreground">
                              <span>Investido: </span>
                              <span className="font-medium text-foreground tabular-nums">{currencyFmt(inv.totalInvested)}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              <span>Lucro: </span>
                              <span className={`font-medium tabular-nums ${
                                isPositive ? 'text-emerald-500' : 'text-rose-500'
                              }`}>
                                {isPositive ? '+' : ''}{currencyFmt(profit)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
