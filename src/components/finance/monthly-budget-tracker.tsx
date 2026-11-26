'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from './analytics-i18n';
import { observeQuery, type QueryResult, type SettledQuery } from './dashboard-query';
import {
  MonthlyBudgetEditor,
  type MonthlyBudgetCategoryOption,
  type MonthlyBudgetDraft,
} from './monthly-budget-editor';

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

const smallText = 'text-xs leading-relaxed text-muted-foreground';
const moneyClass = 'font-mono tabular-nums tracking-tight';

function BudgetRow({ budget, money, showValues, onEdit, onDelete }: {
  budget: BudgetItem; money: (amount: number) => string; showValues: boolean; onEdit: (trigger?: HTMLButtonElement | null) => void; onDelete: () => void;
}) {
  const t = useSafeTranslations('goals');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const openingEditorRef = useRef(false);
  const statusKey = budget.isOverBudget
    ? 'exceeded'
    : budget.percentage >= 90
      ? 'critical'
      : budget.percentage >= 60
        ? 'warning'
        : 'good';
  const label = t(`monthlyBudget.row.status.${statusKey}`);
  const bar = budget.isOverBudget || budget.percentage >= 90 ? 'bg-destructive' : budget.percentage >= 60 ? 'bg-[var(--ds-accent-warning)]' : 'bg-primary';
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{budget.categoryName}</p>
          <p className={cn(smallText, moneyClass)}>
            {t('monthlyBudget.row.spentOfAmount', { spent: money(budget.spent), amount: money(budget.amount) })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={menuTriggerRef} variant="ghost" size="icon" aria-label={t('monthlyBudget.row.actionsAria', { category: budget.categoryName })}><MoreHorizontal aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              if (openingEditorRef.current || document.activeElement !== document.body) {
                event.preventDefault();
              }
              openingEditorRef.current = false;
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                openingEditorRef.current = true;
                onEdit(menuTriggerRef.current);
              }}
            >
              <Pencil aria-hidden="true" />
              {t('monthlyBudget.row.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 aria-hidden="true" />{t('monthlyBudget.row.delete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showValues && (
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
        </div>
      )}
      <div className={cn('mt-1.5 flex flex-wrap justify-between gap-x-2', smallText)}>
        <span>{label}{showValues && t('monthlyBudget.row.usedPct', { pct: budget.percentage.toFixed(0) })}</span>
        <span className={moneyClass}>
          {budget.isOverBudget
            ? t('monthlyBudget.row.exceededBy', { amount: money(Math.abs(budget.remaining)) })
            : t('monthlyBudget.row.remaining', { amount: money(budget.remaining) })}
        </span>
      </div>
    </li>
  );
}

