/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
});
