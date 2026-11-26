/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CANONICAL_LOCALES, LOCALE_COOKIE, LOCALE_METADATA } from '@/i18n/config';
import { renderWithIntl } from '@/test-utils/intl';
import { LocaleFlagIcon } from '@/components/shared/locale-flag-icon';
import {
  LanguageSwitcher,
  LanguageSwitcherOptionRow,
  applyLocaleSelection,
} from './language-switcher';

describe('LocaleFlagIcon e bandeiras SVG', () => {
  test('arquivos SVG decorativos existem em public/locale-flags/{pt,es,en}.svg', () => {
    const publicRoot = join(import.meta.dir, '..', '..', '..', 'public', 'locale-flags');
    for (const locale of CANONICAL_LOCALES) {
      const svgPath = join(publicRoot, `${locale}.svg`);
      expect(existsSync(svgPath)).toBe(true);
      const svg = readFileSync(svgPath, 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('role="presentation"');
    }
  });

  test('LocaleFlagIcon renderiza img puramente decorativo para cada locale', () => {
    for (const locale of CANONICAL_LOCALES) {
      const html = renderToStaticMarkup(<LocaleFlagIcon locale={locale} />);
      expect(html).toContain(`src="${LOCALE_METADATA[locale].flagPath}"`);
      expect(html).toContain('alt=""');
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe('LanguageSwitcher acessível e Quiet Financial OS', () => {
  test('renderiza fallback em pt fora de AppIntlProvider nos modos compact e full', () => {
    const compactHtml = renderToStaticMarkup(<LanguageSwitcher variant="compact" />);
    expect(compactHtml).toContain('data-language-switcher="compact"');
    expect(compactHtml).toContain('aria-label="Selecionar idioma"');
    expect(compactHtml).toContain('PT');
    expect(compactHtml).toContain('src="/locale-flags/pt.svg"');
    expect(compactHtml).toContain('alt=""');
    expect(compactHtml).toContain('aria-hidden="true"');

    const fullHtml = renderToStaticMarkup(<LanguageSwitcher variant="full" />);
    expect(fullHtml).toContain('data-language-switcher="full"');
    expect(fullHtml).toContain('aria-label="Selecionar idioma"');
    expect(fullHtml).toContain('Português');
    expect(fullHtml).toContain('PT');
  });

  test('renderiza autônimos, siglas e rótulos acessíveis para pt, es e en via renderWithIntl', () => {
    const cases = [
      { locale: 'pt' as const, label: 'Selecionar idioma', shortCode: 'PT', autonym: 'Português' },
      { locale: 'es' as const, label: 'Seleccionar idioma', shortCode: 'ES', autonym: 'Español' },
      { locale: 'en' as const, label: 'Select language', shortCode: 'EN', autonym: 'English' },
    ];

    for (const item of cases) {
      const compact = renderWithIntl(<LanguageSwitcher variant="compact" />, item.locale);
      expect(compact).toContain(`aria-label="${item.label}"`);
      expect(compact).toContain(item.shortCode);
      expect(compact).toContain(`src="/locale-flags/${item.locale}.svg"`);

      const full = renderWithIntl(<LanguageSwitcher variant="full" />, item.locale);
      expect(full).toContain(`aria-label="${item.label}"`);
      expect(full).toContain(item.autonym);
      expect(full).toContain(item.shortCode);
    }
  });

  test('opções exibem os 3 idiomas canônicos com autônimo, sigla, bandeira decorativa e marcação ativa', () => {
    const html = renderToStaticMarkup(
      <div>
        {CANONICAL_LOCALES.map((code) => (
          <LanguageSwitcherOptionRow
            key={code}
            item={LOCALE_METADATA[code]}
            active={code === 'es'}
          />
        ))}
      </div>,
    );

    expect(html).toContain('data-locale="pt"');
    expect(html).toContain('data-locale="es"');
    expect(html).toContain('data-locale="en"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('Português');
    expect(html).toContain('Español');
    expect(html).toContain('English');
    expect(html).toContain('PT');
    expect(html).toContain('ES');
    expect(html).toContain('EN');
    expect(html).toContain('<svg');
  });

  test('applyLocaleSelection grava cookie apenas quando muda de idioma e dispara callback ou refresh', () => {
    const selected: string[] = [];
    let refreshed = 0;
    const prevDoc = globalThis.document;
    const fakeDoc = { cookie: '' };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDoc,
    });

    try {
      applyLocaleSelection('es', 'es', (next) => selected.push(next), () => {
        refreshed++;
      });
      expect(selected).toEqual([]);
      expect(refreshed).toBe(0);
      expect(fakeDoc.cookie).toBe('');

      applyLocaleSelection('en', 'es', (next) => selected.push(next), () => {
        refreshed++;
      });
      expect(selected).toEqual(['en']);
      expect(refreshed).toBe(0);
      expect(fakeDoc.cookie).toContain(`${LOCALE_COOKIE}=en`);

      applyLocaleSelection('pt', 'en', undefined, () => {
        refreshed++;
      });
      expect(refreshed).toBe(1);
      expect(fakeDoc.cookie).toContain(`${LOCALE_COOKIE}=pt`);
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: prevDoc,
      });
    }
  });

  test('cumpre Quiet Financial OS e gate AST (sem framer-motion e sem classes condicionais em template string)', () => {
    const flagSrc = readFileSync(
      new URL('../shared/locale-flag-icon.tsx', import.meta.url),
      'utf8',
    );
    const switcherSrc = readFileSync(
      new URL('./language-switcher.tsx', import.meta.url),
      'utf8',
    );

    for (const src of [flagSrc, switcherSrc]) {
      expect(src).not.toContain('framer-motion');
      expect(src).not.toMatch(/className=\{`[^`]*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"][^`]*`\}/);
      expect(src).toContain('cn(');
    }
  });
});
