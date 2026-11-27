'use client';

import type { ReactNode } from 'react';
import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Percent,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, numberFmt, percentFmt, rateFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  DEBT_INSTALLMENT_TYPE_KEYS,
  DEBT_RATIO_CONFIG,
  DEBT_STATUS_BADGE_CONFIG,
  PIE_COLORS,
} from './analytics-i18n';

export { PIE_COLORS };

export interface CardDebt {
  id: string; name: string; brand: string; lastFourDigits: string;
  creditLimit: number; currentBalance: number; utilizationRate: number; color: string; dueDay: number;
}

export interface InstallmentDebt {
  id: string; description: string; totalAmount: number; paidAmount: number; remaining: number;
  installmentCount: number; paidInstallments: number; monthlyValue: number; interestRate: number;
  type: string; status: string; cardName: string | null; nextPaymentDate: string | null;
}

export interface ConsortiumDebt {
  id: string; description: string; group: string; quota: string; administrator: string;
  totalAmount: number; fundedAmount: number; remaining: number; monthlyPayment: number;
  installmentCount: number; paidInstallments: number; startDate: string; endDate: string | null;
  status: string; progress: number;
}

export interface DebtsData {
  totalDebt: number; cardDebt: number; installmentDebt: number; consortiumDebt: number;
  debtToIncomeRatio: number; monthlyIncome: number;
  cards: CardDebt[]; installments: InstallmentDebt[]; consortiums: ConsortiumDebt[];
}

export type DebtSectionType = 'cards' | 'installments' | 'consortiums';

function useMaskedValue(): string {
  const tShared = useSafeTranslations('shared');
  return tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
}

function DebtStatusBadge({ status }: { status: string }) {
  const t = useSafeTranslations('analytics');
  const c = DEBT_STATUS_BADGE_CONFIG[status] || DEBT_STATUS_BADGE_CONFIG.ACTIVE;
  return <Badge className={cn('text-xs px-2 py-0 border', c.className)}>{t(`debts.status.${c.labelKey}`)}</Badge>;
}

/** Recharts tooltip adapter for debt composition chart using FinanceChartTooltip. */
export function DebtChartTooltip({
  active,
  payload,
  showValues = true,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; payload?: { fill?: string } }>;
  showValues?: boolean;
}) {
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry, idx) => {
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !entry?.name) {
      return [];
    }
    return [{
      key: `${entry.name}-${idx}`,
      label: entry.name,
      value: currencyFmt(entry.value, locale),
      color: entry.payload?.fill,
    }];
  });

  if (rows.length === 0) return null;

  return <FinanceChartTooltip active={active} rows={rows} showValues={showValues} />;
}

