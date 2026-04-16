'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Bell,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// ── Helpers ────────────────────────────────────────────────────────────

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const relativeTime = (d: string) => {
  try {
    return formatDistanceToNow(parseISO(d), { addSuffix: true, locale: ptBR });
  } catch {
    return d;
  }
};

// ── Types ──────────────────────────────────────────────────────────────

type NotificationKind = 'income' | 'expense' | 'purchase';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  description: string;
  amount: number;
  date: string;
}

// ── Animation variants ─────────────────────────────────────────────────

const panelVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

const listContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const listItem = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

// ── Icon / color maps ─────────────────────────────────────────────────

const kindConfig: Record<NotificationKind, { icon: typeof ArrowUpRight; label: string; bgClass: string; textClass: string; amountPrefix: string }> = {
  income: {
    icon: ArrowUpRight,
    label: 'Receita',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-500',
    amountPrefix: '+',
  },
  expense: {
    icon: ArrowDownRight,
    label: 'Despesa',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-500',
    amountPrefix: '-',
  },
  purchase: {
    icon: ShoppingBag,
    label: 'Compra',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-500',
    amountPrefix: '-',
  },
};

// ── Component ──────────────────────────────────────────────────────────

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, purchaseRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/purchases'),
      ]);

      const transactions: any[] = txRes.ok ? await txRes.json() : [];
      const purchases: any[] = purchaseRes.ok ? await purchaseRes.json() : [];

      // Map transactions to notification items (only INCOME and EXPENSE)
      const txItems: NotificationItem[] = transactions
        .filter((t) => t.type === 'INCOME' || t.type === 'EXPENSE')
        .map((t) => ({
          id: `tx-${t.id}`,
          kind: t.type === 'INCOME' ? 'income' : ('expense' as NotificationKind),
          description: t.description,
          amount: t.amount,
          date: t.date,
        }));

      // Map purchases to notification items
      const purchaseItems: NotificationItem[] = purchases.map((p) => ({
        id: `purchase-${p.id}`,
        kind: 'purchase' as NotificationKind,
        description: p.merchant,
        amount: p.totalAmount,
        date: p.date,
      }));

      // Combine, sort by date descending, take top 10
      const combined = [...txItems, ...purchaseItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      setNotifications(combined);
    } catch (e) {
      console.error('Erro ao buscar notificações', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background shadow-xl shadow-black/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Notificações</h3>
              {!loading && notifications.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1.5">
                  {notifications.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClose}>
              Fechar
            </Button>
          </div>

          <Separator />

          {/* Content */}
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Suas atividades financeiras aparecerão aqui
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[340px]">
              <motion.div
                variants={listContainer}
                initial="hidden"
                animate="visible"
                className="px-2 py-2"
              >
                {notifications.map((notif) => {
                  const config = kindConfig[notif.kind];
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={notif.id}
                      variants={listItem}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/50 transition-colors group"
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl ${config.bgClass} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                        <Icon className={`w-4 h-4 ${config.textClass}`} />
                      </div>

                      {/* Description + time */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">
                          {notif.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {relativeTime(notif.date)}
                          </span>
                          <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60">
                            {config.label}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <span className={`text-sm font-bold whitespace-nowrap ml-1 ${config.textClass}`}>
                        {config.prefix}{currencyFmt(notif.amount)}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            </ScrollArea>
          )}

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  Ler tudo
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
