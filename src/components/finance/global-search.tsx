'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  ShoppingBag,
  Tag,
  Loader2,
  FileX,
  ArrowLeftRight,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
import type { ViewType } from '@/lib/store';

export type SearchResultType = 'transactions' | 'purchases' | 'accounts' | 'cards' | 'categories';

const searchDestinations: Record<SearchResultType, ViewType> = {
  transactions: 'accounts',
  purchases: 'purchases',
  accounts: 'accounts',
  cards: 'cards',
  categories: 'categories',
};

export function searchDestination(type: string): ViewType | undefined {
  return Object.hasOwn(searchDestinations, type)
    ? searchDestinations[type as SearchResultType]
    : undefined;
}

// ── Helpers ────────────────────────────────────────────────────────

const dateFmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

// ── Types ──────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  secondary: string;
  icon: React.ElementType;
  iconTone?: string;
  meta?: { accountId?: string };
}

interface SearchGroup {
  key: string;
  title: string;
  results: SearchResult[];
}

// ── Group metadata ─────────────────────────────────────────────────
const groupMeta: Record<string, { title: string; icon: React.ElementType }> = {
  transactions: { title: 'Transações', icon: ArrowLeftRight },
  purchases: { title: 'Compras', icon: ShoppingBag },
  accounts: { title: 'Contas', icon: Wallet },
  cards: { title: 'Cartões', icon: CreditCard },
  categories: { title: 'Categorias', icon: Tag },
};

const cardTypeLabels: Record<string, string> = {
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  BOTH: 'Crédito e Débito',
};

const accountTypeLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  BANK: 'Banco',
  DIGITAL_WALLET: 'Carteira Digital',
};

const categoryTypeLabels: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  BOTH: 'Ambos',
};

// ── Props ──────────────────────────────────────────────────────────
interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (type: SearchResultType, id: string, meta?: { accountId?: string }) => void;
}

type KeyboardResult = Pick<SearchResult, 'type' | 'id' | 'meta'>;

export function handleSearchKeyDown(
  e: Pick<React.KeyboardEvent, 'key' | 'preventDefault'>,
  { results: flatResults, activeIndex, setActiveIndex, onSelect, onClose }: {
    results: KeyboardResult[];
    activeIndex: number;
    setActiveIndex: (update: (index: number) => number) => void;
    onSelect?: (type: SearchResultType, id: string, meta?: { accountId?: string }) => void;
    onClose: () => void;
  },
) {
  const boundedIndex = (index: number) => Number.isInteger(index) ? Math.max(0, Math.min(index, flatResults.length - 1)) : 0;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (flatResults.length === 0) return;
    const direction = e.key === 'ArrowDown' ? 1 : -1;
    setActiveIndex((prev) => (boundedIndex(prev) + direction + flatResults.length) % flatResults.length);
  } else if (e.key === 'Enter' && flatResults.length > 0) {
    e.preventDefault();
    const result = flatResults[boundedIndex(activeIndex)];
    onSelect?.(result.type, result.id, result.meta);
    onClose();
  }
}

