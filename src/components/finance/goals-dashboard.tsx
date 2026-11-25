'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { currencyFmt } from '@/lib/helpers';

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

const INVESTMENT_TYPES: Record<string, { label: string }> = {
  STOCK: { label: 'Ações' },
  BOND: { label: 'Renda Fixa' },
  FII: { label: 'FIIs' },
  CDB: { label: 'CDB' },
  LCI: { label: 'LCI' },
  LCA: { label: 'LCA' },
  TESOURO: { label: 'Tesouro' },
  CRYPTO: { label: 'Cripto' },
  ETF: { label: 'ETF' },
  OTHER: { label: 'Outro' },
};

const SAVINGS_TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Poupança',
  PIGGY_BANK: 'Porquinho',
  CDI: 'Conta CDI',
  INVESTMENT: 'Investimento',
  EMERGENCY_FUND: 'Reserva',
};

function getProgressLabel(pct: number): string {
  if (pct >= 90) return 'Excelente';
  if (pct >= 60) return 'Bom';
  if (pct >= 25) return 'Em andamento';
  return 'Início';
}

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
  monthlyContribution: number;
  startDate: string;
  endDate: string | null;
  targetDate: string | null;
  type: string;
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';
const amount = 'break-words font-mono text-sm font-semibold tabular-nums';

export function GoalCategoryLabel({ color, label }: { color: string | null; label: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground">
      {color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} />}
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

export function GoalsProgress({ summary }: { summary: Summary }) {
  const width = Math.min(100, Math.max(0, summary.overallProgress));
  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">Progresso geral</h3>
        <p className="text-xs">{getProgressLabel(summary.overallProgress)} · <span className={amount}>{Math.round(summary.overallProgress)}%</span></p>
      </div>
      <FinanceProgress
        label="Progresso geral das metas"
        value={width}
        min={0}
        max={100}
        unit="%"
        valueText={`${Math.round(summary.overallProgress)}%`}
        showHeader={false}
      />
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {([['Acumulado', summary.totalCurrentAmount], ['Total alvo', summary.totalTargetAmount], ['Restante', Math.max(summary.totalTargetAmount - summary.totalCurrentAmount, 0)]] as const).map(([label, value]) => (
          <FinanceMetric key={label} variant="compact" label={label} value={currencyFmt(value)} valueClassName="text-sm" />
        ))}
      </dl>
      {summary.estimatedCompletion && <p className="text-xs text-muted-foreground">Previsão de conclusão: {summary.estimatedCompletion}</p>}
    </div>
  );
}

