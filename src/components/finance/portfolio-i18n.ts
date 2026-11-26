import type { ElementType } from 'react';
import {
  Plus,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  DollarSign,
  BarChart3,
  Gift,
  Building2,
  Bitcoin,
  Landmark,
  BadgeDollarSign,
  Receipt,
  RefreshCw,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  User,
  Home,
  PiggyBank,
  ShieldCheck,
} from 'lucide-react';
import { INTL_LOCALE, normalizeLocale } from '@/i18n/config';
import { currencyFmt, dateFmt } from '@/lib/helpers';

const CIVIL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the BCP-47 Intl locale tag for any canonical or regional locale. */
export function getPortfolioIntlLocale(locale?: string | null): string {
  return INTL_LOCALE[normalizeLocale(locale)];
}

/** Formats a civil YYYY-MM-DD (or UTC ISO date) without shifting the calendar day. */
export function formatCivilDate(value: string, locale?: string | null): string {
  const civil = value.slice(0, 10);
  if (CIVIL_DATE_REGEX.test(civil)) {
    return dateFmt(civil, normalizeLocale(locale));
  }
  return dateFmt(value, normalizeLocale(locale));
}

/** Formats a BRL amount using the active locale. */
export function formatBrlAmount(amount: number, locale?: string | null): string {
  return currencyFmt(amount, normalizeLocale(locale));
}

type LabelKeyOf<T extends Record<string, { readonly labelKey: string }>> = T[keyof T]['labelKey'];

// ── Investments ─────────────────────────────────────────────────────

export const INVESTMENT_TYPE_KEYS = [
  'STOCK',
  'BOND',
  'FII',
  'CDB',
  'LCI',
  'LCA',
  'TESOURO',
  'CRYPTO',
  'ETF',
  'OTHER',
] as const;

const INVESTMENT_TYPE_META_ENTRIES = {
  STOCK:   { labelKey: 'types.STOCK', icon: TrendingUp },
  BOND:    { labelKey: 'types.BOND', icon: Landmark },
  FII:     { labelKey: 'types.FII', icon: Building2 },
  CDB:     { labelKey: 'types.CDB', icon: BadgeDollarSign },
  LCI:     { labelKey: 'types.LCI', icon: CircleDollarSign },
  LCA:     { labelKey: 'types.LCA', icon: CircleDollarSign },
  TESOURO: { labelKey: 'types.TESOURO', icon: BarChart3 },
  CRYPTO:  { labelKey: 'types.CRYPTO', icon: Bitcoin },
  ETF:     { labelKey: 'types.ETF', icon: RefreshCw },
  OTHER:   { labelKey: 'types.OTHER', icon: Wallet },
} as const;

export type InvestmentTypeLabelKey = LabelKeyOf<typeof INVESTMENT_TYPE_META_ENTRIES>;

export const INVESTMENT_TYPE_META: Record<
  string,
  { readonly labelKey: InvestmentTypeLabelKey; readonly icon: ElementType }
> = INVESTMENT_TYPE_META_ENTRIES;

export const INVESTMENT_TX_TYPE_KEYS = [
  'APORTE',
  'DIVIDENDO',
  'VENDA',
  'REINVESTIMENTO',
  'TAXA',
  'BONUS',
] as const;

const INVESTMENT_TX_META_ENTRIES = {
  APORTE:         { labelKey: 'transactionTypes.APORTE', icon: Plus },
  DIVIDENDO:      { labelKey: 'transactionTypes.DIVIDENDO', icon: Gift },
  VENDA:          { labelKey: 'transactionTypes.VENDA', icon: ArrowDownRight },
  REINVESTIMENTO: { labelKey: 'transactionTypes.REINVESTIMENTO', icon: RefreshCw },
  TAXA:           { labelKey: 'transactionTypes.TAXA', icon: Receipt },
  BONUS:          { labelKey: 'transactionTypes.BONUS', icon: DollarSign },
} as const;

export type InvestmentTxLabelKey = LabelKeyOf<typeof INVESTMENT_TX_META_ENTRIES>;

export const INVESTMENT_TX_META: Record<
  string,
  { readonly labelKey: InvestmentTxLabelKey; readonly icon: ElementType }
> = INVESTMENT_TX_META_ENTRIES;

export const INVESTMENT_FILTER_TABS = [
  { value: 'all', labelKey: 'filters.all' },
  { value: 'STOCK', labelKey: 'filters.STOCK' },
  { value: 'FII', labelKey: 'filters.FII' },
  { value: 'BOND', labelKey: 'filters.BOND' },
  { value: 'TESOURO', labelKey: 'filters.TESOURO' },
  { value: 'CRYPTO', labelKey: 'filters.CRYPTO' },
] as const;

