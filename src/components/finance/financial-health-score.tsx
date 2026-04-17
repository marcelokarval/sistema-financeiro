'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, TrendingUp, TrendingDown, PiggyBank, Landmark, BarChart3, Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// --- Score colors & labels ---
function getScoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 50) return 'Regular';
  if (score >= 30) return 'Atenção';
  return 'Crítico';
}

function getScoreBgClass(score: number): string {
  if (score >= 85) return 'text-emerald-500';
  if (score >= 70) return 'text-lime-500';
  if (score >= 50) return 'text-yellow-500';
  if (score >= 30) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreGlowClass(score: number): string {
  if (score >= 85) return 'shadow-emerald-500/20';
  if (score >= 70) return 'shadow-lime-500/20';
  if (score >= 50) return 'shadow-yellow-500/20';
  if (score >= 30) return 'shadow-amber-500/20';
  return 'shadow-red-500/20';
}

function getScoreBadgeClass(score: number): string {
  if (score >= 85) return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25';
  if (score >= 70) return 'bg-lime-500/15 text-lime-600 border-lime-500/25';
  if (score >= 50) return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/25';
  if (score >= 30) return 'bg-amber-500/15 text-amber-600 border-amber-500/25';
  return 'bg-red-500/15 text-red-600 border-red-500/25';
}

// --- Scoring functions ---
interface ScoreBreakdown {
  savingsPoints: number;
  savingsMax: number;
  savingsLabel: string;
  creditPoints: number;
  creditMax: number;
  creditLabel: string;
  diversificationPoints: number;
  diversificationMax: number;
  diversificationLabel: string;
  netWorthPoints: number;
  netWorthMax: number;
  netWorthLabel: string;
  trendPoints: number;
  trendMax: number;
  trendLabel: string;
}

function calculateScore(data: DashboardData): { total: number; breakdown: ScoreBreakdown } {
  const income = data.monthIncome;
  const expense = data.monthExpense;
  const totalCardBalance = data.totalCardBalance;
  const totalCardLimit = data.totalCardLimit;
  const totalBalance = data.totalBalance;
  const accountCount = data.accountBalances.length;
  const monthlyTrend = data.monthlyTrend;

  // 1. Savings Rate (0-30 points)
  let savingsPoints = 0;
  let savingsLabel = '';
  if (income > 0) {
    const savingsRate = ((income - expense) / income) * 100;
    if (savingsRate >= 30) {
      savingsPoints = 30;
    } else if (savingsRate > 0) {
      savingsPoints = Math.round((savingsRate / 30) * 30);
    } else {
      savingsPoints = 0;
    }
    savingsLabel = `${savingsRate.toFixed(0)}% de poupança`;
  } else {
    savingsLabel = 'Sem renda registrada';
  }

  // 2. Credit Utilization (0-25 points) — lower is better
  let creditPoints = 0;
  let creditLabel = '';
  if (totalCardLimit > 0) {
    const utilization = (totalCardBalance / totalCardLimit) * 100;
    creditLabel = `${utilization.toFixed(0)}% utilizado`;
    if (utilization <= 10) {
      creditPoints = 25;
    } else if (utilization <= 30) {
      creditPoints = Math.round(25 - ((utilization - 10) / 20) * 7);
    } else if (utilization <= 60) {
      creditPoints = Math.round(18 - ((utilization - 30) / 30) * 8);
    } else if (utilization <= 90) {
      creditPoints = Math.round(10 - ((utilization - 60) / 30) * 8);
    } else {
      creditPoints = Math.max(0, Math.round(2 - ((utilization - 90) / 10) * 2));
    }
  } else {
    creditPoints = 25;
    creditLabel = 'Sem cartões de crédito';
  }

  // 3. Account Diversification (0-15 points)
  let diversificationPoints = 0;
  let diversificationLabel = '';
  if (accountCount >= 5) {
    diversificationPoints = 15;
  } else if (accountCount >= 4) {
    diversificationPoints = 13;
  } else if (accountCount >= 3) {
    diversificationPoints = 10;
  } else if (accountCount >= 2) {
    diversificationPoints = 7;
  } else if (accountCount >= 1) {
    diversificationPoints = 4;
  }
  diversificationLabel = `${accountCount} conta${accountCount !== 1 ? 's' : ''}`;

  // 4. Positive Net Worth (0-20 points)
  const netWorth = totalBalance - totalCardBalance;
  let netWorthPoints = 0;
  let netWorthLabel = '';
  if (income > 0) {
    const ratio = netWorth / income;
    if (ratio >= 6) {
      netWorthPoints = 20;
    } else if (ratio >= 3) {
      netWorthPoints = Math.round(14 + ((ratio - 3) / 3) * 6);
    } else if (ratio >= 1) {
      netWorthPoints = Math.round(8 + ((ratio - 1) / 2) * 6);
    } else if (ratio >= 0) {
      netWorthPoints = Math.round((ratio / 1) * 8);
    } else {
      netWorthPoints = 0;
    }
  } else if (netWorth > 0) {
    netWorthPoints = 12;
  }
  netWorthLabel = `${currencyFmt(netWorth)}`;

  // 5. Recent Trend (0-10 points) — are expenses decreasing?
  let trendPoints = 0;
  let trendLabel = '';
  if (monthlyTrend.length >= 3) {
    const last3 = monthlyTrend.slice(-3);
    const firstExp = last3[0]?.expense || 0;
    const lastExp = last3[2]?.expense || 0;

    if (firstExp > 0 && lastExp < firstExp) {
      const decreasePercent = ((firstExp - lastExp) / firstExp) * 100;
      if (decreasePercent >= 15) {
        trendPoints = 10;
        trendLabel = `Despesas ${decreasePercent.toFixed(0)}% menores`;
      } else if (decreasePercent >= 5) {
        trendPoints = Math.round(6 + ((decreasePercent - 5) / 10) * 4);
        trendLabel = `Despesas ${decreasePercent.toFixed(0)}% menores`;
      } else {
        trendPoints = Math.round((decreasePercent / 5) * 6);
        trendLabel = `Despesas estáveis`;
      }
    } else if (lastExp <= firstExp * 1.05) {
      trendPoints = 4;
      trendLabel = 'Despesas estáveis';
    } else {
      const increasePercent = ((lastExp - firstExp) / firstExp) * 100;
      trendPoints = 0;
      trendLabel = `Despesas ${increasePercent.toFixed(0)}% maiores`;
    }
  } else {
    trendPoints = 5;
    trendLabel = 'Dados insuficientes';
  }

  const total = savingsPoints + creditPoints + diversificationPoints + netWorthPoints + trendPoints;

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      savingsPoints,
      savingsMax: 30,
      savingsLabel,
      creditPoints,
      creditMax: 25,
      creditLabel,
      diversificationPoints,
      diversificationMax: 15,
      diversificationLabel,
      netWorthPoints,
      netWorthMax: 20,
      netWorthLabel,
      trendPoints,
      trendMax: 10,
      trendLabel,
    },
  };
}

