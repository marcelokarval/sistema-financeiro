'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, ArrowLeft, ChevronDown, ChevronUp, ChevronRight, Copy, Check, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { useKeyedMutationLock } from '@/hooks/use-keyed-mutation-lock';

const cardColors = [
  ['#8b5cf6', 'Roxo'], ['#f97316', 'Laranja'], ['#ef4444', 'Vermelho'], ['#3b82f6', 'Azul'],
  ['#06b6d4', 'Ciano'], ['#22c55e', 'Verde'], ['#ec4899', 'Rosa'],
];
const cardPanel = 'min-w-0 rounded-xl border border-border bg-card';
const dialogSurface = 'max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none';

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-3 sm:p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-anywhere font-mono text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}

function CardUsage({ value, high }: { value: number; high: boolean }) {
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
        <span>{high ? 'Uso elevado do limite' : 'Uso do limite'}</span>
        <span className="font-mono tabular-nums">{value.toFixed(0)}%</span>
      </p>
      <Progress aria-label="Uso do limite" value={value} className={`h-1.5 [&>div]:motion-reduce:transition-none ${high ? '[&>div]:bg-[var(--ds-accent-warning)]' : ''}`} />
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

export function CardsView() {
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
  const setShowCardDialog = (open: boolean) => {
    ++cardOpening.current;
    setCardDialogOpen(open);
  };
  const [showDeleteDialog, setDeleteTarget] = useState<string | null>(null);
  const deleteOpening = useRef(0);
  const setShowDeleteDialog = (id: string | null) => {
    ++deleteOpening.current;
    setDeleteTarget(id);
  };
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', type: 'CREDIT', brand: 'VISA', lastFourDigits: '', creditLimit: '0',
    closingDay: '1', dueDay: '10', color: '#8b5cf6', flag: '',
  });

  const fetchCards = useCallback(async () => {
    setCardsError(false);
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) {
        setCardsError(true);
        return;
      }
      setCards(await res.json());
    } catch (e) {
      setCardsError(true);
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  const fetchPurchases = useCallback(async (cardId: string) => {
    const query = ++latestPurchaseQuery.current;
    setPurchasesLoading(true);
    setPurchasesError(false);
    try {
      const res = await fetch(`/api/purchases?cardId=${cardId}`);
      if (query !== latestPurchaseQuery.current) return;
      if (!res.ok) {
        setPurchasesError(true);
        return;
      }
      const purchases: Purchase[] = await res.json();
      if (query === latestPurchaseQuery.current) {
        setPurchaseResult({ cardId, purchases });
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

  const closeCard = () => {
    ++latestPurchaseQuery.current;
    setSelectedCard(null);
  };

  const openNewCard = () => {
    setEditingCard(null);
    setForm({ name: '', type: 'CREDIT', brand: 'VISA', lastFourDigits: '', creditLimit: '0', closingDay: '1', dueDay: '10', color: '#8b5cf6', flag: '' });
    setShowCardDialog(true);
  };

  const openEditCard = (card: CardData) => {
    setEditingCard(card);
    setForm({
      name: card.name, type: card.type, brand: card.brand, lastFourDigits: card.lastFourDigits,
      creditLimit: String(card.creditLimit), closingDay: String(card.closingDay),
      dueDay: String(card.dueDay), color: card.color, flag: card.flag,
    });
    setShowCardDialog(true);
  };

  const saveKey = editingCard ? `edit:${editingCard.id}` : 'create';
  const saveCard = async () => {
    if (!form.name.trim()) {
      toast.error('Nome do cartão é obrigatório');
      return;
    }
    if (!tryAcquire(saveKey)) return;
    const opening = cardOpening.current;
    try {
      const body = {
        ...form,
        creditLimit: parseFloat(form.creditLimit) || 0,
        closingDay: parseInt(form.closingDay) || 1,
        dueDay: parseInt(form.dueDay) || 10,
      };
      const res = await fetch('/api/cards', {
        method: editingCard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCard ? { id: editingCard.id, ...body } : body),
      });
      if (!res.ok) {
        toast.error('Erro ao salvar cartão');
        return;
      }
      toast.success(editingCard ? 'Cartão atualizado!' : 'Cartão adicionado!');
      if (cardOpening.current === opening) setShowCardDialog(false);
      fetchCards();
    } catch { toast.error('Erro ao salvar cartão'); } finally {
      release(saveKey);
    }
  };

  const deleteCard = async (id: string) => {
    const key = `delete:${id}`;
    if (!tryAcquire(key)) return;
    const opening = deleteOpening.current;
    try {
      const res = await fetch('/api/cards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) {
        toast.error('Erro ao excluir cartão');
        return;
      }
      toast.success('Cartão excluído!');
      if (deleteOpening.current === opening) setShowDeleteDialog(null);
      fetchCards();
    } catch {
      toast.error('Erro ao excluir cartão');
    } finally {
      release(key);
    }
  };

  const usagePercent = (card: CardData) =>
    card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
  const isOverLimit = (card: CardData) => usagePercent(card) > 80;

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
        <p className="text-sm text-muted-foreground">Carregando cartões…</p>
        <Skeleton aria-hidden="true" className="h-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-40 rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (selectedCard) {
    return (
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <Button ref={detailBack} variant="ghost" size="sm" onClick={closeCard}>
            <ArrowLeft aria-hidden="true" /> Voltar para cartões
          </Button>
          <div>
            <p className="wrap-anywhere text-sm text-muted-foreground">{selectedCard.type === 'CREDIT' ? 'Crédito' : 'Débito'} · {selectedCard.brand}{selectedCard.flag && ` · ${selectedCard.flag}`}</p>
            <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{selectedCard.name}</h2>
          </div>
        </header>
        <dl aria-label="Posição do cartão" className={`${cardPanel} grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
          <CardMetric label="Fatura atual" value={currencyFmt(selectedCard.currentBalance)} />
          <CardMetric label="Limite" value={currencyFmt(selectedCard.creditLimit)} />
          <CardMetric label="Disponível" value={currencyFmt(selectedCard.creditLimit - selectedCard.currentBalance)} />
        </dl>
        <section aria-label="Dados do cartão" className={`${cardPanel} space-y-3 p-4`}>
          <dl className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-muted-foreground">Número mascarado</dt><dd className="font-mono">•••• •••• •••• {selectedCard.lastFourDigits}</dd></div>
            <div><dt className="text-muted-foreground">Fechamento</dt><dd>Dia {String(selectedCard.closingDay).padStart(2, '0')}</dd></div>
            <div><dt className="text-muted-foreground">Vencimento</dt><dd>Dia {String(selectedCard.dueDay).padStart(2, '0')}</dd></div>
          </dl>
          <CardUsage value={usagePercent(selectedCard)} high={isOverLimit(selectedCard)} />
        </section>
        <section aria-labelledby="card-purchases" className={cardPanel}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 id="card-purchases" className="font-semibold">Compras no cartão</h3>
            <span className="text-xs text-muted-foreground">{purchases.length} {purchases.length === 1 ? 'compra' : 'compras'}</span>
          </div>
          {purchasesLoading ? (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Carregando compras do cartão…</p>
          ) : purchasesError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
              <p className="text-destructive">Não foi possível carregar as compras do cartão.</p>
              <Button variant="outline" size="sm" onClick={() => void fetchPurchases(selectedCard.id)}>Tentar novamente</Button>
            </div>
          ) : purchases.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma compra registrada neste cartão.</p>
          ) : (
            <ul aria-labelledby="card-purchases" className="divide-y divide-border">
              {purchases.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-accent/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    aria-expanded={expandedPurchase === p.id}
                    aria-controls={`card-purchase-${p.id}`}
                    onClick={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)}
                  >
                    <span className="min-w-0 flex-1 basis-28">
                      <span className="block wrap-anywhere text-sm font-medium">{p.merchant}</span>
                      <span className="block wrap-anywhere text-xs text-muted-foreground">{formatPurchaseDate(p.date)}{p.category && ` · ${p.category.name}`}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="wrap-anywhere font-mono text-sm font-semibold tabular-nums">{currencyFmt(p.totalAmount)}</span>
                      {expandedPurchase === p.id ? <ChevronUp aria-hidden="true" className="size-4 shrink-0" /> : <ChevronDown aria-hidden="true" className="size-4 shrink-0" />}
                    </span>
                  </button>
                  <div id={`card-purchase-${p.id}`} hidden={expandedPurchase !== p.id} className="border-t border-border bg-muted/30 px-4 py-3">
                    {expandedPurchase === p.id && (p.items?.length ? (
                      <>
                        <p className="text-xs font-medium text-muted-foreground">Itens da compra ({p.items.length})</p>
                        <ul className="mt-2 divide-y divide-border">
                          {p.items.map((item) => (
                            <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
                              <span className="min-w-0 flex-1 basis-28 wrap-anywhere">{item.quantity}× {item.name}</span>
                              <span className="wrap-anywhere font-mono text-xs tabular-nums">{currencyFmt(item.unitPrice)} un. · <strong>{currencyFmt(item.totalPrice)}</strong></span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap justify-between gap-1 border-t border-border pt-2 text-sm font-semibold">
                          <span>Total</span><span className="wrap-anywhere font-mono tabular-nums">{currencyFmt(p.totalAmount)}</span>
                        </div>
                      </>
                    ) : <p className="text-sm text-muted-foreground">Nenhum item detalhado nesta compra.</p>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Cartões</h2>
          <p className="text-sm text-muted-foreground">Acompanhe faturas, limites e compras.</p>
        </div>
        <Button ref={newCardButton} onClick={(event) => { dialogReturn.current = event.currentTarget; openNewCard(); }}>
          <Plus aria-hidden="true" /> Novo cartão
        </Button>
      </header>
      {cardsError && (
        <div role="alert" className={`${cardPanel} flex flex-wrap items-center justify-between gap-2 p-4 text-sm`}>
          <p className="text-destructive">Não foi possível carregar os cartões.</p>
          <Button variant="outline" size="sm" onClick={() => void fetchCards()}>Tentar novamente</Button>
        </div>
      )}
      <dl aria-label="Posição dos cartões" className={`${cardPanel} grid grid-cols-2 divide-x divide-border`}>
        <CardMetric label="Total em faturas" value={currencyFmt(cards.reduce((s, c) => s + c.currentBalance, 0))} />
        <CardMetric label="Limite total" value={currencyFmt(cards.reduce((s, c) => s + c.creditLimit, 0))} />
      </dl>
      <section aria-labelledby="card-list" className={cardPanel}>
        <h3 id="card-list" className="border-b border-border px-4 py-3 font-semibold">Cartões cadastrados</h3>
        {cards.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum cartão cadastrado. Use “Novo cartão” para começar.</p>
        ) : (
          <ul ref={cardList} aria-label="Cartões cadastrados" className="divide-y divide-border">
            {cards.map((card) => (
              <li key={card.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-x-4">
                <Button type="button" variant="ghost" aria-label={`Abrir cartão ${card.name}`} onClick={() => { detailReturn.current = card.id; openCard(card); }} data-card-detail={card.id} className="col-span-2 h-auto min-h-10 min-w-0 justify-start whitespace-normal px-0 text-left md:col-span-1">
                  <CreditCard aria-hidden="true" className="size-5 text-muted-foreground" />
                  <span className="min-w-0 wrap-anywhere">
                    <span className="block font-semibold">{card.name}</span>
                    <span className="block text-xs text-muted-foreground">{card.brand}{card.flag && ` · ${card.flag}`} · <span className="font-mono">•••• •••• •••• {card.lastFourDigits}</span></span>
                    <span className="block text-xs text-muted-foreground">Fecha dia {card.closingDay} · Vence dia {card.dueDay}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
                </Button>
                <div className="col-span-2 grid min-w-0 gap-1 md:col-span-1">
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0"><dt className="text-muted-foreground">Fatura atual</dt><dd className="wrap-anywhere font-mono font-semibold tabular-nums">{currencyFmt(card.currentBalance)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">Disponível</dt><dd className="wrap-anywhere font-mono font-semibold tabular-nums">{currencyFmt(card.creditLimit - card.currentBalance)}</dd></div>
                  </dl>
                  <CardUsage value={usagePercent(card)} high={isOverLimit(card)} />
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-1 md:col-span-1">
                  <span role="status" className="text-xs text-muted-foreground">{copiedId === card.id ? 'Copiado' : ''}</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Copiar número mascarado de ${card.name}`} onClick={() => copyNumber(card.id, `•••• •••• •••• ${card.lastFourDigits}`)}>
                      {copiedId === card.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Editar cartão ${card.name}`} onClick={(event) => { dialogReturn.current = event.currentTarget; openEditCard(card); }}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir cartão ${card.name}`} onClick={(event) => { dialogReturn.current = event.currentTarget; setShowDeleteDialog(card.id); }} className="text-destructive hover:text-destructive">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Card Form Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className={dialogSurface} onCloseAutoFocus={restoreDialogFocus}>
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
            <DialogDescription>{editingCard ? 'Atualize os dados do cartão' : 'Adicione um novo cartão'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="card-name">Nome do Cartão</Label>
              <Input id="card-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank Platinum" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="card-type">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger id="card-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Crédito</SelectItem>
                    <SelectItem value="DEBIT">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="card-brand">Bandeira</Label>
                <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v })}>
                  <SelectTrigger id="card-brand"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISA">Visa</SelectItem>
                    <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                    <SelectItem value="ELO">Elo</SelectItem>
                    <SelectItem value="AMEX">American Express</SelectItem>
                    <SelectItem value="HIPER">Hiper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="card-digits">Últimos 4 dígitos</Label>
                <Input id="card-digits" value={form.lastFourDigits} onChange={(e) => setForm({ ...form, lastFourDigits: e.target.value.slice(0, 4) })} placeholder="0000" maxLength={4} />
              </div>
              <div>
                <Label htmlFor="card-flag">Bandeira/Banco (opcional)</Label>
                <Input id="card-flag" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} placeholder="Ex: Nubank, Inter" />
              </div>
            </div>
            {form.type === 'CREDIT' && (
              <>
                <div>
                  <Label htmlFor="card-limit">Limite de Crédito (R$)</Label>
                  <Input id="card-limit" type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="card-close-day">Dia de Fechamento</Label>
                    <Input id="card-close-day" type="number" min="1" max="31" value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="card-due-day">Dia de Vencimento</Label>
                    <Input id="card-due-day" type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div>
              <p id="card-color" className="text-sm font-medium">Cor</p>
              <div role="group" aria-labelledby="card-color" className="mt-2 flex flex-wrap gap-2">
                {cardColors.map(([c, name]) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={name}
                    aria-pressed={form.color === c}
                    className="size-8 rounded-full border border-border aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-foreground focus-visible:outline-ring"
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCardDialog(false)}>Cancelar</Button>
            <Button aria-disabled={pending.has(saveKey)} onClick={saveCard}>{editingCard ? 'Atualizar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent className={dialogSurface} onCloseAutoFocus={restoreDialogFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O histórico de compras será preservado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              aria-disabled={pending.has(`delete:${showDeleteDialog}`)}
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) void deleteCard(showDeleteDialog);
              }}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
