'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createTranslator } from 'next-intl';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  CalendarClock,
  Wallet,
  CreditCard,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DEFAULT_LOCALE, normalizeLocale, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
import { normalizeSearchText } from '@/lib/search-normalize';
import type { ViewType } from '@/lib/store';
import {
  GlobalSearchResult,
  SearchResults,
  searchGroupMeta,
  type SearchGroup,
  type SearchResult,
  type SearchResultType,
} from './global-search-result';

export {
  GlobalSearchResult,
  SearchResults,
  type SearchGroup,
  type SearchResult,
  type SearchResultType,
};

const searchDestinations: Record<SearchResultType, ViewType> = {
  transactions: 'accounts',
  purchases: 'purchases',
  accounts: 'accounts',
  cards: 'cards',
  categories: 'categories',
  investments: 'investments',
  installments: 'installments',
  consortiums: 'consortiums',
};

export function searchDestination(type: string): ViewType | undefined {
  return Object.hasOwn(searchDestinations, type)
    ? searchDestinations[type as SearchResultType]
    : undefined;
}

const KNOWN_CARD_TYPES = new Set(['CREDIT', 'DEBIT', 'BOTH']);
const KNOWN_ACCOUNT_TYPES = new Set(['CASH', 'BANK', 'DIGITAL_WALLET']);
const KNOWN_CATEGORY_TYPES = new Set(['INCOME', 'EXPENSE', 'BOTH']);
const SEARCH_GROUP_KEYS = [
  'transactions',
  'purchases',
  'accounts',
  'cards',
  'categories',
  'investments',
  'installments',
  'consortiums',
] as const;

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

export type GlobalSearchStatus = {
  rawData: Record<string, any[]>;
  error: boolean;
};

export async function requestGlobalSearch(
  signal: AbortSignal,
  publish: (result: GlobalSearchStatus) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const endpoints = [
    ['transactions', '/api/transactions'],
    ['purchases', '/api/purchases'],
    ['accounts', '/api/accounts'],
    ['cards', '/api/cards'],
    ['categories', '/api/categories'],
    ['investments', '/api/investments'],
    ['installments', '/api/installments'],
    ['consortiums', '/api/consortiums'],
  ] as const;

  let failedCount = 0;
  const entries = await Promise.all(
    endpoints.map(async ([key, url]) => {
      try {
        const res = await fetcher(url, { signal });
        if (res.ok) return [key, await res.json()] as const;
        failedCount++;
        return [key, []] as const;
      } catch {
        failedCount++;
        return [key, []] as const;
      }
    }),
  );

  if (!signal.aborted) {
    publish({
      rawData: Object.fromEntries(entries),
      error: failedCount > 0,
    });
  }
}

export interface BuildSearchResultsOptions {
  locale?: CanonicalLocale | string;
  t?: (key: any, values?: any) => string;
}

