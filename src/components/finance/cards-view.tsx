'use client';

import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { Plus, Pencil, Trash2, ArrowLeft, ChevronDown, ChevronUp, ChevronRight, Copy, Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { QueryPanel } from '@/components/shared/query-panel';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useKeyedMutationLock } from '@/hooks/use-keyed-mutation-lock';
import { CardEditor, emptyCardForm, type CardFormDraft } from './card-editor';
import {
  CARD_BRAND_KEYS,
  createFallbackTranslator,
  PT_OPERATIONS_MESSAGES,
} from './operations-i18n';

const cardPanel = 'min-w-0 rounded-xl border border-border bg-card';
const dialogSurface = 'max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none';

function resolveCardBrand(brand: string, t: (key: string) => string): string {
  return (CARD_BRAND_KEYS as readonly string[]).includes(brand) ? t(`brands.${brand}`) : brand;
}

function resolveCardType(type: string, t: (key: string) => string): string {
  return type === 'CREDIT' || type === 'DEBIT' || type === 'BOTH' ? t(`types.${type}`) : type;
}

function CardUsage({ value, high }: { value: number; high: boolean }) {
  const t = createFallbackTranslator(useSafeTranslations('cards'), PT_OPERATIONS_MESSAGES.cards);
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
        <span>{high ? t('usage.high') : t('usage.normal')}</span>
        <span className="font-mono tabular-nums">{value.toFixed(0)}%</span>
      </p>
      <Progress
        aria-label={t('usage.normal')}
        value={value}
        className={cn('h-1.5 [&>div]:motion-reduce:transition-none', high && '[&>div]:bg-[var(--ds-accent-warning)]')}
      />
    </div>
  );
}

interface CardData {
  id: string;
  name: string;
  type: string;
  brand: string;
  lastFourDigits: string;
  creditLimit: number;
  currentBalance: number;
  closingDay: number;
  dueDay: number;
  color: string;
  flag: string;
}

interface Purchase {
  id: string;
  merchant: string;
  totalAmount: number;
  date: string;
  category?: { id: string; name: string; color: string };
  items: { id: string; name: string; quantity: number; unitPrice: number; totalPrice: number }[];
}

const usagePercent = (card: CardData) => (card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0);
const isOverLimit = (card: CardData) => usagePercent(card) > 80;