export function MonthlyBudgetTracker({ showValues = true, refreshCounter = 0 }: { showValues?: boolean; refreshCounter?: number } = {}) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const fieldId = useId();
  const [request, setRequest] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: SettledQuery<BudgetItem[]> } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categories, setCategories] = useState<MonthlyBudgetCategoryOption[]>([]);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const dialogOriginRef = useRef<HTMLButtonElement | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = format(now, 'MMMM yyyy', { locale: getDateFnsLocale(locale) });
  const key = `${currentYear}-${currentMonth}-${request}-${refreshCounter}-${locale}`;
  const query = settled?.key === key ? settled.result : { status: 'loading' as const };
  const refreshBudgets = () => setRequest((value) => value + 1);
  const money = (amount: number) => showValues ? currencyFmt(amount, locale) : t('maskedValue');

  useEffect(() => observeQuery(async (signal) => {
    const response = await fetch(`/api/monthly-budgets?month=${currentMonth}&year=${currentYear}`, { signal });
    if (!response.ok) throw new Error('Orçamento indisponível');
    const data: { budgets: BudgetItem[] } = await response.json();
    if (!Array.isArray(data?.budgets)) throw new Error('Dados de orçamento inválidos');
    return data.budgets;
  }, (result) => setSettled({ key, result })), [currentMonth, currentYear, key]);

  useEffect(() => observeQuery(async (signal) => {
    void locale;
    const response = await fetch('/api/categories', { signal });
    if (!response.ok) throw new Error('Categorias indisponíveis');
    type Category = MonthlyBudgetCategoryOption & { type: string };
    const data: { categories: Category[] } | Category[] = await response.json();
    return (Array.isArray(data) ? data : data.categories).filter((category) => category.type === 'EXPENSE');
  }, (result) => { if (result.status === 'ready') setCategories(result.data); }), [refreshCounter, locale]);

  const openCreateDialog = (origin?: HTMLButtonElement | null) => {
    dialogOriginRef.current = origin ?? createButtonRef.current;
    setEditingBudget(null);
    setFormCategoryId('');
    setFormAmount('');
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  const openEditDialog = (budget: BudgetItem, trigger?: HTMLButtonElement | null) => {
    dialogOriginRef.current = trigger ?? null;
    setEditingBudget(budget);
    setFormCategoryId(budget.categoryId);
    setFormAmount(String(budget.amount));
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  const handleFieldChange = (field: keyof MonthlyBudgetDraft, value: string) => {
    if (field === 'categoryId') setFormCategoryId(value);
    else if (field === 'amount') setFormAmount(value);
    else if (field === 'month') setFormMonth(value);
    else if (field === 'year') setFormYear(value);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!formCategoryId || !amount || amount <= 0) {
      toast.error(t('monthlyBudget.toasts.invalidFields'));
      return;
    }
    const month = parseInt(formMonth);
    const year = parseInt(formYear);
    if (month < 1 || month > 12 || year < 2021) {
      toast.error(t('monthlyBudget.toasts.invalidPeriod'));
      return;
    }

    setSubmitting(true);
    try {
      const res = editingBudget
        ? await fetch('/api/monthly-budgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingBudget.id, amount }),
          })
        : await fetch('/api/monthly-budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: formCategoryId, amount, month, year }),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || (editingBudget ? t('monthlyBudget.toasts.updateError') : t('monthlyBudget.toasts.createError')));
        return;
      }

      toast.success(editingBudget ? t('monthlyBudget.toasts.updated') : t('monthlyBudget.toasts.created'));
      setDialogOpen(false);
      refreshBudgets();
    } catch {
      toast.error(t('monthlyBudget.toasts.connectionError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/monthly-budgets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('monthlyBudget.toasts.deleted'));
        setPendingDeleteBudget(null);
        refreshBudgets();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || t('monthlyBudget.toasts.deleteError'));
      }
    } catch {
      toast.error(t('monthlyBudget.toasts.connectionError'));
    } finally {
      setDeleting(false);
    }
  };

  const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

  const budgets = query.status === 'ready' ? query.data : [];
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalOverBudget = totalSpent > totalBudget;
  const summaryRows = [
    [t('monthlyBudget.summary.totalBudget'), totalBudget],
    [t('monthlyBudget.summary.totalSpent'), totalSpent],
    [t('monthlyBudget.summary.available'), totalRemaining],
  ] as const;

  return (
    <section aria-label={t('monthlyBudget.title')} className="h-full min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
      <BudgetHeader status={query.status} monthLabel={monthLabel} createButtonRef={createButtonRef} openCreateDialog={openCreateDialog} refreshBudgets={refreshBudgets} />
      {query.status === 'ready' && (budgets.length ? (
        <>
          <dl className="my-3 grid gap-1.5 rounded-md border border-border p-2.5 text-xs">
            {summaryRows.map(([label, amount]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-2"><dt className={smallText}>{label}</dt><dd className={moneyClass}>{money(amount)}</dd></div>
            ))}
          </dl>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {budgets.map((budget) => <BudgetRow key={budget.id} budget={budget} money={money} showValues={showValues} onEdit={(trigger) => openEditDialog(budget, trigger)} onDelete={() => setPendingDeleteBudget(budget)} />)}
          </ul>
          {totalOverBudget && (
            <p className="mt-2 border-t border-border pt-2 text-xs text-destructive">
              <strong>{t('monthlyBudget.overBudgetPrefix')}</strong>{' '}
              {t('monthlyBudget.overBudgetMessage', { amount: money(Math.abs(totalRemaining)) })}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">{t('monthlyBudget.emptyTitle')}</p>
          <p className={smallText}>{t('monthlyBudget.emptyDescription')}</p>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <MonthlyBudgetEditor
        mode={editingBudget ? 'edit' : 'create'}
        open={dialogOpen}
        submitting={submitting}
        fieldId={fieldId}
        form={{
          categoryId: formCategoryId,
          amount: formAmount,
          month: formMonth,
          year: formYear,
        }}
        categories={categories}
        years={years}
        onFieldChange={handleFieldChange}
        onOpenChange={setDialogOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const origin = dialogOriginRef.current;
          dialogOriginRef.current = null;
          const target = origin?.isConnected ? origin : createButtonRef.current;
          if (target?.isConnected) target.focus();
        }}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!pendingDeleteBudget}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDeleteBudget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('monthlyBudget.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteBudget
                ? t('monthlyBudget.deleteDialog.descriptionWithCategory', { category: pendingDeleteBudget.categoryName })
                : t('monthlyBudget.deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('monthlyBudget.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDeleteBudget) void handleDelete(pendingDeleteBudget.id);
              }}
            >
              {t('monthlyBudget.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function BudgetHeader({ status, monthLabel, createButtonRef, openCreateDialog, refreshBudgets }: {
  status: QueryResult<BudgetItem[]>['status']; monthLabel: string; createButtonRef?: RefObject<HTMLButtonElement | null>; openCreateDialog: (origin?: HTMLButtonElement | null) => void; refreshBudgets: () => void;
}) {
  const t = useSafeTranslations('goals');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">{t('monthlyBudget.title')}</h2>
          <p className={cn(smallText, 'mt-1')}>{t('monthlyBudget.currentMonth', { month: monthLabel })}</p>
        </div>
        {status !== 'loading' && <Button ref={createButtonRef} variant="outline" size="sm" onClick={(event) => openCreateDialog(event.currentTarget)}><Plus aria-hidden="true" />{t('monthlyBudget.newLimit')}</Button>}
      </div>
      {status === 'loading' && <p role="status" className={cn(smallText, 'mt-4')}>{t('monthlyBudget.loading')}</p>}
      {status === 'error' && <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-destructive">{t('monthlyBudget.error')}</p><Button size="sm" variant="outline" onClick={refreshBudgets}>{t('common.retry')}</Button></div>}
    </>
  );
}
