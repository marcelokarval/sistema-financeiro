/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import {
  INTL_LOCALE_MAP,
  SUPPORTED_LOCALES,
  apiErrorResponse,
  apiSuccessMessage,
  formatServerCurrencyBRL,
  formatServerDate,
  formatServerMonthLabel,
  formatServerNumber,
  formatServerPurchaseDate,
  formatServerWeekdayShort,
  getApiMessages,
  hasExplicitLocaleSignal,
  normalizeLocale,
  resolveRequestLocale,
  toMonthKey,
  translateApiMessage,
  type SupportedLocale,
} from './server-i18n';

function collectKeysAndPlaceholders(
  obj: unknown,
  prefix = ''
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (typeof obj === 'string') {
    const placeholders = Array.from(obj.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
      .map((m) => m[1])
      .sort();
    result.set(prefix, placeholders);
    return result;
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      for (const [k, v] of collectKeysAndPlaceholders(value, nextPrefix)) {
        result.set(k, v);
      }
    }
  }
  return result;
}

describe('normalizeLocale', () => {
  it('normaliza tags BCP-47 suportados para pt, es ou en', () => {
    expect(normalizeLocale('pt')).toBe('pt');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('PT_pt')).toBe('pt');
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('es-419')).toBe('es');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('EN_GB')).toBe('en');
  });

  it('retorna null para valores vazios ou idiomas não suportados', () => {
    expect(normalizeLocale(undefined)).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale('fr-FR')).toBeNull();
    expect(normalizeLocale('invalid')).toBeNull();
  });
});

describe('resolveRequestLocale e hasExplicitLocaleSignal', () => {
  it('retorna pt e sinal false quando request é ausente ou sem sinal de idioma', () => {
    expect(resolveRequestLocale()).toBe('pt');
    expect(resolveRequestLocale(null)).toBe('pt');
    expect(hasExplicitLocaleSignal()).toBe(false);

    const bareReq = new Request('http://localhost/api/accounts');
    expect(resolveRequestLocale(bareReq)).toBe('pt');
    expect(hasExplicitLocaleSignal(bareReq)).toBe(false);

    const unsupportedReq = new Request('http://localhost/api/accounts?locale=fr', {
      headers: {
        'X-Locale': 'de',
        Cookie: 'NEXT_LOCALE=it',
        'Accept-Language': 'fr-FR,de-DE;q=0.9',
      },
    });
    expect(resolveRequestLocale(unsupportedReq)).toBe('pt');
    expect(hasExplicitLocaleSignal(unsupportedReq)).toBe(false);
  });

  it('respeita precedência estrita: ?locale= -> X-Locale -> cookie NEXT_LOCALE -> Accept-Language -> pt', () => {
    const queryWins = new NextRequest('http://localhost/api/test?locale=en', {
      headers: {
        'X-Locale': 'es',
        Cookie: 'NEXT_LOCALE=pt',
        'Accept-Language': 'pt-BR,es;q=0.8',
      },
    });
    expect(resolveRequestLocale(queryWins)).toBe('en');
    expect(hasExplicitLocaleSignal(queryWins)).toBe(true);

    const xLocaleWins = new NextRequest('http://localhost/api/test?locale=invalid', {
      headers: {
        'X-Locale': 'es-MX',
        Cookie: 'NEXT_LOCALE=en',
        'Accept-Language': 'pt-BR',
      },
    });
    expect(resolveRequestLocale(xLocaleWins)).toBe('es');
    expect(hasExplicitLocaleSignal(xLocaleWins)).toBe(true);

    const cookieWins = new Request('http://localhost/api/test', {
      headers: {
        Cookie: 'foo=1; NEXT_LOCALE=en-GB; bar=2',
        'Accept-Language': 'es-ES,pt-BR;q=0.9',
      },
    });
    expect(resolveRequestLocale(cookieWins)).toBe('en');
    expect(hasExplicitLocaleSignal(cookieWins)).toBe(true);
  });

  it('ordena Accept-Language por qualidade q= decrescente e cai para pt se nenhum for suportado', () => {
    const weightedEs = new Request('http://localhost/api/test', {
      headers: { 'Accept-Language': 'fr-FR,es-MX;q=0.9,en;q=0.8' },
    });
    expect(resolveRequestLocale(weightedEs)).toBe('es');
    expect(hasExplicitLocaleSignal(weightedEs)).toBe(true);

    const higherQEn = new Request('http://localhost/api/test', {
      headers: { 'Accept-Language': 'es;q=0.4,en-US;q=0.9,pt-BR;q=0.7' },
    });
    expect(resolveRequestLocale(higherQEn)).toBe('en');
  });
});

