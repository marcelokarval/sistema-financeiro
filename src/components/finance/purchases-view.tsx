'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronDown, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { currencyFmt } from '@/lib/helpers';
import { formatPurchaseDate as dateFmt, purchaseDateForInput, purchaseDateForSave } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { PurchaseEditor, type PurchaseCardOption, type PurchaseCategoryOption, type PurchaseFormDraft } from './purchase-editor';
import type { PurchaseItemDraft } from './purchase-items-editor';

interface DialogOpening { origin: HTMLButtonElement | null; }
const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const amountStyle = 'font-mono tabular-nums [overflow-wrap:anywhere]';

interface Purchase {
  id: string;
  merchant: string;
  totalAmount: number;
  date: string;
  cardId?: string;
  card?: PurchaseCardOption;
  categoryId?: string;
  category?: PurchaseCategoryOption;
  notes: string;
  items: PurchaseItemDraft[];
}

function PurchaseRecordRow({ purchase, isExpanded, onToggle, onCaptureOrigin, onEdit, onDelete }: {
  purchase: Purchase;
  isExpanded: boolean;
  onToggle: () => void;
  onCaptureOrigin: (origin: HTMLButtonElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const detailId = `purchase-items-${purchase.id}`;
  const summaryId = `purchase-summary-${purchase.id}`;
  const amountId = `purchase-amount-${purchase.id}`;
  return (
    <li className="min-w-0">
      <div className="flex min-w-0 items-start gap-1 px-2 py-1.5 sm:px-3">
        <button
          type="button"
          aria-label={`Itens da compra: ${purchase.merchant}`}
          aria-describedby={`${summaryId} ${amountId}`}
          aria-expanded={isExpanded}
          aria-controls={detailId}
          className={cn('flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/50 sm:px-2', focusStyle)}
          onClick={onToggle}
        >
          <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground', isExpanded && 'rotate-180')} />
          <span className="grid min-w-0 flex-1 gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold">{purchase.merchant}</span>
              <span id={summaryId} className="block break-words text-xs text-muted-foreground">
                {dateFmt(purchase.date)} · {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'itens'}
                {purchase.card && ` · ${purchase.card.name}`}
                {purchase.category && ` · ${purchase.category.name}`}
              </span>
            </span>
            <span id={amountId} className={cn('text-sm font-semibold sm:text-right', amountStyle)}>{currencyFmt(purchase.totalAmount)}</span>
          </span>
        </button>
        <Button variant="ghost" size="icon" aria-label={`Editar compra: ${purchase.merchant}`} className={cn('size-11 shrink-0', focusStyle)} onClickCapture={(event) => onCaptureOrigin(event.currentTarget)} onClick={onEdit}>
          <Pencil aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Excluir compra: ${purchase.merchant}`} className={cn('size-11 shrink-0 text-destructive hover:text-destructive', focusStyle)} onClickCapture={(event) => onCaptureOrigin(event.currentTarget)} onClick={onDelete}>
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
                  <span className={cn('text-xs text-muted-foreground', amountStyle)}>{currencyFmt(item.unitPrice)} / un.</span>
                  <strong className={cn('text-xs', amountStyle)}>{currencyFmt(item.totalPrice)}</strong>
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
}

function TopMerchantRow({ rank, name, total, count, pct }: { rank: number; name: string; total: number; count: number; pct: number }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 px-3 py-3 sm:px-4">
      <span className="font-mono text-xs text-muted-foreground">{rank}.</span>
      <div className="min-w-0">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 break-words text-sm font-medium">{name}</span>
          <span className={cn('text-xs font-semibold', amountStyle)}>{currencyFmt(total)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{count} {count === 1 ? 'compra' : 'compras'}</p>
        <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${pct}%` }} className="h-full bg-muted-foreground/60" />
        </div>
      </div>
    </li>
  );
}

