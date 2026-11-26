'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FinanceConfirmationDialogShell } from '@/components/shared/finance-dialog-shell';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { useSafeTranslations } from '@/i18n/provider';
import { cn } from '@/lib/utils';
import { CategoryEditor, type CategoryFormDraft } from './category-editor';
import { iconOptions } from './category-icon-color-picker';
import {
  CATEGORY_FILTER_KEYS,
  createFallbackTranslator,
  PT_OPERATIONS_MESSAGES,
} from './operations-i18n';

interface DialogOpening {
  origin: HTMLButtonElement | null;
}

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
  color: string;
  _count?: { transactions?: number; purchases?: number };
}

function CategoryRow({
  category,
  maxUsage,
  onCaptureOrigin,
  onEdit,
  onDelete,
}: {
  category: Category;
  maxUsage: number;
  onCaptureOrigin: (origin: HTMLButtonElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = createFallbackTranslator(useSafeTranslations('categories'), PT_OPERATIONS_MESSAGES.categories);
  const txCount = category._count?.transactions || 0;
  const puCount = category._count?.purchases || 0;
  const totalUsage = txCount + puCount;
  const usagePct = (totalUsage / maxUsage) * 100;
  const Icon = iconOptions.find((option) => option.value === category.icon)?.Icon ?? Tag;

  return (
    <li className="flex min-w-0 items-start gap-1 px-2 py-2 sm:gap-2 sm:px-4">
      <div
        aria-hidden="true"
        className="mt-1 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </div>
      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-2 py-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold">{category.name}</h4>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: category.color }}
            />
            {category.type === 'INCOME' ? t('types.INCOME') : t('types.EXPENSE')}
          </p>
        </div>
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              <b className="font-mono font-medium tabular-nums text-foreground">{txCount}</b>{' '}
              {t('list.txCount', { count: txCount })}
            </span>
            <span>
              <b className="font-mono font-medium tabular-nums text-foreground">{puCount}</b>{' '}
              {t('list.purchaseCount', { count: puCount })}
            </span>
          </p>
          <p className="mt-1">
            {t('list.totalRecords', { count: totalUsage })}
          </p>
          <div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-muted-foreground/60" style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('list.editAria', { name: category.name })}
        className={cn('size-11 shrink-0', focusStyle)}
        onClickCapture={(event) => onCaptureOrigin(event.currentTarget)}
        onClick={onEdit}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('list.deleteAria', { name: category.name })}
        className={cn('size-11 shrink-0 text-destructive hover:text-destructive', focusStyle)}
        onClickCapture={(event) => onCaptureOrigin(event.currentTarget)}
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}

export function CategoriesView() {
  const t = createFallbackTranslator(useSafeTranslations('categories'), PT_OPERATIONS_MESSAGES.categories);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const listRead = useRef(0);
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormDraft>({
    name: '',
    icon: 'tag',
    type: 'EXPENSE',
    color: '#64748b',
  });

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
    const target = origin?.isConnected ? origin : newButton.current;
    target?.focus();
  };

  const fetchCategories = useCallback(async () => {
    const read = ++listRead.current;
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('HTTP error');
      const data = await res.json();
      if (read !== listRead.current) return;
      setCategories(data);
      setRefreshFailed(false);
    } catch {
      if (read === listRead.current) setRefreshFailed(true);
    } finally {
      if (read === listRead.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const changeField = (field: keyof CategoryFormDraft, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' });
    setShowDialog(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon, type: cat.type, color: cat.color });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.name) {
      toast.error(t('errors.nameRequired'));
      return;
    }
    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      if (editing) {
        const res = await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || t('errors.save'));
        }
        toast.success(t('toasts.updated'));
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || t('errors.save'));
        }
        toast.success(t('toasts.created'));
      }
      await fetchCategories();
      if (activeOpening.current === submittedOpening) closeDialog('form');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('errors.save'));
    } finally {
      mutationPending.current = false;
    }
  };

  const deleteCat = async (id: string) => {
    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t('errors.delete'));
      }
      toast.success(t('toasts.deleted'));
      await fetchCategories();
      if (activeOpening.current === submittedOpening) {
        submittedOpening.origin = newButton.current;
        closeDialog('delete');
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('errors.delete'));
    } finally {
      mutationPending.current = false;
    }
  };

  const filtered = categories.filter((c) => filter === 'all' || c.type === filter);
  const incomeCount = categories.filter((c) => c.type === 'INCOME').length;
  const expenseCount = categories.filter((c) => c.type === 'EXPENSE').length;

  const maxUsage = Math.max(
    1,
    ...categories.map((c) => (c._count?.transactions || 0) + (c._count?.purchases || 0)),
  );

  const mostUsed = categories.reduce<Category | null>((best, cat) => {
    const usage = (cat._count?.transactions || 0) + (cat._count?.purchases || 0);
    const bestUsage = best ? (best._count?.transactions || 0) + (best._count?.purchases || 0) : 0;
    return usage > bestUsage ? cat : best;
  }, null);

  return (
    <section aria-labelledby="categories-heading" className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('eyebrow')}</p>
          <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {!loading && (
          <Button
            ref={newButton}
            onClickCapture={(event) => beginOpening(event.currentTarget)}
            onClick={openNew}
            className={cn('min-h-11', focusStyle)}
          >
            <Plus aria-hidden="true" /> {t('actions.newCategory')}
          </Button>
        )}
      </header>
      {refreshFailed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">{t('errors.refresh')}</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => void fetchCategories()}>
            {t('actions.retryList')}
          </Button>
        </div>
      )}
      {loading ? (
        <div role="status" className="space-y-3 text-sm text-muted-foreground">
          <p>{t('loading')}</p>
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : (
        <>
          {categories.length > 0 && (
            <dl
              aria-label={t('summary.ariaLabel')}
              className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-[1.2fr_1fr_1fr_1.3fr]"
            >
              {(
                [
                  [t('summary.total'), categories.length],
                  [t('summary.incomes'), incomeCount],
                  [t('summary.expenses'), expenseCount],
                ] as const
              ).map(([label, count], i) => (
                <FinanceMetric
                  key={label}
                  variant="cell"
                  label={label}
                  value={count}
                  className="border-0 bg-background px-3 py-4 sm:px-4"
                  valueClassName={cn(i === 0 ? 'text-2xl' : 'text-lg')}
                />
              ))}
              <FinanceMetric
                variant="cell"
                label={t('summary.mostUsed')}
                value={mostUsed?.name || t('summary.emptyFallback')}
                caption={
                  mostUsed
                    ? t('summary.recordsCaption', { count: (mostUsed._count?.transactions || 0) + (mostUsed._count?.purchases || 0) })
                    : undefined
                }
                className="border-0 bg-background px-3 py-4 sm:px-4"
                valueClassName="font-sans text-sm break-words"
              />
            </dl>
          )}

          <section
            aria-labelledby="category-records-heading"
            className="min-w-0 rounded-lg border border-border bg-card"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-4 sm:px-4">
              <h3 id="category-records-heading" className="text-sm font-semibold">
                {t('list.title')}
              </h3>
              <div
                role="group"
                aria-label={t('list.filterAria')}
                className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1"
              >
                {CATEGORY_FILTER_KEYS.map((key) => {
                  const active = filter === key;
                  const count = key === 'all' ? categories.length : key === 'INCOME' ? incomeCount : expenseCount;
                  const label = key === 'all' ? t('list.filterAll') : key === 'INCOME' ? t('list.filterIncome') : t('list.filterExpense');
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(key)}
                      className={cn(
                        'min-h-11 rounded-md border px-2 text-xs font-semibold',
                        focusStyle,
                        active
                          ? 'border-border bg-card text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label} <span className="font-mono tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </header>
            {filtered.length === 0 ? (
              <p role="status" className="px-4 py-8 text-sm text-muted-foreground">
                {filter === 'all'
                  ? t('list.emptyAll')
                  : filter === 'INCOME'
                    ? t('list.emptyIncome')
                    : t('list.emptyExpense')}
              </p>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {filtered.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    maxUsage={maxUsage}
                    onCaptureOrigin={beginOpening}
                    onEdit={() => openEdit(cat)}
                    onDelete={() => setShowDeleteDialog(cat.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <CategoryEditor
        mode={editing ? 'edit' : 'create'}
        open={showDialog}
        form={form}
        onFieldChange={changeField}
        onOpenChange={(open) => {
          if (!open) closeDialog('form');
        }}
        onCloseAutoFocus={restoreFocus}
        onCancel={() => closeDialog('form')}
        onSubmit={save}
      />

      <FinanceConfirmationDialogShell
        open={!!showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) closeDialog('delete');
        }}
        onCloseAutoFocus={restoreFocus}
        contentClassName="motion-reduce:animate-none border-border bg-card shadow-none"
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        footer={
          <>
            <AlertDialogCancel className={focusStyle}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) deleteCat(showDeleteDialog);
              }}
              className={cn(
                'bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline',
                focusStyle,
              )}
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </>
        }
      />
    </section>
  );
}