describe('catálogos api.json e translateApiMessage', () => {
  it('expõe os três idiomas suportados e mantém paridade total de chaves e placeholders', () => {
    expect(SUPPORTED_LOCALES).toEqual(['pt', 'es', 'en']);
    expect(INTL_LOCALE_MAP).toEqual({
      pt: 'pt-BR',
      es: 'es-ES',
      en: 'en-US',
    });

    const maps = new Map<SupportedLocale, Map<string, string[]>>();
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = getApiMessages(locale);
      const collected = collectKeysAndPlaceholders(catalog);
      expect(collected.size).toBeGreaterThan(50);
      maps.set(locale, collected);

      for (const [key] of collected) {
        const translated = translateApiMessage(locale, key);
        expect(typeof translated).toBe('string');
        expect(translated.trim().length).toBeGreaterThan(0);
      }
    }

    const ptEntries = maps.get('pt')!;
    const ptKeys = Array.from(ptEntries.keys()).sort();
    for (const locale of ['es', 'en'] as const) {
      const otherEntries = maps.get(locale)!;
      expect(Array.from(otherEntries.keys()).sort()).toEqual(ptKeys);
      for (const key of ptKeys) {
        expect(otherEntries.get(key)).toEqual(ptEntries.get(key));
      }
    }
  });

  it('interpola placeholders e retorna a própria chave se não existir', () => {
    expect(
      translateApiMessage('en', 'insights.goalProgress.title', {
        name: 'Emergency',
        progress: 70,
      })
    ).toContain('70%');

    expect(
      translateApiMessage('es', 'errors.notFound')
    ).not.toBe('errors.notFound');

    expect(translateApiMessage('pt', 'non.existent.key')).toBe('non.existent.key');
  });
});

describe('formatadores regionais com BRL contábil e datas civis', () => {
  it('formata valores sempre em BRL nos três idiomas', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatted = formatServerCurrencyBRL(1234.5, locale);
      expect(formatted).toMatch(/R\$|BRL/);
    }
    expect(formatServerCurrencyBRL(1234.5, 'pt')).toContain('R$');
    expect(formatServerCurrencyBRL(1234.5, 'en')).toContain('R$');
    expect(formatServerNumber(1234.5, 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1,234.50');
    expect(formatServerNumber(1234.5, 'pt', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1.234,50');
  });

  it('formata datas civis de compra sem deslocamento de fuso em pt, es e en', () => {
    expect(formatServerPurchaseDate('2026-11-19T00:00:00.000Z', 'pt', 'date')).toBe('19/11/2026');
    expect(formatServerPurchaseDate('2026-11-19T00:00:00.000Z', 'es', 'date')).toBe('19/11/2026');
    expect(formatServerPurchaseDate('2026-11-19T00:00:00.000Z', 'en', 'date')).toBe('11/19/2026');
    expect(formatServerPurchaseDate('2026-11-19T00:00:00.000Z', 'en', 'receipt')).toBe('11/19/2026');
  });

  it('formata rótulos de mês, data, chave YYYY-MM e dias da semana', () => {
    expect(toMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(formatServerMonthLabel(new Date(2026, 10, 1), 'en')).toContain('Nov');
    expect(formatServerDate(new Date(2026, 10, 19, 14, 30), 'en', 'date')).toBe('11/19/2026');
    expect(formatServerDate(new Date(2026, 10, 19, 14, 30), 'pt', 'datetime')).toContain('19/11/2026');

    const ptWeekdays = [0, 1, 2, 3, 4, 5, 6].map((d) => formatServerWeekdayShort(d, 'pt'));
    expect(ptWeekdays).toEqual(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);

    const enWeekdays = [0, 1, 2, 3, 4, 5, 6].map((d) => formatServerWeekdayShort(d, 'en'));
    expect(enWeekdays).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('apiErrorResponse e apiSuccessMessage', () => {
  it('inclui header X-Error-Code e payload { error, code } por padrão', async () => {
    const res = apiErrorResponse('VALIDATION_ERROR', 'Invalid field', 400);
    expect(res.status).toBe(400);
    expect(res.headers.get('X-Error-Code')).toBe('VALIDATION_ERROR');
    expect(await res.json()).toEqual({
      error: 'Invalid field',
      code: 'VALIDATION_ERROR',
    });
  });

  it('permite omitir code no corpo JSON mantendo X-Error-Code para retrocompatibilidade', async () => {
    const res = apiErrorResponse('NOT_FOUND', 'Plano não encontrado', 404, {
      includeCode: false,
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Error-Code')).toBe('NOT_FOUND');
    expect(await res.json()).toEqual({ error: 'Plano não encontrado' });
  });

  it('constrói resposta de sucesso padronizada', async () => {
    const res = apiSuccessMessage('Account deleted', { id: 'acc-1' }, 200);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: 'Account deleted',
      id: 'acc-1',
    });
  });
});