/** Toggleable category button for debt composition list. */
export function DebtTypeToggleButton({
  label,
  count,
  amount,
  expanded,
  ringClass,
  onClick,
  showValues = true,
}: {
  label: string;
  count: number;
  amount: number;
  expanded: boolean;
  ringClass: string;
  onClick: () => void;
  showValues?: boolean;
}) {
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-disabled={count === 0}
        onClick={() => count > 0 && onClick()}
        className={cn(
          'grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-x-2 px-2 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
          expanded && ringClass,
        )}
      >
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {count}
            </Badge>
            {count > 0 && (
              expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        <p className="col-start-1 row-start-1 text-sm font-medium">{label}</p>
        <p className="col-span-2 text-sm font-mono font-semibold tabular-nums">
          {showValues ? currencyFmt(amount, locale) : maskedValue}
        </p>
      </button>
    </div>
  );
}

/** Debt-to-income ratio summary card with threshold markers and FinanceProgress. */
export function DebtIncomeRatioCard({
  ratio,
  monthlyIncome,
  showValues = true,
}: {
  ratio: number;
  monthlyIncome: number;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const ratioLevel = ratio > 30 ? 'critical' : ratio > 15 ? 'warning' : 'healthy';
  const currentRatio = DEBT_RATIO_CONFIG[ratioLevel];
  const clampedRatio = Math.min(Math.max(ratio, 0), 100);
  const ratioText = showValues ? percentFmt(ratio, locale, { signed: false }) : '•••';

  return (
    <div className={cn('rounded-lg border p-4', currentRatio.bgClass)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', currentRatio.iconBg)}>
          <Percent className="w-5 h-5" style={{ color: currentRatio.barColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className={cn('text-sm font-semibold', currentRatio.textClass)}>
              {t('debts.ratio.title')}
            </p>
            <Badge className={cn('text-xs px-2 py-0 border', currentRatio.bgClass, currentRatio.textClass)}>
              {t(`debts.ratio.${currentRatio.labelKey}`)}
            </Badge>
          </div>
          <p className={cn('text-xs leading-relaxed mb-3', currentRatio.textClass)}>
            {t(`debts.ratio.${currentRatio.recommendationKey}`)}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t('debts.ratio.subtitle')}
              </span>
              <span className={cn('font-mono text-xs font-semibold tabular-nums', currentRatio.textClass)}>
                {ratioText}
              </span>
            </div>
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--money)]/40 z-10"
                style={{ left: '15%' }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--debt)]/40 z-10"
                style={{ left: '30%' }}
              />
              <FinanceProgress
                label={t('debts.ratio.subtitle')}
                ariaLabel={t('debts.ratio.ariaLabel')}
                value={Math.round(clampedRatio)}
                min={0}
                max={100}
                unit="%"
                displayValue={ratioText}
                valueText={ratioText}
                showHeader={false}
                trackClassName={cn('h-3 bg-muted', currentRatio.indicatorClass)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{showValues ? '0%' : '•••'}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--money)] font-medium">{showValues ? '15%' : '•••'}</span>
                <span className="text-xs text-[var(--debt)] font-medium">{showValues ? '30%' : '•••'}</span>
              </div>
              <span className="text-xs text-muted-foreground">{showValues ? '100%' : '•••'}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t('debts.ratio.monthlyIncome')}</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {showValues ? currencyFmt(monthlyIncome, locale) : maskedValue}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebtSectionShell({
  icon, title, countLabel, amount, amountClass, showValues = true, children,
}: {
  icon: ReactNode; title: string; countLabel: string; amount: number; amountClass: string; showValues?: boolean; children: ReactNode;
}) {
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  return (
    <div className="overflow-hidden">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {icon}
          <span className="text-xs font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{countLabel}</Badge>
          <Badge className={cn('font-mono text-xs tabular-nums px-2 py-0 border', amountClass)}>
            {showValues ? currencyFmt(amount, locale) : maskedValue}
          </Badge>
        </div>
        <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function DebtCardRow({ card, showValues = true }: { card: CardDebt; showValues?: boolean }) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const clampedUtilization = Math.round(Math.min(100, Math.max(0, card.utilizationRate)));
  const indicatorClass = card.utilizationRate > 80
    ? '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-4)]'
    : card.utilizationRate > 50
      ? '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-2)]'
      : '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-1)]';

  return (
    <div className="px-4 py-3 hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{card.name}</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">{card.brand}</Badge>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">****{card.lastFourDigits}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs tabular-nums text-[var(--debt)] font-semibold">{showValues ? currencyFmt(card.currentBalance, locale) : maskedValue}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{t('debts.cardRow.limit', { amount: showValues ? currencyFmt(card.creditLimit, locale) : maskedValue })}</span>
            <span className="text-xs text-muted-foreground">{t('debts.cardRow.dueDay', { day: card.dueDay })}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <FinanceProgress
              label={t('debts.cardRow.limitUsageAria', { name: card.name })}
              ariaLabel={t('debts.cardRow.limitUsageAria', { name: card.name })}
              value={clampedUtilization}
              valueText={showValues ? undefined : '•••'}
              showHeader={false}
              className="flex-1 max-w-[120px]"
              trackClassName={cn('h-1.5 bg-muted', indicatorClass)}
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{t('debts.cardRow.usedPct', { pct: showValues ? numberFmt(card.utilizationRate, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '•••' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebtPlanRow({
  description, status, badgeLabel, remaining, paidInstallments,
  installmentCount, monthlyValue, extraMeta, progressLabel, progressValue, showValues = true,
}: {
  description: string; status: string; badgeLabel?: string; remaining: number; paidInstallments: number;
  installmentCount: number; monthlyValue: number; extraMeta?: string; progressLabel: string; progressValue: number; showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  return (
    <div className="px-4 py-3 hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full shrink-0 bg-[var(--obligation)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{description}</span>
            {badgeLabel && <Badge variant="outline" className="text-xs px-1.5 py-0">{badgeLabel}</Badge>}
            <DebtStatusBadge status={status} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs tabular-nums text-[var(--obligation)] font-semibold">
              {t('debts.planRow.remaining', { amount: money(remaining) })}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('debts.planRow.installmentsCount', { paid: paidInstallments, total: installmentCount })}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('debts.planRow.perMonth', { amount: money(monthlyValue) })}
            </span>
            {extraMeta && <span className="font-mono text-xs tabular-nums text-muted-foreground">{extraMeta}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <FinanceProgress
              label={progressLabel}
              ariaLabel={progressLabel}
              value={progressValue}
              valueText={showValues ? undefined : '•••'}
              showHeader={false}
              className="flex-1 max-w-[160px]"
              trackClassName="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-[var(--obligation)]"
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{t('debts.planRow.paidPct', { pct: showValues ? progressValue : '•••' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Expanded domain detail list for the selected debt category. */
export function DebtExpandedSection({
  expandedType,
  data,
  showValues = true,
}: {
  expandedType: string | null;
  data: DebtsData;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const resolveTypeLabel = (type: string) => {
    const key = DEBT_INSTALLMENT_TYPE_KEYS[type];
    return key ? t(`debts.types.${key}`) : type;
  };

  if (expandedType === 'cards' && data.cards.length > 0) {
    return (
      <DebtSectionShell
        icon={<CreditCard className="w-4 h-4 text-[var(--debt)]" />}
        title={t('debts.categories.cards')}
        countLabel={t('debts.counts.cards', { count: data.cards.length })}
        amount={data.cardDebt}
        amountClass="bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20"
        showValues={showValues}
      >
        {data.cards.map((card) => (
          <DebtCardRow key={card.id} card={card} showValues={showValues} />
        ))}
      </DebtSectionShell>
    );
  }

  if (expandedType === 'installments' && data.installments.length > 0) {
    return (
      <DebtSectionShell
        icon={<CalendarClock className="w-4 h-4 text-[var(--obligation)]" />}
        title={t('debts.categories.installments')}
        countLabel={t('debts.counts.plans', { count: data.installments.length })}
        amount={data.installmentDebt}
        amountClass="bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20"
        showValues={showValues}
      >
        {data.installments.map((ip) => (
          <DebtPlanRow
            key={ip.id}
            description={ip.description}
            status={ip.status}
            badgeLabel={resolveTypeLabel(ip.type)}
            remaining={ip.remaining}
            paidInstallments={ip.paidInstallments}
            installmentCount={ip.installmentCount}
            monthlyValue={ip.monthlyValue}
            extraMeta={ip.interestRate > 0 ? t('debts.planRow.interestRate', { rate: showValues ? rateFmt(ip.interestRate, locale) : '•••' }) : undefined}
            progressLabel={t('debts.planRow.installmentProgressAria', { description: ip.description })}
            progressValue={ip.installmentCount > 0 ? Math.round((ip.paidInstallments / ip.installmentCount) * 100) : 0}
            showValues={showValues}
          />
        ))}
      </DebtSectionShell>
    );
  }

  if (expandedType === 'consortiums' && data.consortiums.length > 0) {
    return (
      <DebtSectionShell
        icon={<Building2 className="w-4 h-4 text-[var(--obligation)]" />}
        title={t('debts.categories.consortiums')}
        countLabel={t('debts.counts.consortiums', { count: data.consortiums.length })}
        amount={data.consortiumDebt}
        amountClass="bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20"
        showValues={showValues}
      >
        {data.consortiums.map((c) => (
          <DebtPlanRow
            key={c.id}
            description={c.description}
            status={c.status}
            remaining={c.remaining}
            paidInstallments={c.paidInstallments}
            installmentCount={c.installmentCount}
            monthlyValue={c.monthlyPayment}
            extraMeta={c.administrator ? t('debts.planRow.administrator', { name: c.administrator }) : undefined}
            progressLabel={t('debts.planRow.consortiumProgressAria', { description: c.description })}
            progressValue={Math.round(Math.min(100, Math.max(0, c.progress)))}
            showValues={showValues}
          />
        ))}
      </DebtSectionShell>
    );
  }

  return null;
}
