import { INTL_LOCALE, normalizeLocale, type CanonicalLocale } from '@/i18n/config';
import ptAccounts from '@/messages/pt/accounts.json';
import ptCards from '@/messages/pt/cards.json';
import ptPurchases from '@/messages/pt/purchases.json';
import ptCategories from '@/messages/pt/categories.json';
import ptReceipts from '@/messages/pt/receipts.json';

export type TranslatorValues = Record<string, string | number | Date>;

type RawTranslator = ((key: never, values?: never) => string) & {
  has?: (key: never) => boolean;
};

export type NamespaceTranslate = (key: string, values?: TranslatorValues) => string;

function resolveMessagePath(messages: Record<string, unknown>, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function formatFallbackMessage(template: string, values?: TranslatorValues): string {
  if (!values) return template;
  const withPlurals = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*\}/g,
    (_, name: string, oneText: string, otherText: string) => {
      const count = Number(values[name] ?? 0);
      const branch = count === 1 ? oneText : otherText;
      return branch.replace(/#/g, String(count));
    },
  );
  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/** Wraps a next-intl safe translator with deterministic PT fallback before namespace registration. */
export function createFallbackTranslator(
  translator: RawTranslator,
  fallbackMessages: Record<string, unknown>,
): NamespaceTranslate {
  const hasFn = translator.has as ((key: string) => boolean) | undefined;
  const callFn = translator as unknown as (key: string, values?: TranslatorValues) => string;
  return (key, values) => {
    if (typeof hasFn === 'function' && hasFn(key)) {
      return callFn(key, values);
    }
    const fallback = resolveMessagePath(fallbackMessages, key);
    return fallback !== undefined ? formatFallbackMessage(fallback, values) : callFn(key, values);
  };
}

export const PT_OPERATIONS_MESSAGES = {
  accounts: ptAccounts,
  cards: ptCards,
  purchases: ptPurchases,
  categories: ptCategories,
  receipts: ptReceipts,
} as const;

/** Resolves a BCP-47 locale tag from any canonical or regional locale input. */
export function getIntlLocale(locale?: string | null): string {
  const canonical: CanonicalLocale = normalizeLocale(locale);
  return INTL_LOCALE[canonical];
}

export const ACCOUNT_TYPE_KEYS = ['CASH', 'BANK', 'DIGITAL_WALLET'] as const;

export const ACCOUNT_COLORS = [
  { value: '#22c55e', key: 'green' },
  { value: '#3b82f6', key: 'blue' },
  { value: '#8b5cf6', key: 'purple' },
  { value: '#06b6d4', key: 'cyan' },
  { value: '#f97316', key: 'orange' },
  { value: '#ef4444', key: 'red' },
  { value: '#ec4899', key: 'pink' },
] as const;

export const CARD_TYPE_KEYS = ['CREDIT', 'DEBIT'] as const;

export const CARD_BRAND_KEYS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPER'] as const;

export const CARD_COLORS = [
  { value: '#8b5cf6', key: 'purple' },
  { value: '#f97316', key: 'orange' },
  { value: '#ef4444', key: 'red' },
  { value: '#3b82f6', key: 'blue' },
  { value: '#06b6d4', key: 'cyan' },
  { value: '#22c55e', key: 'green' },
  { value: '#ec4899', key: 'pink' },
] as const;

export const CATEGORY_COLOR_KEYS = {
  '#22c55e': 'green',
  '#06b6d4': 'cyan',
  '#3b82f6': 'blue',
  '#8b5cf6': 'violet',
  '#ef4444': 'red',
  '#f97316': 'orange',
  '#f59e0b': 'amber',
  '#64748b': 'slate',
  '#ec4899': 'pink',
  '#84cc16': 'lime',
  '#a855f7': 'purple',
  '#94a3b8': 'lightGray',
} as const;

export const CATEGORY_ICON_KEYS = {
  banknote: 'banknote',
  laptop: 'laptop',
  'trending-up': 'trendingUp',
  utensils: 'utensils',
  car: 'car',
  'heart-pulse': 'heartPulse',
  'graduation-cap': 'graduationCap',
  'gamepad-2': 'gamepad2',
  'shopping-bag': 'shoppingBag',
  receipt: 'receipt',
  home: 'home',
  'more-horizontal': 'moreHorizontal',
  tag: 'tag',
  gift: 'gift',
  plane: 'plane',
  baby: 'baby',
  dog: 'dog',
} as const;

export const CATEGORY_FILTER_KEYS = ['all', 'INCOME', 'EXPENSE'] as const;

export const RECEIPT_FIELD_KEYS = [
  'merchant',
  'description',
  'type',
  'category',
  'account',
  'card',
  'installment',
  'date',
] as const;

export type ReceiptFieldKey = (typeof RECEIPT_FIELD_KEYS)[number];

export const DEFAULT_RECEIPT_FIELD_LABELS: Record<ReceiptFieldKey, string> = ptReceipts.fields;

export const DEFAULT_RECEIPT_DOCUMENT = ptReceipts.document;
