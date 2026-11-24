'use client';

import type { ElementType } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CreditCard,
  FileX,
  Loader2,
  Search,
  ShoppingBag,
  Tag,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchResultType = 'transactions' | 'purchases' | 'accounts' | 'cards' | 'categories';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  secondary: string;
  icon: ElementType;
  iconTone?: string;
  meta?: { accountId?: string };
}

export interface SearchGroup {
  key: string;
  title: string;
  results: SearchResult[];
}

export const searchGroupMeta: Record<string, { title: string; icon: ElementType }> = {
  transactions: { title: 'Transações', icon: ArrowLeftRight },
  purchases: { title: 'Compras', icon: ShoppingBag },
  accounts: { title: 'Contas', icon: Wallet },
  cards: { title: 'Cartões', icon: CreditCard },
  categories: { title: 'Categorias', icon: Tag },
};

export interface GlobalSearchResultProps {
  result: SearchResult;
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
  onSelect: (type: SearchResultType, id: string, meta?: SearchResult['meta']) => void;
}

/** Single selectable global search result row preserving active state and tabular secondary numbers. */
export function GlobalSearchResult({
  result,
  index,
  active,
  onActivate,
  onSelect,
}: GlobalSearchResultProps) {
  const Icon = result.icon;

  return (
    <li>
      <button
        type="button"
        data-result-index={index}
        data-active={active ? 'true' : undefined}
        onClick={() => onSelect(result.type, result.id, result.meta)}
        onMouseEnter={() => onActivate(index)}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-md border-s-2 border-transparent px-2 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ds-focus) data-[active=true]:border-primary data-[active=true]:bg-muted"
      >
        <Icon aria-hidden="true" className={cn('size-4 shrink-0', result.iconTone ?? 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{result.label}</p>
          <p className={cn('truncate text-xs text-muted-foreground', result.type !== 'categories' && 'font-mono tabular-nums')}>
            {result.secondary}
          </p>
        </div>
        <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </li>
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

/** Grouped global search results with loading, initial guidance, and filtered empty states. */
export function SearchResults({ groups, query, loading, activeIndex, onActivate, onSelect }: SearchResultsProps) {
  if (loading || groups.length === 0) {
    const hasQuery = query.trim() !== '';
    const Icon = loading ? Loader2 : hasQuery ? FileX : Search;
    return (
      <div role="status" className="flex items-start gap-3 px-4 py-6 text-muted-foreground sm:px-5">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', loading && 'motion-safe:animate-spin')} />
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
        const GroupIcon = searchGroupMeta[group.key].icon;
        const startIdx = globalIdx;
        globalIdx += group.results.length;
        return (
          <section key={group.key} className="px-2 pb-2 sm:px-3">
            <div className="flex items-center gap-2 px-2 pb-1 pt-2.5 text-muted-foreground">
              <GroupIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <h3 className="text-xs font-semibold">{group.title}</h3>
              <span className="ml-auto font-mono text-xs tabular-nums">{group.results.length}</span>
            </div>
            <ul>
              {group.results.map((result, offset) => {
                const index = startIdx + offset;
                return (
                  <GlobalSearchResult
                    key={`${result.type}-${result.id}`}
                    result={result}
                    index={index}
                    active={index === activeIndex}
                    onActivate={onActivate}
                    onSelect={onSelect}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