export function buildSearchResults(
  rawData: Record<string, any[]>,
  query: string,
  options?: BuildSearchResultsOptions,
): SearchResult[] {
  const locale = normalizeLocale(options?.locale ?? DEFAULT_LOCALE);
  const t = options?.t ?? createTranslator({
    locale,
    messages: getMessagesForLocale(locale),
    namespace: 'shell.globalSearch',
  });
  const q = normalizeSearchText(query.trim());
  const results: SearchResult[] = [];

  for (const tx of rawData.transactions ?? []) {
    const txDate = formatPurchaseDate(tx.date, 'date', locale);
    const searchable = normalizeSearchText(`${tx.description || ''} ${tx.category?.name || ''} ${tx.type || ''} ${txDate}`);
    if (q && !searchable.includes(q)) continue;

    const isTransfer = tx.type === 'TRANSFER';
    const isIn = tx.type === 'INCOME';
    results.push({
      id: tx.id,
      type: 'transactions',
      label: tx.description || t('fallbacks.noDescription'),
      secondary: isTransfer
        ? `${currencyFmt(tx.amount, locale)} · ${t('labels.transfer')} · ${txDate}`
        : `${isIn ? '+' : '-'}${currencyFmt(tx.amount, locale)} · ${txDate}`,
      icon: isTransfer ? ArrowLeftRight : isIn ? ArrowUpRight : ArrowDownRight,
      iconTone: isTransfer ? 'text-muted-foreground' : isIn ? 'text-(--ds-accent-positive)' : 'text-(--ds-accent-danger)',
      meta: tx.accountId ? { accountId: tx.accountId } : undefined,
    });
  }

  for (const p of rawData.purchases ?? []) {
    const date = formatPurchaseDate(p.date, 'date', locale);
    const searchable = normalizeSearchText(`${p.merchant || ''} ${p.card?.name || ''} ${p.category?.name || ''} ${date}`);
    if (q && !searchable.includes(q)) continue;

    results.push({
      id: p.id,
      type: 'purchases',
      label: p.merchant || t('fallbacks.noMerchant'),
      secondary: `${currencyFmt(p.totalAmount, locale)} · ${date}${p.card ? ` · ${p.card.name}` : ''}`,
      icon: ShoppingBag,
    });
  }

  for (const a of rawData.accounts ?? []) {
    const typeLabel = KNOWN_ACCOUNT_TYPES.has(a.type) ? t(`accountTypes.${a.type}`) : a.type;
    const searchable = normalizeSearchText(`${a.name || ''} ${typeLabel || ''} ${currencyFmt(a.balance, locale)}`);
    if (q && !searchable.includes(q)) continue;

    results.push({
      id: a.id,
      type: 'accounts',
      label: a.name || t('fallbacks.noName'),
      secondary: `${currencyFmt(a.balance, locale)} · ${typeLabel}`,
      icon: Wallet,
    });
  }

  for (const c of rawData.cards ?? []) {
    const typeLabel = KNOWN_CARD_TYPES.has(c.type) ? t(`cardTypes.${c.type}`) : c.type;
    const searchable = normalizeSearchText(`${c.name || ''} ${c.brand || ''} ${c.lastFourDigits || ''} ${typeLabel || ''}`);
    if (q && !searchable.includes(q)) continue;

    results.push({
      id: c.id,
      type: 'cards',
      label: `${c.name || t('fallbacks.cardDefault')} · •••• ${c.lastFourDigits || '0000'}`,
      secondary: `${typeLabel} · ${c.brand || ''} · ${t('labels.statement', { amount: currencyFmt(c.currentBalance || 0, locale) })}`,
      icon: CreditCard,
    });
  }

  for (const cat of rawData.categories ?? []) {
    const typeLabel = KNOWN_CATEGORY_TYPES.has(cat.type) ? t(`categoryTypes.${cat.type}`) : cat.type;
    const searchable = normalizeSearchText(`${cat.name || ''} ${typeLabel || ''}`);
    if (q && !searchable.includes(q)) continue;

    results.push({
      id: cat.id,
      type: 'categories',
      label: cat.name || t('fallbacks.noName'),
      secondary: typeLabel,
      icon: Tag,
    });
  }

  for (const inv of rawData.investments ?? []) {
    const searchable = normalizeSearchText(`${inv.name || ''} ${inv.ticker || ''} ${inv.type || ''} ${inv.brokerage || ''}`);
    if (q && !searchable.includes(q)) continue;

    const details = [inv.ticker, inv.type, inv.brokerage].filter(Boolean).join(' · ');
    results.push({
      id: inv.id,
      type: 'investments',
      label: inv.name || t('fallbacks.noName'),
      secondary: `${currencyFmt(inv.currentBalance || 0, locale)}${details ? ` · ${details}` : ''}`,
      icon: TrendingUp,
    });
  }

  for (const ins of rawData.installments ?? []) {
    const searchable = normalizeSearchText(`${ins.description || ''} ${ins.type || ''} ${ins.status || ''} ${ins.card?.name || ''} ${ins.category?.name || ''}`);
    if (q && !searchable.includes(q)) continue;

    const count = ins.installmentCount ?? 0;
    const paid = ins.paidInstallments ?? 0;
    results.push({
      id: ins.id,
      type: 'installments',
      label: ins.description || t('fallbacks.noDescription'),
      secondary: `${t('labels.perMonth', { amount: currencyFmt(ins.monthlyValue || 0, locale) })} · ${paid}/${count}${ins.card?.name ? ` · ${ins.card.name}` : ''}`,
      icon: CalendarClock,
    });
  }

  for (const con of rawData.consortiums ?? []) {
    const searchable = normalizeSearchText(`${con.description || ''} ${con.group || ''} ${con.quota || ''} ${con.administrator || ''} ${con.status || ''}`);
    if (q && !searchable.includes(q)) continue;

    const groupQuota = con.group && con.quota
      ? t('labels.groupQuota', { group: con.group, quota: con.quota })
      : con.group || con.quota;
    const details = [con.administrator, groupQuota].filter(Boolean).join(' · ');
    results.push({
      id: con.id,
      type: 'consortiums',
      label: con.description || t('fallbacks.noDescription'),
      secondary: `${currencyFmt(con.totalAmount || 0, locale)}${details ? ` · ${details}` : ''}`,
      icon: Building2,
    });
  }

  return results;
}

