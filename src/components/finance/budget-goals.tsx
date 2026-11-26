'use client';

import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { currencyFmt } from '@/lib/helpers';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import {
  BudgetGoalEditor,
  type BudgetGoalCategoryOption,
  type BudgetGoalDraft,
} from './budget-goal-editor';

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

const emptyForm: BudgetGoalDraft = {
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
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const openingEditor = useRef(false);
  const percent = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const width = Math.max(0, percent);
  const metrics: Array<[string, number]> = [
    [t('budgetGoals.metrics.current'), goal.currentAmount],
    [t('budgetGoals.metrics.target'), goal.targetAmount],
    ...(!goal.isCompleted && remaining > 0 ? [[t('budgetGoals.metrics.remaining'), remaining] as [string, number]] : []),
  ];

  return (
    <li className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-5">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-semibold">{goal.name}</h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
          <span>{goal.isCompleted ? t('budgetGoals.status.completed') : t('budgetGoals.status.active')}</span>
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
          label={t('budgetGoals.progressLabel')}
          ariaLabel={t('budgetGoals.progressAriaLabel', { name: goal.name })}
          value={width}
          min={0}
          max={100}
          unit="%"
          displayValue={`${Math.round(percent)}%`}
          valueText={`${Math.round(percent)}%`}
        />
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {metrics.map(([label, value]) => (
            <FinanceMetric key={label} variant="compact" label={label} value={currencyFmt(value, locale)} valueClassName="text-xs font-normal" />
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {!goal.isCompleted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={menuTrigger} type="button" variant="outline" size="icon" aria-label={t('budgetGoals.actions.more', { name: goal.name })}><MoreHorizontal aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={(event) => {
              // Do not pull focus back out of the editor or off a new target.
              if (openingEditor.current || document.activeElement !== document.body) event.preventDefault();
              openingEditor.current = false;
            }}>
              <DropdownMenuItem onSelect={() => {
                openingEditor.current = true;
                onEdit(goal, menuTrigger.current);
              }}><Pencil aria-hidden="true" /> {t('budgetGoals.actions.edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(goal)}><CheckCircle2 aria-hidden="true" /> {t('budgetGoals.actions.markCompleted')}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(goal)}><Trash2 aria-hidden="true" /> {t('budgetGoals.actions.delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => onToggle(goal)}>
          {goal.isCompleted ? t('budgetGoals.actions.reopen') : t('budgetGoals.actions.markCompleted')}
        </Button>
      </div>
    </li>
  );
}

export function BudgetGoalsWidget() {
  const t = useSafeTranslations('goals');
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<BudgetGoalCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);
  const [form, setForm] = useState<BudgetGoalDraft>(emptyForm);
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

  const handleFieldChange = (field: keyof BudgetGoalDraft, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t('budgetGoals.toasts.nameRequired'));
      return;
    }
    const target = parseFloat(form.targetAmount);
    if (!target || target <= 0) {
      toast.error(t('budgetGoals.toasts.targetPositive'));
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
        toast.error(err.error || t('budgetGoals.toasts.saveError'));
        return;
      }

      toast.success(editingGoal ? t('budgetGoals.toasts.updated') : t('budgetGoals.toasts.created'));
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error(t('budgetGoals.toasts.connectionError'));
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
        toast.success(t('budgetGoals.toasts.deleted'));
        pendingDeletionFocus.current.add(goal.id);
        fetchData();
      } else {
        toast.error(t('budgetGoals.toasts.deleteError'));
      }
    } catch {
      toast.error(t('budgetGoals.toasts.connectionError'));
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
        toast.success(goal.isCompleted ? t('budgetGoals.toasts.reopened') : t('budgetGoals.toasts.completed'));
        fetchData();
      }
    } catch {
      toast.error(t('budgetGoals.toasts.updateError'));
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
      <BudgetGoalEditor
        mode={editingGoal ? 'edit' : 'create'}
        open={dialogOpen}
        submitting={submitting}
        form={form}
        categories={categories}
        onFieldChange={handleFieldChange}
        onOpenChange={setDialogOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreBudgetGoalFocus(dialogOrigin.current, createButton.current);
          dialogOrigin.current = null;
        }}
        onSubmit={handleSubmit}
      />
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
  const t = useSafeTranslations('goals');
  if (loading) {
    return (
      <section data-qa="quiet-budget-goals" aria-label={t('budgetGoals.title')} aria-busy="true" className={panel}>
        <h2 className="font-semibold">{t('budgetGoals.title')}</h2>
        <p role="status" className="text-sm text-muted-foreground">{t('budgetGoals.loading')}</p>
      </section>
    );
  }
  if (error) {
    return (
      <section data-qa="quiet-budget-goals" aria-label={t('budgetGoals.title')} className={panel}>
        <h2 className="font-semibold">{t('budgetGoals.title')}</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">{t('budgetGoals.error')}</p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>{t('common.retry')}</Button>
        </div>
      </section>
    );
  }
  const activeCount = goals.filter((g) => !g.isCompleted).length;
  const completedCount = goals.filter((g) => g.isCompleted).length;
  return (
    <section data-qa="quiet-budget-goals" aria-label={t('budgetGoals.title')} className={panel}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{t('budgetGoals.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('budgetGoals.summary', { activeCount, completedCount })}</p>
        </div>
        <Button ref={createButtonRef} variant="default" size="sm" className="min-h-9" onClick={onCreate}><Plus aria-hidden="true" /> {t('budgetGoals.newGoal')}</Button>
      </header>
      {goals.length === 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">{t('budgetGoals.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('budgetGoals.emptyDescription')}</p>
          <Button variant="outline" size="sm" onClick={onCreate}>{t('budgetGoals.createGoal')}</Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {goals.map((goal) => <BudgetGoalRow key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />)}
        </ul>
      )}
    </section>
  );
}