function CardPurchaseRow({ purchase, expanded, onToggle }: { purchase: Purchase; expanded: boolean; onToggle: () => void }) {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('cards'), PT_OPERATIONS_MESSAGES.cards);
  return (
    <li>
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-accent/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        aria-expanded={expanded}
        aria-controls={`card-purchase-${purchase.id}`}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1 basis-28">
          <span className="block wrap-anywhere text-sm font-medium">{purchase.merchant}</span>
          <span className="block wrap-anywhere text-xs text-muted-foreground">
            {formatPurchaseDate(purchase.date, 'date', locale)}{purchase.category && ` · ${purchase.category.name}`}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="wrap-anywhere font-mono text-sm font-semibold tabular-nums">{currencyFmt(purchase.totalAmount, locale)}</span>
          {expanded ? <ChevronUp aria-hidden="true" className="size-4 shrink-0" /> : <ChevronDown aria-hidden="true" className="size-4 shrink-0" />}
        </span>
      </button>
      <div id={`card-purchase-${purchase.id}`} hidden={!expanded} className="border-t border-border bg-muted/30 px-4 py-3">
        {expanded && (purchase.items?.length ? (
          <>
            <p className="text-xs font-medium text-muted-foreground">{t('detail.purchaseItems', { count: purchase.items.length })}</p>
            <ul className="mt-2 divide-y divide-border">
              {purchase.items.map((item) => (
                <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="min-w-0 flex-1 basis-28 wrap-anywhere">{item.quantity}× {item.name}</span>
                  <span className="wrap-anywhere font-mono text-xs tabular-nums">{t('detail.unitShort', { price: currencyFmt(item.unitPrice, locale) })} · <strong>{currencyFmt(item.totalPrice, locale)}</strong></span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-between gap-1 border-t border-border pt-2 text-sm font-semibold">
              <span>{t('detail.total')}</span><span className="wrap-anywhere font-mono tabular-nums">{currencyFmt(purchase.totalAmount, locale)}</span>
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">{t('detail.noItems')}</p>)}
      </div>
    </li>
  );
}

function CardRow({ card, copied, onOpen, onCopy, onEdit, onDelete }: {
  card: CardData;
  copied: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('cards'), PT_OPERATIONS_MESSAGES.cards);
  return (
    <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-x-4">
      <Button type="button" variant="ghost" aria-label={t('list.openCardAria', { name: card.name })} onClick={onOpen} data-card-detail={card.id} className="col-span-2 h-auto min-h-10 min-w-0 justify-start whitespace-normal px-0 text-left md:col-span-1">
        <CreditCard aria-hidden="true" className="size-5 text-muted-foreground" />
        <span className="min-w-0 wrap-anywhere">
          <span className="block font-semibold">{card.name}</span>
          <span className="block text-xs text-muted-foreground">{resolveCardBrand(card.brand, t)}{card.flag && ` · ${card.flag}`} · <span className="font-mono">•••• •••• •••• {card.lastFourDigits}</span></span>
          <span className="block text-xs text-muted-foreground">{t('list.cycleDates', { closingDay: card.closingDay, dueDay: card.dueDay })}</span>
        </span>
        <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
      </Button>
      <div className="col-span-2 grid min-w-0 gap-1 md:col-span-1">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <FinanceMetric variant="compact" label={t('list.currentBalance')} value={currencyFmt(card.currentBalance, locale)} />
          <FinanceMetric variant="compact" label={t('list.available')} value={currencyFmt(card.creditLimit - card.currentBalance, locale)} />
        </dl>
        <CardUsage value={usagePercent(card)} high={isOverLimit(card)} />
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-1 md:col-span-1">
        <span role="status" className="text-xs text-muted-foreground">{copied ? t('list.copied') : ''}</span>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="icon" aria-label={t('list.copyNumberAria', { name: card.name })} onClick={onCopy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('list.editCardAria', { name: card.name })} onClick={onEdit}>
            <Pencil aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('list.deleteCardAria', { name: card.name })} onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function CardsView() {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('cards'), PT_OPERATIONS_MESSAGES.cards);
  const storeSelectedCardId = useAppStore((state) => state.selectedCardId);
  const setStoreSelectedCardId = useAppStore((state) => state.setSelectedCardId);
  const newCardButton = useRef<HTMLButtonElement>(null);
  const dialogReturn = useRef<HTMLButtonElement | null>(null);
  const detailReturn = useRef<string | null>(null);
  const detailBack = useRef<HTMLButtonElement>(null);
  const cardList = useRef<HTMLUListElement>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const latestPurchaseQuery = useRef(0);
  const [purchaseResult, setPurchaseResult] = useState<{ cardId: string; purchases: Purchase[] } | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const purchases = purchaseResult?.cardId === selectedCard?.id ? purchaseResult?.purchases ?? [] : [];
  const [loading, setLoading] = useState(true);
  const [cardsError, setCardsError] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState(false);
  const { pending, tryAcquire, release } = useKeyedMutationLock();
  const [showCardDialog, setCardDialogOpen] = useState(false);
  const cardOpening = useRef(0);
  const setShowCardDialog = (open: boolean) => { ++cardOpening.current; setCardDialogOpen(open); };
  const [showDeleteDialog, setDeleteTarget] = useState<string | null>(null);
  const deleteOpening = useRef(0);
  const setShowDeleteDialog = (id: string | null) => { ++deleteOpening.current; setDeleteTarget(id); };
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState<CardFormDraft>(emptyCardForm);

  const fetchCards = useCallback(async () => {
    setCardsError(false);
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) { setCardsError(true); return; }
      setCards(await res.json());
    } catch (e) { setCardsError(true); console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchPurchases = useCallback(async (cardId: string) => {
    const query = ++latestPurchaseQuery.current;
    setPurchasesLoading(true);
    setPurchasesError(false);
    try {
      const res = await fetch(`/api/purchases?cardId=${cardId}`);
      if (query !== latestPurchaseQuery.current) return;
      if (!res.ok) { setPurchasesError(true); return; }
      const nextPurchases: Purchase[] = await res.json();
      if (query === latestPurchaseQuery.current) {
        setPurchaseResult({ cardId, purchases: nextPurchases });
        setPurchasesError(false);
      }
    } catch (e) {
      if (query === latestPurchaseQuery.current) setPurchasesError(true);
      console.error(e);
    } finally {
      if (query === latestPurchaseQuery.current) setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const openCard = useCallback((card: CardData) => {
    setPurchaseResult(null);
    setExpandedPurchase(null);
    setSelectedCard(card);
    void fetchPurchases(card.id);
  }, [fetchPurchases]);

  useEffect(() => {
    if (!storeSelectedCardId || loading) return;
    const target = cards.find(({ id }) => id === storeSelectedCardId);
    if (target) openCard(target);
    setStoreSelectedCardId(null);
  }, [cards, loading, openCard, setStoreSelectedCardId, storeSelectedCardId]);

  const closeCard = () => { ++latestPurchaseQuery.current; setSelectedCard(null); };
  const openNewCard = () => { setEditingCard(null); setForm(emptyCardForm); setShowCardDialog(true); };
  const openEditCard = (card: CardData) => {
    setEditingCard(card);
    setForm({
      name: card.name, type: card.type, brand: card.brand, lastFourDigits: card.lastFourDigits,
      creditLimit: String(card.creditLimit), closingDay: String(card.closingDay),
      dueDay: String(card.dueDay), color: card.color, flag: card.flag,
    });
    setShowCardDialog(true);
  };
  const changeCardField = (field: keyof CardFormDraft, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const saveKey = editingCard ? `edit:${editingCard.id}` : 'create';
  const saveCard = async () => {
    if (!form.name.trim()) { toast.error(t('errors.nameRequired')); return; }
    if (!tryAcquire(saveKey)) return;
    const opening = cardOpening.current;
    try {
      const body = { ...form, creditLimit: parseFloat(form.creditLimit) || 0, closingDay: parseInt(form.closingDay) || 1, dueDay: parseInt(form.dueDay) || 10 };
      const res = await fetch('/api/cards', {
        method: editingCard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCard ? { id: editingCard.id, ...body } : body),
      });
      if (!res.ok) { toast.error(t('errors.saveCard')); return; }
      toast.success(editingCard ? t('toasts.cardUpdated') : t('toasts.cardAdded'));
      if (cardOpening.current === opening) setShowCardDialog(false);
      fetchCards();
    } catch { toast.error(t('errors.saveCard')); } finally { release(saveKey); }
  };

  const deleteCard = async (id: string) => {
    const key = `delete:${id}`;
    if (!tryAcquire(key)) return;
    const opening = deleteOpening.current;
    try {
      const res = await fetch('/api/cards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) { toast.error(t('errors.deleteCard')); return; }
      toast.success(t('toasts.cardDeleted'));
      if (deleteOpening.current === opening) {
        dialogReturn.current = null;
        setShowDeleteDialog(null);
      }
      fetchCards();
    } catch { toast.error(t('errors.deleteCard')); } finally { release(key); }
  };

  const copyNumber = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const restoreDialogFocus = (event: Event) => {
    event.preventDefault();
    const trigger = dialogReturn.current;
    dialogReturn.current = null;
    (trigger?.isConnected ? trigger : newCardButton.current)?.focus();
  };

  useEffect(() => {
    if (selectedCard) {
      detailBack.current?.focus();
    } else if (detailReturn.current) {
      const buttons = Array.from(cardList.current?.querySelectorAll<HTMLButtonElement>('[data-card-detail]') ?? []);
      (buttons.find((button) => button.dataset.cardDetail === detailReturn.current) ?? newCardButton.current)?.focus();
      detailReturn.current = null;
    }
  }, [selectedCard]);

  if (loading) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
        <Skeleton aria-hidden="true" className="h-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-40 rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (selectedCard) {
    const purchaseStatus = purchasesLoading ? 'loading' : purchasesError ? 'error' : purchases.length === 0 ? 'empty' : 'success';
    return (
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <Button ref={detailBack} variant="ghost" size="sm" onClick={closeCard}>
            <ArrowLeft aria-hidden="true" /> {t('actions.backToCards')}
          </Button>
          <div>
            <p className="wrap-anywhere text-sm text-muted-foreground">{resolveCardType(selectedCard.type, t)} · {resolveCardBrand(selectedCard.brand, t)}{selectedCard.flag && ` · ${selectedCard.flag}`}</p>
            <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{selectedCard.name}</h2>
          </div>
        </header>
        <dl aria-label={t('detail.positionAria')} className={cn(cardPanel, 'grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0')}>
          <FinanceMetric variant="cell" label={t('detail.currentBalance')} value={currencyFmt(selectedCard.currentBalance, locale)} />
          <FinanceMetric variant="cell" label={t('detail.limit')} value={currencyFmt(selectedCard.creditLimit, locale)} />
          <FinanceMetric variant="cell" label={t('detail.available')} value={currencyFmt(selectedCard.creditLimit - selectedCard.currentBalance, locale)} />
        </dl>
        <section aria-label={t('detail.infoAria')} className={cn(cardPanel, 'space-y-3 p-4')}>
          <dl className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-muted-foreground">{t('detail.maskedNumber')}</dt><dd className="font-mono">•••• •••• •••• {selectedCard.lastFourDigits}</dd></div>
            <div><dt className="text-muted-foreground">{t('detail.closing')}</dt><dd>{t('detail.day', { day: String(selectedCard.closingDay).padStart(2, '0') })}</dd></div>
            <div><dt className="text-muted-foreground">{t('detail.due')}</dt><dd>{t('detail.day', { day: String(selectedCard.dueDay).padStart(2, '0') })}</dd></div>
          </dl>
          <CardUsage value={usagePercent(selectedCard)} high={isOverLimit(selectedCard)} />
        </section>
        <QueryPanel
          titleId="card-purchases"
          title={t('detail.purchasesTitle')}
          controls={<span className="text-xs text-muted-foreground">{t('detail.purchaseCount', { count: purchases.length })}</span>}
          status={purchaseStatus}
          loadingMessage={t('detail.loadingPurchases')}
          errorMessage={t('errors.loadPurchases')}
          emptyMessage={t('detail.emptyPurchases')}
          retryLabel={t('actions.retry')}
          onRetry={() => void fetchPurchases(selectedCard.id)}
          className="rounded-xl"
          contentClassName="space-y-0 p-0 sm:p-0"
        >
          <ul aria-labelledby="card-purchases" className="divide-y divide-border">
            {purchases.map((p) => (
              <CardPurchaseRow key={p.id} purchase={p} expanded={expandedPurchase === p.id} onToggle={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)} />
            ))}
          </ul>
        </QueryPanel>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button ref={newCardButton} onClick={(event) => { dialogReturn.current = event.currentTarget; openNewCard(); }}>
          <Plus aria-hidden="true" /> {t('actions.newCard')}
        </Button>
      </header>
      {cardsError && (
        <div role="alert" className={cn(cardPanel, 'flex flex-wrap items-center justify-between gap-2 p-4 text-sm')}>
          <p className="text-destructive">{t('errors.loadCards')}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchCards()}>{t('actions.retry')}</Button>
        </div>
      )}
      <dl aria-label={t('summary.ariaLabel')} className={cn(cardPanel, 'grid grid-cols-2 divide-x divide-border')}>
        <FinanceMetric variant="cell" label={t('summary.totalBalance')} value={currencyFmt(cards.reduce((s, c) => s + c.currentBalance, 0), locale)} />
        <FinanceMetric variant="cell" label={t('summary.totalLimit')} value={currencyFmt(cards.reduce((s, c) => s + c.creditLimit, 0), locale)} />
      </dl>
      <section aria-labelledby="card-list" className={cardPanel}>
        <h3 id="card-list" className="border-b border-border px-4 py-3 font-semibold">{t('list.title')}</h3>
        {cards.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('list.empty')}</p>
        ) : (
          <ul ref={cardList} aria-label={t('list.title')} className="divide-y divide-border">
            {cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                copied={copiedId === card.id}
                onOpen={() => { detailReturn.current = card.id; openCard(card); }}
                onCopy={() => copyNumber(card.id, `•••• •••• •••• ${card.lastFourDigits}`)}
                onEdit={(event) => { dialogReturn.current = event.currentTarget; openEditCard(card); }}
                onDelete={(event) => { dialogReturn.current = event.currentTarget; setShowDeleteDialog(card.id); }}
              />
            ))}
          </ul>
        )}
      </section>

      <CardEditor
        mode={editingCard ? 'edit' : 'create'}
        open={showCardDialog}
        pending={pending.has(saveKey)}
        form={form}
        onFieldChange={changeCardField}
        onOpenChange={setShowCardDialog}
        onCloseAutoFocus={restoreDialogFocus}
        onSubmit={saveCard}
      />

      <FinanceConfirmationDialogShell
        open={!!showDeleteDialog}
        onOpenChange={() => setShowDeleteDialog(null)}
        onCloseAutoFocus={restoreDialogFocus}
        contentClassName={dialogSurface}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        footer={
          <>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              aria-disabled={pending.has(`delete:${showDeleteDialog}`)}
              onClick={(event) => { event.preventDefault(); if (showDeleteDialog) void deleteCard(showDeleteDialog); }}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </>
        }
      />
    </div>
  );
}
