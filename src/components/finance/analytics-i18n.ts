import { parseISO, type Locale } from 'date-fns';
import { enUS, es, ptBR } from 'date-fns/locale';
import { INTL_LOCALE, normalizeLocale, type CanonicalLocale } from '@/i18n/config';

export { INTL_LOCALE };

const DATE_FNS_LOCALES: Record<CanonicalLocale, Locale> = {
  pt: ptBR,
  es,
  en: enUS,
};

const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.000)?Z?$)/;

/** Returns the date-fns locale object matching the active canonical locale. */
export function getDateFnsLocale(locale?: string | null): Locale {
  return DATE_FNS_LOCALES[normalizeLocale(locale)];
}

/** Returns the BCP-47 Intl locale tag matching the active canonical locale. */
export function getIntlLocale(locale?: string | null): string {
  return INTL_LOCALE[normalizeLocale(locale)];
}

/** Parses YYYY-MM-DD (or midnight ISO) as a local civil date without timezone drift. */
export function parseCivilDate(value: string): Date {
  const match = CIVIL_DATE_RE.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return parseISO(value);
}

export const CALENDAR_DATE_FORMATS: Record<
  CanonicalLocale,
  {
    fullDate: string;
    dayMonthWeekday: string;
    shortDayMonthWeekday: string;
    monthYear: string;
    dayShortMonth: string;
    daySlashMonth: string;
  }
> = {
  pt: {
    fullDate: "EEEE, dd 'de' MMMM 'de' yyyy",
    dayMonthWeekday: "EEEE, dd 'de' MMMM",
    shortDayMonthWeekday: "EEE, dd 'de' MMMM",
    monthYear: 'MMMM yyyy',
    dayShortMonth: 'dd MMM',
    daySlashMonth: 'dd/MM',
  },
  es: {
    fullDate: "EEEE, dd 'de' MMMM 'de' yyyy",
    dayMonthWeekday: "EEEE, dd 'de' MMMM",
    shortDayMonthWeekday: "EEE, dd 'de' MMMM",
    monthYear: 'MMMM yyyy',
    dayShortMonth: 'dd MMM',
    daySlashMonth: 'dd/MM',
  },
  en: {
    fullDate: 'EEEE, MMMM d, yyyy',
    dayMonthWeekday: 'EEEE, MMMM d',
    shortDayMonthWeekday: 'EEE, MMM d',
    monthYear: 'MMMM yyyy',
    dayShortMonth: 'MMM d',
    daySlashMonth: 'MM/dd',
  },
};

/** Formats an unlocked-at date in the active locale while respecting civil dates. */
export function formatAchievementDate(iso: string | null, locale?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const isCivil = CIVIL_DATE_RE.test(iso);
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(isCivil ? { timeZone: 'UTC' } : {}),
  }).format(date);
}

/** Formats compact BRL axis tick values for NetworthEvolution in the active locale. */
export function formatNetworthAxis(value: number, locale?: string | null): string {
  const intlLocale = getIntlLocale(locale);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const formatted = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(abs / 1_000_000);
    return `${sign}R$ ${formatted}M`;
  }
  if (abs >= 1000) {
    const formatted = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(abs / 1000);
    return `${sign}R$ ${formatted}k`;
  }
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return `R$ ${formatted}`;
}

export const ACHIEVEMENT_FILTER_KEYS = [
  'todas',
  'poupanca',
  'controle',
  'investimento',
  'exploracao',
] as const;

export type InvestmentTypeKey =
  | 'stock'
  | 'bond'
  | 'fii'
  | 'cdb'
  | 'lci'
  | 'lca'
  | 'tesouro'
  | 'crypto'
  | 'etf'
  | 'other';

export const INVESTMENT_TYPE_KEYS: Record<string, InvestmentTypeKey> = {
  STOCK: 'stock',
  BOND: 'bond',
  FII: 'fii',
  CDB: 'cdb',
  LCI: 'lci',
  LCA: 'lca',
  TESOURO: 'tesouro',
  CRYPTO: 'crypto',
  ETF: 'etf',
  OTHER: 'other',
};

export type SavingsTypeKey = 'savings' | 'piggyBank' | 'cdi' | 'investment' | 'emergencyFund';

export const SAVINGS_TYPE_KEYS: Record<string, SavingsTypeKey> = {
  SAVINGS: 'savings',
  PIGGY_BANK: 'piggyBank',
  CDI: 'cdi',
  INVESTMENT: 'investment',
  EMERGENCY_FUND: 'emergencyFund',
};