// --- SVG Gauge ---
function ScoreGauge({
  score,
  size = 180,
  strokeWidth = 14,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: color }}
      />
      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.25}
        />
        {/* Score arc */}
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
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <ScoreCounter target={score} colorClass={getScoreBgClass(score)} />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className={`text-sm font-semibold ${getScoreBgClass(score)}`}
        >
          {getScoreLabel(score)}
        </motion.p>
      </div>
    </div>
  );
}

// --- Animated counter ---
function ScoreCounter({ target, colorClass }: { target: number; colorClass: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    const startDelay = 300;

    const step = (now: number) => {
      const elapsed = now - startTime - startDelay;
      if (elapsed < 0) {
        ref.current = requestAnimationFrame(step);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    };

    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target]);

  return (
    <span className={`text-5xl font-extrabold tabular-nums ${colorClass}`}>
      {displayed}
    </span>
  );
}

// --- Mini Metric Bar ---
function MetricBar({
  icon,
  label,
  points,
  maxPoints,
  detail,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
  color: string;
  delay?: number;
}) {
  const percent = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-3"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">{label}</span>
            <span className="text-[10px] text-muted-foreground">{detail}</span>
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color }}>
            {points}/{maxPoints}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: delay + 0.2 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// --- Types ---
interface DashboardData {
  totalBalance: number;
  totalCardBalance: number;
  totalCardLimit: number;
  monthIncome: number;
  monthExpense: number;
  recentTransactions: any[];
  recentPurchases: any[];
  expenseByCategory: any[];
  monthlyTrend: { month: string; income: number; expense: number }[];
  accountBalances: { accountId: string; accountName: string; accountColor: string; balance: number }[];
}

