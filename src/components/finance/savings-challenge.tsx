'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// --- Types ---
interface ChallengeTarget {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progress: number;
  unit: 'currency' | 'percent';
}

interface SavingsData {
  currentMonthSavings: number;
  dailyAverageExpense: number;
  projectedMonthExpense: number;
  projectedSavings: number;
  savingsRate: number;
  daysRemaining: number;
  daysInMonth: number;
  daysElapsed: number;
  income: number;
  totalExpenses: number;
  todaySpending: number;
  dailyTarget: number;
  challengeTargets: ChallengeTarget[];
}

function getMotivationalMessage(data: SavingsData): string {
  const { savingsRate, daysRemaining } = data;
  if (savingsRate >= 30) {
    return `Incrível! Você está economizando ${savingsRate.toFixed(0)}% da sua renda. Continue assim!`;
  }
  if (savingsRate >= 20) {
    return `Muito bem! Sua taxa de poupança está saudável. Faltam ${daysRemaining} dias — mantenha o foco!`;
  }
  if (savingsRate >= 10) {
    return `Você está no caminho certo. Tente reduzir pequenos gastos para atingir 20% de economia.`;
  }
  if (savingsRate >= 0) {
    return `Sua taxa de poupança está baixa. Que tal cortar gastos desnecessários estes ${daysRemaining} dias?`;
  }
  return `Suas despesas ultrapassaram a renda. Revise seus gastos e busque formas de economizar.`;
}

const STARTED_STORAGE_KEY = 'quiet-savings-challenges-started';

export function readStartedChallenges(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(STARTED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function acceptChallengeInStorage(id: string): Set<string> {
  const next = readStartedChallenges();
  next.add(id);
  try {
    globalThis.localStorage?.setItem(STARTED_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Ignore storage errors in restricted environments.
  }
  return next;
}

function getSavingsLabel(rate: number) {
  if (rate >= 30) return 'Excelente';
  if (rate >= 20) return 'Bom';
  if (rate >= 10) return 'Atenção';
  if (rate >= 0) return 'Baixo';
  return 'Negativo';
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';
const amount = 'break-words font-mono text-sm font-semibold tabular-nums';

export function ChallengeRow({ challenge }: { challenge: ChallengeTarget }) {
  const [started, setStarted] = useState(() => readStartedChallenges().has(challenge.id));
  const label = challenge.progress >= 80 ? 'No caminho' : challenge.progress >= 50 ? 'Quase lá' : 'Precisa melhorar';
  const formatValue = (v: number, unit: string) => unit === 'currency' ? currencyFmt(v) : `${v.toFixed(1)}%`;
  const width = Math.min(100, Math.max(challenge.progress, 0));

  return (
    <li className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <h4 className="break-words text-sm font-medium">{challenge.title}</h4>
        <p className="break-words text-xs text-muted-foreground">{challenge.description}</p>
      </div>
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="flex flex-wrap justify-between gap-x-2"><span>{label}</span><span className="font-mono tabular-nums">{challenge.progress.toFixed(0)}%</span></p>
        <FinanceProgress
          label={`Progresso de ${challenge.title}`}
          value={width}
          min={0}
          max={100}
          unit="%"
          valueText={`${challenge.progress.toFixed(0)}%`}
          showHeader={false}
        />
        <p className="break-words text-muted-foreground">Atual: {formatValue(challenge.current, challenge.unit)} · Meta: {formatValue(challenge.target, challenge.unit)}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 justify-self-start"
        onClick={() => {
          acceptChallengeInStorage(challenge.id);
          setStarted(true);
        }}
        disabled={started}
      >
        {started ? 'Desafio aceito!' : 'Iniciar Desafio'}
      </Button>
    </li>
  );
}

export function SavingsChallenge() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/savings-challenge');
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch (e) {
      console.error('Erro ao carregar dados do desafio de economia', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return <SavingsChallengeContent data={data} loading={loading} onRetry={fetchData} />;
}

export function SavingsChallengeContent({
  data,
  loading,
  onRetry,
}: {
  data: SavingsData | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) return <section data-qa="quiet-savings-challenge" aria-label="Desafios de economia" aria-busy="true" className={panel}><h2 className="font-semibold">Desafios de economia</h2><p role="status" className="text-sm text-muted-foreground">Carregando desafios…</p></section>;
  if (!data) {
    return (
      <section data-qa="quiet-savings-challenge" aria-label="Desafios de economia" className={panel}>
        <h2 className="font-semibold">Desafios de economia</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os dados do desafio de economia.</p>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>Tentar novamente</Button>
        </div>
      </section>
    );
  }

  const motivation = getMotivationalMessage(data);
  const todayProgress = data.dailyTarget > 0 ? Math.min((data.todaySpending / data.dailyTarget) * 100, 100) : 0;
  return (
    <section data-qa="quiet-savings-challenge" aria-label="Desafios de economia" className={panel}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold">Desafios de economia</h2>
        <p className="text-xs capitalize text-muted-foreground">{format(new Date(), 'MMMM yyyy', { locale: ptBR })}</p>
      </header>
      <dl aria-label="Economia no mês" className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs sm:grid-cols-3 xl:grid-cols-5">
        <FinanceMetric variant="compact" label="Taxa de poupança" value={`${Math.round(data.savingsRate)}%`} caption={getSavingsLabel(data.savingsRate)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Economia no mês" value={currencyFmt(data.currentMonthSavings)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Média diária de gastos" value={currencyFmt(data.dailyAverageExpense)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Economia projetada" value={currencyFmt(data.projectedSavings)} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label="Dias restantes" value={data.daysRemaining} valueClassName="text-sm" />
      </dl>
      <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium">Gastos de hoje</h3>
          <p className="text-xs">{data.todaySpending > data.dailyTarget ? 'Meta ultrapassada' : 'Dentro da meta'}</p>
        </div>
        <p className="break-words text-xs text-muted-foreground"><strong className={cn(amount, 'text-foreground')}>{currencyFmt(data.todaySpending)}</strong> de {currencyFmt(data.dailyTarget)} disponíveis · {todayProgress.toFixed(0)}% da meta diária utilizada</p>
        <FinanceProgress
          label="Uso da meta diária"
          value={Math.min(100, Math.max(todayProgress, 0))}
          min={0}
          max={100}
          unit="%"
          valueText={`${todayProgress.toFixed(0)}%`}
          showHeader={false}
        />
        {data.todaySpending === 0 && <p className="text-xs text-muted-foreground">Nenhum gasto ainda</p>}
      </div>
      <div>
        <h3 className="text-sm font-medium">Metas dos desafios</h3>
        <ul className="divide-y divide-border">{data.challengeTargets.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} />)}</ul>
      </div>
      <footer className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <p>{motivation}</p>
        <p>Receita: {currencyFmt(data.income)} · Despesas: {currencyFmt(data.totalExpenses)} · {data.daysElapsed} de {data.daysInMonth} dias</p>
      </footer>
    </section>
  );
}
