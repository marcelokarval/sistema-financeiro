import { INTL_LOCALE, normalizeLocale } from '@/i18n/config';

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export function civilPurchaseDate(value: string | Date, date = new Date(value)): string | undefined {
  if (typeof value === 'string' && dateOnly.test(value)) return value;

  // Prisma serializa a data do campo HTML como meia-noite UTC, sem hora de compra.
  if (date.getTime() % 86_400_000 === 0) return date.toISOString().slice(0, 10);
}

export function purchaseDateForInput(value?: string | Date, now = new Date()): string {
  const date = value ? new Date(value) : now;
  if (Number.isNaN(date.getTime())) return '';
  const civil = value && civilPurchaseDate(value, date);
  if (civil) return civil;

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function purchaseDateForSave(input: string, original?: string): string {
  return original && input === purchaseDateForInput(original) ? original : input;
}

export function formatPurchaseDate(
  value: string | Date,
  style: 'date' | 'receipt' = 'date',
  locale?: string,
): string {
  const intlLocale = INTL_LOCALE[normalizeLocale(locale)];
  const date = new Date(value);
  const civil = civilPurchaseDate(value, date);
  if (civil) {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${civil}T00:00:00.000Z`));
  }

  if (style === 'receipt') {
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