// --- Animation variants ---
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// --- Main Component ---
export function FinancialHealthScore() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Erro ao carregar dados da saúde financeira', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Loading state
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <Skeleton className="w-44 h-44 rounded-full" />
            <div className="flex-1 space-y-4 w-full max-w-md">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Erro ao carregar dados da saúde financeira.</p>
        </CardContent>
      </Card>
    );
  }

  const { total: score, breakdown } = calculateScore(data);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Saúde Financeira</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avaliação baseada nos seus dados financeiros
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Score Gauge */}
            <motion.div
              variants={item}
              className="flex flex-col items-center gap-3 shrink-0"
            >
              <ScoreGauge score={score} size={180} strokeWidth={14} />
              <Badge className={`text-xs font-medium border ${getScoreBadgeClass(score)}`}>
                {score}/100 pontos
              </Badge>
            </motion.div>

            {/* Metric Bars */}
            <div className="flex-1 w-full space-y-4">
              <MetricBar
                icon={<PiggyBank className="w-4 h-4 text-emerald-500" />}
                label="Taxa de Poupança"
                points={breakdown.savingsPoints}
                maxPoints={breakdown.savingsMax}
                detail={breakdown.savingsLabel}
                color="#22c55e"
                delay={0.15}
              />
              <MetricBar
                icon={<Landmark className="w-4 h-4 text-sky-500" />}
                label="Uso do Crédito"
                points={breakdown.creditPoints}
                maxPoints={breakdown.creditMax}
                detail={breakdown.creditLabel}
                color="#0ea5e9"
                delay={0.25}
              />
              <MetricBar
                icon={<BarChart3 className="w-4 h-4 text-violet-500" />}
                label="Diversificação"
                points={breakdown.diversificationPoints}
                maxPoints={breakdown.diversificationMax}
                detail={breakdown.diversificationLabel}
                color="#8b5cf6"
                delay={0.35}
              />
              <MetricBar
                icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
                label="Patrimônio Líquido"
                points={breakdown.netWorthPoints}
                maxPoints={breakdown.netWorthMax}
                detail={breakdown.netWorthLabel}
                color="#f59e0b"
                delay={0.45}
              />
              <MetricBar
                icon={<Activity className="w-4 h-4 text-teal-500" />}
                label="Tendência"
                points={breakdown.trendPoints}
                maxPoints={breakdown.trendMax}
                detail={breakdown.trendLabel}
                color="#14b8a6"
                delay={0.55}
              />

              {/* Summary line */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="pt-3 border-t border-border/50"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Total: {currencyFmt(data.monthIncome)} receita · {currencyFmt(data.monthExpense)} despesa
                  </span>
                  <span className="flex items-center gap-1">
                    {data.monthIncome - data.monthExpense >= 0 ? (
                      <>
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">
                          +{currencyFmt(data.monthIncome - data.monthExpense)} saldo
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3 h-3 text-rose-500" />
                        <span className="text-rose-500 font-medium">
                          {currencyFmt(data.monthIncome - data.monthExpense)} déficit
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
