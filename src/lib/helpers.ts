import { DEFAULT_LOCALE, INTL_LOCALE, normalizeLocale } from '@/i18n/config';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function resolveIntlLocale(locale?: unknown): string {
  return typeof locale === 'string'
    ? INTL_LOCALE[normalizeLocale(locale)]
    : INTL_LOCALE[DEFAULT_LOCALE];
}

function formatDateWithPattern(
  d: string,
  year: 'numeric' | '2-digit',
  locale?: string,
): string {
  if (!d) return d;
  const isDateOnly = DATE_ONLY_REGEX.test(d);
  const date = isDateOnly ? new Date(`${d}T00:00:00.000Z`) : new Date(d);
  if (Number.isNaN(date.getTime())) return d;

  const isCivil = isDateOnly || date.getTime() % MS_PER_DAY === 0;
  return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year,
    ...(isCivil ? { timeZone: 'UTC' } : {}),
  }).format(date);
}

export const currencyFmt = (v: number, locale?: string) =>
  new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: 'currency',
    currency: 'BRL',
  }).format(v);

export const shortCurrency = (v: number, locale?: string | number) => {
  const intlLocale = resolveIntlLocale(locale);
  const oneDecimal = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (Math.abs(v) >= 1_000_000) return `${oneDecimal.format(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1_000) return `${oneDecimal.format(v / 1_000)}k`;
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
};

export const dateFmt = (d: string, locale?: string) =>
  formatDateWithPattern(d, 'numeric', locale);

export const dateShortFmt = (d: string, locale?: string) =>
  formatDateWithPattern(d, '2-digit', locale);

export const numberFmt = (
  v: number,
  locale?: string,
  options?: Intl.NumberFormatOptions,
) => new Intl.NumberFormat(resolveIntlLocale(locale), options).format(v);

export const rateFmt = (
  v: number,
  locale?: string,
  maximumFractionDigits = 2,
) =>
  numberFmt(v, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

export const percentFmt = (
  v: number,
  locale?: string,
  options?: { precision?: number; signed?: boolean },
) => {
  const precision = options?.precision ?? 1;
  const signed = options?.signed ?? true;
  const formatted = numberFmt(v, locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return `${signed && v >= 0 ? '+' : ''}${formatted}%`;
};

export const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

// Animation variants
export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const summaryContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export const summaryItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

export const listContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export const detailEntryVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
