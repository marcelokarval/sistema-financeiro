'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { currencyFmt } from '@/lib/helpers';

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 50) return 'Regular';
  if (score >= 30) return 'Atenção';
  return 'Crítico';
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

interface DashboardData {
  totalBalance: number;
  totalCardBalance: number;
  totalCardLimit: number;
  monthIncome: number;
  monthExpense: number;
  recentTransactions: Record<string, unknown>[];
  recentPurchases: Record<string, unknown>[];
  expenseByCategory: Record<string, unknown>[];
  monthlyTrend: { month: string; income: number; expense: number }[];
  accountBalances: { accountId: string; accountName: string; accountColor: string; balance: number }[];
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';

export function HealthBreakdown({ data }: { data: DashboardData }) {
  const { total: score, breakdown } = calculateScore(data);
  const criteria = [
    ['Taxa de poupança', breakdown.savingsPoints, breakdown.savingsMax, breakdown.savingsLabel],
    ['Uso do crédito', breakdown.creditPoints, breakdown.creditMax, breakdown.creditLabel],
    ['Diversificação', breakdown.diversificationPoints, breakdown.diversificationMax, breakdown.diversificationLabel],
    ['Patrimônio líquido', breakdown.netWorthPoints, breakdown.netWorthMax, breakdown.netWorthLabel],
    ['Tendência', breakdown.trendPoints, breakdown.trendMax, breakdown.trendLabel],
  ] as const;
  const balance = data.monthIncome - data.monthExpense;
  return (
    <>
      <div className="grid min-w-0 gap-4 border-y border-border py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-medium">Pontuação</h3>
            <p className="text-xs">{getScoreLabel(score)}</p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">{score}<span className="text-sm text-muted-foreground">/100 pontos</span></p>
          <FinanceProgress
            label="Pontuação de saúde financeira"
            value={score}
            min={0}
            max={100}
            unit="pontos"
            valueText={`${score} de 100 pontos · ${getScoreLabel(score)}`}
            showHeader={false}
          />
        </div>
        <dl aria-label="Resumo mensal" className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 sm:border-l sm:border-border sm:pl-4">
          <FinanceMetric variant="compact" label="Receita do mês" value={currencyFmt(data.monthIncome)} valueClassName="text-sm" />
          <FinanceMetric variant="compact" label="Despesa do mês" value={currencyFmt(data.monthExpense)} valueClassName="text-sm" />
          <FinanceMetric variant="compact" label={balance >= 0 ? 'Saldo do mês' : 'Déficit do mês'} value={currencyFmt(balance)} valueClassName="text-sm" />
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-medium">Critérios da pontuação</h3>
        <dl className="divide-y divide-border text-sm">
          {criteria.map(([label, points, maxPoints, detail]) => (
            <div key={label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
              <dt className="break-words">{label}</dt>
              <dd className="col-start-1 row-start-2 break-words text-xs text-muted-foreground sm:col-start-2 sm:row-start-1">{detail}</dd>
              <dd className="col-start-2 row-start-1 whitespace-nowrap font-mono text-xs tabular-nums sm:col-start-3">{points}/{maxPoints} pontos</dd>
              <dd aria-hidden="true" className="col-span-full">
                <FinanceProgress
                  label={label}
                  value={points}
                  min={0}
                  max={maxPoints}
                  unit="pontos"
                  showHeader={false}
                  trackClassName="h-1"
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

export function FinancialHealthScore() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch (e) {
      console.error('Erro ao carregar dados da saúde financeira', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return <FinancialHealthContent data={data} loading={loading} onRetry={fetchDashboard} />;
}

export function FinancialHealthContent({
  data,
  loading,
  onRetry,
}: {
  data: DashboardData | null;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <section data-qa="quiet-financial-health" aria-label="Saúde financeira" aria-busy={loading || undefined} className={panel}>
      <header>
        <h2 className="font-semibold">Saúde financeira</h2>
        <p className="text-xs text-muted-foreground">Avaliação baseada nos seus dados financeiros</p>
      </header>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Carregando avaliação…</p>
        : !data ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <p role="alert" className="text-sm text-muted-foreground">Erro ao carregar dados da saúde financeira.</p>
            <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>Tentar novamente</Button>
          </div>
        ) : <HealthBreakdown data={data} />}
    </section>
  );
}
