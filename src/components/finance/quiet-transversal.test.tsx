/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet } from 'lucide-react';
import * as search from './global-search';
import * as notifications from './notification-panel';
import { AIAdvisor } from './ai-advisor';

test('Busca mapeia os cinco tipos emitidos a views existentes e ignora tipos desconhecidos', () => {
  expect(search).toHaveProperty('searchDestination');
  const destination = (search as typeof search & { searchDestination: (type: string) => string | undefined }).searchDestination;
  expect(destination('transactions')).toBe('accounts');
  expect(destination('purchases')).toBe('purchases');
  expect(destination('accounts')).toBe('accounts');
  expect(destination('cards')).toBe('cards');
  expect(destination('categories')).toBe('categories');
  expect(destination('investment')).toBeUndefined();
  expect(destination('__proto__')).toBeUndefined();
});

test('Busca mantém seleção utilizável após setas sem resultados', () => {
  let active = 0;
  const selected: string[] = [];
  const context = { results: [] as { type: search.SearchResultType; id: string }[], activeIndex: active, setActiveIndex: (update: (index: number) => number) => { active = update(active); }, onSelect: (type: search.SearchResultType, id: string) => selected.push(`${type}:${id}`), onClose: noop };
  const key = (value: string) => ({ key: value, preventDefault: noop });
  search.handleSearchKeyDown(key('ArrowDown'), context);
  search.handleSearchKeyDown(key('ArrowUp'), context);
  context.results = [{ type: 'accounts', id: 'conta' }];
  context.activeIndex = active;
  search.handleSearchKeyDown(key('Enter'), context);
  expect(selected).toEqual(['accounts:conta']);
});

test('Busca limita seleção quando lista encolhe e mantém navegação circular', () => {
  let active = 8;
  const selected: string[] = [];
  const context = { results: [{ type: 'accounts' as const, id: 'a' }, { type: 'cards' as const, id: 'b' }], activeIndex: active, setActiveIndex: (update: (index: number) => number) => { active = update(active); }, onSelect: (type: search.SearchResultType, id: string) => selected.push(`${type}:${id}`), onClose: noop };
  const key = (value: string) => ({ key: value, preventDefault: noop });
  search.handleSearchKeyDown(key('Enter'), context);
  expect(selected).toEqual(['cards:b']);
  search.handleSearchKeyDown(key('ArrowDown'), context);
  expect(active).toBe(0);
  search.handleSearchKeyDown(key('ArrowUp'), context);
  expect(active).toBe(1);
});

test('Escape fica exclusivamente com o diálogo e não fecha pelo campo', () => {
  let closes = 0;
  search.handleSearchKeyDown({ key: 'Escape', preventDefault: noop }, { results: [], activeIndex: 0, setActiveIndex: noop, onClose: () => { closes++; } });
  expect(closes).toBe(0);
});

const noop = () => {};

test('Busca organiza resultados por grupo e preserva índices e dados mascarados', () => {
  expect(search).toHaveProperty('SearchResults');
  const html = renderToStaticMarkup(<search.SearchResults
    loading={false} query="sintético" activeIndex={1} onActivate={noop} onSelect={noop}
    groups={[
      { key: 'accounts', title: 'Contas', results: [
        { id: 'a', type: 'accounts', label: 'Saldo sintético', secondary: 'R$ 0,00 · Banco', icon: Wallet },
      ] },
      { key: 'cards', title: 'Cartões', results: [
        { id: 'c', type: 'cards', label: 'Cartão sintético · •••• 1234', secondary: 'Crédito · Fatura: R$ 42,50', icon: Wallet },
      ] },
    ]}
  />);
  expect(html).toMatch(/<h3[^>]*>Contas<\/h3>[\s\S]*<button[^>]*data-result-index="0"[^>]*>[\s\S]*Saldo sintético/);
  expect(html).toMatch(/<h3[^>]*>Cartões<\/h3>[\s\S]*<button[^>]*data-result-index="1"[^>]*>[\s\S]*•••• 1234/);
  expect(html).not.toMatch(/data-result-index="0"[^>]*data-active=/);
  expect(html).toMatch(/data-result-index="1"[^>]*data-active="true"/);
  expect(html).toContain('R$ 0,00');
  expect(html).not.toMatch(/bg-gradient|glass-card/);
});

test('Busca distingue carregamento, orientação inicial e vazio filtrado', () => {
  const status = (loading: boolean, query: string) => renderToStaticMarkup(<search.SearchResults
    groups={[]} query={query} loading={loading} activeIndex={0} onActivate={noop} onSelect={noop}
  />);
  expect(status(true, 'sintético')).toContain('Buscando dados...');
  expect(status(false, '')).toContain('Comece a digitar para buscar');
  expect(status(false, 'sintético')).toContain('Nenhum resultado encontrado');
});

test('Notificações identifica a atividade recente, o carregamento e o fechamento', () => {
  const html = renderToStaticMarkup(<notifications.NotificationPanel isOpen onClose={noop} />);
  expect(html).toContain('Atividade recente');
  expect(html).toContain('Carregando atividades');
  expect(html).toMatch(/<button[^>]*>Fechar<\/button>/);
  expect(html).not.toMatch(/bg-gradient|glass-card/);
});

test.each([
  ['income', 'Receita', 12.5, 'R$ 12,50'],
  ['income', 'Receita', -12.5, '-R$ 12,50'],
  ['expense', 'Despesa', -24.75, '-R$ 24,75'],
  ['purchase', 'Compra', -36, '-R$ 36,00'],
  ['income', 'Receita', 0, 'R$ 0,00'],
] as const)('Notificações exibe sinal monetário para %s', (kind, label, amount, signedAmount) => {
  const html = renderToStaticMarkup(<notifications.NotificationList notifications={[{
    id: 'fixture', kind, description: 'Registro sintético', amount, date: '2026-11-19T12:00:00Z',
  }]} />);
  expect(html).toContain(`${label} ·`);
  expect(html).toContain(`>${signedAmount}</span>`);
});

test('Assistente apresenta a conversa antes das sugestões e nomeia o envio', () => {
  const html = renderToStaticMarkup(<AIAdvisor />);
  expect(html).not.toMatch(/bg-gradient|glass-card|Online agora/);
  expect(html).toContain('aria-label="Conversa"');
  expect(html.indexOf('aria-label="Conversa"')).toBeLessThan(html.indexOf('Como economizar mais?'));
  for (const suggestion of ['Como economizar mais?', 'Análise dos meus gastos', 'Meta de investimento', 'Dicas para reduzir despesas']) {
    expect(html).toContain(suggestion);
  }
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Enviar mensagem"[^>]*disabled/);
});

import { readFileSync } from 'node:fs';

test('Assistente IA remove emojis, framer-motion e setTimeout de foco no mount', () => {
  const src = readFileSync(new URL('./ai-advisor.tsx', import.meta.url), 'utf8');
  expect(src).not.toMatch(/from 'framer-motion'|<motion\.|AnimatePresence/);
  expect(src).not.toMatch(/👋|⚠️/);
  expect(src).not.toContain('setTimeout(() => inputRef.current?.focus(), 300)');
});
