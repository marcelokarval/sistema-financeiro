'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
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
const dayLabel = (day: string) => format(parseISO(day), 'dd/MM/yyyy');
const axisFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function DashboardView({ children, refreshCounter = 0 }: { children?: ReactNode; refreshCounter?: number } = {}) {
  const [request, setRequest] = useState<DashboardRequest>(() => ({ range: quickRange('month') }));
  const [settled, setSettled] = useState<DashboardResult | null>(null);
  const [preset, setPreset] = useState<QuickFilterKey | 'custom'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showValues, setShowValues] = useState(true);

  useEffect(() => observeQuery(
    (signal) => fetchDashboard(request.range, signal),
    (result) => setSettled({ request, refreshCounter, result }),
  ), [request, refreshCounter]);

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
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Posição financeira</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Resumo financeiro</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowValues((visible) => !visible)}>
              {showValues ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {showValues ? 'Ocultar valores' : 'Mostrar valores'}
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Atualizar resumo" onClick={retry}>
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div role="group" aria-label="Período do resumo" className="flex flex-wrap gap-1">
            {QUICK_FILTERS.map(({ label, key }) => (
              <Button type="button" key={key} size="sm" variant={preset === key ? 'secondary' : 'ghost'} aria-pressed={preset === key} onClick={() => selectPreset(key)}>{label}</Button>
            ))}
          </div>
          <p className={`${muted} ${moneyClass}`} aria-live="polite">Período: {dayLabel(request.range.from)} a {dayLabel(request.range.to)}</p>
        </div>
        <details>
          <summary className={disclosure}>Período personalizado</summary>
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={applyCustom}>
            <label className={muted}>De<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block min-h-9 max-w-full rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" /></label>
            <label className={muted}>Até<input required type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block min-h-9 max-w-full rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" /></label>
            <Button size="sm" type="submit" disabled={!from || !to || invalidRange}>Filtrar</Button>
            {invalidRange && <p role="alert" className="basis-full text-xs text-destructive">A data final não pode ser anterior à inicial.</p>}
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
  const data = query.status === 'ready' ? query.data : null;
  const metrics = data ? dashboardMetrics(data) : null;
  const money: Money = (amount) => showValues ? currencyFmt(amount) : 'R$ ••••••';
  return (
    <div className="space-y-[18px]">
      <section aria-label="Indicadores principais" aria-busy={query.status === 'loading'} className="border-y border-border">
        {query.status === 'loading' && <p className="pt-3 text-sm text-muted-foreground" role="status">Carregando resumo…</p>}
        {query.status === 'error' && (
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <p className="text-sm text-destructive" role="alert">Não foi possível carregar o resumo.</p>
            <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>
          </div>
        )}
        <dl className="grid min-w-0 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,.65fr)_minmax(0,.65fr)]">
          <Metric dominant label="Saldo em contas" caption="Posição atual · contas ativas" value={data ? money(data.totalBalance) : null} />
          <Metric label="Saldo do período" caption="Entradas menos saídas no intervalo" value={metrics ? money(metrics.net) : null} />
          <Metric label="Despesas do período" caption="Transações de saída e compras" value={data ? money(data.monthExpense) : null} />
        </dl>
      </section>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,.8fr)]">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1"><UpcomingBills showValues={showValues} refreshCounter={refreshCounter} /></div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <Panel title="Entradas e saídas" caption="Agregação mensal da API, desde o início do primeiro mês até a data final do período.">
            {data ? <Flow trend={data.monthlyTrend} showValues={showValues} money={money} /> : <QueryPlaceholder status={query.status} />}
          </Panel>
        </div>
      </div>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.45fr)_minmax(0,.75fr)]">
        <Panel title="Atividade recente" caption="Últimas transações do período selecionado.">
          {data ? <RecentTransactions transactions={data.recentTransactions} money={money} /> : <QueryPlaceholder status={query.status} />}
        </Panel>
        <MonthlyBudgetTracker showValues={showValues} refreshCounter={refreshCounter} />
      </div>
      <details className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
        <summary className={disclosure}>Mais detalhes financeiros</summary>
        <div className="mt-5 grid min-w-0 gap-4">
          {data && metrics && <DashboardDetails data={data} metrics={metrics} money={money} showValues={showValues} />}
          <FinancialHealthScore key={`FinancialHealthScore-${refreshCounter}`} />
          <FinancialReportsWidget key={`FinancialReportsWidget-${refreshCounter}`} />
          <RecurringTransactionsWidget key={`RecurringTransactionsWidget-${refreshCounter}`} />
          <BudgetGoalsWidget key={`BudgetGoalsWidget-${refreshCounter}`} />
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
  return status === 'loading' ? (
    <div aria-hidden="true" className="h-24 rounded-md bg-muted motion-safe:animate-pulse" />
  ) : <p className={muted}>Dados do resumo indisponíveis.</p>;
}

