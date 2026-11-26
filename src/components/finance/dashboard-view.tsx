'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { FinanceRow } from '@/components/shared/finance-row';
import { INTL_LOCALE, type CanonicalLocale } from '@/i18n/config';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { BudgetGoalsWidget } from './budget-goals';
import { FinancialReportsWidget } from './financial-reports';
import { FinancialHealthScore } from './financial-health-score';
import { RecurringTransactionsWidget } from './recurring-transactions';
import { UpcomingBills } from './upcoming-bills';
import { MonthlyBudgetTracker } from './monthly-budget-tracker';
import { currentDashboardResult, dashboardMetrics, fetchDashboard, observeQuery, QUICK_FILTERS, quickRange, type DashboardData, type DashboardRequest, type DashboardResult, type QueryResult, type QuickFilterKey } from './dashboard-query';

type Money = (amount: number) => string;
const moneyClass = 'font-mono tabular-nums tracking-tight';
const muted = 'text-xs leading-relaxed text-muted-foreground';
const disclosure = 'cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';
const dayLabel = (day: string, locale: CanonicalLocale) => {
  const parsed = parseISO(day);
  if (Number.isNaN(parsed.getTime())) return day;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
};

export function DashboardView({ children, refreshCounter = 0 }: { children?: ReactNode; refreshCounter?: number } = {}) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  const [request, setRequest] = useState<DashboardRequest>(() => ({ range: quickRange('month') }));
  const [settled, setSettled] = useState<DashboardResult | null>(null);
  const [preset, setPreset] = useState<QuickFilterKey | 'custom'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const showValues = useAppStore((state) => state.showValues);
  const toggleShowValues = useAppStore((state) => state.toggleShowValues);

  useEffect(() => {
    void locale;
    return observeQuery(
      (signal) => fetchDashboard(request.range, signal),
      (result) => setSettled({ request, refreshCounter, result }),
    );
  }, [request, refreshCounter, locale]);

  const retry = () => setRequest((current) => ({ range: current.range }));
  const invalidRange = Boolean(from && to && from > to);
  function selectPreset(key: QuickFilterKey) {
    if (preset !== key) {
      setPreset(key);
      setRequest({ range: quickRange(key) });
    }
    setFrom('');
    setTo('');
  }
  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from || !to || invalidRange) return;
    setPreset('custom');
    setRequest({ range: { from, to } });
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t('eyebrow')}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('title')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={toggleShowValues}>
              {showValues ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {showValues ? t('hideValues') : t('showValues')}
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label={t('refreshAriaLabel')} onClick={retry}>
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div role="group" aria-label={t('periodGroupAriaLabel')} className="flex flex-wrap gap-1">
            {QUICK_FILTERS.map(({ key }) => (
              <Button type="button" key={key} size="sm" variant={preset === key ? 'secondary' : 'ghost'} aria-pressed={preset === key} onClick={() => selectPreset(key)}>{t(`filters.${key}`)}</Button>
            ))}
          </div>
          <p className={cn(muted, moneyClass)} aria-live="polite">{t('periodRange', { from: dayLabel(request.range.from, locale), to: dayLabel(request.range.to, locale) })}</p>
        </div>
        <details>
          <summary className={disclosure}>{t('customPeriod.summary')}</summary>
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={applyCustom}>
            <label className={muted}>{t('customPeriod.from')}<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block min-h-9 max-w-full rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" /></label>
            <label className={muted}>{t('customPeriod.to')}<input required type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block min-h-9 max-w-full rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" /></label>
            <Button size="sm" type="submit" disabled={!from || !to || invalidRange}>{t('customPeriod.apply')}</Button>
            {invalidRange && <p role="alert" className="basis-full text-xs text-destructive">{t('customPeriod.invalidRange')}</p>}
          </form>
        </details>
      </header>
      <DashboardContent query={currentDashboardResult(request, settled, refreshCounter)} showValues={showValues} retry={retry} refreshCounter={refreshCounter}>
        {children}
      </DashboardContent>
    </div>
  );
}

