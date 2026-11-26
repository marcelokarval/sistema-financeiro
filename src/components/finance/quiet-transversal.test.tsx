/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet } from 'lucide-react';
import * as search from './global-search';
import * as notifications from './notification-panel';
import { AIAdvisor } from './ai-advisor';
import { renderWithIntl } from '@/test-utils/intl';
import { CANONICAL_LOCALES, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { AppIntlBridgeContext } from '@/i18n/provider';

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

test('Assistente IA remove emojis, framer-motion e setTimeout de foco no mount', () => {
  const src = readFileSync(new URL('./ai-advisor.tsx', import.meta.url), 'utf8');
  expect(src).not.toMatch(/from 'framer-motion'|<motion\.|AnimatePresence/);
  expect(src).not.toMatch(/👋|⚠️/);
  expect(src).not.toContain('setTimeout(() => inputRef.current?.focus(), 300)');
});

test('renderiza NotificationPanel, NotificationList, AIAdvisor e SearchResults em pt, es e en sem vazar chaves', () => {
  const expected = {
    pt: { notifTitle: 'Notificações', income: 'Receita', conversation: 'Conversa', emptySearch: 'Comece a digitar para buscar' },
    es: { notifTitle: 'Notificaciones', income: 'Ingreso', conversation: 'Conversación', emptySearch: 'Empieza a escribir para buscar' },
    en: { notifTitle: 'Notifications', income: 'Income', conversation: 'Conversation', emptySearch: 'Start typing to search' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const panelHtml = renderWithIntl(<notifications.NotificationPanel isOpen onClose={() => {}} />, locale);
    expect(panelHtml).toContain(expected[locale].notifTitle);
    expect(panelHtml).not.toContain('MISSING_MESSAGE');

    const listHtml = renderWithIntl(
      <notifications.NotificationList
        notifications={[{ id: 'fx', kind: 'income', description: 'Salário', amount: 150, date: '2026-11-19T12:00:00Z' }]}
      />,
      locale,
    );
    expect(listHtml).toContain(`${expected[locale].income} ·`);

    const advisorHtml = renderWithIntl(<AIAdvisor />, locale);
    expect(advisorHtml).toContain(`aria-label="${expected[locale].conversation}"`);
    expect(advisorHtml).not.toContain('MISSING_MESSAGE');

    const searchHtml = renderWithIntl(
      <search.SearchResults groups={[]} query="" activeIndex={0} loading={false} onActivate={noop} onSelect={noop} />,
      locale,
    );
    expect(searchHtml).toContain(expected[locale].emptySearch);
  }
});

test('mantém paridade recursiva de chaves e placeholders ICU nos 18 namespaces UI entre pt, es e en', () => {
  const uiNamespaces = [
    'common', 'shell', 'shared', 'dashboard', 'goals', 'analytics',
    'accounts', 'cards', 'purchases', 'categories', 'receipts',
    'investments', 'installments', 'consortiums', 'savings',
    'recurring', 'notifications', 'advisor',
  ] as const;

  function flattenLeafStrings(node: unknown, prefix = ''): Map<string, string> {
    const out = new Map<string, string>();
    if (typeof node === 'string') {
      out.set(prefix, node);
      return out;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node)) {
        const next = prefix ? `${prefix}.${k}` : k;
        for (const [lk, lv] of flattenLeafStrings(v, next)) {
          out.set(lk, lv);
        }
      }
    }
    return out;
  }

  function extractPlaceholders(str: string): string[] {
    const vars = new Set<string>();
    const collect = (input: string) => {
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
        const inner = input.slice(i + 1, end - 1);
        const match = inner.match(/^([a-zA-Z0-9_]+)(?:\s*,\s*([a-zA-Z]+)\s*,([\s\S]*))?$/);
        if (match) {
          vars.add(match[1]);
          if (match[2] && /^(plural|select|selectordinal)$/i.test(match[2]) && match[3]) {
            const branches = match[3];
            let j = 0;
            while (j < branches.length) {
              if (branches[j] !== '{') {
                j += 1;
                continue;
              }
              let bd = 1;
              let bEnd = j + 1;
              while (bEnd < branches.length && bd > 0) {
                if (branches[bEnd] === '{') bd += 1;
                else if (branches[bEnd] === '}') bd -= 1;
                bEnd += 1;
              }
              collect(branches.slice(j + 1, bEnd - 1));
              j = bEnd;
            }
          }
        }
        i = end;
      }
    };
    collect(str);
    return [...vars].sort();
  }

  const rootMessages = join(process.cwd(), 'src', 'messages');
  for (const ns of uiNamespaces) {
    const ptMap = flattenLeafStrings(JSON.parse(readFileSync(join(rootMessages, 'pt', `${ns}.json`), 'utf8')));
    expect(ptMap.size).toBeGreaterThan(0);
    for (const locale of ['es', 'en'] as const) {
      const otherMap = flattenLeafStrings(JSON.parse(readFileSync(join(rootMessages, locale, `${ns}.json`), 'utf8')));
      expect([...otherMap.keys()].sort()).toEqual([...ptMap.keys()].sort());
      for (const [key, ptVal] of ptMap) {
        const otherVal = otherMap.get(key) ?? '';
        expect(otherVal.trim().length).toBeGreaterThan(0);
        expect(extractPlaceholders(otherVal)).toEqual(extractPlaceholders(ptVal));
      }
    }
  }
});

