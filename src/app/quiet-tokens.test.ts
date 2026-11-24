/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const theme = readFileSync(new URL('../../docs/reference/design-system.premium-theme.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const light = theme.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
const dark = theme.match(/body\.dark-reference\s*\{([^}]*)\}/)?.[1] ?? '';

function token(block: string, name: string): string {
  return block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))?.[1].trim() ?? '';
}

type RGB = [number, number, number];

function color(value: string, background: RGB = [1, 1, 1]): RGB {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255) as RGB;
  const neutral = value.match(/^oklch\((0?\.\d+|1) 0 0(?: \/ (\d+)%)?\)$/);
  if (!neutral) throw new Error(`Cor não suportada: ${value}`);
  const linear = Number(neutral[1]) ** 3;
  const channel = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const alpha = neutral[2] ? Number(neutral[2]) / 100 : 1;
  return background.map((bg) => channel * alpha + bg * (1 - alpha)) as RGB;
}

function contrast(a: RGB, b: RGB): number {
  const luminance = (rgb: RGB) => rgb.reduce((sum, channel, i) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe('contrato de tokens Quiet', () => {
  test('usa grafite neutro e ação ciano no escuro conforme o conceito', () => {
    expect(token(dark, 'ds-bg')).toBe('oklch(0.145 0 0)');
    expect(token(dark, 'ds-surface')).toBe('oklch(0.205 0 0)');
    expect(token(dark, 'ds-primary')).toBe('oklch(0.72 0.14 232)');
    expect(token(dark, 'ds-accent-positive')).not.toBe(token(dark, 'ds-primary'));
  });

  test('usa superfícies neutras e ação ciano no claro', () => {
    expect(token(light, 'ds-bg')).toBe('oklch(0.98 0 0)');
    expect(token(light, 'ds-surface')).toBe('oklch(1 0 0)');
    expect(token(light, 'ds-primary')).toBe('oklch(0.47 0.12 232)');
    expect(token(light, 'ds-accent-positive')).not.toBe(token(light, 'ds-primary'));
  });

  test('ativa o bloco escuro pela classe usada no aplicativo', () => {
    expect(theme).toMatch(/\.dark\s*,\s*\[data-theme="dark"\]\s*,\s*body\.dark-reference\s*\{/);
    expect(globals).toMatch(/\.dark\s*\{[^}]*--input:\s*var\(--ds-input\);/);
  });

  for (const [mode, block] of [['claro', light], ['escuro', dark]] as const) {
    test(`borda funcional e foco visível têm contraste em ${mode}`, () => {
      const surface = color(token(block, 'ds-surface'));
      const border = color(token(block, 'ds-input'), surface);
      expect(contrast(border, surface)).toBeGreaterThanOrEqual(3);
      // Input aplica dark:bg-input/30; avaliar também o preenchimento composto.
      if (mode === 'escuro') {
        const fill = surface.map((channel, i) => channel * 0.7 + border[i] * 0.3) as RGB;
        expect(contrast(border, fill)).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(color(token(block, 'ds-focus')), surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(color(token(block, 'ds-focus')), color(token(block, 'ds-bg')))).toBeGreaterThanOrEqual(3);
      expect(globals).toMatch(/\[data-slot="input"\]:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ds-focus\)/);
    });

    test(`cores semânticas de texto contrastam com superfície em ${mode}`, () => {
      for (const name of ['ds-accent-info', 'ds-accent-warning', 'ds-accent-ai']) {
        expect(contrast(color(token(block, name)), color(token(block, 'ds-surface')))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test('gatilhos de navegação, menus e seleção usam o mesmo contorno opaco', () => {
    for (const slot of ['button', 'select-trigger', 'tabs-trigger', 'dropdown-menu-trigger', 'popover-trigger']) {
      expect(globals).toContain(`[data-slot="${slot}"]:focus-visible`);
    }
    expect(globals).toMatch(/\[data-slot="select-trigger"\]:focus-visible[^\{]*\{[^}]*outline:\s*2px solid var\(--ds-focus\)/);
  });

  test('preserva a entrada e aliases usados pelos componentes e receitas legadas', () => {
    expect(globals).toContain('@import "../../docs/reference/design-system.premium-theme.css";');
    for (const block of [light, dark]) {
      expect(token(block, 'money')).toBe('var(--ds-accent-positive)');
      expect(token(block, 'forecast')).toBe('var(--ds-accent-info)');
      expect(token(block, 'ledger-bg')).toBe('var(--ds-bg)');
      expect(token(block, 'vault-surface')).toBe('var(--ds-surface)');
    }
    expect(globals).toContain('--primary: var(--ds-primary);');
    expect(globals).toContain('.glass-card');
  });

  test('usa tokens --ds-* em .glass-card e remove classes slop legadas de globals.css', () => {
    const glassMatch = globals.match(/\.glass-card\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(glassMatch).toContain('var(--ds-surface)');
    expect(glassMatch).toContain('var(--ds-border)');
    expect(glassMatch).not.toContain('rgba(255, 255, 255');
    for (const legacy of [
      '.card-glow',
      '.gradient-border',
      '.animate-float',
      '.card-premium',
      '.hero-gradient',
      '.counter-glow',
      '.animate-breathe',
      '.card-elevated',
      '.hover-lift',
      '.status-glow-',
      '.hover-shimmer',
      '.text-gradient-emerald',
      '.text-gradient-rose',
      '.text-gradient-violet',
      '.animate-morph',
      '.gradient-orb',
      '.card-border-glow',
      '.shimmer',
      '.success-glow',
      '.warning-glow',
      '.danger-glow',
      '.badge-glow',
    ]) {
      expect(globals).not.toContain(legacy);
    }
  });
});