// ── Installments ────────────────────────────────────────────────────

const INSTALLMENT_PLAN_TYPE_META_ENTRIES = {
  FINANCING:        { labelKey: 'planTypes.FINANCING', icon: Landmark },
  CARD_INSTALLMENT: { labelKey: 'planTypes.CARD_INSTALLMENT', icon: CreditCard },
  LOAN:             { labelKey: 'planTypes.LOAN', icon: HandCoins },
  PERSONAL:         { labelKey: 'planTypes.PERSONAL', icon: User },
  RENTAL:           { labelKey: 'planTypes.RENTAL', icon: Home },
} as const;

export type InstallmentPlanTypeLabelKey = LabelKeyOf<typeof INSTALLMENT_PLAN_TYPE_META_ENTRIES>;

export const INSTALLMENT_PLAN_TYPE_META: Record<
  string,
  { readonly labelKey: InstallmentPlanTypeLabelKey; readonly icon: ElementType }
> = INSTALLMENT_PLAN_TYPE_META_ENTRIES;

/** Resolves translated plan type metadata compatible with InstallmentPlanEditor. */
export function buildInstallmentPlanTypes(
  translate: (key: InstallmentPlanTypeLabelKey) => string,
): Record<string, { label: string; icon: ElementType }> {
  const result: Record<string, { label: string; icon: ElementType }> = {};
  for (const [key, meta] of Object.entries(INSTALLMENT_PLAN_TYPE_META_ENTRIES)) {
    result[key] = { label: translate(meta.labelKey), icon: meta.icon };
  }
  return result;
}

const INSTALLMENT_PLAN_STATUS_KEY_MAP = {
  ACTIVE: 'planStatus.ACTIVE',
  COMPLETED: 'planStatus.COMPLETED',
  CANCELLED: 'planStatus.CANCELLED',
  OVERDUE: 'planStatus.OVERDUE',
} as const;

export type InstallmentPlanStatusLabelKey =
  (typeof INSTALLMENT_PLAN_STATUS_KEY_MAP)[keyof typeof INSTALLMENT_PLAN_STATUS_KEY_MAP];

export const INSTALLMENT_PLAN_STATUS_KEYS: Record<string, InstallmentPlanStatusLabelKey> =
  INSTALLMENT_PLAN_STATUS_KEY_MAP;

const INSTALLMENT_ENTRY_STATUS_META_ENTRIES = {
  PAID: {
    labelKey: 'installmentStatus.PAID',
    className: 'border border-(--ds-accent-positive)/30 bg-(--ds-accent-positive)/10 text-(--ds-accent-positive)',
  },
  PENDING: {
    labelKey: 'installmentStatus.PENDING',
    className: 'border border-(--ds-accent-warning)/30 bg-(--ds-accent-warning)/10 text-(--ds-accent-warning)',
  },
  OVERDUE: {
    labelKey: 'installmentStatus.OVERDUE',
    className: 'border border-(--ds-accent-danger)/30 bg-(--ds-accent-danger)/10 text-(--ds-accent-danger)',
  },
} as const;

export type InstallmentEntryStatusLabelKey = LabelKeyOf<typeof INSTALLMENT_ENTRY_STATUS_META_ENTRIES>;

export const INSTALLMENT_ENTRY_STATUS_META: Record<
  string,
  { readonly labelKey: InstallmentEntryStatusLabelKey; readonly className: string }
> = INSTALLMENT_ENTRY_STATUS_META_ENTRIES;

export const INSTALLMENT_FILTER_TABS = [
  { key: 'ALL', labelKey: 'filters.ALL', emptyKey: 'empty.ALL' },
  { key: 'ACTIVE', labelKey: 'filters.ACTIVE', emptyKey: 'empty.ACTIVE' },
  { key: 'COMPLETED', labelKey: 'filters.COMPLETED', emptyKey: 'empty.COMPLETED' },
  { key: 'OVERDUE', labelKey: 'filters.OVERDUE', emptyKey: 'empty.OVERDUE' },
] as const;

// ── Consortiums ─────────────────────────────────────────────────────