export function DashboardContent({ query, showValues, retry, children, refreshCounter = 0 }: { query: QueryResult<DashboardData>; showValues: boolean; retry: () => void; children?: ReactNode; refreshCounter?: number }) {
  const t = useSafeTranslations('dashboard');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const data = query.status === 'ready' ? query.data : null;
  const metrics = data ? dashboardMetrics(data) : null;
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const money: Money = (amount) => showValues ? currencyFmt(amount, locale) : maskedValue;
  return (
    <div className="space-y-[18px]">
      <section aria-label={t('metrics.sectionAriaLabel')} aria-busy={query.status === 'loading'} className="border-y border-border">
        {query.status === 'loading' && <p className="pt-3 text-sm text-muted-foreground" role="status">{t('loading')}</p>}
        {query.status === 'error' && (
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <p className="text-sm text-destructive" role="alert">{t('error')}</p>
            <Button variant="outline" size="sm" onClick={retry}>{t('retry')}</Button>
          </div>
        )}
        <dl className="grid min-w-0 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,.65fr)_minmax(0,.65fr)]">
          <Metric dominant label={t('metrics.totalBalance.label')} caption={t('metrics.totalBalance.caption')} value={data ? money(data.totalBalance) : null} />
          <Metric label={t('metrics.periodBalance.label')} caption={t('metrics.periodBalance.caption')} value={metrics ? money(metrics.net) : null} />
          <Metric label={t('metrics.periodExpense.label')} caption={t('metrics.periodExpense.caption')} value={data ? money(data.monthExpense) : null} />
        </dl>
      </section>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,.8fr)]">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1"><UpcomingBills showValues={showValues} refreshCounter={refreshCounter} /></div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <Panel title={t('flow.title')} caption={t('flow.caption')}>
            {data ? <Flow trend={data.monthlyTrend} showValues={showValues} money={money} /> : <QueryPlaceholder status={query.status} />}
          </Panel>
        </div>
      </div>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.45fr)_minmax(0,.75fr)]">
        <Panel title={t('recentTransactions.title')} caption={t('recentTransactions.caption')}>
          {data ? <RecentTransactions transactions={data.recentTransactions} showValues={showValues} /> : <QueryPlaceholder status={query.status} />}
        </Panel>
        <MonthlyBudgetTracker showValues={showValues} refreshCounter={refreshCounter} />
      </div>
      <details className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
        <summary className={disclosure}>{t('moreDetails')}</summary>
        <div className="mt-5 grid min-w-0 gap-4">
          {data && metrics && <DashboardDetails data={data} metrics={metrics} money={money} showValues={showValues} />}
          <FinancialHealthScore key={`FinancialHealthScore-${refreshCounter}`} showValues={showValues} />
          <FinancialReportsWidget key={`FinancialReportsWidget-${refreshCounter}`} showValues={showValues} />
          <RecurringTransactionsWidget key={`RecurringTransactionsWidget-${refreshCounter}`} showValues={showValues} />
          <BudgetGoalsWidget key={`BudgetGoalsWidget-${refreshCounter}`} showValues={showValues} />
          {children}
        </div>
      </details>
    </div>
  );
}

function Metric({ label, caption, value, dominant = false }: { label: string; caption: string; value: string | null; dominant?: boolean }) {
  return (
    <div className={dominant ? 'min-w-0 py-4 sm:col-span-2 lg:col-span-1 lg:pr-5' : 'min-w-0 border-t border-border py-3 sm:py-4 sm:pl-4 lg:border-t-0 lg:border-l lg:px-5'}>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`${moneyClass} mt-1 font-semibold [overflow-wrap:anywhere] ${dominant ? 'text-4xl sm:text-5xl' : 'text-xl sm:text-2xl'}`}>{value ?? '—'}</dd>
      <dd className={`${muted} mt-1`}>{caption}</dd>
    </div>
  );
}