// ── Component ──────────────────────────────────────────────────────
export function GlobalSearch({ isOpen, onClose, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [rawData, setRawData] = useState<Record<string, any[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Fetch all data on open ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const endpoints = [
        ['transactions', '/api/transactions'],
        ['purchases', '/api/purchases'],
        ['accounts', '/api/accounts'],
        ['cards', '/api/cards'],
        ['categories', '/api/categories'],
      ] as const;

      let failedCount = 0;
      const entries = await Promise.all(
        endpoints.map(async ([key, url]) => {
          try {
            const res = await fetch(url);
            if (res.ok) return [key, await res.json()] as const;
            failedCount++;
            return [key, []] as const;
          } catch {
            failedCount++;
            return [key, []] as const;
          }
        })
      );

      setError(failedCount > 0);
      setRawData(Object.fromEntries(entries));
    } catch {
      setError(true);
      console.error('Erro ao buscar dados para busca global');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      fetchAll();
    }
  }, [isOpen, fetchAll]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Build flat result list ───────────────────────────────────────
  const flatResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Transactions
    for (const t of rawData.transactions ?? []) {
      const txDate = formatPurchaseDate(t.date);
      const searchable = `${t.description || ''} ${t.category?.name || ''} ${t.type || ''} ${txDate}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      const isIn = t.type === 'INCOME';
      results.push({
        id: t.id,
        type: 'transactions',
        label: t.description || 'Sem descrição',
        secondary: `${isIn ? '+' : '-'}${currencyFmt(t.amount)} · ${txDate}`,
        icon: isIn ? ArrowUpRight : ArrowDownRight,
        iconTone: isIn ? 'text-(--ds-accent-positive)' : 'text-(--ds-accent-danger)',
        meta: t.accountId ? { accountId: t.accountId } : undefined,
      });
    }

    // Purchases
    for (const p of rawData.purchases ?? []) {
      const date = formatPurchaseDate(p.date);
      const searchable = `${p.merchant || ''} ${p.card?.name || ''} ${p.category?.name || ''} ${date}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      results.push({
        id: p.id,
        type: 'purchases',
        label: p.merchant || 'Sem estabelecimento',
        secondary: `${currencyFmt(p.totalAmount)} · ${date}${p.card ? ` · ${p.card.name}` : ''}`,
        icon: ShoppingBag,
      });
    }

    // Accounts
    for (const a of rawData.accounts ?? []) {
      const searchable = `${a.name || ''} ${accountTypeLabels[a.type] || ''} ${currencyFmt(a.balance)}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      results.push({
        id: a.id,
        type: 'accounts',
        label: a.name || 'Sem nome',
        secondary: `${currencyFmt(a.balance)} · ${accountTypeLabels[a.type] || a.type}`,
        icon: Wallet,
      });
    }

    // Cards
    for (const c of rawData.cards ?? []) {
      const searchable = `${c.name || ''} ${c.brand || ''} ${c.lastFourDigits || ''} ${cardTypeLabels[c.type] || ''}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      results.push({
        id: c.id,
        type: 'cards',
        label: `${c.name || 'Cartão'} · •••• ${c.lastFourDigits || '0000'}`,
        secondary: `${cardTypeLabels[c.type] || c.type} · ${c.brand || ''} · Fatura: ${currencyFmt(c.currentBalance || 0)}`,
        icon: CreditCard,
      });
    }

    // Categories
    for (const cat of rawData.categories ?? []) {
      const searchable = `${cat.name || ''} ${categoryTypeLabels[cat.type] || ''}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      results.push({
        id: cat.id,
        type: 'categories',
        label: cat.name || 'Sem nome',
        secondary: categoryTypeLabels[cat.type] || cat.type,
        icon: Tag,
      });
    }

    return results;
  }, [rawData, query]);

  // ── Grouped results ──────────────────────────────────────────────
  const groupedResults = useMemo<SearchGroup[]>(() => {
    const groups: SearchGroup[] = [];
    const order = ['transactions', 'purchases', 'accounts', 'cards', 'categories'];

    for (const key of order) {
      const meta = groupMeta[key];
      const results = flatResults.filter((r) => r.type === key);
      if (results.length > 0) {
        groups.push({ key, title: meta.title, results });
      }
    }

    return groups;
  }, [flatResults]);

  useEffect(() => {
    setActiveIndex((index) => Number.isInteger(index) ? Math.max(0, Math.min(index, flatResults.length - 1)) : 0);
  }, [flatResults.length]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // ── Keyboard navigation ──────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => handleSearchKeyDown(e, { results: flatResults, activeIndex, setActiveIndex, onSelect, onClose }),
    [flatResults, activeIndex, onSelect, onClose]
  );

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-result-index]');
      const target = items[activeIndex] as HTMLElement | undefined;
      if (target) {
        target.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="gap-0 overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg motion-reduce:animate-none sm:max-w-[560px]">
        {isOpen && (
          <div
            data-quiet-search
            className="flex max-h-[80dvh] min-w-0 flex-col transition-opacity duration-150 motion-reduce:transition-none"
          >
              <header className="shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
                <DialogTitle className="pr-8 text-base">Busca Global</DialogTitle>
                <DialogDescription className="mt-1.5 pr-6 text-xs">
                  Transações, compras, contas, cartões e categorias
                </DialogDescription>
                <div className="relative mt-3">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    aria-label="Buscar nas finanças"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite um termo de busca…"
                    className="h-10 rounded-md bg-background pl-9"
                  />
                </div>
              </header>

              <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[48dvh]">
                <div ref={listRef}>
                  {error && !loading && (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs sm:px-5">
                      <span className="text-destructive">Não foi possível carregar todos os dados da busca.</span>
                      <button
                        type="button"
                        onClick={() => void fetchAll()}
                        className="rounded border border-border bg-card px-2 py-1 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-(--ds-focus)"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  <SearchResults
                    groups={groupedResults}
                    query={query}
                    loading={loading}
                    activeIndex={activeIndex}
                    onActivate={setActiveIndex}
                    onSelect={(type, id, meta) => {
                      onSelect?.(type, id, meta);
                      onClose();
                    }}
                  />
                </div>
              </ScrollArea>

              {flatResults.length > 0 && (
                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                  <span className="tabular-nums">
                    {flatResults.length} resultado{flatResults.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-3">
                    <span><kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> Navegar</span>
                    <span><kbd className="rounded border border-border px-1 font-mono">↵</kbd> Selecionar</span>
                  </div>
                </footer>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SearchResultsProps {
  groups: SearchGroup[];
  query: string;
  loading: boolean;
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (type: SearchResult['type'], id: string, meta?: SearchResult['meta']) => void;
}

export function SearchResults({ groups, query, loading, activeIndex, onActivate, onSelect }: SearchResultsProps) {
  if (loading || groups.length === 0) {
    const hasQuery = query.trim() !== '';
    const Icon = loading ? Loader2 : hasQuery ? FileX : Search;
    return (
      <div role="status" className="flex items-start gap-3 px-4 py-6 text-muted-foreground sm:px-5">
        <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${loading ? 'motion-safe:animate-spin' : ''}`} />
        <div>
          <p className="text-sm font-medium text-foreground">
            {loading ? 'Buscando dados...' : hasQuery ? 'Nenhum resultado encontrado' : 'Comece a digitar para buscar'}
          </p>
          {(!loading && hasQuery) && <p className="mt-1 text-xs">Tente buscar por outro termo.</p>}
        </div>
      </div>
    );
  }

  let globalIdx = 0;
  return (
    <div className="divide-y divide-border">
      {groups.map((group) => {
        const GroupIcon = groupMeta[group.key].icon;
        return (
          <section key={group.key} className="px-2 pb-2 sm:px-3">
            <div className="flex items-center gap-2 px-2 pb-1 pt-2.5 text-muted-foreground">
              <GroupIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <h3 className="text-xs font-semibold">{group.title}</h3>
              <span className="ml-auto font-mono text-xs tabular-nums">{group.results.length}</span>
            </div>
            <ul>
              {group.results.map((result) => {
                const index = globalIdx++;
                const Icon = result.icon;
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      data-result-index={index}
                      data-active={index === activeIndex ? "true" : undefined}
                      onClick={() => onSelect(result.type, result.id, result.meta)}
                      onMouseEnter={() => onActivate(index)}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-md border-s-2 border-transparent px-2 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ds-focus) data-[active=true]:border-primary data-[active=true]:bg-muted"
                    >
                      <Icon aria-hidden="true" className={`size-4 shrink-0 ${result.iconTone ?? 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{result.label}</p>
                        <p className={`truncate text-xs text-muted-foreground ${result.type !== 'categories' ? 'font-mono tabular-nums' : ''}`}>{result.secondary}</p>
                      </div>
                      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
