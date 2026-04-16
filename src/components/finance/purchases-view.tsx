'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Search, ShoppingBag, CreditCard, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TrendingUp, Store, BarChart3 } from 'lucide-react';

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); }
  catch { return d; }
};

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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  const [form, setForm] = useState({
    merchant: '', cardId: '', categoryId: '', date: new Date().toISOString().split('T')[0], notes: '',
  });
  const [items, setItems] = useState<PurchaseItem[]>([
    { name: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
  ]);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch('/api/purchases');
      if (res.ok) setPurchases(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (res.ok) setCards(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchPurchases(); fetchCards(); fetchCategories(); }, [fetchPurchases, fetchCards, fetchCategories]);

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
    setForm({ merchant: '', cardId: '', categoryId: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setItems([{ name: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setShowDialog(true);
  };

  const openEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setForm({
      merchant: purchase.merchant,
      cardId: purchase.cardId || '',
      categoryId: purchase.categoryId || '',
      date: purchase.date ? purchase.date.split('T')[0] : new Date().toISOString().split('T')[0],
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

    try {
      const body = {
        ...form,
        totalAmount: formTotal,
        items: validItems,
      };

      if (editingPurchase) {
        await fetch('/api/purchases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPurchase.id, ...body }) });
        toast.success('Compra atualizada!');
      } else {
        await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast.success('Compra registrada!');
      }
      setShowDialog(false);
      fetchPurchases();
    } catch { toast.error('Erro ao salvar compra'); }
  };

  const deletePurchase = async (id: string) => {
    try {
      await fetch('/api/purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success('Compra excluída!');
      setShowDeleteDialog(null);
      fetchPurchases();
    } catch { toast.error('Erro ao excluir compra'); }
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Compras</h2>
          <p className="text-sm text-muted-foreground">Controle detalhado de todas as compras</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Compra
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por estabelecimento ou cartão..."
          className="pl-9"
        />
      </div>

      {/* Total summary */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{filtered.length} compras encontradas</span>
        <span>·</span>
        <span>Total: <strong className="text-foreground">{currencyFmt(filtered.reduce((s, p) => s + p.totalAmount, 0))}</strong></span>
      </div>

      {/* Spending Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Gasto</p>
              <p className="text-sm font-bold">{currencyFmt(totalSpent)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
              <p className="text-sm font-bold">{currencyFmt(avgPurchase)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estabelecimentos</p>
              <p className="text-sm font-bold">{Object.keys(merchantStats).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Itens Comprados</p>
              <p className="text-sm font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Merchants */}
      {topMerchants.length > 0 && (
        <Card className="border-0 shadow-sm">
          <div className="flex items-center justify-between p-4 pb-3">
            <h3 className="text-sm font-semibold">Top Estabelecimentos</h3>
            <Store className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="px-4 pb-4 space-y-2">
            {topMerchants.map(([name, stats], idx) => {
              const pct = totalSpent > 0 ? (stats.total / totalSpent) * 100 : 0;
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right font-mono">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{stats.count}x</span>
                        <span className="text-xs font-bold">{currencyFmt(stats.total)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.1 }}
                        className="h-full rounded-full bg-violet-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Purchase List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma compra encontrada</p>
          </div>
        ) : (
          filtered.map((purchase) => {
            const isExpanded = expandedId === purchase.id;
            return (
              <Card key={purchase.id} className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <button
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : purchase.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5 text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{purchase.merchant}</p>
                        {purchase.card && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <CreditCard className="w-2.5 h-2.5 mr-0.5" />
                            {purchase.card.name}
                          </Badge>
                        )}
                        {purchase.category && (
                          <Badge variant="secondary" className="text-[10px] shrink-0" style={{ backgroundColor: `${purchase.category.color}20`, color: purchase.category.color }}>
                            {purchase.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{dateFmt(purchase.date)}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{purchase.items.length} itens</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-bold">{currencyFmt(purchase.totalAmount)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(purchase)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteDialog(purchase.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : purchase.id)}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Items */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-4 bg-accent/20">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Itens da Compra ({purchase.items.length})
                      </p>
                      <div className="space-y-1">
                        {purchase.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-muted-foreground shrink-0 w-6 text-right text-xs">
                                {item.quantity}x
                              </span>
                              <span className="truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                              <span className="text-muted-foreground">
                                {currencyFmt(item.unitPrice)} un
                              </span>
                              <span className="font-medium w-24 text-right">
                                {currencyFmt(item.totalPrice)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border mt-2 pt-2 flex items-center justify-between text-sm font-semibold px-3">
                        <span>Total</span>
                        <span>{currencyFmt(purchase.totalAmount)}</span>
                      </div>
                      {purchase.notes && (
                        <p className="text-xs text-muted-foreground mt-2 px-3 italic">"{purchase.notes}"</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* New/Edit Purchase Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingPurchase ? 'Editar Compra' : 'Nova Compra'}</DialogTitle>
            <DialogDescription>
              Registre os detalhes da compra com todos os itens
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4 pb-4">
              <div>
                <Label>Estabelecimento</Label>
                <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Ex: Carrefour, Amazon..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cartão</Label>
                  <Select value={form.cardId} onValueChange={(v) => setForm({ ...form, cardId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastFourDigits}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Itens da Compra</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-3 h-3 mr-1" /> Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        placeholder="Nome do item"
                      />
                      <Input
                        className="w-16"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                        placeholder="Qtd"
                      />
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="R$ un"
                      />
                      <div className="w-24 text-sm font-medium text-right">
                        {currencyFmt(item.totalPrice)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Observações (opcional)</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais..." />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="text-sm font-semibold mr-auto">
              Total: {currencyFmt(formTotal)}
            </div>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={savePurchase}>{editingPurchase ? 'Atualizar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens da compra serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteDialog && deletePurchase(showDeleteDialog)} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


