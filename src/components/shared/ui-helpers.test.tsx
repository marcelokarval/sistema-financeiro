/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet } from 'lucide-react';
import * as uiHelpers from './ui-helpers';

test('ui-helpers exporta apenas EmptyState e StatusBadge sem componentes órfãos legados', () => {
  expect(Object.keys(uiHelpers).sort()).toEqual(['EmptyState', 'StatusBadge']);
  const source = readFileSync(new URL('./ui-helpers.tsx', import.meta.url), 'utf8');
  expect(source).not.toMatch(/card-glow|card-elevated|hover-lift|focus-gradient|bg-gradient|shadow-md|shadow-lg|hover:shadow-xl|text-white|framer-motion/);
});

test('EmptyState e StatusBadge renderizam markup Quiet acessível sem opacidades ou decorações legadas', () => {
  const emptyHtml = renderToStaticMarkup(
    <uiHelpers.EmptyState icon={Wallet} title="Nenhum registro" subtitle="Adicione um item para começar." />,
  );
  expect(emptyHtml).toContain('Nenhum registro');
  expect(emptyHtml).toContain('Adicione um item para começar.');
  expect(emptyHtml).not.toContain('text-muted-foreground/70');
  expect(emptyHtml).not.toMatch(/rounded-2xl|bg-gradient|card-glow/);

  const badgeHtml = renderToStaticMarkup(
    <uiHelpers.StatusBadge status="ACTIVE" labels={{ ACTIVE: { text: 'Ativo', className: 'bg-muted text-[var(--ds-accent-positive)]' } }} />,
  );
  expect(badgeHtml).toContain('Ativo');
  expect(badgeHtml).toContain('text-xs');
  expect(badgeHtml).not.toContain('text-[10px]');

  const fallbackHtml = renderToStaticMarkup(
    <uiHelpers.StatusBadge status="UNKNOWN" labels={{}} />,
  );
  expect(fallbackHtml).toContain('UNKNOWN');
  expect(fallbackHtml).toContain('bg-muted text-muted-foreground');
});
