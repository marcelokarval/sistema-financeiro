'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); }
  catch { return d; }
};

const cardColors = ['#8b5cf6', '#f97316', '#ef4444', '#3b82f6', '#06b6d4', '#22c55e', '#ec4899'];
const brandIcons: Record<string, string> = { VISA: 'VISA', MASTERCARD: 'MC', ELO: 'ELO', AMEX: 'AMEX', HIPER: 'HIPER' };

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
  const [cards, setCards] = useState<CardData[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', type: 'CREDIT', brand: 'VISA', lastFourDigits: '', creditLimit: '0',
    closingDay: '1', dueDay: '10', color: '#8b5cf6', flag: '',
  });

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (res.ok) setCards(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchPurchases = useCallback(async (cardId: string) => {
    try {
      const res = await fetch(`/api/purchases?cardId=${cardId}`);
      if (res.ok) setPurchases(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const openCard = (card: CardData) => {
    setSelectedCard(card);
    fetchPurchases(card.id);
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

  const saveCard = async () => {
    try {
      const body = {
        ...form,
        creditLimit: parseFloat(form.creditLimit) || 0,
        closingDay: parseInt(form.closingDay) || 1,
        dueDay: parseInt(form.dueDay) || 10,
      };
      if (editingCard) {
        await fetch('/api/cards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCard.id, ...body }) });
        toast.success('Cartão atualizado!');
      } else {
        await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast.success('Cartão adicionado!');
      }
      setShowCardDialog(false);
      fetchCards();
    } catch { toast.error('Erro ao salvar cartão'); }
  };

  const deleteCard = async (id: string) => {
    try {
      await fetch('/api/cards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success('Cartão excluído!');
      setShowDeleteDialog(null);
      if (selectedCard?.id === id) setSelectedCard(null);
      fetchCards();
    } catch { toast.error('Erro ao excluir cartão'); }
  };

  const usagePercent = (card: CardData) =>
    card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;

  const isOverLimit = (card: CardData) => usagePercent(card) > 80;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  // Selected card detail view
  if (selectedCard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedCard(null)}>
            <X className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold">{selectedCard.name}</h2>
          <Badge variant="outline">{selectedCard.type === 'CREDIT' ? 'Crédito' : 'Débito'}</Badge>
        </div>

        {/* Card Visual */}
        <div
          className="relative w-full max-w-md h-56 rounded-2xl p-6 text-white overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${selectedCard.color}, ${selectedCard.color}cc)`,
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white" />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wider">{selectedCard.flag || selectedCard.brand}</p>
                <p className="text-lg font-bold mt-1">{selectedCard.name}</p>
              </div>
              <span className="text-xl font-bold opacity-90">{brandIcons[selectedCard.brand] || selectedCard.brand}</span>
            </div>
            <div>
              <p className="text-2xl font-mono tracking-[0.25em] mb-4">
                •••• •••• •••• {selectedCard.lastFourDigits}
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs opacity-70">Fecha em</p>
                  <p className="font-semibold">{selectedCard.closingDay} de cada mês</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Vence em</p>
                  <p className="font-semibold">dia {selectedCard.dueDay}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Limite Total</p>
              <p className="text-xl font-bold">{currencyFmt(selectedCard.creditLimit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Fatura Atual</p>
              <p className="text-xl font-bold text-rose-500">{currencyFmt(selectedCard.currentBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className={`text-xl font-bold ${isOverLimit(selectedCard) ? 'text-amber-500' : 'text-emerald-500'}`}>
                {currencyFmt(selectedCard.creditLimit - selectedCard.currentBalance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uso do Limite</span>
              <span className="text-sm text-muted-foreground">{usagePercent(selectedCard).toFixed(0)}%</span>
            </div>
            <Progress value={usagePercent(selectedCard)} className="h-2" />
          </CardContent>
        </Card>

        {/* Purchases */}
        <Card>
          <Card className="border-0 shadow-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Compras no Cartão</h3>
              <Badge variant="outline">{purchases.length} compras</Badge>
            </div>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma compra registrada neste cartão</p>
              </div>
            ) : (
              <div className="space-y-2">
                {purchases.map((p) => (
                  <div key={p.id} className="border border-border rounded-lg">
                    <button
                      className="flex items-center justify-between w-full p-3 hover:bg-accent/30 transition-colors rounded-lg"
                      onClick={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{p.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateFmt(p.date)}
                            {p.category && ` · ${p.category.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{currencyFmt(p.totalAmount)}</span>
                        {expandedPurchase === p.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedPurchase === p.id && p.items && p.items.length > 0 && (
                      <div className="border-t border-border px-3 pb-3 pt-2">
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">ITENS DA COMPRA</p>
                          {p.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm pl-2">
                              <span className="text-muted-foreground truncate flex-1">
                                <span className="text-foreground/70">{item.quantity}x</span> {item.name}
                              </span>
                              <span className="font-medium whitespace-nowrap ml-2 text-xs">
                                {currencyFmt(item.unitPrice)} un · <strong>{currencyFmt(item.totalPrice)}</strong>
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-semibold">
                            <span>Total</span>
                            <span>{currencyFmt(p.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Card>
      </div>
    );
  }

  // Cards grid view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cartões</h2>
          <p className="text-sm text-muted-foreground">Gerencie seus cartões e faturas</p>
        </div>
        <Button onClick={openNewCard} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Cartão
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="space-y-3 group">
            {/* Card visual */}
            <div
              className="relative w-full h-48 rounded-2xl p-5 text-white cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${card.color}, ${card.color}bb)`,
              }}
              onClick={() => openCard(card)}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs opacity-80 uppercase tracking-wider">{card.flag || card.brand}</p>
                    <p className="text-base font-bold mt-0.5">{card.name}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); openEditCard(card); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(card.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-mono tracking-[0.2em] mb-3">
                    •••• •••• •••• {card.lastFourDigits}
                  </p>
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-bold opacity-90">{brandIcons[card.brand]}</span>
                    <div className="text-right">
                      <p className="text-[10px] opacity-70">Fecha dia {card.closingDay}</p>
                      <p className="text-[10px] opacity-70">Vence dia {card.dueDay}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage info */}
            <div className="px-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fatura</span>
                <span className="font-semibold">{currencyFmt(card.currentBalance)}</span>
              </div>
              <Progress
                value={usagePercent(card)}
                className={`h-1.5 ${isOverLimit(card) ? '[&>div]:bg-amber-500' : ''}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{usagePercent(card).toFixed(0)}% usado</span>
                <span>Limite: {currencyFmt(card.creditLimit)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Card Form Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
            <DialogDescription>
              {editingCard ? 'Atualize os dados do cartão' : 'Adicione um novo cartão'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cartão</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank Platinum" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Crédito</SelectItem>
                    <SelectItem value="DEBIT">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bandeira</Label>
                <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Últimos 4 dígitos</Label>
                <Input value={form.lastFourDigits} onChange={(e) => setForm({ ...form, lastFourDigits: e.target.value.slice(0, 4) })} placeholder="0000" maxLength={4} />
              </div>
              <div>
                <Label>Bandeira/Banco (opcional)</Label>
                <Input value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} placeholder="Ex: Nubank, Inter" />
              </div>
            </div>
            {form.type === 'CREDIT' && (
              <>
                <div>
                  <Label>Limite de Crédito (R$)</Label>
                  <Input type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dia de Fechamento</Label>
                    <Input type="number" min="1" max="31" value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: e.target.value })} />
                  </div>
                  <div>
                    <Label>Dia de Vencimento</Label>
                    <Input type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {cardColors.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCardDialog(false)}>Cancelar</Button>
            <Button onClick={saveCard}>{editingCard ? 'Atualizar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de compras será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteDialog && deleteCard(showDeleteDialog)} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
