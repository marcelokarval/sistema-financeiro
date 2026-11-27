'use client';

import { useEffect, useState } from 'react';
import { Building2, CalendarClock, CreditCard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTL_LOCALE } from '@/i18n/config';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { observeQuery, type QueryResult, type SettledQuery } from './dashboard-query';

interface Bill {
  id: string;
  type: 'installment' | 'consortium' | 'card' | 'recurring';
  title: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  status: 'overdue' | 'urgent' | 'upcoming' | 'later';
  source: string;
}

interface UpcomingBillsData {
  bills: Bill[];
  summary: { thisWeek: { count: number; amount: number }; thisMonth: { count: number; amount: number }; totalAmount: number };
}

const icons = { installment: CalendarClock, consortium: Building2, card: CreditCard, recurring: RefreshCw };
const smallText = 'text-xs leading-relaxed text-muted-foreground';
const moneyClass = 'font-mono tabular-nums tracking-tight';
const disclosure = 'cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';

function isBillInReferenceMonth(dueDate: string, referenceDate: Date): boolean {
  const civilMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate.trim());
  if (civilMatch) {
    const year = Number(civilMatch[1]);
    const month = Number(civilMatch[2]) - 1;
    return year === referenceDate.getFullYear() && month === referenceDate.getMonth();
  }
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === referenceDate.getFullYear() && parsed.getMonth() === referenceDate.getMonth();
}

export function UpcomingBills({ showValues = true, refreshCounter = 0 }: { showValues?: boolean; refreshCounter?: number } = {}) {
  const locale = useSafeLocale();
  const [request, setRequest] = useState(0);
  const key = `${request}-${refreshCounter}-${locale}`;
  const [settled, setSettled] = useState<{ key: string; result: SettledQuery<UpcomingBillsData> } | null>(null);
  const query = settled?.key === key ? settled.result : { status: 'loading' as const };
  const refresh = () => setRequest((current) => current + 1);

  useEffect(() => observeQuery(async (signal) => {
    const response = await fetch('/api/upcoming-bills', { signal });
    if (!response.ok) throw new Error(`Upcoming bills unavailable (${response.status})`);
    const data: UpcomingBillsData = await response.json();
    if (!Array.isArray(data?.bills) || !data.summary) throw new Error('Invalid upcoming bills data');
    return data;
  }, (result) => setSettled({ key, result })), [key]);

  return <UpcomingBillsPanel query={query} refresh={refresh} showValues={showValues} />;
}

export function UpcomingBillsPanel({
  query,
  refresh,
  showValues,
  referenceDate = new Date(),
}: {
  query: QueryResult<UpcomingBillsData>;
  refresh: () => void;
  showValues: boolean;
  referenceDate?: Date;
}) {
  const t = useSafeTranslations('dashboard');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const money = (value: number) => showValues ? currencyFmt(value, locale) : maskedValue;
  const bills = query.status === 'ready' ? query.data.bills : [];
  const groups = [
    { key: 'overdue', label: t('upcomingBills.groups.overdue'), bills: bills.filter((bill) => bill.status === 'overdue') },
    { key: 'urgent', label: t('upcomingBills.groups.urgent'), bills: bills.filter((bill) => bill.status === 'urgent') },
    {
      key: 'thisMonth',
      label: t('upcomingBills.groups.thisMonth'),
      bills: bills.filter((bill) => bill.status !== 'overdue' && isBillInReferenceMonth(bill.dueDate, referenceDate)),
    },
  ];

  return (
    <section aria-label={t('upcomingBills.title')} className="h-full min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">{t('upcomingBills.title')}</h2>
          <p className={cn(smallText, 'mt-1')}>{t('upcomingBills.subtitle')}</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label={t('upcomingBills.refreshAriaLabel')} onClick={refresh}><RefreshCw aria-hidden="true" /></Button>
      </div>
      {query.status === 'loading' && <p role="status" className={cn(smallText, 'mt-4')}>{t('upcomingBills.loading')}</p>}
      {query.status === 'error' && <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-destructive">{t('upcomingBills.error')}</p><Button size="sm" variant="outline" onClick={refresh}>{t('retry')}</Button></div>}
      {query.status === 'ready' && (
        <>
          {query.data.bills.length === 0 ? <p className={cn(smallText, 'mt-4')}>{t('upcomingBills.empty')}</p> : (
            <BillList bills={query.data.bills} money={money} />
          )}
          {groups.filter((group) => group.bills.length > 0).map((group) => (
            <details key={group.key} className="mt-2 border-t border-border pt-2">
              <summary className={cn(disclosure, 'flex flex-wrap items-baseline justify-between gap-x-2')}>
                <span>{group.label} ({group.bills.length})</span>
                <span className={moneyClass}>{money(group.bills.reduce((sum, bill) => sum + bill.amount, 0))}</span>
              </summary>
              <BillList bills={group.bills} money={money} />
            </details>
          ))}
          <details className="mt-3 border-t border-border pt-3">
            <summary className={disclosure}>{t('upcomingBills.totals.summary')}</summary>
            <dl className="mt-2 grid gap-2 text-xs">
              {([
                ['thisWeek', t('upcomingBills.totals.thisWeek'), query.data.summary.thisWeek],
                ['thisMonth', t('upcomingBills.totals.thisMonth'), query.data.summary.thisMonth],
                ['next30Days', t('upcomingBills.totals.next30Days'), { count: query.data.bills.length, amount: query.data.summary.totalAmount }],
              ] as const).map(([key, label, total]) => (
                <div key={key} className="flex flex-wrap justify-between gap-x-2">
                  <dt className={smallText}>{label} ({total.count})</dt>
                  <dd className={moneyClass}>{money(total.amount)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </section>
  );
}

function BillList({ bills, money }: { bills: Bill[]; money: (amount: number) => string }) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  const billDateFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: '2-digit', month: 'short' });
  const dayLabel = (days: number) => {
    if (days < 0) return t('upcomingBills.days.overdue', { count: Math.abs(days) });
    if (days === 0) return t('upcomingBills.days.today');
    if (days === 1) return t('upcomingBills.days.tomorrow');
    return t('upcomingBills.days.inDays', { count: days });
  };

  return (
    <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto">
      {bills.map((bill) => {
        const Icon = icons[bill.type] ?? CalendarClock;
        const state = bill.status === 'overdue' ? 'text-destructive' : bill.status === 'urgent' ? 'text-[var(--ds-accent-warning)]' : 'text-muted-foreground';
        return (
          <li key={bill.id} className="flex flex-wrap items-start gap-x-2 gap-y-1 py-2.5">
            <div className="flex min-w-0 flex-1 basis-32 items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{bill.title}</p>
                <p className={smallText}>{bill.source} · {billDateFmt.format(new Date(bill.dueDate))}</p>
                <p className={cn('text-xs', state)}>{dayLabel(bill.daysUntilDue)}</p>
              </div>
            </div>
            <p className={cn(moneyClass, 'ml-auto text-sm')}>{money(bill.amount)}</p>
          </li>
        );
      })}
    </ul>
  );
}