function Flow({ trend, showValues, money }: { trend: DashboardData['monthlyTrend']; showValues: boolean; money: Money }) {
  if (!trend.length) return <p className={muted}>Sem dados para a série mensal.</p>;
  if (!showValues) return <p className={`${muted} grid min-h-40 place-items-center rounded-md border border-dashed border-border`}>Série oculta enquanto os valores estão ocultos.</p>;
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-chart-1" />Entradas</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-chart-2" />Saídas</span>
      </div>
      <div className="h-52 min-w-0 sm:h-60">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trend} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(value: number) => axisFmt.format(value)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <Tooltip formatter={(value: number) => currencyFmt(value)} isAnimationActive={false} contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--card-foreground)' }} />
            <Line type="linear" dataKey="income" name="Entradas" stroke="var(--chart-1)" strokeWidth={2} dot={trend.length <= 12} isAnimationActive={false} />
            <Line type="linear" dataKey="expense" name="Saídas" stroke="var(--chart-2)" strokeDasharray="5 3" strokeWidth={2} dot={trend.length <= 12} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {trend.every(({ income, expense }) => income === 0 && expense === 0) && (
        <p className={muted}>Totais zerados podem indicar ausência de lançamentos ou valores que somaram zero.</p>
      )}
      <details className="mt-2">
        <summary className={disclosure}>Valores por mês</summary>
        <div className="mt-2 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b text-muted-foreground"><th scope="col" className="p-2">Mês</th><th scope="col" className="p-2 text-right">Entradas</th><th scope="col" className="p-2 text-right">Saídas</th></tr></thead>
            <tbody>{trend.map(({ month, income, expense }, index) => <tr className="border-b last:border-0" key={`${month}-${index}`}><th scope="row" className="p-2 font-normal">{month}</th><td className={`${moneyClass} p-2 text-right`}>{money(income)}</td><td className={`${moneyClass} p-2 text-right`}>{money(expense)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function RecentTransactions({ transactions, money }: { transactions: DashboardData['recentTransactions']; money: Money }) {
  if (!transactions.length) return <p className={muted}>Nenhuma transação no período.</p>;
  return (
    <ul className="max-h-80 divide-y divide-border overflow-y-auto">
      {transactions.map((transaction) => {
        const income = transaction.type === 'INCOME';
        const Icon = income ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
            <div className="flex min-w-0 flex-1 basis-40 items-start gap-2">
              <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${income ? 'text-(--ds-accent-positive)' : 'text-(--ds-accent-danger)'}`} />
              <div className="min-w-0"><p className="break-words text-sm font-medium">{transaction.description}</p><p className={muted}>{dayLabel(transaction.date)}{transaction.category && ` · ${transaction.category.name}`}</p></div>
            </div>
            <span className={`${moneyClass} ml-auto text-sm font-medium ${income ? 'text-(--ds-accent-positive)' : 'text-(--ds-accent-danger)'}`}>{income ? '+' : '−'}{money(transaction.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function DashboardDetails({ data, metrics, money, showValues }: { data: DashboardData; metrics: ReturnType<typeof dashboardMetrics>; money: Money; showValues: boolean }) {
  const pct = (value: number, precision = 0) => showValues ? `${value.toFixed(precision)}%` : '•••';
  const change = (label: string, value?: number) => value === undefined ? null : <span className={muted}> · {label}: {pct(value, 1)}</span>;
  return (
    <>
      <Panel title="Outros indicadores do resumo" caption="Posição atual de contas e cartões; totais e atividade do período selecionado.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div><dt>Fatura dos cartões</dt><dd className={moneyClass}>{money(data.totalCardBalance)}</dd><dd className={muted}>Limite usado: {pct(metrics.cardUsage)} · Disponível: {money(metrics.cardAvailable)}</dd></div>
          <div><dt>Contas menos faturas</dt><dd className={moneyClass}>{money(metrics.assetsEstimate)}{change('Variação do saldo mensal', metrics.variations?.net)}</dd></div>
          <div><dt>Entradas do período</dt><dd className={moneyClass}>{money(data.monthIncome)}</dd><dd className={muted}>{metrics.net >= 0 ? 'Superávit' : 'Déficit'}: {money(Math.abs(metrics.net))} · Poupança: {pct(metrics.savingsRate)}</dd></div>
          <div><dt>Compras recentes do período</dt><dd>{data.recentPurchases.length}{change('Variação dos gastos mensais', metrics.variations?.expense)}</dd></div>
          <div><dt>Transações recentes do período</dt><dd>{data.recentTransactions.length}{change('Variação do volume financeiro mensal', metrics.variations?.volume)}</dd></div>
          <div><dt>Gasto médio por dia</dt><dd className={moneyClass}>{money(metrics.daily)}{change('Variação do gasto médio diário', metrics.variations?.daily)}</dd><dd className={muted}>Total do período dividido pelo dia corrente do mês.</dd></div>
        </dl>
        {data.monthlyTrend.length >= 2 && (
          <details className="mt-4">
            <summary className={disclosure}>Comparativo mensal</summary>
            <ul className="mt-2 divide-y divide-border text-xs">{data.monthlyTrend.map((month, index) => {
              const prev = data.monthlyTrend[index - 1];
              const income = prev && prev.income > 0 ? ((month.income - prev.income) / prev.income) * 100 : 0;
              const expense = prev && prev.expense > 0 ? ((month.expense - prev.expense) / prev.expense) * 100 : 0;
              return <li className="flex flex-wrap gap-x-4 gap-y-1 py-2" key={`${month.month}-${index}`}><span>{month.month}</span><span>Entradas: {pct(income)}</span><span>Saídas: {pct(expense)}</span><span>Saldo: {money(month.income - month.expense)}</span></li>;
            })}</ul>
          </details>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Despesas por categoria" caption="Período selecionado · transações de saída e compras com categoria.">
          {data.expenseByCategory.length ? <ul className="divide-y divide-border">{data.expenseByCategory.map((category) => <li key={category.categoryId} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm"><span className="break-words">{category.categoryName}</span><span className={moneyClass}>{money(category.total)}</span></li>)}</ul> : <p className={muted}>Nenhuma despesa categorizada no período.</p>}
        </Panel>
        <Panel title="Distribuição por conta" caption="Posição atual · contas ativas.">
          {data.accountBalances.length ? <ul className="divide-y divide-border">{data.accountBalances.map((account) => <li key={account.accountId} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm"><span className="break-words">{account.accountName}</span><span className={moneyClass}>{money(account.balance)}</span></li>)}</ul> : <p className={muted}>Nenhuma conta ativa.</p>}
        </Panel>
      </div>
      <Panel title="Compras recentes" caption="Período selecionado. Abra uma compra para ler seus itens.">
        {data.recentPurchases.length ? (
          <ul className="divide-y divide-border">
            {data.recentPurchases.map((purchase) => (
              <li key={purchase.id} className="py-2">
                <details>
                  <summary className={`${disclosure} group flex list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden`}>
                    <span className="min-w-0 flex-1 basis-36 break-words">{purchase.merchant}<span className={`block ${muted}`}>{formatPurchaseDate(purchase.date)}{purchase.card && ` · ${purchase.card.name}`} · {purchase.items.length} itens</span></span>
                    <span className={moneyClass}>{money(purchase.totalAmount)}</span><ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
                  </summary>
                  {purchase.items.length ? <ul className="mt-2 border-l border-border pl-3">{purchase.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-x-3 py-1 text-xs"><span className="break-words">{item.quantity}× {item.name}</span><span className={moneyClass}>{money(item.totalPrice)}</span></li>)}</ul> : <p className={`${muted} mt-2`}>Nenhum item cadastrado.</p>}
                </details>
              </li>
            ))}
          </ul>
        ) : <p className={muted}>Nenhuma compra no período.</p>}
      </Panel>
    </>
  );
}