function CombinedGoalRow({ goal, isExpanded, onToggleExpand }: {
  goal: CombinedGoal;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const width = Math.min(100, Math.max(0, goal.progress));
  return (
    <li className="min-w-0 space-y-2 py-3">
      <Button variant="ghost" type="button" aria-expanded={isExpanded} onClick={() => onToggleExpand(goal.id)} className="h-auto min-h-9 w-full justify-between whitespace-normal px-2 py-1.5 text-left">
        <span className="min-w-0 break-words">{goal.name}</span><ChevronDown aria-hidden="true" className={isExpanded ? 'rotate-180' : ''} />
      </Button>
      <div className="space-y-1.5 px-2 text-xs">
        <div className="flex flex-wrap justify-between gap-x-2">
          <p className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 break-words">
            <span>{goal.isCompleted ? 'Concluída' : 'Em andamento'}</span>
            {goal.source === 'budget' && <span className="text-muted-foreground">Orçamento</span>}
            {goal.categoryName && <GoalCategoryLabel color={goal.categoryColor} label={goal.categoryName} />}
          </p>
          <span className="font-mono tabular-nums">{Math.round(goal.progress)}%</span>
        </div>
        <FinanceProgress
          label={`Progresso da meta ${goal.name}`}
          value={width}
          min={0}
          max={100}
          unit="%"
          valueText={`${Math.round(goal.progress)}%`}
          showHeader={false}
        />
        <p className="break-words text-muted-foreground">Atual: {currencyFmt(goal.currentAmount)} · Alvo: {currencyFmt(goal.targetAmount)}</p>
      </div>
      {isExpanded && (
        <dl className="grid grid-cols-2 gap-2 border-t border-border px-2 pt-2 text-xs sm:grid-cols-4">
          <FinanceMetric variant="compact" label="Faltam" value={currencyFmt(Math.max(goal.targetAmount - goal.currentAmount, 0))} valueClassName="text-sm" />
          {goal.monthlyContribution > 0 && (
            <FinanceMetric
              variant="compact"
              label="Contribuição mensal"
              value={`${currencyFmt(goal.monthlyContribution)}/mês`}
              caption={Math.max(goal.targetAmount - goal.currentAmount, 0) > 0 ? `~${Math.ceil(Math.max(goal.targetAmount - goal.currentAmount, 0) / goal.monthlyContribution)} meses` : undefined}
              valueClassName="text-sm"
            />
          )}
          {goal.startDate && <div><dt className="text-muted-foreground">Início</dt><dd>{new Date(goal.startDate).toLocaleDateString('pt-BR')}</dd></div>}
          {(goal.endDate || goal.targetDate) && <div><dt className="text-muted-foreground">Prazo</dt><dd>{new Date((goal.endDate || goal.targetDate)!).toLocaleDateString('pt-BR')}</dd></div>}
        </dl>
      )}
    </li>
  );
}

function GoalInvestmentRow({ inv }: { inv: InvestmentItem }) {
  const invType = INVESTMENT_TYPES[inv.type] || INVESTMENT_TYPES.OTHER;
  const isPositive = inv.returnRate >= 0;
  const profit = inv.currentAmount - inv.totalInvested;
  return (
    <li className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
      <div className="min-w-0"><h3 className="break-words text-sm font-medium">{inv.name}</h3><p className="break-words text-xs text-muted-foreground">{invType.label}{inv.ticker && ` · ${inv.ticker}`}</p></div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <FinanceMetric variant="compact" label="Valor atual" value={currencyFmt(inv.currentAmount)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Investido" value={currencyFmt(inv.totalInvested)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Resultado" value={`${profit >= 0 ? '+' : ''}${currencyFmt(profit)}`} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Retorno" value={`${isPositive ? '+' : ''}${inv.returnRate.toFixed(1)}%`} valueClassName="text-sm" />
      </dl>
    </li>
  );
}

export function GoalsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/goals-dashboard');
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch (e) {
      console.error('Erro ao carregar central de metas', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <GoalsDashboardContent
      data={data}
      loading={loading}
      expandedGoal={expandedGoal}
      onToggleExpand={(id) => setExpandedGoal((prev) => (prev === id ? null : id))}
      onRetry={fetchData}
    />
  );
}

export function GoalsDashboardContent({
  data,
  loading,
  expandedGoal,
  onToggleExpand,
  onRetry,
}: {
  data: DashboardData | null;
  loading: boolean;
  expandedGoal: string | null;
  onToggleExpand: (id: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <section data-qa="quiet-goals-dashboard" aria-label="Central de metas" aria-busy="true" className={panel}>
        <h2 className="font-semibold">Central de metas</h2>
        <p role="status" className="text-sm text-muted-foreground">Carregando metas…</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section data-qa="quiet-goals-dashboard" aria-label="Central de metas" className={panel}>
        <h2 className="font-semibold">Central de metas</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar a central de metas.</p>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>Tentar novamente</Button>
        </div>
      </section>
    );
  }

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

  const investmentResult = investments.reduce((s, i) => s + (i.currentAmount - i.totalInvested), 0);
  return (
    <section data-qa="quiet-goals-dashboard" aria-label="Central de metas" className={panel}>
      <header><h2 className="font-semibold">Central de metas</h2><p className="text-xs text-muted-foreground">Acompanhe seus objetivos financeiros</p></header>
      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs sm:grid-cols-4">
        {([['Total de metas', summary.totalGoals], ['Em progresso', summary.inProgressGoals], ['Concluídas', summary.completedGoals], ['Total acumulado', currencyFmt(summary.totalCurrentAmount)]] as const).map(([label, value]) => (
          <FinanceMetric key={label} variant="compact" label={label} value={value} valueClassName="text-sm" />
        ))}
      </dl>
      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList aria-label="Áreas da central de metas" className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="overview" className="min-h-9 whitespace-normal text-center text-xs">Visão Geral</TabsTrigger>
          <TabsTrigger value="goals" className="min-h-9 whitespace-normal text-center text-xs">Metas e Economias</TabsTrigger>
          <TabsTrigger value="investments" className="min-h-9 whitespace-normal text-center text-xs">Investimentos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-w-0 space-y-4 pt-2">
          <GoalsProgress summary={summary} />
          <dl aria-label="Acumulado por grupo" className="grid grid-cols-2 gap-3 border-b border-border pb-3 text-xs sm:grid-cols-4">
            <FinanceMetric variant="compact" label="Metas de orçamento" value={currencyFmt(budgetGoals.reduce((s, g) => s + g.currentAmount, 0))} caption={`${budgetGoals.length} meta${budgetGoals.length !== 1 ? 's' : ''}`} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label="Economias" value={currencyFmt(savingsGoals.reduce((s, g) => s + g.currentAmount, 0))} caption={`${savingsGoals.length} meta${savingsGoals.length !== 1 ? 's' : ''}`} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label="Investimentos" value={currencyFmt(investments.reduce((s, i) => s + i.currentAmount, 0))} caption={`${investments.length} investimento${investments.length !== 1 ? 's' : ''}`} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label="Resultado dos investimentos" value={currencyFmt(investmentResult)} valueClassName="text-sm" />
          </dl>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Metas recentes</h3>
            {recentGoals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p> : (
              <ul className="divide-y divide-border">
                {recentGoals.map((goal) => (
                  <li key={goal.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3 py-2 text-sm">
                    <div className="min-w-0"><p className="break-words font-medium">{goal.name}</p><p className="text-xs text-muted-foreground"><GoalCategoryLabel color={goal.source === 'budget' ? goal.categoryColor : goal.color} label={goal.source === 'budget' ? 'Meta de orçamento' : SAVINGS_TYPE_LABELS[goal.type] || 'Meta de poupança'} /></p></div>
                    <div className="min-w-0 text-right"><p className={amount}>{currencyFmt(goal.currentAmount)}</p><p className="font-mono text-xs tabular-nums">{Math.round(goal.progress)}%</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="goals" className="min-w-0 pt-2">
          {combinedGoals.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nenhuma meta encontrada. Crie metas de orçamento ou poupança para acompanhar aqui.</p> : (
            <ul className="divide-y divide-border">
              {combinedGoals.map((goal) => (
                <CombinedGoalRow
                  key={goal.id}
                  goal={goal}
                  isExpanded={expandedGoal === goal.id}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="investments" className="min-w-0 pt-2">
          {investments.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nenhum investimento. Comece a investir para acompanhar sua carteira aqui.</p> : (
            <ul className="divide-y divide-border">
              {investments.map((inv) => (
                <GoalInvestmentRow key={inv.id} inv={inv} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
