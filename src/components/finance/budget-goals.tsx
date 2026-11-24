'use client';

import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { currencyFmt } from '@/lib/helpers';
import { FinanceProgress } from '@/components/shared/finance-progress';

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

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';

type FocusTarget = Pick<HTMLElement, 'isConnected' | 'focus'>;

export function restoreBudgetGoalFocus(origin: FocusTarget | null, fallback: FocusTarget | null) {
  const target = origin?.isConnected ? origin : fallback;
  if (target?.isConnected) target.focus();
}

export function restoreBudgetGoalFocusAfterDeletion(
  deletedId: string,
  goals: readonly Pick<BudgetGoal, 'id'>[],
  activeElement: object | null,
  body: object,
  fallback: FocusTarget | null,
) {
  if (activeElement === body && !goals.some((goal) => goal.id === deletedId)) {
    restoreBudgetGoalFocus(null, fallback);
  }
}

export function BudgetGoalRow({ goal, onEdit, onDelete, onToggle }: {
  goal: BudgetGoal;
  onEdit: (goal: BudgetGoal, trigger: HTMLButtonElement | null) => void;
  onDelete: (goal: BudgetGoal) => void;
  onToggle: (goal: BudgetGoal) => void;
}) {
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const openingEditor = useRef(false);
  const percent = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const width = Math.max(0, percent);
  return (
    <li className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-5">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-semibold">{goal.name}</h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
          <span>{goal.isCompleted ? 'Concluída' : 'Ativa'}</span>
          {goal.category && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: goal.category.color }} />
              <span className="min-w-0 break-words">{goal.category.name}</span>
            </span>
          )}
        </p>
        {goal.description && <p className="mt-1 break-words text-sm text-muted-foreground">{goal.description}</p>}
      </div>
      <div className="min-w-0 space-y-1.5 text-xs">
        <FinanceProgress
          label="Progresso"
          ariaLabel={`Progresso da meta ${goal.name}`}
          value={width}
          min={0}
          max={100}
          unit="%"
          displayValue={`${Math.round(percent)}%`}
          valueText={`${Math.round(percent)}%`}
        />
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {([['Atual', goal.currentAmount], ['Alvo', goal.targetAmount], ...(!goal.isCompleted && remaining > 0 ? [['Restante', remaining] as const] : [])] as const).map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-mono tabular-nums">{currencyFmt(value)}</dd></div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {!goal.isCompleted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={menuTrigger} type="button" variant="outline" size="icon" aria-label={`Mais ações de ${goal.name}`}><MoreHorizontal aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={(event) => {
              // Do not pull focus back out of the editor or off a new target.
              if (openingEditor.current || document.activeElement !== document.body) event.preventDefault();
              openingEditor.current = false;
            }}>
              <DropdownMenuItem onSelect={() => {
                openingEditor.current = true;
                onEdit(goal, menuTrigger.current);
              }}><Pencil aria-hidden="true" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(goal)}><CheckCircle2 aria-hidden="true" /> Marcar como concluída</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(goal)}><Trash2 aria-hidden="true" /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => onToggle(goal)}>
          {goal.isCompleted ? 'Reabrir meta' : 'Marcar como concluída'}
        </Button>
      </div>
    </li>
  );
}

export function BudgetGoalsWidget() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);
  const [form, setForm] = useState<GoalFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const dialogOrigin = useRef<HTMLButtonElement | null>(null);
  const pendingDeletionFocus = useRef(new Set<string>());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const [goalsRes, catsRes] = await Promise.all([
        fetch('/api/budgets'),
        fetch('/api/categories'),
      ]);
      if (!goalsRes.ok) {
        setError(true);
        return;
      }
      setGoals(await goalsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
    } catch (e) {
      console.error('Erro ao carregar metas', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (pendingDeletionFocus.current.size === 0) return;
    // Wait for the refreshed list to commit and the menu's focus scope to close.
    const frame = requestAnimationFrame(() => {
      for (const id of pendingDeletionFocus.current) {
        if (goals.some((goal) => goal.id === id)) continue;
        pendingDeletionFocus.current.delete(id);
        restoreBudgetGoalFocusAfterDeletion(id, goals, document.activeElement, document.body, createButton.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [goals]);

  const openCreate = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOrigin.current = event.currentTarget;
    setEditingGoal(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (goal: BudgetGoal, trigger: HTMLButtonElement | null) => {
    dialogOrigin.current = trigger;
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
        pendingDeletionFocus.current.add(goal.id);
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
        toast.success(goal.isCompleted ? 'Meta reaberta' : 'Meta concluída!');
        fetchData();
      }
    } catch {
      toast.error('Erro ao atualizar meta');
    }
  };

  return (
    <>
      <BudgetGoalsContent
        goals={goals}
        loading={loading}
        error={error}
        createButtonRef={createButton}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggle={handleToggleComplete}
        onRetry={fetchData}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md" onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreBudgetGoalFocus(dialogOrigin.current, createButton.current);
          dialogOrigin.current = null;
        }}>
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

            <div className="grid gap-3 min-[400px]:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goal-category">Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(val) => setForm({ ...form, categoryId: val })}
                >
                  <SelectTrigger id="goal-category" className="w-full min-w-0">
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
    </>
  );
}

export function BudgetGoalsContent({
  goals,
  loading,
  error,
  createButtonRef,
  onCreate,
  onEdit,
  onDelete,
  onToggle,
  onRetry,
}: {
  goals: BudgetGoal[];
  loading: boolean;
  error: boolean;
  createButtonRef?: React.Ref<HTMLButtonElement>;
  onCreate: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (goal: BudgetGoal, trigger: HTMLButtonElement | null) => void;
  onDelete: (goal: BudgetGoal) => void;
  onToggle: (goal: BudgetGoal) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <section data-qa="quiet-budget-goals" aria-label="Metas de orçamento" aria-busy="true" className={panel}>
        <h2 className="font-semibold">Metas de orçamento</h2>
        <p role="status" className="text-sm text-muted-foreground">Carregando metas…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section data-qa="quiet-budget-goals" aria-label="Metas de orçamento" className={panel}>
        <h2 className="font-semibold">Metas de orçamento</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar as metas de orçamento.</p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>Tentar novamente</Button>
        </div>
      </section>
    );
  }
  const activeCount = goals.filter((g) => !g.isCompleted).length;
  const completedCount = goals.filter((g) => g.isCompleted).length;
  return (
    <section data-qa="quiet-budget-goals" aria-label="Metas de orçamento" className={panel}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Metas de orçamento</h2>
          <p className="text-xs text-muted-foreground">{activeCount} ativa{activeCount !== 1 ? 's' : ''} · {completedCount} concluída{completedCount !== 1 ? 's' : ''}</p>
        </div>
        <Button ref={createButtonRef} variant="default" size="sm" className="min-h-9" onClick={onCreate}><Plus aria-hidden="true" /> Nova Meta</Button>
      </header>
      {goals.length === 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">Nenhuma meta cadastrada</h3>
          <p className="text-sm text-muted-foreground">Crie sua primeira meta de orçamento para acompanhar seus objetivos.</p>
          <Button variant="outline" size="sm" onClick={onCreate}>Criar Meta</Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {goals.map((goal) => <BudgetGoalRow key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />)}
        </ul>
      )}
    </section>
  );
}
