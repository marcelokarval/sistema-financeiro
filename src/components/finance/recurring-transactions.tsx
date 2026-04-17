'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

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

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

const frequencyColors: Record<string, string> = {
  WEEKLY: 'bg-sky-500/10 text-sky-600',
  BIWEEKLY: 'bg-cyan-500/10 text-cyan-600',
  MONTHLY: 'bg-violet-500/10 text-violet-600',
  QUARTERLY: 'bg-amber-500/10 text-amber-600',
  YEARLY: 'bg-emerald-500/10 text-emerald-600',
};

// ── Animation Variants ─────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Interfaces ─────────────────────────────────────────────────────
interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  frequency: string;
  nextDate: string;
  isActive: boolean;
  category?: { id: string; name: string; color: string; icon: string } | null;
  account?: { id: string; name: string; color: string; icon: string } | null;
  card?: { id: string; name: string; color: string; lastFourDigits: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface Account {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface CardItem {
  id: string;
  name: string;
  color: string;
  lastFourDigits: string;
}

// ── Component ──────────────────────────────────────────────────────
export function RecurringTransactionsWidget() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  // Form state
  const defaultNextDate = new Date();
  defaultNextDate.setMonth(defaultNextDate.getMonth() + 1);
  const defaultNextDateStr = defaultNextDate.toISOString().split('T')[0];

  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'EXPENSE',
    frequency: 'MONTHLY',
    nextDate: defaultNextDateStr,
    categoryId: '',
    accountId: '',
    cardId: '',
  });

  // ── Data fetching ────────────────────────────────────────────────
  const fetchRecurring = useCallback(async () => {
    try {
      const res = await fetch('/api/recurring');
      if (res.ok) setRecurring(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [catRes, accRes, cardRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/accounts'),
        fetch('/api/cards'),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
      if (cardRes.ok) setCards(await cardRes.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRecurring();
    fetchLookups();
  }, [fetchRecurring, fetchLookups]);

  // ── Computed ─────────────────────────────────────────────────────
  const activeCount = recurring.filter((r) => r.isActive).length;
  const inactiveCount = recurring.filter((r) => !r.isActive).length;
  const monthlyTotal = recurring
    .filter((r) => r.isActive && r.type === 'EXPENSE')
    .reduce((sum, r) => sum + r.amount, 0);
  const monthlyIncome = recurring
    .filter((r) => r.isActive && r.type === 'INCOME')
    .reduce((sum, r) => sum + r.amount, 0);

  // ── Actions ──────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm({
      description: '',
      amount: '',
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: defaultNextDateStr,
      categoryId: '',
      accountId: '',
      cardId: '',
    });
    setShowFormDialog(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r);
    setForm({
      description: r.description,
      amount: String(r.amount),
      type: r.type,
      frequency: r.frequency,
      nextDate: new Date(r.nextDate).toISOString().split('T')[0],
      categoryId: r.categoryId || '',
      accountId: r.accountId || '',
      cardId: r.cardId || '',
    });
    setShowFormDialog(true);
  };

  const toggleActive = async (r: RecurringTransaction) => {
    try {
      await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      });
      toast.success(r.isActive ? 'Transação pausada' : 'Transação ativada');
      fetchRecurring();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const saveForm = async () => {
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Preencha descrição e valor corretamente');
      return;
    }

    try {
      const body = {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        frequency: form.frequency,
        nextDate: form.nextDate,
        categoryId: form.categoryId || null,
        accountId: form.accountId || null,
        cardId: form.cardId || null,
      };

      if (editing) {
        await fetch('/api/recurring', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        });
        toast.success('Transação recorrente atualizada!');
      } else {
        await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Transação recorrente criada!');
      }
      setShowFormDialog(false);
      fetchRecurring();
    } catch {
      toast.error('Erro ao salvar transação recorrente');
    }
  };

  const deleteRecurring = async (id: string) => {
    try {
      await fetch('/api/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Transação recorrente excluída!');
      setShowDeleteDialog(null);
      fetchRecurring();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const processRecurring = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/recurring/process', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Processamento concluído');
        fetchRecurring();
      } else {
        toast.error(data.error || 'Erro ao processar');
      }
    } catch {
      toast.error('Erro ao processar transações');
    } finally {
      setProcessing(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div variants={headerVariants} initial="hidden" animate="show">
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Transações Recorrentes</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerencie suas transações automáticas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={processRecurring}
                  disabled={processing}
                  className="gap-1.5"
                >
                  <RotateCcw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Processar</span>
                </Button>
                <Button onClick={openNew} size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nova Transação Recorrente</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={item}>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Receitas Mensais
                  </p>
                  <p className="text-xl font-bold text-emerald-500 mt-1 tracking-tight">
                    {currencyFmt(monthlyIncome)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Despesas Mensais
                  </p>
                  <p className="text-xl font-bold text-rose-500 mt-1 tracking-tight">
                    {currencyFmt(monthlyTotal)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4 text-rose-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Ativas / Inativas
                  </p>
                  <p className="text-xl font-bold mt-1 tracking-tight">
                    <span className="text-violet-500">{activeCount}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">{inactiveCount}</span>
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Recurring Transactions List */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Card className="overflow-hidden border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Lista de Transações Recorrentes
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {recurring.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recurring.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium">Nenhuma transação recorrente</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Clique em &quot;Nova Transação Recorrente&quot; para começar a automatizar suas finanças
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {recurring.map((r) => (
                  <motion.div
                    key={r.id}
                    variants={item}
                    className={`flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors ${
                      !r.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          r.type === 'INCOME'
                            ? 'bg-emerald-500/10'
                            : 'bg-rose-500/10'
                        }`}
                      >
                        {r.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              frequencyColors[r.frequency] || 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {frequencyLabels[r.frequency] || r.frequency}
                          </span>
                          {r.category && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                backgroundColor: `${r.category.color}15`,
                                color: r.category.color,
                              }}
                            >
                              {r.category.name}
                            </span>
                          )}
                          {r.account && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                              {r.account.name}
                            </span>
                          )}
                          {r.card && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                              {r.card.name} ****{r.card.lastFourDigits}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div className="text-right">
                        <span
                          className={`text-sm font-bold ${
                            r.type === 'INCOME'
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {r.type === 'INCOME' ? '+' : '-'}
                          {currencyFmt(r.amount)}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Próx: {dateFmt(r.nextDate)}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleActive(r)}
                        className="p-1 rounded-lg hover:bg-accent transition-colors"
                        title={r.isActive ? 'Pausar' : 'Ativar'}
                      >
                        {r.isActive ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setShowDeleteDialog(r.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? 'Editar Transação Recorrente'
                : 'Nova Transação Recorrente'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da transação recorrente'
                : 'Configure uma nova transação que se repete automaticamente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Ex: Salário, Aluguel, Netflix..."
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Frequência</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="BIWEEKLY">Quinzenal</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Próxima Data</Label>
              <Input
                type="date"
                value={form.nextDate}
                onChange={(e) => setForm({ ...form, nextDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.type === form.type)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta</Label>
              <Select
                value={form.accountId}
                onValueChange={(v) => setForm({ ...form, accountId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cartão</Label>
              <Select
                value={form.cardId}
                onValueChange={(v) => setForm({ ...form, cardId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ****{c.lastFourDigits}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveForm}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog !== null}
        onOpenChange={() => setShowDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação Recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação recorrente? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteRecurring(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