export function GlobalSearch({ isOpen, onClose, onSelect }: GlobalSearchProps) {
  const locale = useSafeLocale();
  const t = useSafeTranslations('shell.globalSearch');
  const sharedTranslator = useSafeTranslations('shared') as unknown as {
    (key: string): string;
    has?: (key: string) => boolean;
  };
  const closeLabel = sharedTranslator.has?.('dialogCloseLabel')
    ? sharedTranslator('dialogCloseLabel')
    : 'Fechar formulário';
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [rawData, setRawData] = useState<Record<string, any[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      await requestGlobalSearch(controller.signal, (result) => {
        setError(result.error);
        setRawData(result.rawData);
      });
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
        console.error('Erro ao buscar dados para busca global');
      }
    } finally {
      if (!controller.signal.aborted && abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      void fetchAll();
      return () => {
        abortControllerRef.current?.abort();
      };
    }
    abortControllerRef.current?.abort();
  }, [isOpen, fetchAll]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const flatResults = useMemo<SearchResult[]>(
    () => buildSearchResults(rawData, query, { locale, t }),
    [rawData, query, locale, t],
  );

  const groupedResults = useMemo<SearchGroup[]>(() => {
    const groups: SearchGroup[] = [];
    for (const key of SEARCH_GROUP_KEYS) {
      const results = flatResults.filter((r) => r.type === key);
      if (results.length > 0 && searchGroupMeta[key]) {
        groups.push({ key, title: t(`groups.${key}`), results });
      }
    }
    return groups;
  }, [flatResults, t]);

  useEffect(() => {
    setActiveIndex((index) => Number.isInteger(index) ? Math.max(0, Math.min(index, flatResults.length - 1)) : 0);
  }, [flatResults.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => handleSearchKeyDown(e, { results: flatResults, activeIndex, setActiveIndex, onSelect, onClose }),
    [flatResults, activeIndex, onSelect, onClose],
  );

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
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg motion-reduce:animate-none sm:max-w-[560px]"
      >
        {isOpen && (
          <div
            data-quiet-search
            className="flex max-h-[80dvh] min-w-0 flex-col transition-opacity duration-150 motion-reduce:transition-none"
          >
            <header className="shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <div className="relative pr-10">
                <DialogClose asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={closeLabel}
                    className="absolute right-0 top-0"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
                <DialogTitle className="text-base">{t('title')}</DialogTitle>
                <DialogDescription className="mt-1.5 text-xs">
                  {t('description')}
                </DialogDescription>
              </div>
              <div className="relative mt-3">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  aria-label={t('inputAriaLabel')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  className="h-10 rounded-md bg-background pl-9"
                />
              </div>
            </header>

            <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[48dvh]">
              <div ref={listRef}>
                {error && !loading && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs sm:px-5">
                    <span className="text-destructive">{t('loadError')}</span>
                    <button
                      type="button"
                      onClick={() => void fetchAll()}
                      className="rounded border border-border bg-card px-2 py-1 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-(--ds-focus)"
                    >
                      {t('retry')}
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
                  {t('resultCount', { count: flatResults.length })}
                </span>
                <div className="flex gap-3">
                  <span><kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> {t('navigateHint')}</span>
                  <span><kbd className="rounded border border-border px-1 font-mono">↵</kbd> {t('selectHint')}</span>
                </div>
              </footer>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
