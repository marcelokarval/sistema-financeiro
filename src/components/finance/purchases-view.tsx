'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronDown, Search, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogClose,
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
import { formatPurchaseDate as dateFmt, purchaseDateForInput, purchaseDateForSave } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';

interface DialogOpening { origin: HTMLButtonElement | null; }

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const amountStyle = 'font-mono tabular-nums [overflow-wrap:anywhere]';

interface CardData { id: string; name: string; lastFourDigits: string; color: string; }
interface Category { id: string; name: string; type: string; color: string; }

interface PurchaseItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Purchase {
  id: string;
  merchant: string;
  totalAmount: number;
  date: string;
  cardId?: string;
  card?: CardData;
  categoryId?: string;
  category?: Category;
  notes: string;
  items: PurchaseItem[];
}

export function PurchasesView() {
  const storeSelectedPurchaseId = useAppStore((state) => state.selectedPurchaseId);
  const setStoreSelectedPurchaseId = useAppStore((state) => state.setSelectedPurchaseId);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const listRead = useRef(0);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const activeOpening = useRef<DialogOpening | null>(null);
  const [opening, setOpening] = useState<DialogOpening | null>(null);
  const mutationPending = useRef(false);

  const beginOpening = (origin: HTMLButtonElement) => {
    const session = { origin };
    activeOpening.current = session;
    setOpening(session);
  };

  const closeDialog = (kind: 'form' | 'delete') => {
    activeOpening.current = null;
    if (kind === 'form') setShowDialog(false);
    else setShowDeleteDialog(null);
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (activeOpening.current) return;
    const origin = opening?.origin;
    const target = origin?.isConnected ? origin : newButton.current;
    target?.focus();
  };

  const [form, setForm] = useState({
    merchant: '', cardId: '', categoryId: '', date: purchaseDateForInput(), notes: '',
  });
  const [items, setItems] = useState<PurchaseItem[]>([
    { name: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
  ]);

  const fetchPurchases = useCallback(async () => {
    const read = ++listRead.current;
    try {
      const res = await fetch('/api/purchases');
      if (!res.ok) throw new Error('HTTP error');
      const data = await res.json();
      if (read !== listRead.current) return;
      setPurchases(data);
      setRefreshFailed(false);
    } catch {
      if (read === listRead.current) setRefreshFailed(true);
    } finally {
      if (read === listRead.current) setLoading(false);
    }
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('HTTP error');
      setCards(await res.json());
      setOptionsFailed(false);
    } catch (e) {
      setOptionsFailed(true);
      console.error(e);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('HTTP error');
      setCategories(await res.json());
      setOptionsFailed(false);
    } catch (e) {
      setOptionsFailed(true);
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchPurchases(); fetchCards(); fetchCategories(); }, [fetchPurchases, fetchCards, fetchCategories]);

  useEffect(() => {
    if (!storeSelectedPurchaseId || loading) return;
    if (purchases.some(({ id }) => id === storeSelectedPurchaseId)) {
      setExpandedId(storeSelectedPurchaseId);
    }
    setStoreSelectedPurchaseId(null);
  }, [loading, purchases, setStoreSelectedPurchaseId, storeSelectedPurchaseId]);

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        item.totalPrice = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      }
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const formTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const openNew = () => {
    setEditingPurchase(null);
    setForm({ merchant: '', cardId: '', categoryId: '', date: purchaseDateForInput(), notes: '' });
    setItems([{ name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setShowDialog(true);
  };

  const openEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setForm({
      merchant: purchase.merchant,
      cardId: purchase.cardId || '',
      categoryId: purchase.categoryId || '',
      date: purchaseDateForInput(purchase.date),
      notes: purchase.notes,
    });
    setItems(
      purchase.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }))
    );
    setShowDialog(true);
  };

  const savePurchase = async () => {
    if (!form.merchant) { toast.error('Informe o estabelecimento'); return; }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) { toast.error('Adicione ao menos um item'); return; }

    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      const body = {
        ...form,
        date: editingPurchase?.date ? purchaseDateForSave(form.date, editingPurchase.date) : form.date,
        totalAmount: formTotal,
        items: validItems,
      };

      if (editingPurchase) {
        const res = await fetch('/api/purchases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPurchase.id, ...body }) });
        if (!res.ok) throw new Error('HTTP error');
        toast.success('Compra atualizada!');
      } else {
        const res = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('HTTP error');
        toast.success('Compra registrada!');
      }
      await fetchPurchases();
      if (activeOpening.current === submittedOpening) closeDialog('form');
    } catch { toast.error('Erro ao salvar compra'); }
    finally { mutationPending.current = false; }
  };

  const deletePurchase = async (id: string) => {
    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      const res = await fetch('/api/purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('HTTP error');
      toast.success('Compra excluída!');
      await fetchPurchases();
      if (activeOpening.current === submittedOpening) {
        submittedOpening.origin = newButton.current;
        closeDialog('delete');
      }
    } catch { toast.error('Erro ao excluir compra'); }
    finally { mutationPending.current = false; }
  };

  const filtered = purchases.filter((p) =>
    p.merchant.toLowerCase().includes(search.toLowerCase()) ||
    (p.card?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Calculate top merchants
  const merchantStats = purchases.reduce((acc, p) => {
    if (!acc[p.merchant]) acc[p.merchant] = { total: 0, count: 0, items: 0 };
    acc[p.merchant].total += p.totalAmount;
    acc[p.merchant].count += 1;
    acc[p.merchant].items += p.items.length;
    return acc;
  }, {} as Record<string, { total: number; count: number; items: number }>);
  const topMerchants = Object.entries(merchantStats)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5);
  const totalSpent = purchases.reduce((s, p) => s + p.totalAmount, 0);
  const totalItems = purchases.reduce((s, p) => s + p.items.length, 0);
  const avgPurchase = purchases.length > 0 ? totalSpent / purchases.length : 0;

  return (
    <section aria-labelledby="purchases-heading" className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Movimentação</p>
          <h2 id="purchases-heading" className="text-2xl font-semibold tracking-tight">Compras</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe os gastos e os itens de cada compra.</p>
        </div>
        {!loading && (
          <Button ref={newButton} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={openNew} className={`min-h-11 ${focusStyle}`}>
            <Plus aria-hidden="true" /> Nova compra
          </Button>
        )}
      </header>
      {refreshFailed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Não foi possível atualizar a lista de compras.</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => void fetchPurchases()}>
            Tentar atualizar lista
          </Button>
        </div>
      )}
      {optionsFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-destructive">Não foi possível carregar cartões ou categorias.</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => { void fetchCards(); void fetchCategories(); }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div role="status" className="space-y-3 text-sm text-muted-foreground">
          <p>Carregando compras…</p>
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : (
        <>
          {purchases.length > 0 && (
            <dl aria-label="Totais de compras" className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              {[['Total das compras', currencyFmt(totalSpent)], ['Valor médio por compra', currencyFmt(avgPurchase)], ['Estabelecimentos', Object.keys(merchantStats).length], ['Itens comprados', totalItems]].map(([label, value], index) => (
                <div key={label} className="min-w-0 bg-background px-3 py-4 sm:px-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`mt-1 font-semibold ${amountStyle} ${index === 0 ? 'text-xl sm:text-2xl' : 'text-lg'}`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <section aria-labelledby="purchase-records-heading" className="min-w-0 rounded-lg border border-border bg-card">
              <header className="space-y-3 border-b border-border px-3 py-4 sm:px-4">
                <h3 id="purchase-records-heading" className="text-sm font-semibold">Registros de compras</h3>
                <div className="relative">
                  <Label htmlFor="purchase-search" className="sr-only">Buscar por estabelecimento ou cartão</Label>
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="purchase-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Estabelecimento ou cartão" className={`min-h-11 pl-9 ${focusStyle}`} />
                </div>
                <p role="status" className="text-xs text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? 'compra encontrada' : 'compras encontradas'}
                  {filtered.length > 0 && (
                    <> · Total dos resultados: <strong className={`font-semibold text-foreground ${amountStyle}`}>{currencyFmt(filtered.reduce((s, p) => s + p.totalAmount, 0))}</strong></>
                  )}
                </p>
              </header>
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground">{search ? 'Nenhuma compra corresponde à busca.' : 'Nenhuma compra registrada.'}</p>
              ) : (
                <ul role="list" className="divide-y divide-border">
                  {filtered.map((purchase) => {
                    const isExpanded = expandedId === purchase.id;
                    const detailId = `purchase-items-${purchase.id}`;
                    const summaryId = `purchase-summary-${purchase.id}`;
                    const amountId = `purchase-amount-${purchase.id}`;
                    return (
                      <li key={purchase.id} className="min-w-0">
                        <div className="flex min-w-0 items-start gap-1 px-2 py-1.5 sm:px-3">
                          <button
                            type="button"
                            aria-label={`Itens da compra: ${purchase.merchant}`}
                            aria-describedby={`${summaryId} ${amountId}`}
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/50 sm:px-2 ${focusStyle}`}
                            onClick={() => setExpandedId(isExpanded ? null : purchase.id)}
                          >
                            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground ${isExpanded ? 'rotate-180' : ''}`} />
                            <span className="grid min-w-0 flex-1 gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-semibold">{purchase.merchant}</span>
                                <span id={summaryId} className="block break-words text-xs text-muted-foreground">
                                  {dateFmt(purchase.date)} · {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'itens'}
                                  {purchase.card && ` · ${purchase.card.name}`}
                                  {purchase.category && ` · ${purchase.category.name}`}
                                </span>
                              </span>
                              <span id={amountId} className={`text-sm font-semibold sm:text-right ${amountStyle}`}>{currencyFmt(purchase.totalAmount)}</span>
                            </span>
                          </button>
                          <Button variant="ghost" size="icon" aria-label={`Editar compra: ${purchase.merchant}`} className={`size-11 shrink-0 ${focusStyle}`} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={() => openEdit(purchase)}>
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Excluir compra: ${purchase.merchant}`} className={`size-11 shrink-0 text-destructive hover:text-destructive ${focusStyle}`} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={() => setShowDeleteDialog(purchase.id)}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <div id={detailId} hidden={!isExpanded} className="min-w-0 border-t border-border bg-muted/30 px-3 py-3 sm:px-4">
                          {isExpanded && (
                            <>
                              <h4 className="text-xs font-semibold text-muted-foreground">Itens da compra ({purchase.items.length})</h4>
                              <ul role="list" className="mt-1 divide-y divide-border">
                                {purchase.items.map((item) => (
                                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                                    <span className="min-w-0 flex-1 basis-28 break-words">{item.quantity} × {item.name}</span>
                                    <span className={`text-xs text-muted-foreground ${amountStyle}`}>{currencyFmt(item.unitPrice)} / un.</span>
                                    <strong className={`text-xs ${amountStyle}`}>{currencyFmt(item.totalPrice)}</strong>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-2 text-sm font-semibold">
                                <span>Total da compra</span>
                                <span className={amountStyle}>{currencyFmt(purchase.totalAmount)}</span>
                              </div>
                              {purchase.notes && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">Observações: {purchase.notes}</p>}
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {topMerchants.length > 0 && (
              <section aria-labelledby="purchase-ranking-heading" className="min-w-0 rounded-lg border border-border bg-card">
                <header className="border-b border-border px-3 py-4 sm:px-4">
                  <h3 id="purchase-ranking-heading" className="text-sm font-semibold">Estabelecimentos com mais gastos</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Considera todas as compras, sem aplicar a busca.</p>
                </header>
                <ol role="list" className="divide-y divide-border">
                  {topMerchants.map(([name, stats], idx) => {
                    const pct = totalSpent > 0 ? (stats.total / totalSpent) * 100 : 0;
                    return (
                      <li key={name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 px-3 py-3 sm:px-4">
                        <span className="font-mono text-xs text-muted-foreground">{idx + 1}.</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 break-words text-sm font-medium">{name}</span>
                            <span className={`text-xs font-semibold ${amountStyle}`}>{currencyFmt(stats.total)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{stats.count} {stats.count === 1 ? 'compra' : 'compras'}</p>
                          <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                            <div style={{ width: `${pct}%` }} className="h-full bg-muted-foreground/60" />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        </>
      )}

      {/* New/Edit Purchase Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog('form'); }}>
        <DialogContent showCloseButton={false} onCloseAutoFocus={restoreFocus} className="motion-reduce:animate-none max-h-[90dvh] gap-4 overflow-y-auto border-border bg-card p-4 shadow-none sm:max-w-lg sm:p-6">
          <DialogHeader className="min-h-11 pr-12 text-left">
            <DialogTitle>{editingPurchase ? 'Editar compra' : 'Nova compra'}</DialogTitle>
            <DialogDescription>
              Registre os detalhes da compra com todos os itens
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" className={`absolute right-3 top-3 size-11 ${focusStyle}`}>
              <X aria-hidden="true" />
            </Button>
          </DialogClose>

          <div className="min-w-0">
            <div className="space-y-4 pb-4">
              <div>
                <Label htmlFor="purchase-merchant">Estabelecimento</Label>
                <Input className={focusStyle} id="purchase-merchant" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Ex: Carrefour, Amazon..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="purchase-card">Cartão</Label>
                  <Select value={form.cardId || '__none__'} onValueChange={(v) => setForm({ ...form, cardId: v === '__none__' ? '' : v })}>
                    <SelectTrigger id="purchase-card" className={`w-full ${focusStyle}`}><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum cartão</SelectItem>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastFourDigits}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="purchase-category">Categoria</Label>
                  <Select value={form.categoryId || '__none__'} onValueChange={(v) => setForm({ ...form, categoryId: v === '__none__' ? '' : v })}>
                    <SelectTrigger id="purchase-category" className={`w-full ${focusStyle}`}><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="purchase-date">Data</Label>
                <Input className={focusStyle} id="purchase-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>

              <fieldset className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <legend className="px-1 text-sm font-medium">Itens da compra</legend>
                {items.map((item, idx) => (
                  <div key={idx} role="group" aria-label={`Item ${idx + 1}`} className="grid min-w-0 grid-cols-2 gap-2 border-b border-border pb-3">
                    <div className="col-span-2 min-w-0 space-y-1">
                      <Label htmlFor={`purchase-item-name-${idx}`}>Nome do item</Label>
                      <Input className={focusStyle} id={`purchase-item-name-${idx}`} value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={`purchase-item-quantity-${idx}`}>Quantidade</Label>
                      <Input className={focusStyle} id={`purchase-item-quantity-${idx}`} type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={`purchase-item-price-${idx}`}>Preço unitário</Label>
                      <Input className={focusStyle} id={`purchase-item-price-${idx}`} type="number" step="0.01" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2">
                      <p className={`min-w-0 text-xs ${amountStyle}`}>Subtotal: {currencyFmt(item.totalPrice)}</p>
                      <Button
                        type="button" variant="ghost" size="icon" aria-label={`Remover item ${idx + 1}`}
                        className={`size-11 shrink-0 text-destructive hover:text-destructive ${focusStyle}`}
                        onClick={() => removeItem(idx)} disabled={items.length <= 1}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className={`min-h-11 ${focusStyle}`} onClick={addItem}>
                  <Plus aria-hidden="true" /> Adicionar item
                </Button>
              </fieldset>

              <div>
                <Label htmlFor="purchase-notes">Observações (opcional)</Label>
                <Input className={focusStyle} id="purchase-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais..." />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className={`mr-auto text-sm font-semibold ${amountStyle}`}>
              Total: {currencyFmt(formTotal)}
            </div>
            <Button variant="outline" className={focusStyle} onClick={() => closeDialog('form')}>Cancelar</Button>
            <Button className={focusStyle} onClick={savePurchase}>{editingPurchase ? 'Atualizar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open) closeDialog('delete'); }}>
        <AlertDialogContent onCloseAutoFocus={restoreFocus} className="motion-reduce:animate-none border-border bg-card shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens da compra serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={focusStyle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) deletePurchase(showDeleteDialog);
              }}
              className={`bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline ${focusStyle}`}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
