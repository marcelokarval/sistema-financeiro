'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from './analytics-i18n';

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

type SavingsRateLabelKey = 'excellent' | 'good' | 'attention' | 'low' | 'negative';

function getSavingsLabelKey(rate: number): SavingsRateLabelKey {
  if (rate >= 30) return 'excellent';
  if (rate >= 20) return 'good';
  if (rate >= 10) return 'attention';
  if (rate >= 0) return 'low';
  return 'negative';
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';
const amount = 'break-words font-mono text-sm font-semibold tabular-nums';

function maskChallengeText(text: string, maskedValue: string): string {
  return text
    .replace(/-?R\$\s*[\d.,]+/g, maskedValue)
    .replace(/[+-]?\d+(?:[.,]\d+)?\s*%/g, '•••')
    .replace(/\d+(?:[.,]\d+)*/g, '•••');
}

export function ChallengeRow({ challenge, showValues = true }: { challenge: ChallengeTarget; showValues?: boolean }) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const [started, setStarted] = useState(() => readStartedChallenges().has(challenge.id));
  const statusKey = challenge.progress >= 80 ? 'onTrack' : challenge.progress >= 50 ? 'almostThere' : 'needsWork';
  const label = t(`challenges.row.${statusKey}`);
  const maskedValue = t('maskedValue');
  const title = showValues ? challenge.title : maskChallengeText(challenge.title, maskedValue);
  const description = showValues ? challenge.description : maskChallengeText(challenge.description, maskedValue);
  const formatValue = (v: number, unit: string) => {
    if (!showValues) return unit === 'currency' ? maskedValue : '•••';
    return unit === 'currency' ? currencyFmt(v, locale) : `${v.toFixed(1)}%`;
  };
  const width = Math.min(100, Math.max(challenge.progress, 0));

  return (
    <li className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <h4 className="break-words text-sm font-medium">{title}</h4>
        <p className="break-words text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="flex flex-wrap justify-between gap-x-2"><span>{label}</span><span className="font-mono tabular-nums">{showValues ? `${challenge.progress.toFixed(0)}%` : '•••'}</span></p>
        <FinanceProgress
          label={t('challenges.row.progressAria', { title })}
          value={width}
          min={0}
          max={100}
          unit="%"
          valueText={showValues ? `${challenge.progress.toFixed(0)}%` : '•••'}
          showHeader={false}
        />
        <p className="break-words text-muted-foreground">
          {t('challenges.row.currentAndTarget', {
            current: formatValue(challenge.current, challenge.unit),
            target: formatValue(challenge.target, challenge.unit),
          })}
        </p>
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
        {started ? t('challenges.row.accepted') : t('challenges.row.start')}
      </Button>
    </li>
  );
}

export function SavingsChallenge({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
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

  useEffect(() => {
    void locale;
    fetchData();
  }, [fetchData, locale]);

  return <SavingsChallengeContent data={data} loading={loading} onRetry={fetchData} showValues={showValues} />;
}

export function SavingsChallengeContent({
  data,
  loading,
  onRetry,
  showValues = true,
}: {
  data: SavingsData | null;
  loading: boolean;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();

  if (loading) {
    return (
      <section data-qa="quiet-savings-challenge" aria-label={t('challenges.title')} aria-busy="true" className={panel}>
        <h2 className="font-semibold">{t('challenges.title')}</h2>
        <p role="status" className="text-sm text-muted-foreground">{t('challenges.loading')}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section data-qa="quiet-savings-challenge" aria-label={t('challenges.title')} className={panel}>
        <h2 className="font-semibold">{t('challenges.title')}</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">{t('challenges.error')}</p>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>{t('common.retry')}</Button>
        </div>
      </section>
    );
  }

  const maskedValue = t('maskedValue');
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const motivation = data.savingsRate >= 30
    ? t('challenges.motivation.high', { rate: showValues ? data.savingsRate.toFixed(0) : '•••' })
    : data.savingsRate >= 20
      ? t('challenges.motivation.good', { days: data.daysRemaining })
      : data.savingsRate >= 10
        ? t('challenges.motivation.medium')
        : data.savingsRate >= 0
          ? t('challenges.motivation.low', { days: data.daysRemaining })
          : t('challenges.motivation.negative');

  const todayProgress = data.dailyTarget > 0 ? Math.min((data.todaySpending / data.dailyTarget) * 100, 100) : 0;
  return (
    <section data-qa="quiet-savings-challenge" aria-label={t('challenges.title')} className={panel}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold">{t('challenges.title')}</h2>
        <p className="text-xs capitalize text-muted-foreground">{format(new Date(), 'MMMM yyyy', { locale: getDateFnsLocale(locale) })}</p>
      </header>
      <dl aria-label={t('challenges.summaryAria')} className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs sm:grid-cols-3 xl:grid-cols-5">
        <FinanceMetric variant="compact" label={t('challenges.metrics.savingsRate')} value={`${Math.round(data.savingsRate)}%`} caption={t(`challenges.rateLabels.${getSavingsLabelKey(data.savingsRate)}`)} showValues={showValues} maskedValue="•••" valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('challenges.metrics.monthSavings')} value={currencyFmt(data.currentMonthSavings, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('challenges.metrics.dailyAverage')} value={currencyFmt(data.dailyAverageExpense, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('challenges.metrics.projectedSavings')} value={currencyFmt(data.projectedSavings, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('challenges.metrics.daysRemaining')} value={data.daysRemaining} valueClassName="text-sm" />
      </dl>
      <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium">{t('challenges.today.title')}</h3>
          <p className="text-xs">{data.todaySpending > data.dailyTarget ? t('challenges.today.overTarget') : t('challenges.today.withinTarget')}</p>
        </div>
        <p className="break-words text-xs text-muted-foreground">
          <strong className={cn(amount, 'text-foreground')}>{money(data.todaySpending)}</strong>{' '}
          {t('challenges.today.usagePrefix', { target: money(data.dailyTarget), pct: showValues ? todayProgress.toFixed(0) : '•••' })}
        </p>
        <FinanceProgress
          label={t('challenges.today.progressLabel')}
          value={Math.min(100, Math.max(todayProgress, 0))}
          min={0}
          max={100}
          unit="%"
          valueText={showValues ? `${todayProgress.toFixed(0)}%` : '•••'}
          showHeader={false}
        />
        {data.todaySpending === 0 && <p className="text-xs text-muted-foreground">{t('challenges.today.noSpending')}</p>}
      </div>
      <div>
        <h3 className="text-sm font-medium">{t('challenges.targetsTitle')}</h3>
        <ul className="divide-y divide-border">{data.challengeTargets.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} showValues={showValues} />)}</ul>
      </div>
      <footer className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <p>{motivation}</p>
        <p>
          {t('challenges.footerSummary', {
            income: money(data.income),
            expenses: money(data.totalExpenses),
            elapsed: data.daysElapsed,
            total: data.daysInMonth,
          })}
        </p>
      </footer>
    </section>
  );
}
