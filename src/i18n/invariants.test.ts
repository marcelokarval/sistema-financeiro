/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import {
  CANONICAL_LOCALES,
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALE_COOKIE,
  LOCALE_METADATA,
  getHtmlLang,
  normalizeLocale,
  resolveAcceptLanguage,
} from './config';
import { MESSAGES_BY_LOCALE, getMessagesForLocale } from './messages';
import { useSafeLocale, useSafeTranslations } from './provider';
import { renderWithIntl } from '@/test-utils/intl';

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.set(path, value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedVal] of collectLeafPaths(value as Record<string, unknown>, path)) {
        result.set(nestedKey, nestedVal);
      }
    } else {
      throw new Error(`Unexpected non-string/non-object value at ${path}`);
    }
  }
  return result;
}

function extractIcuPlaceholders(template: string): string[] {
  const names = new Set<string>();
  // Match top-level ICU placeholders like {count} or {count, plural, ...}
  let depth = 0;
  let start = -1;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const inner = template.slice(start, i);
        const name = inner.split(',')[0]?.trim();
        if (name) names.add(name);
        start = -1;
      }
    }
  }
  return [...names].sort();
}

function extractPluralClauses(template: string): Array<{ variable: string; body: string }> {
  const clauses: Array<{ variable: string; body: string }> = [];
  const scan = (input: string) => {
    let i = 0;
    while (i < input.length) {
      if (input[i] !== '{') {
        i += 1;
        continue;
      }
      let depth = 1;
      let end = i + 1;
      while (end < input.length && depth > 0) {
        if (input[end] === '{') depth += 1;
        else if (input[end] === '}') depth -= 1;
        end += 1;
      }
      if (depth !== 0) {
        throw new Error(`Unbalanced braces in ICU template: ${template}`);
      }
      const inner = input.slice(i + 1, end - 1);
      const match = inner.match(/^([a-zA-Z0-9_]+)\s*,\s*plural\s*,([\s\S]*)$/);
      if (match) {
        clauses.push({ variable: match[1], body: match[2] });
        scan(match[2]);
      } else {
        scan(inner);
      }
      i = end;
    }
  };
  scan(template);
  return clauses;
}

const UI_NAMESPACES = [
  'common', 'shell', 'shared', 'dashboard', 'goals', 'analytics',
  'accounts', 'cards', 'purchases', 'categories', 'receipts',
  'investments', 'installments', 'consortiums', 'savings',
  'recurring', 'notifications', 'advisor',
] as const;

function ProbeComponent() {
  const locale = useSafeLocale();
  const tLoading = useSafeTranslations('loading');
  const tNav = useSafeTranslations('shell.navigation');
  return React.createElement(
    'div',
    { 'data-locale': locale },
    React.createElement('span', null, tLoading('app')),
    React.createElement('span', null, tNav('items.dashboard')),
  );
}