export function PurchasesView() {
  const storeSelectedPurchaseId = useAppStore((state) => state.selectedPurchaseId);
  const setStoreSelectedPurchaseId = useAppStore((state) => state.setSelectedPurchaseId);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cards, setCards] = useState<PurchaseCardOption[]>([]);
  const [categories, setCategories] = useState<PurchaseCategoryOption[]>([]);
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
    (origin?.isConnected ? origin : newButton.current)?.focus();
  };

  const [form, setForm] = useState<PurchaseFormDraft>({ merchant: '', cardId: '', categoryId: '', date: purchaseDateForInput(), notes: '' });
  const [items, setItems] = useState<PurchaseItemDraft[]>([{ name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);

  const fetchPurchases = useCallback(async () => {
    const read = ++listRead.current;
    try {
      const res = await fetch('/api/purchases');
      if (!res.ok) throw new Error('HTTP error');
      const data = await res.json();
      if (read !== listRead.current) return;
      setPurchases(data);
      setRefreshFailed(false);
    } catch { if (read === listRead.current) setRefreshFailed(true); } finally { if (read === listRead.current) setLoading(false); }
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('HTTP error');
      setCards(await res.json());
      setOptionsFailed(false);
    } catch (e) { setOptionsFailed(true); console.error(e); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('HTTP error');
      setCategories(await res.json());
      setOptionsFailed(false);
    } catch (e) { setOptionsFailed(true); console.error(e); }
  }, []);

  useEffect(() => { fetchPurchases(); fetchCards(); fetchCategories(); }, [fetchPurchases, fetchCards, fetchCategories]);
  useEffect(() => {
    if (!storeSelectedPurchaseId || loading) return;
    if (purchases.some(({ id }) => id === storeSelectedPurchaseId)) setExpandedId(storeSelectedPurchaseId);
    setStoreSelectedPurchaseId(null);
  }, [loading, purchases, setStoreSelectedPurchaseId, storeSelectedPurchaseId]);

  const changeField = (field: keyof PurchaseFormDraft, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateItem = (index: number, field: keyof PurchaseItemDraft, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') item.totalPrice = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      updated[index] = item;
      return updated;
    });
  };
  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)); };
  const formTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const openNew = () => {
    setEditingPurchase(null);
    setForm({ merchant: '', cardId: '', categoryId: '', date: purchaseDateForInput(), notes: '' });
    setItems([{ name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setShowDialog(true);
  };
  const openEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setForm({ merchant: purchase.merchant, cardId: purchase.cardId || '', categoryId: purchase.categoryId || '', date: purchaseDateForInput(purchase.date), notes: purchase.notes });
    setItems(purchase.items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice })));
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
      const body = { ...form, date: editingPurchase?.date ? purchaseDateForSave(form.date, editingPurchase.date) : form.date, totalAmount: formTotal, items: validItems };
      const res = await fetch('/api/purchases', {
        method: editingPurchase ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPurchase ? { id: editingPurchase.id, ...body } : body),
      });
      if (!res.ok) throw new Error('HTTP error');
      toast.success(editingPurchase ? 'Compra atualizada!' : 'Compra registrada!');
      await fetchPurchases();
      if (activeOpening.current === submittedOpening) closeDialog('form');
    } catch { toast.error('Erro ao salvar compra'); } finally { mutationPending.current = false; }
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
    } catch { toast.error('Erro ao excluir compra'); } finally { mutationPending.current = false; }
  };

  const filtered = purchases.filter((p) => p.merchant.toLowerCase().includes(search.toLowerCase()) || (p.card?.name || '').toLowerCase().includes(search.toLowerCase()));
  const merchantStats = purchases.reduce((acc, p) => {
    if (!acc[p.merchant]) acc[p.merchant] = { total: 0, count: 0, items: 0 };
    acc[p.merchant].total += p.totalAmount;
    acc[p.merchant].count += 1;
    acc[p.merchant].items += p.items.length;
    return acc;
  }, {} as Record<string, { total: number; count: number; items: number }>);
  const topMerchants = Object.entries(merchantStats).sort(([, a], [, b]) => b.total - a.total).slice(0, 5);
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
          <Button ref={newButton} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={openNew} className={cn('min-h-11', focusStyle)}>
            <Plus aria-hidden="true" /> Nova compra
          </Button>
        )}
      </header>
      {refreshFailed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Não foi possível atualizar a lista de compras.</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => void fetchPurchases()}>Tentar atualizar lista</Button>
        </div>
      )}
      {optionsFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-destructive">Não foi possível carregar cartões ou categorias.</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => { void fetchCards(); void fetchCategories(); }}>Tentar novamente</Button>
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
              {([['Total das compras', currencyFmt(totalSpent)], ['Valor médio por compra', currencyFmt(avgPurchase)], ['Estabelecimentos', Object.keys(merchantStats).length], ['Itens comprados', totalItems]] as const).map(([label, value], index) => (
                <FinanceMetric key={label} variant="cell" label={label} value={value} className="border-0 bg-background px-3 py-4 sm:px-4" valueClassName={cn(amountStyle, index === 0 ? 'text-xl sm:text-2xl' : 'text-lg')} />
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
                  <Input id="purchase-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Estabelecimento ou cartão" className={cn('min-h-11 pl-9', focusStyle)} />
                </div>
                <p role="status" className="text-xs text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? 'compra encontrada' : 'compras encontradas'}
                  {filtered.length > 0 && (<> · Total dos resultados: <strong className={cn('font-semibold text-foreground', amountStyle)}>{currencyFmt(filtered.reduce((s, p) => s + p.totalAmount, 0))}</strong></>)}
                </p>
              </header>
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground">{search ? 'Nenhuma compra corresponde à busca.' : 'Nenhuma compra registrada.'}</p>
              ) : (
                <ul role="list" className="divide-y divide-border">
                  {filtered.map((purchase) => (
                    <PurchaseRecordRow
                      key={purchase.id}
                      purchase={purchase}
                      isExpanded={expandedId === purchase.id}
                      onToggle={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                      onCaptureOrigin={beginOpening}
                      onEdit={() => openEdit(purchase)}
                      onDelete={() => setShowDeleteDialog(purchase.id)}
                    />
                  ))}
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
                  {topMerchants.map(([name, stats], idx) => (
                    <TopMerchantRow key={name} rank={idx + 1} name={name} total={stats.total} count={stats.count} pct={totalSpent > 0 ? (stats.total / totalSpent) * 100 : 0} />
                  ))}
                </ol>
              </section>
            )}
          </div>
        </>
      )}

      <PurchaseEditor
        mode={editingPurchase ? 'edit' : 'create'}
        open={showDialog}
        form={form}
        items={items}
        cards={cards}
        categories={categories}
        totalAmount={formTotal}
        onFieldChange={changeField}
        onItemChange={updateItem}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onOpenChange={(open) => { if (!open) closeDialog('form'); }}
        onCloseAutoFocus={restoreFocus}
        onCancel={() => closeDialog('form')}
        onSubmit={savePurchase}
      />

      <FinanceConfirmationDialogShell
        open={!!showDeleteDialog}
        onOpenChange={(open) => { if (!open) closeDialog('delete'); }}
        onCloseAutoFocus={restoreFocus}
        contentClassName="motion-reduce:animate-none border-border bg-card shadow-none"
        title="Excluir compra?"
        description="Esta ação não pode ser desfeita. Todos os itens da compra serão removidos."
        footer={
          <>
            <AlertDialogCancel className={focusStyle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); if (showDeleteDialog) deletePurchase(showDeleteDialog); }}
              className={cn('bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline', focusStyle)}
            >
              Excluir
            </AlertDialogAction>
          </>
        }
      />
    </section>
  );
}