export const MONTH_NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
export const PROJECTION_MONTH_OPTIONS = [3, 6, 9, 12] as const;
export const CALENDAR_FILTER_DAYS = [7, 30, 90] as const;
export const TIMELINE_FILTER_DAYS = [7, 15, 30] as const;
export const WEEKDAY_HEADER_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const TRANSACTION_TYPE_FILTER_KEYS = ['ALL', 'INCOME', 'EXPENSE'] as const;

export const PIE_COLORS = ['var(--ds-chart-4)', 'var(--ds-chart-3)', 'var(--ds-chart-2)'];

export type DebtInstallmentTypeKey =
  | 'financing'
  | 'cardInstallment'
  | 'loan'
  | 'personal'
  | 'rental';

export const DEBT_INSTALLMENT_TYPE_KEYS: Record<string, DebtInstallmentTypeKey> = {
  FINANCING: 'financing',
  CARD_INSTALLMENT: 'cardInstallment',
  LOAN: 'loan',
  PERSONAL: 'personal',
  RENTAL: 'rental',
};

export type DebtStatusLabelKey = 'active' | 'overdue' | 'completed' | 'contemplated';

export const DEBT_STATUS_BADGE_CONFIG: Record<string, { labelKey: DebtStatusLabelKey; className: string }> = {
  ACTIVE: {
    labelKey: 'active',
    className: 'bg-[var(--money)]/10 text-[var(--money)] border-[var(--money)]/20',
  },
  OVERDUE: {
    labelKey: 'overdue',
    className: 'bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20',
  },
  COMPLETED: {
    labelKey: 'completed',
    className: 'bg-[var(--primary)]/10 text-primary border-[var(--primary)]/20',
  },
  CONTEMPLATED: {
    labelKey: 'contemplated',
    className: 'bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20',
  },
};

export const DEBT_RATIO_CONFIG = {
  critical: {
    barColor: 'var(--ds-chart-4)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-4)]',
    bgClass: 'bg-[var(--debt)]/5 border-[var(--debt)]/20',
    textClass: 'text-[var(--debt)]',
    iconBg: 'bg-[var(--debt)]/10',
    labelKey: 'criticalLabel',
    recommendationKey: 'criticalRecommendation',
  },
  warning: {
    barColor: 'var(--ds-chart-2)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-2)]',
    bgClass: 'bg-[var(--obligation)]/5 border-[var(--obligation)]/20',
    textClass: 'text-[var(--obligation)]',
    iconBg: 'bg-[var(--obligation)]/10',
    labelKey: 'warningLabel',
    recommendationKey: 'warningRecommendation',
  },
  healthy: {
    barColor: 'var(--ds-chart-1)',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-[var(--ds-chart-1)]',
    bgClass: 'bg-[var(--money)]/5 border-[var(--money)]/20',
    textClass: 'text-[var(--money)]',
    iconBg: 'bg-[var(--money)]/10',
    labelKey: 'healthyLabel',
    recommendationKey: 'healthyRecommendation',
  },
} as const;

export const DISTRIBUTION_COLORS = [
  'var(--ds-chart-1)',
  'var(--ds-chart-2)',
  'var(--ds-chart-3)',
  'var(--ds-chart-5)',
  'var(--ds-chart-4)',
];

export const INSIGHT_TYPE_PRESENTATION = {
  success: { labelKey: 'success', color: 'text-[var(--ds-accent-positive)]' },
  warning: { labelKey: 'warning', color: 'text-[var(--ds-accent-warning)]' },
  danger: { labelKey: 'danger', color: 'text-destructive' },
  info: { labelKey: 'info', color: 'text-primary' },
} as const;

export const PROJECTION_RISK_CONFIG = {
  low: {
    bgClass: 'bg-muted/20 border-border',
    textClass: 'text-[var(--ds-accent-positive)]',
    iconBg: 'bg-[var(--ds-accent-positive)]/10',
    headingKey: 'lowHeading',
    messageKey: 'lowMessage',
  },
  medium: {
    bgClass: 'bg-muted/20 border-border',
    textClass: 'text-[var(--ds-accent-warning)]',
    iconBg: 'bg-[var(--ds-accent-warning)]/10',
    headingKey: 'mediumHeading',
    messageKey: 'mediumMessage',
  },
  high: {
    bgClass: 'bg-muted/20 border-border',
    textClass: 'text-[var(--ds-accent-danger)]',
    iconBg: 'bg-[var(--ds-accent-danger)]/10',
    headingKey: 'highHeading',
    messageKey: 'highMessage',
  },
} as const;
