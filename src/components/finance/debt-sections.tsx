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
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';

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

export const PIE_COLORS = ['var(--ds-chart-4)', 'var(--ds-chart-3)', 'var(--ds-chart-2)'];

const TYPE_LABELS: Record<string, string> = {
  FINANCING: 'Financiamento',
  CARD_INSTALLMENT: 'Parcelamento Cartão',
  LOAN: 'Empréstimo',
  PERSONAL: 'Empréstimo Pessoal',
  RENTAL: 'Aluguel',
};

const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativo', className: 'bg-[var(--money)]/10 text-[var(--money)] border-[var(--money)]/20' },
  OVERDUE: { label: 'Atrasado', className: 'bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20' },
  COMPLETED: { label: 'Concluído', className: 'bg-[var(--primary)]/10 text-primary border-[var(--primary)]/20' },
  CONTEMPLATED: { label: 'Contemplado', className: 'bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20' },
};

const RATIO_CONFIG = {
  critical: {
    barColor: 'var(--ds-chart-4)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-4)]',
    bgClass: 'bg-[var(--debt)]/5 border-[var(--debt)]/20',
    textClass: 'text-[var(--debt)]',
    iconBg: 'bg-[var(--debt)]/10',
    label: 'Crítico',
    recommendation:
      'Suas dívidas comprometem mais de 30% da sua renda. Considere renegociar taxas, priorizar a quitação de cartões e evitar novas dívidas.',
  },
  warning: {
    barColor: 'var(--ds-chart-2)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-2)]',
    bgClass: 'bg-[var(--obligation)]/5 border-[var(--obligation)]/20',
    textClass: 'text-[var(--obligation)]',
    iconBg: 'bg-[var(--obligation)]/10',
    label: 'Atenção',
    recommendation:
      'Suas dívidas estão entre 15% e 30% da sua renda. Mantenha o controle, evite novas aquisições e priorize o pagamento antecipado.',
  },
  healthy: {
    barColor: 'var(--ds-chart-1)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-1)]',
    bgClass: 'bg-[var(--money)]/5 border-[var(--money)]/20',
    textClass: 'text-[var(--money)]',
    iconBg: 'bg-[var(--money)]/10',
    label: 'Saudável',
    recommendation:
      'Ótimo! Suas dívidas estão abaixo de 15% da sua renda. Continue com esse controle financeiro e mantenha o equilíbrio.',
  },
} as const;

function typeLabel(type: string) {
  return TYPE_LABELS[type] || type;
}

function DebtStatusBadge({ status }: { status: string }) {
  const c = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.ACTIVE;
  return <Badge className={cn('text-xs px-2 py-0 border', c.className)}>{c.label}</Badge>;
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
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry, idx) => {
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !entry?.name) {
      return [];
    }
    return [{
      key: `${entry.name}-${idx}`,
      label: entry.name,
      value: currencyFmt(entry.value),
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
}: {
  label: string;
  count: number;
  amount: number;
  expanded: boolean;
  ringClass: string;
  onClick: () => void;
}) {
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
          {currencyFmt(amount)}
        </p>
      </button>
    </div>
  );
}

