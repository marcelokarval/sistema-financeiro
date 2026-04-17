'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  PieChart,
  Plus,
  Target,
  CreditCard,
  Wallet,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { currencyFmt, containerVariants, itemVariants } from '@/lib/helpers';

// --- Types ---
interface BudgetItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// --- Color helpers ---
function getProgressColor(pct: number, overBudget: boolean): string {
  if (overBudget) return 'bg-red-500';
  if (pct >= 90) return 'bg-rose-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressLabel(pct: number, overBudget: boolean): string {
  if (overBudget) return 'Excedido';
  if (pct >= 90) return 'Crítico';
  if (pct >= 60) return 'Atenção';
  return 'Bom';
}

// --- Loading Skeleton ---
function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md">
      <div className="h-1 rounded-t-xl bg-gradient-to-r from-emerald-500 to-teal-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Budget Card ---
function BudgetCard({
  budget,
  index,
  onEdit,
  onDelete,
}: {
  budget: BudgetItem;
  index: number;
  onEdit: (b: BudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const pctColor = getProgressColor(budget.percentage, budget.isOverBudget);
  const label = getProgressLabel(budget.percentage, budget.isOverBudget);
  const labelColor = budget.isOverBudget
    ? 'text-red-500'
    : budget.percentage >= 90
    ? 'text-rose-500'
    : budget.percentage >= 60
    ? 'text-amber-500'
    : 'text-emerald-500';

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${budget.categoryColor}15` }}
            >
              <span
                className="text-sm"
                dangerouslySetInnerHTML={{
                  __html: `<iconify-icon icon="lucide:${budget.categoryIcon}" width="16" height="16" style="color:${budget.categoryColor}"></iconify-icon>`,
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{budget.categoryName}</h4>
              <p className="text-[11px] text-muted-foreground">
                {currencyFmt(budget.spent)} de {currencyFmt(budget.amount)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-medium ${labelColor}`}
                style={{
                  backgroundColor: budget.isOverBudget
                    ? 'rgba(239,68,68,0.08)'
                    : budget.percentage >= 90
                    ? 'rgba(244,63,94,0.08)'
                    : budget.percentage >= 60
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(34,197,94,0.08)',
                }}
              >
                {label}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(budget)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(budget.id)}
                    className="text-rose-500 focus:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${pctColor}`}
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(budget.percentage, 100)}%`,
                }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + index * 0.06 }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {budget.percentage.toFixed(0)}% utilizado
              </span>
              <span
                className={`text-[11px] font-medium ${
                  budget.isOverBudget ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {budget.isOverBudget
                  ? `Excedido em ${currencyFmt(Math.abs(budget.remaining))}`
                  : `Resta ${currencyFmt(budget.remaining)}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Main Component ---
export function MonthlyBudgetTracker() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = format(now, 'MMMM yyyy', { locale: ptBR });

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch(`/api/monthly-budgets?month=${currentMonth}&year=${currentYear}`);
      if (res.ok) {
        const data = await res.json();
        setBudgets(data.budgets);
      }
    } catch (e) {
      console.error('Erro ao carregar orçamentos:', e);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        const expenseCategories = (data.categories || data || []).filter(
          (c: any) => c.type === 'EXPENSE'
        );
        setCategories(
          expenseCategories.map((c: any) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, [fetchBudgets, fetchCategories]);

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalOverBudget = totalSpent > totalBudget;

  // Open create dialog
  const openCreateDialog = () => {
    setEditingBudget(null);
    setFormCategoryId('');
    setFormAmount('');
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (budget: BudgetItem) => {
    setEditingBudget(budget);
    setFormCategoryId(budget.categoryId);
    setFormAmount(String(budget.amount));
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  // Submit handler
  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!formCategoryId || !amount || amount <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }
    const month = parseInt(formMonth);
    const year = parseInt(formYear);
    if (month < 1 || month > 12 || year < 2021) {
      toast.error('Mês ou ano inválido');
      return;
    }

    setSubmitting(true);
    try {
      if (editingBudget) {
        const res = await fetch('/api/monthly-budgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingBudget.id, amount }),
        });
        if (res.ok) {
          toast.success('Orçamento atualizado');
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao atualizar');
        }
      } else {
        const res = await fetch('/api/monthly-budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: formCategoryId, amount, month, year }),
        });
        if (res.ok) {
          toast.success('Orçamento criado');
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao criar');
        }
      }
      setDialogOpen(false);
      fetchBudgets();
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/monthly-budgets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Orçamento excluído');
        fetchBudgets();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro de conexão');
    }
  };

  if (loading) return <LoadingSkeleton />;

  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md card-glow">
        {/* Gradient top border */}
        <div className="h-1 rounded-t-xl bg-gradient-to-r from-emerald-500 to-teal-500" />

        <CardHeader className="pb-3">
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <PieChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Orçamento Mensal</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:from-emerald-600 hover:to-teal-700 transition-all"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Limite
            </Button>
          </motion.div>
        </CardHeader>

        <CardContent>
          {/* Summary Row */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"
          >
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Orçamento Total</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{currencyFmt(totalBudget)}</p>
            </div>
            <div
              className={`rounded-xl border border-border/50 bg-gradient-to-br ${totalOverBudget ? 'from-rose-500/5 to-transparent' : 'from-emerald-500/5 to-transparent'} p-4`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${totalOverBudget ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}
                >
                  <CreditCard
                    className={`w-3.5 h-3.5 ${totalOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Gasto Total</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${totalOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                {currencyFmt(totalSpent)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-teal-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-teal-500" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Disponível</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${totalOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                {currencyFmt(totalRemaining)}
              </p>
            </div>
          </motion.div>

          {/* Budget List */}
          {budgets.length > 0 ? (
            <motion.div
              variants={containerVariants}
              className="space-y-2.5"
            >
              <AnimatePresence mode="popLayout">
                {budgets.map((budget, i) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    index={i}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="py-12 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <PieChart className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground">
                Nenhum orçamento definido
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
                Defina limites de gastos por categoria para controlar melhor suas
                finanças
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={openCreateDialog}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Orçamento
              </Button>
            </motion.div>
          )}

          {/* Over-budget warning */}
          {totalOverBudget && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-4 rounded-xl bg-gradient-to-r from-red-500/5 via-rose-500/5 to-transparent border border-red-500/10 p-3 flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </div>
              <p className="text-xs text-red-500 dark:text-red-400 leading-relaxed">
                <span className="font-semibold">Atenção:</span> Você ultrapassou o orçamento total em{' '}
                <span className="font-bold">{currencyFmt(Math.abs(totalRemaining))}</span> este mês.
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formCategoryId}
                onValueChange={setFormCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Valor do Limite (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={formMonth} onValueChange={setFormMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={formYear} onValueChange={setFormYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
              onClick={handleSubmit}
              disabled={submitting || !formCategoryId || !formAmount}
            >
              {submitting ? 'Salvando...' : editingBudget ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