test('#10: AIAdvisor trata falha de transporte TypeError("Failed to fetch") com erro localizado nos 3 idiomas sem vazar texto cru', async () => {
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousH = internals.H;
  const originalFetch = globalThis.fetch;

  const expectedConnectError = {
    pt: 'Erro ao conectar com o assistente.',
    es: 'Error al conectar con el asistente.',
    en: 'Failed to connect to the advisor.',
  } as const;

  try {
    globalThis.fetch = Object.assign(
      async () => {
        throw new TypeError('Failed to fetch');
      },
      { preconnect: () => {} },
    ) as typeof fetch;

    for (const locale of CANONICAL_LOCALES) {
      const states: unknown[] = [];
      const refs: { current: unknown }[] = [];
      const callbacks: Array<{ deps?: readonly unknown[]; fn: unknown }> = [];
      const depsChanged = (a?: readonly unknown[], b?: readonly unknown[]) =>
        !a || !b || a.length !== b.length || b.some((v, i) => !Object.is(v, a[i]));

      const renderAdvisor = () => {
        let s = 0, r = 0, c = 0;
        internals.H = {
          useState(initial: unknown) {
            const i = s++;
            if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
            return [states[i], (next: unknown) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
          },
          useRef: (init: unknown) => (refs[r++] ??= { current: init }),
          useCallback: (fn: unknown, deps?: readonly unknown[]) => {
            const i = c++;
            if (!callbacks[i] || depsChanged(callbacks[i].deps, deps)) callbacks[i] = { deps, fn };
            return callbacks[i].fn;
          },
          useMemo: (f: () => unknown) => f(),
          useContext: (ctx: React.Context<unknown>) =>
            ctx === AppIntlBridgeContext
              ? { locale, messages: getMessagesForLocale(locale as CanonicalLocale) }
              : (ctx as unknown as { _currentValue?: unknown })._currentValue,
          useEffect: () => {},
        };
        return AIAdvisor();
      };

      const tree = renderAdvisor();
      const findComposer = (node: React.ReactNode): React.ReactElement<Record<string, any>> | undefined => {
        for (const child of React.Children.toArray(node)) {
          if (!React.isValidElement<Record<string, any>>(child)) continue;
          if (typeof child.type === 'function' && child.type.name === 'AdvisorComposer') return child;
          const nested = findComposer(child.props.children);
          if (nested) return nested;
        }
        return undefined;
      };

      const composer = findComposer(tree)!;
      expect(composer).toBeDefined();
      await composer.props.onSuggestionClick('Como economizar?');

      const updatedTree = renderAdvisor();
      const logNode = (function findLog(node: React.ReactNode): React.ReactElement<Record<string, any>> | undefined {
        for (const child of React.Children.toArray(node)) {
          if (!React.isValidElement<Record<string, any>>(child)) continue;
          if (child.props.role === 'log') return child;
          const nested = findLog(child.props.children);
          if (nested) return nested;
        }
        return undefined;
      })(updatedTree)!;
      const messages = React.Children.toArray(logNode.props.children)
        .filter((c): c is React.ReactElement<{ message: { content: string } }> => React.isValidElement(c) && Boolean((c.props as { message?: unknown }).message))
        .map((c) => c.props.message.content);
      const lastContent = messages.at(-1) ?? '';
      expect(lastContent).toBe(expectedConnectError[locale]);
      expect(lastContent).not.toContain('Failed to fetch');
    }
  } finally {
    internals.H = previousH;
    globalThis.fetch = originalFetch;
  }
});
