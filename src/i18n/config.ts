export const CANONICAL_LOCALES = ['pt', 'es', 'en'] as const;

export type CanonicalLocale = (typeof CANONICAL_LOCALES)[number];

export const DEFAULT_LOCALE: CanonicalLocale = 'pt';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const INTL_LOCALE: Record<CanonicalLocale, string> = {
  pt: 'pt-BR',
  es: 'es-ES',
  en: 'en-US',
} as const;

export interface LocaleMetadata {
  code: CanonicalLocale;
  shortCode: 'PT' | 'ES' | 'EN';
  autonym: string;
  flagPath: string;
}

export const LOCALE_METADATA: Record<CanonicalLocale, LocaleMetadata> = {
  pt: {
    code: 'pt',
    shortCode: 'PT',
    autonym: 'Português',
    flagPath: '/locale-flags/pt.svg',
  },
  es: {
    code: 'es',
    shortCode: 'ES',
    autonym: 'Español',
    flagPath: '/locale-flags/es.svg',
  },
  en: {
    code: 'en',
    shortCode: 'EN',
    autonym: 'English',
    flagPath: '/locale-flags/en.svg',
  },
} as const;

const CANONICAL_SET = new Set<string>(CANONICAL_LOCALES);

/** Normalizes any locale string or regional tag to a supported canonical locale. */
export function normalizeLocale(input?: string | null): CanonicalLocale {
  if (typeof input !== 'string') return DEFAULT_LOCALE;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return DEFAULT_LOCALE;
  const base = trimmed.split(/[-_]/)[0];
  return CANONICAL_SET.has(base) ? (base as CanonicalLocale) : DEFAULT_LOCALE;
}

/** Resolves an HTTP Accept-Language header by q-weight priority to a supported canonical locale. */
export function resolveAcceptLanguage(header?: string | null): CanonicalLocale {
  if (!header) return DEFAULT_LOCALE;
  const candidates = header
    .split(',')
    .map((entry, index) => {
      const [rawTag, ...params] = entry.trim().split(';');
      const tag = rawTag?.trim().toLowerCase() ?? '';
      let q = 1.0;
      for (const param of params) {
        const [k, v] = param.trim().split('=');
        if (k === 'q' && v !== undefined) {
          const parsed = Number.parseFloat(v);
          q = Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return { tag, q, index };
    })
    .filter(({ tag, q }) => tag.length > 0 && q > 0)
    .sort((a, b) => (b.q !== a.q ? b.q - a.q : a.index - b.index));

  for (const { tag } of candidates) {
    const base = tag.split(/[-_]/)[0];
    if (CANONICAL_SET.has(base)) {
      return base as CanonicalLocale;
    }
  }
  return DEFAULT_LOCALE;
}

/** Returns the BCP-47 tag used on the root html lang attribute. */
export function getHtmlLang(locale: CanonicalLocale): string {
  return INTL_LOCALE[normalizeLocale(locale)];
}

/** Persists the canonical locale cookie in browser runtimes. */
export function setLocaleCookie(locale: CanonicalLocale): void {
  if (typeof document === 'undefined') return;
  const normalized = normalizeLocale(locale);
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
