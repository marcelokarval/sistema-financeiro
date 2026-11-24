'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Bell,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { currencyFmt } from '@/lib/helpers';

// ── Helpers ────────────────────────────────────────────────────────────

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

// ── Icon / color maps ─────────────────────────────────────────────────

const kindConfig: Record<NotificationKind, { icon: typeof ArrowUpRight; label: string; textClass: string }> = {
  income: {
    icon: ArrowUpRight,
    label: 'Receita',
    textClass: 'text-(--ds-accent-positive)',
  },
  expense: {
    icon: ArrowDownRight,
    label: 'Despesa',
    textClass: 'text-(--ds-accent-danger)',
  },
  purchase: {
    icon: ShoppingBag,
    label: 'Compra',
    textClass: 'text-muted-foreground',
  },
};

export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <ul aria-label="Atividade recente" className="divide-y divide-border px-4">
      {notifications.map((notif) => {
        const config = kindConfig[notif.kind];
        const Icon = config.icon;
        return (
          <li key={notif.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 py-2.5">
            <Icon aria-hidden="true" className={`mt-0.5 size-4 ${config.textClass}`} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{notif.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {config.label} · <time dateTime={notif.date}>{relativeTime(notif.date)}</time>
              </p>
            </div>
            <span className="whitespace-nowrap font-mono text-xs font-medium tabular-nums sm:text-sm">
              {currencyFmt(notif.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Component ──────────────────────────────────────────────────────────

const READ_AT_STORAGE_KEY = 'finance-notifications-read-at';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(READ_AT_STORAGE_KEY);
      if (saved) setReadAt(saved);
    } catch {
      // Ignore storage access failures in restricted contexts.
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [txRes, purchaseRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/purchases'),
      ]);

      if (!txRes.ok || !purchaseRes.ok) {
        setError(true);
        return;
      }

      const transactions: any[] = await txRes.json();
      const purchases: any[] = await purchaseRes.json();

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
      setError(true);
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

  const unreadCount = readAt
    ? notifications.filter((item) => new Date(item.date).getTime() > new Date(readAt).getTime()).length
    : notifications.length;

  const markAllRead = () => {
    const now = new Date().toISOString();
    setReadAt(now);
    try {
      window.localStorage.setItem(READ_AT_STORAGE_KEY, now);
    } catch {
      // Ignore storage access failures.
    }
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          data-quiet-notifications
          className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg transition-opacity duration-150 motion-reduce:transition-none"
        >
          <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bell aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                Notificações
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Atividade recente
                {!loading && !error && notifications.length > 0 && (
                  <span className="font-mono tabular-nums">
                    {unreadCount > 0 ? ` · ${unreadCount} nova${unreadCount !== 1 ? 's' : ''}` : ' · Todas lidas'}
                  </span>
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onClose}>Fechar</Button>
          </header>

          {loading ? (
            <div role="status" className="space-y-3 px-4 py-3">
              <p className="text-xs text-muted-foreground">Carregando atividades…</p>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} aria-hidden="true" className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
                  <Skeleton className="h-3 w-16 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="space-y-2 px-4 py-6">
              <p className="text-sm font-medium text-destructive">Não foi possível carregar as notificações.</p>
              <Button variant="outline" size="sm" onClick={() => void fetchNotifications()}>
                Tentar novamente
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div role="status" className="px-4 py-6">
              <p className="text-sm font-medium">Nenhuma notificação</p>
              <p className="mt-1 text-xs text-muted-foreground">Suas atividades financeiras aparecerão aqui.</p>
            </div>
          ) : (
            <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-[min(340px,50dvh)]">
              <NotificationList notifications={notifications} />
            </ScrollArea>
          )}

          {!loading && !error && notifications.length > 0 && (
            <footer className="border-t border-border bg-muted/40 px-3 py-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={markAllRead}>
                <BookOpen aria-hidden="true" className="size-3.5" />
                Ler tudo
              </Button>
            </footer>
          )}
        </div>
      )}
    </>
  );
}