export const CONSORTIUM_STATUS_META = {
  ACTIVE:       { labelKey: 'status.ACTIVE', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  COMPLETED:    { labelKey: 'status.COMPLETED', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  CANCELLED:    { labelKey: 'status.CANCELLED', className: 'bg-muted text-muted-foreground' },
  CONTEMPLATED: { labelKey: 'status.CONTEMPLATED', className: 'bg-muted text-[var(--ds-accent-warning)]' },
} as const;

export const CONSORTIUM_INSTALLMENT_STATUS_META = {
  PAID:    { labelKey: 'installmentStatus.PAID', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  PENDING: { labelKey: 'installmentStatus.PENDING', className: 'bg-muted text-[var(--ds-accent-warning)]' },
  OVERDUE: { labelKey: 'installmentStatus.OVERDUE', className: 'bg-muted text-destructive' },
} as const;

export const CONSORTIUM_FILTER_TABS = [
  'ALL',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'CONTEMPLATED',
] as const;

/** Resolves translated labels compatible with StatusBadge. */
export function buildStatusBadgeLabels<K extends string>(
  meta: Readonly<Record<string, { readonly labelKey: K; readonly className: string }>>,
  translate: (key: K) => string,
): Record<string, { text: string; className: string }> {
  const result: Record<string, { text: string; className: string }> = {};
  for (const [key, entry] of Object.entries(meta)) {
    result[key] = { text: translate(entry.labelKey), className: entry.className };
  }
  return result;
}

// ── Savings ─────────────────────────────────────────────────────────

export const SAVINGS_FILTER_TABS = [
  { value: 'ALL', labelKey: 'filters.ALL' },
  { value: 'SAVINGS', labelKey: 'filters.SAVINGS' },
  { value: 'PIGGY_BANK', labelKey: 'filters.PIGGY_BANK' },
  { value: 'CDI', labelKey: 'filters.CDI' },
  { value: 'EMERGENCY_FUND', labelKey: 'filters.EMERGENCY_FUND' },
  { value: 'INVESTMENT', labelKey: 'filters.INVESTMENT' },
] as const;

const SAVINGS_TYPE_KEY_MAP = {
  SAVINGS: 'types.SAVINGS',
  PIGGY_BANK: 'types.PIGGY_BANK',
  CDI: 'types.CDI',
  INVESTMENT: 'types.INVESTMENT',
  EMERGENCY_FUND: 'types.EMERGENCY_FUND',
} as const;

export type SavingsTypeLabelKey =
  (typeof SAVINGS_TYPE_KEY_MAP)[keyof typeof SAVINGS_TYPE_KEY_MAP];

export const SAVINGS_TYPE_KEYS: Record<string, SavingsTypeLabelKey> = SAVINGS_TYPE_KEY_MAP;

export const SAVINGS_EDITOR_TYPES = [
  { value: 'SAVINGS', labelKey: 'editor.types.SAVINGS', icon: PiggyBank },
  { value: 'PIGGY_BANK', labelKey: 'editor.types.PIGGY_BANK', icon: Gift },
  { value: 'CDI', labelKey: 'editor.types.CDI', icon: Landmark },
  { value: 'INVESTMENT', labelKey: 'editor.types.INVESTMENT', icon: TrendingUp },
  { value: 'EMERGENCY_FUND', labelKey: 'editor.types.EMERGENCY_FUND', icon: ShieldCheck },
] as const;

export const SAVINGS_GOAL_COLORS = [
  { value: '#10b981', labelKey: 'editor.colors.emerald' },
  { value: '#0ea5e9', labelKey: 'editor.colors.sky' },
  { value: '#8b5cf6', labelKey: 'editor.colors.violet' },
  { value: '#f59e0b', labelKey: 'editor.colors.amber' },
  { value: '#f43f5e', labelKey: 'editor.colors.coral' },
  { value: '#06b6d4', labelKey: 'editor.colors.cyan' },
  { value: '#6366f1', labelKey: 'editor.colors.indigo' },
  { value: '#ec4899', labelKey: 'editor.colors.pink' },
  { value: '#14b8a6', labelKey: 'editor.colors.teal' },
  { value: '#84cc16', labelKey: 'editor.colors.lime' },
] as const;

// ── Recurring ───────────────────────────────────────────────────────

export const RECURRING_TYPE_KEYS = ['EXPENSE', 'INCOME'] as const;

export const RECURRING_FREQUENCY_KEYS = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
] as const;

const RECURRING_FREQUENCY_KEY_MAP = {
  WEEKLY: 'frequencies.WEEKLY',
  BIWEEKLY: 'frequencies.BIWEEKLY',
  MONTHLY: 'frequencies.MONTHLY',
  QUARTERLY: 'frequencies.QUARTERLY',
  YEARLY: 'frequencies.YEARLY',
} as const;

export type RecurringFrequencyLabelKey =
  (typeof RECURRING_FREQUENCY_KEY_MAP)[keyof typeof RECURRING_FREQUENCY_KEY_MAP];

export const RECURRING_FREQUENCY_MAP: Record<string, RecurringFrequencyLabelKey> =
  RECURRING_FREQUENCY_KEY_MAP;
