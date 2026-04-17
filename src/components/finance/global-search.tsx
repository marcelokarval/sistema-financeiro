'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Hash,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Helpers ────────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  type: 'transactions' | 'purchases' | 'accounts' | 'cards' | 'categories';
  label: string;
  secondary: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
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

// ── Animation ──────────────────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30, duration: 0.25 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -8,
    transition: { duration: 0.15 },
  },
};

const resultVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.02, duration: 0.2 },
  }),
};

// ── Props ──────────────────────────────────────────────────────────
interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (type: string, id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────
export function GlobalSearch({ isOpen, onClose, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<Record<string, any[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Fetch all data on open ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const endpoints = [
        ['transactions', '/api/transactions'],
        ['purchases', '/api/purchases'],
        ['accounts', '/api/accounts'],
        ['cards', '/api/cards'],
        ['categories', '/api/categories'],
      ] as const;

      const entries = await Promise.all(
        endpoints.map(async ([key, url]) => {
          try {
            const res = await fetch(url);
            if (res.ok) return [key, await res.json()] as const;
            return [key, []] as const;
          } catch {
            return [key, []] as const;
          }
        })
      );

      setRawData(Object.fromEntries(entries));
    } catch {
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
      const searchable = `${t.description || ''} ${t.category?.name || ''} ${t.type || ''} ${dateFmt(t.date)}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      const isIn = t.type === 'INCOME';
      results.push({
        id: t.id,
        type: 'transactions',
        label: t.description || 'Sem descrição',
        secondary: `${isIn ? '+' : '-'}${currencyFmt(t.amount)} · ${dateFmt(t.date)}`,
        icon: isIn ? ArrowUpRight : ArrowDownRight,
        iconBg: isIn ? 'bg-emerald-500/10' : 'bg-rose-500/10',
        iconColor: isIn ? 'text-emerald-500' : 'text-rose-500',
      });
    }

    // Purchases
    for (const p of rawData.purchases ?? []) {
      const searchable = `${p.merchant || ''} ${p.card?.name || ''} ${p.category?.name || ''} ${dateFmt(p.date)}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      results.push({
        id: p.id,
        type: 'purchases',
        label: p.merchant || 'Sem estabelecimento',
        secondary: `${currencyFmt(p.totalAmount)} · ${dateFmt(p.date)}${p.card ? ` · ${p.card.name}` : ''}`,
        icon: ShoppingBag,
        iconBg: 'bg-violet-500/10',
        iconColor: 'text-violet-500',
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
        iconBg: `${a.color || '#22c55e'}15`,
        iconColor: a.color || '#22c55e',
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
        iconBg: `${c.color || '#8b5cf6'}15`,
        iconColor: c.color || '#8b5cf6',
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
        iconBg: `${cat.color || '#6b7280'}15`,
        iconColor: cat.color || '#6b7280',
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

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // ── Keyboard navigation ──────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flatResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
      } else if (e.key === 'Enter' && flatResults.length > 0) {
        e.preventDefault();
        const result = flatResults[activeIndex];
        if (result) {
          onSelect?.(result.type, result.id);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
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

  // ── Global index counter for flat list ───────────────────────────
  let globalIdx = 0;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden border-0 shadow-2xl bg-background/95 backdrop-blur-xl">
        <DialogTitle className="sr-only">Busca Global</DialogTitle>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col max-h-[70vh] sm:max-h-[80vh]"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                <Search className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar transações, compras, contas, cartões..."
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-auto p-0 text-sm placeholder:text-muted-foreground/60"
                />
                {loading && (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                )}
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground bg-muted border border-border/50 shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <ScrollArea className="flex-1">
                <div ref={listRef} className="py-2">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mb-3" />
                      <p className="text-sm font-medium">Buscando dados...</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Carregando todas as entidades
                      </p>
                    </div>
                  ) : query.trim() === '' && flatResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                        <Search className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium">Comece a digitar para buscar</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Pesquise em todas as suas finanças
                      </p>
                      <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                        {Object.values(groupMeta).map((meta) => {
                          const GroupIcon = meta.icon;
                          return (
                            <Badge
                              key={meta.title}
                              variant="secondary"
                              className="text-[10px] gap-1 px-2 py-0.5"
                            >
                              <GroupIcon className="w-3 h-3" />
                              {meta.title}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ) : flatResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                        <FileX className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium">Nenhum resultado encontrado</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Tente buscar por outro termo
                      </p>
                    </div>
                  ) : (
                    groupedResults.map((group) => (
                      <div key={group.key} className="mb-1">
                        {/* Group header */}
                        <div className="flex items-center gap-2 px-4 py-1.5">
                          <GroupHeaderIcon type={group.key} />
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 min-w-[18px] flex items-center justify-center px-1"
                          >
                            {group.results.length}
                          </Badge>
                        </div>

                        {/* Group results */}
                        {group.results.map((result) => {
                          const currentIndex = globalIdx++;
                          const isActive = currentIndex === activeIndex;
                          const Icon = result.icon;

                          return (
                            <motion.button
                              key={`${result.type}-${result.id}`}
                              custom={currentIndex}
                              variants={resultVariants}
                              initial="hidden"
                              animate="visible"
                              data-result-index={currentIndex}
                              onClick={() => {
                                onSelect?.(result.type, result.id);
                                onClose();
                              }}
                              onMouseEnter={() => setActiveIndex(currentIndex)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isActive
                                  ? 'bg-primary/10 text-foreground'
                                  : 'text-foreground/90 hover:bg-accent/50'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${result.iconBg}`}
                              >
                                <Icon className={`w-4 h-4 ${result.iconColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{result.label}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {result.secondary}
                                </p>
                              </div>
                              <Hash className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                            </motion.button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              {flatResults.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/30">
                  <span className="text-[11px] text-muted-foreground">
                    {flatResults.length} resultado{flatResults.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted border border-border/50 font-mono">↑↓</kbd>
                      Navegar
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted border border-border/50 font-mono">↵</kbd>
                      Selecionar
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ── Group Header Icon ──────────────────────────────────────────────
function GroupHeaderIcon({ type }: { type: string }) {
  const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
    transactions: { icon: ArrowLeftRight, color: 'text-blue-500' },
    purchases: { icon: ShoppingBag, color: 'text-violet-500' },
    accounts: { icon: Wallet, color: 'text-emerald-500' },
    cards: { icon: CreditCard, color: 'text-amber-500' },
    categories: { icon: Tag, color: 'text-pink-500' },
  };

  const entry = iconMap[type] || { icon: Search, color: 'text-muted-foreground' };
  const Icon = entry.icon;

  return <Icon className={`w-3.5 h-3.5 ${entry.color}`} />;
}