describe('i18n foundation invariants', () => {
  test('canonical constants and metadata match contract', () => {
    expect(CANONICAL_LOCALES).toEqual(['pt', 'es', 'en']);
    expect(DEFAULT_LOCALE).toBe('pt');
    expect(LOCALE_COOKIE).toBe('NEXT_LOCALE');
    expect(INTL_LOCALE).toEqual({ pt: 'pt-BR', es: 'es-ES', en: 'en-US' });
    expect(LOCALE_METADATA.pt.autonym).toBe('Português');
    expect(LOCALE_METADATA.es.autonym).toBe('Español');
    expect(LOCALE_METADATA.en.autonym).toBe('English');
  });

  test('normalizeLocale resolves regional tags and falls back safely to pt', () => {
    expect(normalizeLocale('pt')).toBe('pt');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('pt_PT')).toBe('pt');
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('es-419')).toBe('es');
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('pt');
    expect(normalizeLocale('fr')).toBe('pt');
    expect(normalizeLocale('')).toBe('pt');
    expect(normalizeLocale(undefined)).toBe('pt');
    expect(normalizeLocale(null)).toBe('pt');
  });

  test('resolveAcceptLanguage parses quality weights and selects canonical locale', () => {
    expect(resolveAcceptLanguage('es-MX,es;q=0.9,en;q=0.8')).toBe('es');
    expect(resolveAcceptLanguage('en-GB;q=0.9,pt;q=0.7')).toBe('en');
    expect(resolveAcceptLanguage('fr-CA;q=0.9,es-419;q=0.8,en;q=0.7')).toBe('es');
    expect(resolveAcceptLanguage('de-DE,fr-FR;q=0.8')).toBe('pt');
    expect(resolveAcceptLanguage('en;q=0,pt;q=0.5')).toBe('pt');
    expect(resolveAcceptLanguage(undefined)).toBe('pt');
    expect(resolveAcceptLanguage('')).toBe('pt');
  });

  test('getHtmlLang maps canonical locales to BCP-47 html lang values', () => {
    expect(getHtmlLang('pt')).toBe('pt-BR');
    expect(getHtmlLang('es')).toBe('es-ES');
    expect(getHtmlLang('en')).toBe('en-US');
  });

  test('modular JSON files and composed MESSAGES_BY_LOCALE have full key, non-empty, and ICU placeholder parity', () => {
    const messagesRoot = join(import.meta.dir, '..', 'messages');
    for (const file of ['common.json', 'shell.json']) {
      const ptJson = JSON.parse(readFileSync(join(messagesRoot, 'pt', file), 'utf8')) as Record<string, unknown>;
      const ptLeaves = collectLeafPaths(ptJson);
      expect(ptLeaves.size).toBeGreaterThan(0);

      for (const locale of ['es', 'en'] as const) {
        const targetJson = JSON.parse(readFileSync(join(messagesRoot, locale, file), 'utf8')) as Record<string, unknown>;
        const targetLeaves = collectLeafPaths(targetJson);
        expect([...targetLeaves.keys()].sort()).toEqual([...ptLeaves.keys()].sort());
        for (const [keyPath, ptValue] of ptLeaves) {
          const targetValue = targetLeaves.get(keyPath);
          expect(targetValue).toBeDefined();
          expect(targetValue!.trim().length).toBeGreaterThan(0);
          expect(ptValue.trim().length).toBeGreaterThan(0);
          expect(extractIcuPlaceholders(targetValue!)).toEqual(extractIcuPlaceholders(ptValue));
        }
      }
    }

    const ptComposed = collectLeafPaths(MESSAGES_BY_LOCALE.pt as unknown as Record<string, unknown>);
    for (const locale of ['es', 'en'] as const) {
      const composed = collectLeafPaths(getMessagesForLocale(locale) as unknown as Record<string, unknown>);
      expect([...composed.keys()].sort()).toEqual([...ptComposed.keys()].sort());
    }
    expect(getMessagesForLocale('fr-CA')).toEqual(MESSAGES_BY_LOCALE.pt);
  });

  test('useSafeLocale and useSafeTranslations fall back to pt in standalone renderToStaticMarkup and translate with renderWithIntl', () => {
    const standaloneHtml = renderToStaticMarkup(React.createElement(ProbeComponent));
    expect(standaloneHtml).toContain('data-locale="pt"');
    expect(standaloneHtml).toContain('Carregando FinanceApp…');
    expect(standaloneHtml).toContain('Resumo');

    const esHtml = renderWithIntl(React.createElement(ProbeComponent), 'es');
    expect(esHtml).toContain('data-locale="es"');
    expect(esHtml).toContain('Cargando FinanceApp…');
    expect(esHtml).toContain('Resumen');

    const enHtml = renderWithIntl(React.createElement(ProbeComponent), 'en');
    expect(enHtml).toContain('data-locale="en"');
    expect(enHtml).toContain('Loading FinanceApp…');
    expect(enHtml).toContain('Overview');
  });

  test('every ICU plural clause across all 18 PT UI namespaces declares =0 and formats 0, 1, and 2 correctly', () => {
    const messagesRoot = join(import.meta.dir, '..', 'messages');
    const missingZeroClauses: string[] = [];

    for (const ns of UI_NAMESPACES) {
      const ptJson = JSON.parse(readFileSync(join(messagesRoot, 'pt', `${ns}.json`), 'utf8')) as Record<string, unknown>;
      const ptLeaves = collectLeafPaths(ptJson);
      const t = createTranslator({
        locale: 'pt',
        messages: MESSAGES_BY_LOCALE.pt as unknown as Record<string, any>,
        ...(ns === 'common' ? {} : { namespace: ns }),
      });

      for (const [keyPath, template] of ptLeaves) {
        if (!template.includes(', plural,')) continue;
        const clauses = extractPluralClauses(template);
        expect(clauses.length).toBeGreaterThan(0);

        for (const clause of clauses) {
          if (!/(?:^|\s)=0\s*\{/.test(clause.body)) {
            missingZeroClauses.push(`${ns}.${keyPath} (${clause.variable})`);
          }
        }

        const placeholders = extractIcuPlaceholders(template);
        const makeParams = (n: number) =>
          Object.fromEntries(placeholders.map((name) => [name, n]));

        const renderedZero = t(keyPath as never, makeParams(0) as never);
        const renderedOne = t(keyPath as never, makeParams(1) as never);
        const renderedTwo = t(keyPath as never, makeParams(2) as never);

        expect(renderedZero.length).toBeGreaterThan(0);
        expect(renderedOne.length).toBeGreaterThan(0);
        expect(renderedTwo.length).toBeGreaterThan(0);
        expect(renderedZero).not.toContain(', plural,');
        expect(renderedOne).not.toContain(', plural,');
        expect(renderedTwo).not.toContain(', plural,');

        // When one and other differ, 0 must render the plural =0 form rather than the singular one form
        if (renderedOne.replace(/1/g, 'X') !== renderedTwo.replace(/2/g, 'X')) {
          expect(renderedZero.replace(/0/g, 'X')).toBe(renderedTwo.replace(/2/g, 'X'));
        }
      }
    }

    expect(missingZeroClauses).toEqual([]);

    const sampleCases: Array<{ ns: string; key: string; params: Record<number, Record<string, number>>; expected: [string, string, string] }> = [
      {
        ns: 'purchases',
        key: 'records.foundCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 compras encontradas', '1 compra encontrada', '2 compras encontradas'],
      },
      {
        ns: 'accounts',
        key: 'list.transactionCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 transações', '1 transação', '2 transações'],
      },
      {
        ns: 'categories',
        key: 'list.txCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['transações', 'transação', 'transações'],
      },
      {
        ns: 'categories',
        key: 'list.purchaseCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['compras', 'compra', 'compras'],
      },
      {
        ns: 'installments',
        key: 'summary.planCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 planos no total', '1 plano no total', '2 planos no total'],
      },
      {
        ns: 'investments',
        key: 'summary.investmentCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 investimentos', '1 investimento', '2 investimentos'],
      },
      {
        ns: 'notifications',
        key: 'unreadCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 novas', '1 nova', '2 novas'],
      },
      {
        ns: 'shell',
        key: 'globalSearch.resultCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 resultados', '1 resultado', '2 resultados'],
      },
      {
        ns: 'goals',
        key: 'budgetGoals.summary',
        params: {
          0: { activeCount: 0, completedCount: 0 },
          1: { activeCount: 1, completedCount: 1 },
          2: { activeCount: 2, completedCount: 2 },
        },
        expected: ['0 ativas · 0 concluídas', '1 ativa · 1 concluída', '2 ativas · 2 concluídas'],
      },
      {
        ns: 'dashboard',
        key: 'details.recentPurchases.itemCount',
        params: { 0: { count: 0 }, 1: { count: 1 }, 2: { count: 2 } },
        expected: ['0 itens', '1 item', '2 itens'],
      },
    ];

    for (const sample of sampleCases) {
      const t = createTranslator({
        locale: 'pt',
        messages: MESSAGES_BY_LOCALE.pt as unknown as Record<string, any>,
        namespace: sample.ns,
      });
      expect(t(sample.key as never, sample.params[0] as never)).toBe(sample.expected[0]);
      expect(t(sample.key as never, sample.params[1] as never)).toBe(sample.expected[1]);
      expect(t(sample.key as never, sample.params[2] as never)).toBe(sample.expected[2]);
    }
  });
});
