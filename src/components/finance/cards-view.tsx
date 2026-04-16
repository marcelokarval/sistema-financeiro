'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, ShoppingBag, Wifi, Copy, Check, CreditCard, Nfc } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyNumber = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
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

        {/* Card Visual - Premium */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md mx-auto"
        >
          <div
            className="relative w-full h-56 rounded-2xl p-6 text-white overflow-hidden shadow-2xl cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${selectedCard.color}, ${selectedCard.color}cc, ${selectedCard.color}99)`,
            }}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white/3" />
            </div>

            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />

            <div className="relative z-10 h-full flex flex-col justify-between">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-[0.2em]">{selectedCard.flag || selectedCard.brand}</p>
                  <p className="text-lg font-bold mt-1 tracking-wide">{selectedCard.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-yellow-300/80 flex items-center justify-center">
                    <Nfc className="w-4 h-4 text-yellow-900/60" />
                  </div>
                  <Wifi className="w-5 h-5 opacity-60 rotate-90" />
                </div>
              </div>

              {/* Card number */}
              <div>
                <p className="text-xl font-mono tracking-[0.3em] mb-4 flex items-center gap-2">
                  <span>••••</span>
                  <span>••••</span>
                  <span>••••</span>
                  <span className="text-2xl">{selectedCard.lastFourDigits}</span>
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] opacity-50 uppercase tracking-wider">Fecha em</p>
                    <p className="font-semibold text-sm">{String(selectedCard.closingDay).padStart(2, '0')} de cada mês</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] opacity-50 uppercase tracking-wider">Vence em</p>
                    <p className="font-semibold text-sm">dia {String(selectedCard.dueDay).padStart(2, '0')}</p>
                  </div>
                  <span className="text-lg font-black opacity-80 tracking-wider">
                    {brandIcons[selectedCard.brand] || selectedCard.brand}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-xl opacity-30"
            style={{ backgroundColor: selectedCard.color }}
          />
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Limite</p>
              <p className="text-lg font-bold mt-1">{currencyFmt(selectedCard.creditLimit)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fatura</p>
              <p className="text-lg font-bold mt-1 text-rose-500">{currencyFmt(selectedCard.currentBalance)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Livre</p>
              <p className={`text-lg font-bold mt-1 ${isOverLimit(selectedCard) ? 'text-amber-500' : 'text-emerald-500'}`}>
                {currencyFmt(selectedCard.creditLimit - selectedCard.currentBalance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage bar */}
        <Card className="border-0 shadow-sm max-w-md mx-auto">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uso do Limite</span>
              <Badge variant={isOverLimit(selectedCard) ? 'destructive' : 'secondary'} className="text-[10px]">
                {usagePercent(selectedCard).toFixed(0)}%
              </Badge>
            </div>
            <Progress value={usagePercent(selectedCard)} className="h-2" />
          </CardContent>
        </Card>

        {/* Purchases */}
        <Card className="border-0 shadow-md">
          <div className="flex items-center justify-between p-4 pb-3">
            <h3 className="text-base font-semibold">Compras no Cartão</h3>
            <Badge variant="outline" className="text-[10px]">{purchases.length} compras</Badge>
          </div>
          {purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground px-4">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma compra registrada neste cartão</p>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className="border border-border/50 rounded-xl overflow-hidden">
                  <button
                    className="flex items-center justify-between w-full p-3 hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-violet-500" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{p.merchant}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{dateFmt(p.date)}</span>
                          {p.category && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${p.category.color}15`, color: p.category.color }}>
                              {p.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">{currencyFmt(p.totalAmount)}</span>
                      <AnimatePresence mode="wait">
                        {expandedPurchase === p.id ? (
                          <motion.div key="up" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: -90 }} transition={{ duration: 0.15 }}>
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          </motion.div>
                        ) : (
                          <motion.div key="down" initial={{ rotate: 90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }} transition={{ duration: 0.15 }}>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedPurchase === p.id && p.items && p.items.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/50 px-3 pb-3 pt-2">
                          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Itens da Compra ({p.items.length})
                            </p>
                            {p.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs pl-2 py-0.5">
                                <span className="text-muted-foreground truncate flex-1">
                                  <span className="text-foreground/60 mr-1">{item.quantity}x</span>
                                  {item.name}
                                </span>
                                <span className="font-medium whitespace-nowrap ml-3 text-[11px]">
                                  {currencyFmt(item.unitPrice)} un · <strong>{currencyFmt(item.totalPrice)}</strong>
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-bold px-2">
                              <span>Total</span>
                              <span>{currencyFmt(p.totalAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Cards grid view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Cartões</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus cartões e acompanhe as faturas</p>
        </div>
        <Button onClick={openNewCard} size="sm" className="shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Cartão
        </Button>
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-r from-violet-500/10 to-transparent border-violet-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-violet-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total em Faturas</p>
              <p className="text-lg font-bold text-rose-500">{currencyFmt(cards.reduce((s, c) => s + c.currentBalance, 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
              <span className="text-xs">💳</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Limite Total</p>
              <p className="text-lg font-bold">{currencyFmt(cards.reduce((s, c) => s + c.creditLimit, 0))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Card visual */}
            <div
              className="relative w-full h-48 rounded-2xl p-5 text-white cursor-pointer overflow-hidden shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${card.color}, ${card.color}bb)`,
              }}
              onClick={() => openCard(card)}
            >
              {/* Background elements */}
              <div className="absolute inset-0">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
              </div>

              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] opacity-70 uppercase tracking-[0.15em]">{card.flag || card.brand}</p>
                    <p className="text-sm font-bold mt-0.5">{card.name}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); copyNumber(card.id, `•••• •••• •••• ${card.lastFourDigits}`); }}
                    >
                      {copiedId === card.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-mono tracking-[0.25em] mb-3">
                    •••• •••• •••• {card.lastFourDigits}
                  </p>
                  <div className="flex items-end justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded bg-yellow-300/70 flex items-center justify-center">
                        <Nfc className="w-3 h-3 text-yellow-900/60" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] opacity-50">Fecha {card.closingDay} · Vence {card.dueDay}</p>
                    </div>
                    <span className="text-sm font-black opacity-80 tracking-wider">{brandIcons[card.brand] || card.brand}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card info */}
            <div className="px-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fatura atual</span>
                <span className="font-bold">{currencyFmt(card.currentBalance)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={usagePercent(card)}
                  className={`h-1.5 flex-1 ${isOverLimit(card) ? '[&>div]:bg-amber-500' : ''}`}
                />
                <span className="text-[10px] text-muted-foreground w-8 text-right">{usagePercent(card).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Disponível: <span className={isOverLimit(card) ? 'text-amber-500 font-medium' : 'text-emerald-500 font-medium'}>{currencyFmt(card.creditLimit - card.currentBalance)}</span>
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditCard(card); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(card.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Card Form Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
            <DialogDescription>{editingCard ? 'Atualize os dados do cartão' : 'Adicione um novo cartão'}</DialogDescription>
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
              <div className="flex gap-2 mt-1 flex-wrap">
                {cardColors.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
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
            <AlertDialogDescription>Esta ação não pode ser desfeita. O histórico de compras será preservado.</AlertDialogDescription>
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