function Panel({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <section className="h-full min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
      <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
      {caption && <p className={`${muted} mt-1`}>{caption}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function QueryPlaceholder({ status }: { status: QueryResult<DashboardData>['status'] }) {
  const t = useSafeTranslations('dashboard');
  return status === 'loading' ? (
    <div aria-hidden="true" className="h-24 rounded-md bg-muted motion-safe:animate-pulse" />
  ) : <p className={muted}>{t('unavailable')}</p>;
}

function Flow({ trend, showValues, money }: { trend: DashboardData['monthlyTrend']; showValues: boolean; money: Money }) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  if (!trend.length) return <p className={muted}>{t('flow.empty')}</p>;
  if (!showValues) return <p className={cn(muted, 'grid min-h-40 place-items-center rounded-md border border-dashed border-border')}>{t('flow.hidden')}</p>;
  const axisFmt = new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-chart-1" />{t('flow.income')}</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-chart-2" />{t('flow.expense')}</span>
      </div>
      <div className="h-52 min-w-0 sm:h-60">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trend} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(value: number) => axisFmt.format(value)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <Tooltip formatter={(value: number) => currencyFmt(value, locale)} isAnimationActive={false} contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--card-foreground)' }} />
            <Line type="linear" dataKey="income" name={t('flow.income')} stroke="var(--chart-1)" strokeWidth={2} dot={trend.length <= 12} isAnimationActive={false} />
            <Line type="linear" dataKey="expense" name={t('flow.expense')} stroke="var(--chart-2)" strokeDasharray="5 3" strokeWidth={2} dot={trend.length <= 12} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {trend.every(({ income, expense }) => income === 0 && expense === 0) && (
        <p className={muted}>{t('flow.zeroedNote')}</p>
      )}
      <details className="mt-2">
        <summary className={disclosure}>{t('flow.tableSummary')}</summary>
        <div className="mt-2 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b text-muted-foreground"><th scope="col" className="p-2">{t('flow.monthColumn')}</th><th scope="col" className="p-2 text-right">{t('flow.income')}</th><th scope="col" className="p-2 text-right">{t('flow.expense')}</th></tr></thead>
            <tbody>{trend.map(({ month, income, expense }, index) => <tr className="border-b last:border-0" key={`${month}-${index}`}><th scope="row" className="p-2 font-normal">{month}</th><td className={cn(moneyClass, 'p-2 text-right')}>{money(income)}</td><td className={cn(moneyClass, 'p-2 text-right')}>{money(expense)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function RecentTransactions({ transactions, showValues }: { transactions: DashboardData['recentTransactions']; showValues: boolean }) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  if (!transactions.length) return <p className={muted}>{t('recentTransactions.empty')}</p>;
  return (
    <ul className="max-h-80 divide-y divide-border overflow-y-auto">
      {transactions.map((transaction) => {
        const income = transaction.type === 'INCOME';
        const Icon = income ? ArrowUpRight : ArrowDownRight;
        return (
          <FinanceRow
            key={transaction.id}
            variant="compact"
            tone={income ? 'positive' : 'negative'}
            description={transaction.description}
            metadata={`${dayLabel(transaction.date, locale)}${transaction.category ? ` · ${transaction.category.name}` : ''}`}
            amount={transaction.amount}
            showValues={showValues}
            leading={<Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', income ? 'text-(--ds-accent-positive)' : 'text-(--ds-accent-danger)')} />}
          />
        );
      })}
    </ul>
  );
}

function DashboardDetails({ data, metrics, money, showValues }: { data: DashboardData; metrics: ReturnType<typeof dashboardMetrics>; money: Money; showValues: boolean }) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  const pct = (value: number, precision = 0) => showValues ? `${value.toFixed(precision)}%` : '•••';
  const change = (label: string, value?: number) => value === undefined ? null : <span className={muted}> · {label}: {pct(value, 1)}</span>;
  const netStatus = metrics.net >= 0 ? t('details.otherMetrics.surplus') : t('details.otherMetrics.deficit');
  return (
    <>
      <Panel title={t('details.otherMetrics.title')} caption={t('details.otherMetrics.caption')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div><dt>{t('details.otherMetrics.cardBill')}</dt><dd className={moneyClass}>{money(data.totalCardBalance)}</dd><dd className={muted}>{t('details.otherMetrics.cardUsage', { usage: pct(metrics.cardUsage), available: money(metrics.cardAvailable) })}</dd></div>
          <div><dt>{t('details.otherMetrics.accountsMinusBills')}</dt><dd className={moneyClass}>{money(metrics.assetsEstimate)}{change(t('details.variations.net'), metrics.variations?.net)}</dd></div>
          <div><dt>{t('details.otherMetrics.periodIncome')}</dt><dd className={moneyClass}>{money(data.monthIncome)}</dd><dd className={muted}>{netStatus}: {money(Math.abs(metrics.net))} · {t('details.otherMetrics.savingsLabel')}: {pct(metrics.savingsRate)}</dd></div>
          <div><dt>{t('details.otherMetrics.recentPurchasesCount')}</dt><dd>{data.recentPurchases.length}{change(t('details.variations.expense'), metrics.variations?.expense)}</dd></div>
          <div><dt>{t('details.otherMetrics.recentTransactionsCount')}</dt><dd>{data.recentTransactions.length}{change(t('details.variations.volume'), metrics.variations?.volume)}</dd></div>
          <div><dt>{t('details.otherMetrics.dailyAverage')}</dt><dd className={moneyClass}>{money(metrics.daily)}{change(t('details.variations.daily'), metrics.variations?.daily)}</dd><dd className={muted}>{t('details.otherMetrics.dailyAverageCaption')}</dd></div>
        </dl>
        {data.monthlyTrend.length >= 2 && (
          <details className="mt-4">
            <summary className={disclosure}>{t('details.monthlyComparison.summary')}</summary>
            <ul className="mt-2 divide-y divide-border text-xs">{data.monthlyTrend.map((month, index) => {
              const prev = data.monthlyTrend[index - 1];
              const income = prev && prev.income > 0 ? ((month.income - prev.income) / prev.income) * 100 : 0;
              const expense = prev && prev.expense > 0 ? ((month.expense - prev.expense) / prev.expense) * 100 : 0;
              return <li className="flex flex-wrap gap-x-4 gap-y-1 py-2" key={`${month.month}-${index}`}><span>{month.month}</span><span>{t('details.monthlyComparison.income', { value: pct(income) })}</span><span>{t('details.monthlyComparison.expense', { value: pct(expense) })}</span><span>{t('details.monthlyComparison.balance', { value: money(month.income - month.expense) })}</span></li>;
            })}</ul>
          </details>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('details.expenseByCategory.title')} caption={t('details.expenseByCategory.caption')}>
          {data.expenseByCategory.length ? <ul className="divide-y divide-border">{data.expenseByCategory.map((category) => <li key={category.categoryId} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm"><span className="break-words">{category.categoryName}</span><span className={moneyClass}>{money(category.total)}</span></li>)}</ul> : <p className={muted}>{t('details.expenseByCategory.empty')}</p>}
        </Panel>
        <Panel title={t('details.accountBalances.title')} caption={t('details.accountBalances.caption')}>
          {data.accountBalances.length ? <ul className="divide-y divide-border">{data.accountBalances.map((account) => <li key={account.accountId} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm"><span className="break-words">{account.accountName}</span><span className={moneyClass}>{money(account.balance)}</span></li>)}</ul> : <p className={muted}>{t('details.accountBalances.empty')}</p>}
        </Panel>
      </div>
      <Panel title={t('details.recentPurchases.title')} caption={t('details.recentPurchases.caption')}>
        {data.recentPurchases.length ? (
          <ul className="divide-y divide-border">
            {data.recentPurchases.map((purchase) => {
              const itemCountLabel = t.has('details.recentPurchases.itemCount')
                ? t('details.recentPurchases.itemCount', { count: purchase.items.length })
                : `${purchase.items.length} ${purchase.items.length === 1 ? 'item' : 'itens'}`;
              return (
                <li key={purchase.id} className="py-2">
                  <details>
                    <summary className={cn(disclosure, 'group flex list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden')}>
                      <span className="min-w-0 flex-1 basis-36 break-words">{purchase.merchant}<span className={cn('block', muted)}>{formatPurchaseDate(purchase.date, 'date', locale)}{purchase.card && ` · ${purchase.card.name}`} · {itemCountLabel}</span></span>
                      <span className={moneyClass}>{money(purchase.totalAmount)}</span><ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
                    </summary>
                    {purchase.items.length ? <ul className="mt-2 border-l border-border pl-3">{purchase.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-x-3 py-1 text-xs"><span className="break-words">{item.quantity}× {item.name}</span><span className={moneyClass}>{money(item.totalPrice)}</span></li>)}</ul> : <p className={cn(muted, 'mt-2')}>{t('details.recentPurchases.noItems')}</p>}
                  </details>
                </li>
              );
            })}
          </ul>
        ) : <p className={muted}>{t('details.recentPurchases.empty')}</p>}
      </Panel>
    </>
  );
}
