import { NextRequest, NextResponse } from 'next/server';
import { civilPurchaseDate } from '@/lib/purchase-date';
import ptMessages from '@/messages/pt/api.json';
import esMessages from '@/messages/es/api.json';
import enMessages from '@/messages/en/api.json';

export const SUPPORTED_LOCALES = ['pt', 'es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const INTL_LOCALE_MAP: Record<SupportedLocale, string> = {
  pt: 'pt-BR',
  es: 'es-ES',
  en: 'en-US',
};

export type ApiMessages = typeof ptMessages;

const CATALOGS: Record<SupportedLocale, ApiMessages> = {
  pt: ptMessages,
  es: esMessages,
  en: enMessages,
};

const PT_WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

type RequestLike = Request | NextRequest | null | undefined;

/**
 * Normaliza um código de idioma/BCP-47 para um dos locales suportados ('pt' | 'es' | 'en').
 */
export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const primary = trimmed.split(/[-_]/)[0];
  if (primary === 'pt' || primary === 'es' || primary === 'en') {
    return primary;
  }
  return null;
}

function getQueryLocale(request: Request | NextRequest): SupportedLocale | null {
  const nextUrl = (request as NextRequest).nextUrl;
  if (nextUrl?.searchParams) {
    return normalizeLocale(nextUrl.searchParams.get('locale'));
  }
  if (!request.url) {
    return null;
  }
  try {
    const parsed = new URL(request.url, 'http://localhost');
    return normalizeLocale(parsed.searchParams.get('locale'));
  } catch {
    return null;
  }
}

function getCookieLocale(request: Request | NextRequest): SupportedLocale | null {
  const cookiesApi = (request as NextRequest).cookies;
  if (cookiesApi && typeof cookiesApi.get === 'function') {
    const cookieVal = cookiesApi.get('NEXT_LOCALE')?.value;
    const normalized = normalizeLocale(cookieVal);
    if (normalized) {
      return normalized;
    }
  }

  const rawCookieHeader = request.headers.get('cookie');
  if (!rawCookieHeader) {
    return null;
  }

  for (const part of rawCookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name !== 'NEXT_LOCALE') continue;
    const rawValue = part.slice(eqIdx + 1).trim();
    const decoded = (() => {
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    })();
    const normalized = normalizeLocale(decoded);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function getAcceptLanguageLocale(request: Request | NextRequest): SupportedLocale | null {
  const header = request.headers.get('accept-language');
  if (!header) {
    return null;
  }

  const candidates = header
    .split(',')
    .map((segment, index) => {
      const [rawTag, ...params] = segment.trim().split(';');
      let quality = 1;
      for (const param of params) {
        const [k, v] = param.trim().split('=');
        if (k?.toLowerCase() === 'q' && v !== undefined) {
          const parsedQ = Number(v);
          if (Number.isFinite(parsedQ) && parsedQ >= 0 && parsedQ <= 1) {
            quality = parsedQ;
          } else {
            quality = 0;
          }
        }
      }
      return {
        locale: normalizeLocale(rawTag),
        quality,
        index,
      };
    })
    .filter((entry): entry is { locale: SupportedLocale; quality: number; index: number } => {
      return entry.locale !== null && entry.quality > 0;
    })
    .sort((a, b) => (b.quality !== a.quality ? b.quality - a.quality : a.index - b.index));

  return candidates[0]?.locale ?? null;
}

function extractLocaleSignal(request?: RequestLike): SupportedLocale | null {
  if (!request) {
    return null;
  }
  const fromQuery = getQueryLocale(request);
  if (fromQuery) return fromQuery;

  const fromHeader = normalizeLocale(request.headers.get('x-locale'));
  if (fromHeader) return fromHeader;

  const fromCookie = getCookieLocale(request);
  if (fromCookie) return fromCookie;

  return getAcceptLanguageLocale(request);
}

/**
 * Resolve o idioma da requisição seguindo ?locale= -> X-Locale -> cookie NEXT_LOCALE -> Accept-Language -> 'pt'.
 */
export function resolveRequestLocale(request?: RequestLike): SupportedLocale {
  return extractLocaleSignal(request) ?? 'pt';
}

/**
 * Indica se a requisição trouxe um sinal explícito de idioma suportado.
 */
export function hasExplicitLocaleSignal(request?: RequestLike): boolean {
  return extractLocaleSignal(request) !== null;
}

/**
 * Retorna o catálogo completo de mensagens da API para o idioma informado.
 */
export function getApiMessages(locale: SupportedLocale = 'pt'): ApiMessages {
  return CATALOGS[locale] ?? CATALOGS.pt;
}

function lookupMessage(catalog: unknown, key: string): string | null {
  let current: unknown = catalog;
  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

/**
 * Traduz uma chave pontuada do catálogo da API com interpolação simples de placeholders {var}.
 */
export function translateApiMessage(
  locale: SupportedLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const template =
    lookupMessage(getApiMessages(locale), key) ??
    lookupMessage(CATALOGS.pt, key) ??
    key;

  if (!params) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return match;
  });
}