/** Debt-to-income ratio summary card with threshold markers and FinanceProgress. */
export function DebtIncomeRatioCard({
  ratio,
  monthlyIncome,
}: {
  ratio: number;
  monthlyIncome: number;
}) {
  const ratioLevel = ratio > 30 ? 'critical' : ratio > 15 ? 'warning' : 'healthy';
  const currentRatio = RATIO_CONFIG[ratioLevel];
  const clampedRatio = Math.min(Math.max(ratio, 0), 100);

  return (
    <div className={cn('rounded-lg border p-4', currentRatio.bgClass)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', currentRatio.iconBg)}>
          <Percent className="w-5 h-5" style={{ color: currentRatio.barColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className={cn('text-sm font-semibold', currentRatio.textClass)}>
              Comprometimento de Renda
            </p>
            <Badge className={cn('text-xs px-2 py-0 border', currentRatio.bgClass, currentRatio.textClass)}>
              {currentRatio.label}
            </Badge>
          </div>
          <p className={cn('text-xs leading-relaxed mb-3', currentRatio.textClass)}>
            {currentRatio.recommendation}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Endividamento / Renda mensal
              </span>
              <span className={cn('font-mono text-xs font-semibold tabular-nums', currentRatio.textClass)}>
                {ratio.toFixed(1)}%
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
                label="Endividamento / Renda mensal"
                ariaLabel="Comprometimento de renda com dívidas"
                value={Math.round(clampedRatio)}
                min={0}
                max={100}
                unit="%"
                displayValue={`${ratio.toFixed(1)}%`}
                valueText={`${ratio.toFixed(1)}%`}
                showHeader={false}
                trackClassName={cn('h-3 bg-muted', currentRatio.indicatorClass)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">0%</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--money)] font-medium">15%</span>
                <span className="text-xs text-[var(--debt)] font-medium">30%</span>
              </div>
              <span className="text-xs text-muted-foreground">100%</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Renda mensal:</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {currencyFmt(monthlyIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebtSectionShell({
  icon, title, countLabel, amount, amountClass, children,
}: {
  icon: ReactNode; title: string; countLabel: string; amount: number; amountClass: string; children: ReactNode;
}) {
  return (
    <div className="overflow-hidden">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {icon}
          <span className="text-xs font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{countLabel}</Badge>
          <Badge className={cn('font-mono text-xs tabular-nums px-2 py-0 border', amountClass)}>
            {currencyFmt(amount)}
          </Badge>
        </div>
        <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function DebtCardRow({ card }: { card: CardDebt }) {
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
            <span className="font-mono text-xs tabular-nums text-[var(--debt)] font-semibold">{currencyFmt(card.currentBalance)}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">Limite: {currencyFmt(card.creditLimit)}</span>
            <span className="text-xs text-muted-foreground">Vencimento: dia {card.dueDay}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <FinanceProgress
              label={`Uso do limite do cartão ${card.name}`}
              ariaLabel={`Uso do limite do cartão ${card.name}`}
              value={clampedUtilization}
              showHeader={false}
              className="flex-1 max-w-[120px]"
              trackClassName={cn('h-1.5 bg-muted', indicatorClass)}
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{card.utilizationRate.toFixed(0)}% usado</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebtPlanRow({
  description,
  status,
  badgeLabel,
  remaining,
  paidInstallments,
  installmentCount,
  monthlyValue,
  extraMeta,
  progressLabel,
  progressValue,
}: {
  description: string;
  status: string;
  badgeLabel?: string;
  remaining: number;
  paidInstallments: number;
  installmentCount: number;
  monthlyValue: number;
  extraMeta?: string;
  progressLabel: string;
  progressValue: number;
}) {
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
              Restante: {currencyFmt(remaining)}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {paidInstallments}/{installmentCount} parcelas
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {currencyFmt(monthlyValue)}/mês
            </span>
            {extraMeta && <span className="font-mono text-xs tabular-nums text-muted-foreground">{extraMeta}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <FinanceProgress
              label={progressLabel}
              ariaLabel={progressLabel}
              value={progressValue}
              showHeader={false}
              className="flex-1 max-w-[160px]"
              trackClassName="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-[var(--obligation)]"
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{progressValue}% pago</span>
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
}: {
  expandedType: string | null;
  data: DebtsData;
}) {
  if (expandedType === 'cards' && data.cards.length > 0) {
    return (
      <DebtSectionShell
        icon={<CreditCard className="w-4 h-4 text-[var(--debt)]" />}
        title="Cartões de Crédito"
        countLabel={`${data.cards.length} cartão(ões)`}
        amount={data.cardDebt}
        amountClass="bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20"
      >
        {data.cards.map((card) => (
          <DebtCardRow key={card.id} card={card} />
        ))}
      </DebtSectionShell>
    );
  }

  if (expandedType === 'installments' && data.installments.length > 0) {
    return (
      <DebtSectionShell
        icon={<CalendarClock className="w-4 h-4 text-[var(--obligation)]" />}
        title="Parcelamentos"
        countLabel={`${data.installments.length} plano(s)`}
        amount={data.installmentDebt}
        amountClass="bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20"
      >
        {data.installments.map((ip) => (
          <DebtPlanRow
            key={ip.id}
            description={ip.description}
            status={ip.status}
            badgeLabel={typeLabel(ip.type)}
            remaining={ip.remaining}
            paidInstallments={ip.paidInstallments}
            installmentCount={ip.installmentCount}
            monthlyValue={ip.monthlyValue}
            extraMeta={ip.interestRate > 0 ? `Juros: ${ip.interestRate}% a.m.` : undefined}
            progressLabel={`Progresso do parcelamento ${ip.description}`}
            progressValue={ip.installmentCount > 0 ? Math.round((ip.paidInstallments / ip.installmentCount) * 100) : 0}
          />
        ))}
      </DebtSectionShell>
    );
  }

  if (expandedType === 'consortiums' && data.consortiums.length > 0) {
    return (
      <DebtSectionShell
        icon={<Building2 className="w-4 h-4 text-[var(--obligation)]" />}
        title="Consórcios"
        countLabel={`${data.consortiums.length} consórcio(s)`}
        amount={data.consortiumDebt}
        amountClass="bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20"
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
            extraMeta={c.administrator ? `Adm: ${c.administrator}` : undefined}
            progressLabel={`Progresso do consórcio ${c.description}`}
            progressValue={Math.round(Math.min(100, Math.max(0, c.progress)))}
          />
        ))}
      </DebtSectionShell>
    );
  }

  return null;
}
