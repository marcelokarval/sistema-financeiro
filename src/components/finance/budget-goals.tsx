'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface BudgetGoal {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
  startDate: string;
  endDate: string | null;
  isCompleted: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

function getProgressColor(percent: number): string {
  if (percent >= 70) return '#22c55e';
  if (percent >= 30) return '#f59e0b';
  return '#ef4444';
}

function getProgressColorClass(percent: number): string {
  if (percent >= 70) return 'text-emerald-500';
  if (percent >= 30) return 'text-amber-500';
  return 'text-rose-500';
}

function CircularProgress({
  percent,
  size = 72,
  strokeWidth = 6,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const color = getProgressColor(percent);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  );
}

interface GoalFormData {
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  categoryId: string;
  endDate: string;
}

const emptyForm: GoalFormData = {
  name: '',
  description: '',
  targetAmount: '',
  currentAmount: '0',
  categoryId: 'none',
  endDate: '',
};

export function BudgetGoalsWidget() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);
  const [form, setForm] = useState<GoalFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, catsRes] = await Promise.all([
        fetch('/api/budgets'),
        fetch('/api/categories'),
      ]);
      if (goalsRes.ok) setGoals(await goalsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
    } catch (e) {
      console.error('Erro ao carregar metas', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingGoal(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (goal: BudgetGoal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      description: goal.description,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      categoryId: goal.categoryId || 'none',
      endDate: goal.endDate ? goal.endDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('O nome da meta é obrigatório');
      return;
    }
    const target = parseFloat(form.targetAmount);
    if (!target || target <= 0) {
      toast.error('O valor alvo deve ser maior que zero');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        targetAmount: target,
        currentAmount: parseFloat(form.currentAmount) || 0,
        categoryId: form.categoryId !== 'none' ? form.categoryId : null,
        endDate: form.endDate || null,
        ...(editingGoal && { id: editingGoal.id }),
      };

      const method = editingGoal ? 'PUT' : 'POST';
      const res = await fetch('/api/budgets', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erro ao salvar meta');
        return;
      }

      toast.success(editingGoal ? 'Meta atualizada com sucesso!' : 'Meta criada com sucesso!');
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (goal: BudgetGoal) => {
    try {
      const res = await fetch('/api/budgets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goal.id }),
      });
      if (res.ok) {
        toast.success('Meta excluída');
        fetchData();
      } else {
        toast.error('Erro ao excluir meta');
      }
    } catch {
      toast.error('Erro de conexão');
    }
  };

  const handleToggleComplete = async (goal: BudgetGoal) => {
    try {
      const res = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goal.id,
          isCompleted: !goal.isCompleted,
        }),
      });
      if (res.ok) {
        toast.success(goal.isCompleted ? 'Meta reaberta' : 'Meta concluída! 🎉');
        fetchData();
      }
    } catch {
      toast.error('Erro ao atualizar meta');
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeCount = goals.filter((g) => !g.isCompleted).length;
  const completedCount = goals.filter((g) => g.isCompleted).length;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Metas de Orçamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeCount} ativa{activeCount !== 1 ? 's' : ''} · {completedCount} concluída{completedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nova Meta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma meta criada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Crie sua primeira meta de orçamento para acompanhar seus objetivos
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              Criar Meta
            </Button>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {goals.map((goal) => {
                const percent = goal.targetAmount > 0
                  ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                  : 0;
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);

                return (
                  <motion.div
                    key={goal.id}
                    variants={item}
                    layout
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className="relative"
                  >
                    <div
                      className={`relative rounded-xl border p-4 transition-all ${
                        goal.isCompleted
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-card hover:shadow-md border-border'
                      }`}
                    >
                      {/* Completed overlay badge */}
                      {goal.isCompleted && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluída
                          </Badge>
                        </div>
                      )}

                      {/* Dropdown menu */}
                      <div className="absolute top-3 right-3">
                        {!goal.isCompleted && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(goal)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleComplete(goal)}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Marcar como concluída
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(goal)}
                                className="text-rose-500 focus:text-rose-500"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!goal.isCompleted && (
                          <></>
                        )}
                      </div>

                      <div className="flex items-start gap-4">
                        {/* Progress Circle */}
                        <div className="relative shrink-0">
                          <CircularProgress percent={percent} size={68} strokeWidth={6} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-sm font-bold ${getProgressColorClass(percent)}`}>
                              {Math.round(percent)}%
                            </span>
                          </div>
                        </div>

                        {/* Goal Info */}
                        <div className="flex-1 min-w-0 pr-6">
                          <h3 className="text-sm font-semibold truncate">{goal.name}</h3>
                          {goal.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {goal.description}
                            </p>
                          )}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Atual</span>
                              <span className="font-medium">{currencyFmt(goal.currentAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Meta</span>
                              <span className="font-semibold">{currencyFmt(goal.targetAmount)}</span>
                            </div>
                            {!goal.isCompleted && remaining > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Faltam</span>
                                <span className="font-medium text-rose-500">
                                  {currencyFmt(remaining)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Category Badge */}
                      {goal.category && (
                        <div className="mt-3">
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1"
                            style={{
                              backgroundColor: `${goal.category.color}15`,
                              color: goal.category.color,
                              borderColor: `${goal.category.color}30`,
                            }}
                          >
                            {goal.category.name}
                          </Badge>
                        </div>
                      )}

                      {/* Complete toggle button */}
                      {!goal.isCompleted && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-emerald-600"
                            onClick={() => handleToggleComplete(goal)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar como concluída
                          </Button>
                        </div>
                      )}

                      {/* Reopen button */}
                      {goal.isCompleted && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-xs gap-1.5 text-emerald-600"
                            onClick={() => handleToggleComplete(goal)}
                          >
                            <Circle className="w-3.5 h-3.5" />
                            Reabrir meta
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Editar Meta' : 'Nova Meta de Orçamento'}
            </DialogTitle>
            <DialogDescription>
              {editingGoal
                ? 'Atualize os dados da sua meta de orçamento.'
                : 'Defina um objetivo financeiro para acompanhar seu progresso.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Nome da meta *</Label>
              <Input
                id="goal-name"
                placeholder="Ex: Reserva de emergência"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-desc">Descrição</Label>
              <Textarea
                id="goal-desc"
                placeholder="Descreva sua meta (opcional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="goal-target">Valor alvo (R$) *</Label>
                <Input
                  id="goal-target"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={form.targetAmount}
                  onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-current">Valor atual (R$)</Label>
                <Input
                  id="goal-current"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.currentAmount}
                  onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(val) => setForm({ ...form, categoryId: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-end">Data limite</Label>
                <Input
                  id="goal-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <X className="w-4 h-4" />
                  </motion.div>
                  Salvando...
                </>
              ) : editingGoal ? (
                'Salvar Alterações'
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar Meta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
