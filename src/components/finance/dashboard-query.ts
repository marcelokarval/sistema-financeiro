import { format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { z } from 'zod';

const amount = z.number().finite();
const dashboardSchema = z.object({
  totalBalance: amount,
  totalCardBalance: amount,
  totalCardLimit: amount,
  monthIncome: amount,
  monthExpense: amount,
  recentTransactions: z.array(z.object({
    id: z.string(), type: z.string(), description: z.string(), date: z.string(), amount,
    category: z.object({ name: z.string() }).nullish(),
  })),
  recentPurchases: z.array(z.object({
    id: z.string(), merchant: z.string(), date: z.string(), totalAmount: amount,
    card: z.object({ name: z.string() }).nullish(),
    items: z.array(z.object({ id: z.string(), name: z.string(), quantity: amount, totalPrice: amount })),
  })),
  expenseByCategory: z.array(z.object({ categoryId: z.string(), categoryName: z.string(), categoryColor: z.string(), total: amount })),
  monthlyTrend: z.array(z.object({ month: z.string(), income: amount, expense: amount })),
  accountBalances: z.array(z.object({ accountId: z.string(), accountName: z.string(), accountColor: z.string(), balance: amount })),
});

export type DashboardData = z.infer<typeof dashboardSchema>;
export type DashboardRange = { from: string; to: string };
export type DashboardRequest = { range: DashboardRange };
export type SettledQuery<T> = { status: 'ready'; data: T } | { status: 'error' };
export type QueryResult<T> = SettledQuery<T> | { status: 'loading' };

export const QUICK_FILTERS = [
  { label: 'Este mês', key: 'month' },
  { label: 'Últimos 3 meses', key: 'quarter' },
  { label: 'Últimos 6 meses', key: 'halfyear' },
  { label: 'Este ano', key: 'year' },
  { label: 'Tudo', key: 'all' },
] as const;
export type QuickFilterKey = typeof QUICK_FILTERS[number]['key'];

export function quickRange(key: QuickFilterKey, now = new Date()): DashboardRange {
  const starts = {
    month: startOfMonth(now),
    quarter: startOfMonth(subMonths(now, 2)),
    halfyear: startOfMonth(subMonths(now, 5)),
    year: startOfYear(now),
    all: new Date(2000, 0, 1),
  };
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: format(starts[key], 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
}

export async function fetchDashboard(range: DashboardRange, signal: AbortSignal, fetcher = fetch): Promise<DashboardData> {
  const params = new URLSearchParams(range);
  const response = await fetcher(`/api/dashboard?${params}`, { signal });
  if (!response.ok) throw new Error(`Resumo indisponível (${response.status})`);
  return dashboardSchema.parse(await response.json());
}

export function observeQuery<T>(load: (signal: AbortSignal) => Promise<T>, publish: (result: SettledQuery<T>) => void) {
  const controller = new AbortController();
  void (async () => {
    let result: SettledQuery<T>;
    try {
      result = { status: 'ready', data: await load(controller.signal) };
    } catch {
      result = { status: 'error' };
    }
    if (!controller.signal.aborted) publish(result);
  })();
  return () => controller.abort();
}

export type DashboardResult = { request: DashboardRequest; refreshCounter: number; result: SettledQuery<DashboardData> };

export function currentDashboardResult(request: DashboardRequest, settled: DashboardResult | null, refreshCounter: number): QueryResult<DashboardData> {
  // Request identity distinguishes retries and A → B → A; the counter distinguishes external refreshes.
  return settled?.request === request && settled.refreshCounter === refreshCounter ? settled.result : { status: 'loading' };
}

export function dashboardMetrics(data: DashboardData, day = new Date().getDate()) {
  const { monthIncome, monthExpense, totalBalance, totalCardBalance, totalCardLimit, monthlyTrend } = data;
  const [previous, current] = monthlyTrend.slice(-2);
  const net = monthIncome - monthExpense;
  const daily = monthExpense / day;
  const base = { net, daily, savingsRate: monthIncome > 0 ? (net / monthIncome) * 100 : 0,
    assetsEstimate: totalBalance - totalCardBalance, cardAvailable: totalCardLimit - totalCardBalance,
    cardUsage: totalCardLimit > 0 ? (totalCardBalance / totalCardLimit) * 100 : 0 };
  if (!previous || !current) return { ...base, variations: null };
  const fromIncome = (difference: number) => previous.income > 0 ? (difference / previous.income) * 100 : 0;
  const volume = previous.income + previous.expense;
  return { ...base, variations: {
    net: fromIncome((current.income - current.expense) - (previous.income - previous.expense)),
    expense: fromIncome(current.expense - previous.expense),
    volume: previous.income > 0 ? ((current.income + current.expense - volume) / volume) * 100 : 0,
    daily: previous.expense > 0 ? ((current.expense / Math.max(day, 1) - previous.expense / 30) / (previous.expense / 30)) * 100 : 0,
  } };
}