/**
 * Formata valores monetários preservando sempre a moeda contábil BRL.
 */
export function formatServerCurrencyBRL(
  value: number,
  locale: SupportedLocale = 'pt'
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata números de acordo com o locale resolvido.
 */
export function formatServerNumber(
  value: number,
  locale: SupportedLocale = 'pt',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], options).format(value);
}

/**
 * Formata rótulo de mês/ano via Intl.DateTimeFormat no locale resolvido.
 */
export function formatServerMonthLabel(
  date: Date,
  locale: SupportedLocale = 'pt',
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(
    INTL_LOCALE_MAP[locale],
    options ?? { month: 'short', year: '2-digit' }
  ).format(date);
}

/**
 * Formata data ou data/hora via Intl.DateTimeFormat no locale resolvido.
 */
export function formatServerDate(
  date: Date | string,
  locale: SupportedLocale = 'pt',
  style: 'date' | 'datetime' = 'date',
  timeZone?: string
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  const options: Intl.DateTimeFormatOptions =
    style === 'datetime'
      ? {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], options).format(parsed);
}

/**
 * Formata datas de compra preservando datas civis (meia-noite UTC) sem recuo de fuso.
 */
export function formatServerPurchaseDate(
  value: string | Date,
  locale: SupportedLocale = 'pt',
  style: 'date' | 'receipt' = 'date'
): string {
  const date = value instanceof Date ? value : new Date(value);
  const civil = civilPurchaseDate(value, date);
  if (civil) {
    const [yearStr, monthStr, dayStr] = civil.split('-');
    const utcDate = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
    return formatServerDate(utcDate, locale, 'date', 'UTC');
  }
  return formatServerDate(date, locale, style === 'receipt' ? 'datetime' : 'date');
}

/**
 * Retorna abreviação curta do dia da semana (0=Domingo .. 6=Sábado).
 */
export function formatServerWeekdayShort(
  dayIndex: number,
  locale: SupportedLocale = 'pt'
): string {
  const normalizedIndex = ((Math.trunc(dayIndex) % 7) + 7) % 7;
  if (locale === 'pt') {
    return PT_WEEKDAYS_SHORT[normalizedIndex];
  }
  // 2026-11-22 é domingo em UTC
  const reference = new Date(Date.UTC(2026, 10, 22 + normalizedIndex));
  const raw = new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(reference);
  const cleaned = raw.replace(/\.$/, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Formata uma data para chave neutra YYYY-MM.
 */
export function toMonthKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface ApiErrorResponseOptions {
  includeCode?: boolean;
  headers?: HeadersInit;
  extra?: Record<string, unknown>;
}

/**
 * Constrói NextResponse de erro padronizada com header X-Error-Code e payload { error, code }.
 */
export function apiErrorResponse(
  code: string,
  message: string,
  status: number,
  options?: ApiErrorResponseOptions
): NextResponse {
  const includeCode = options?.includeCode ?? true;
  const headers = new Headers(options?.headers);
  headers.set('X-Error-Code', code);

  const body: Record<string, unknown> = {
    error: message,
    ...(includeCode ? { code } : {}),
    ...(options?.extra ?? {}),
  };

  return NextResponse.json(body, { status, headers });
}

/**
 * Constrói NextResponse de sucesso padronizada com { success: true, message, ...payload }.
 */
export function apiSuccessMessage(
  message: string,
  payload?: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      ...(payload ?? {}),
    },
    { status }
  );
}
