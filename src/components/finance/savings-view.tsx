'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import {
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  MoreHorizontal,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { FinanceProgress } from '@/components/shared/finance-progress';
import { EmptyState } from '@/components/shared/ui-helpers';
import { currencyFmt, dateFmt, pct, rateFmt } from '@/lib/helpers';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { useAppStore } from '@/lib/store';
import { SAVINGS_FILTER_TABS, SAVINGS_TYPE_KEYS } from './portfolio-i18n';
import { SavingsGoalEditor, type SavingsGoalDraft } from './savings-goal-editor';
import { SavingsContributionDialog, type SavingsContributionDraft } from './savings-contribution-dialog';

// ── Interfaces ─────────────────────────────────────────────────────

interface SavingsGoal {
  id: string;
  name: string;
  type: string;
  description: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number | null;
  yieldRate: number | null;
  targetDate: string | null;
  accountId: string | null;
  color: string;
  isCompleted: boolean;
  createdAt: string;
  account?: { id: string; name: string } | null;
}

interface Account {
  id: string;
  name: string;
}


// ── Form Types ─────────────────────────────────────────────────────

const emptyGoalForm: SavingsGoalDraft = {
  name: '',
  type: 'SAVINGS',
  description: '',
  targetAmount: '',
  currentAmount: '0',
  monthlyContribution: '',
  yieldRate: '',
  targetDate: '',
  accountId: 'none',
  color: '#10b981',
};

const emptyDepositForm: SavingsContributionDraft = {
  amount: '',
  description: '',
};

type FocusTarget = Pick<HTMLElement, 'isConnected' | 'focus'>;

/** Restaura o foco para o controle sobrevivente quando a meta removida sai da lista e o foco caiu em body ou nó desconectado. */
export function restoreSavingsFocusAfterDeletion(
  deletedId: string,
  goals: readonly Pick<SavingsGoal, 'id'>[],
  activeElement: Pick<HTMLElement, 'isConnected'> | null,
  body: object,
  fallback: FocusTarget | null,
): boolean {
  if (goals.some((goal) => goal.id === deletedId)) return false;
  if (activeElement !== body && activeElement?.isConnected) return false;
  if (!fallback?.isConnected) return false;
  fallback.focus();
  return true;
}

// ── Component ──────────────────────────────────────────────────────

export function SavingsView() {
  const t = useSafeTranslations('savings');
  const locale = useSafeLocale();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Dialogs
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [depositingGoal, setDepositingGoal] = useState<SavingsGoal | null>(null);

  // Forms
  const [goalForm, setGoalForm] = useState<SavingsGoalDraft>(emptyGoalForm);
  const [depositForm, setDepositForm] = useState<SavingsContributionDraft>(emptyDepositForm);
  const [submitting, setSubmitting] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const pendingDeletionFocus = useRef(new Set<string>());

  const handleGoalFieldChange = (field: keyof SavingsGoalDraft, value: string) => {
    setGoalForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepositFieldChange = (field: keyof SavingsContributionDraft, value: string) => {
    setDepositForm((prev) => ({ ...prev, [field]: value }));
  };

  // ── Data Fetching ────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/savings');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setGoals(await res.json());
    } catch (e) {
      console.error('Erro ao carregar metas de poupança', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (e) {
      console.error('Erro ao carregar contas', e);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    fetchAccounts();
    if (useAppStore.getState().newGoalRequested) {
      useAppStore.getState().clearNewGoalRequest();
      setEditingGoal(null);
      setGoalForm(emptyGoalForm);
      setShowGoalDialog(true);
    }
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.newGoalRequested) {
        useAppStore.getState().clearNewGoalRequest();
        setEditingGoal(null);
        setGoalForm(emptyGoalForm);
        setShowGoalDialog(true);
      }
    });
    return unsubscribe;
  }, [fetchGoals, fetchAccounts]);

  useEffect(() => {
    if (pendingDeletionFocus.current.size === 0) return;
    for (const id of [...pendingDeletionFocus.current]) {
      if (goals.some((goal) => goal.id === id)) continue;
      pendingDeletionFocus.current.delete(id);
      restoreSavingsFocusAfterDeletion(
        id,
        goals,
        document.activeElement,
        document.body,
        createButton.current ?? document.getElementById('savings-create'),
      );
    }
  }, [goals]);

  // ── Computed Data ────────────────────────────────────────────────

  const filteredGoals = useMemo(() => {
    if (typeFilter === 'ALL') return goals;
    return goals.filter((g) => g.type === typeFilter);
  }, [goals, typeFilter]);

  const summary = useMemo(() => {
    const totalAccumulated = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTargets = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const completedCount = goals.filter(
      (g) => g.isCompleted || g.currentAmount >= g.targetAmount
    ).length;
    const monthlyTotal = goals.reduce(
      (sum, g) => sum + (g.monthlyContribution || 0),
      0
    );
    return { totalAccumulated, totalTargets, completedCount, monthlyTotal };
  }, [goals]);

  // ── Goal Actions ─────────────────────────────────────────────────

  const openCreateGoal = () => {
    setEditingGoal(null);
    setGoalForm(emptyGoalForm);
    setShowGoalDialog(true);
  };

  const openEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      type: goal.type,
      description: goal.description || '',
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      monthlyContribution: goal.monthlyContribution ? String(goal.monthlyContribution) : '',
      yieldRate: goal.yieldRate ? String(goal.yieldRate) : '',
      targetDate: goal.targetDate ? goal.targetDate.split('T')[0] : '',
      accountId: goal.accountId || 'none',
      color: goal.color,
    });
    setShowGoalDialog(true);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.name.trim()) {
      toast.error(t('errors.nameRequired'));
      return;
    }
    const target = parseFloat(goalForm.targetAmount);
    if (!target || target <= 0) {
      toast.error(t('errors.targetPositive'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: goalForm.name.trim(),
        type: goalForm.type,
        description: goalForm.description.trim() || null,
        targetAmount: target,
        currentAmount: parseFloat(goalForm.currentAmount) || 0,
        monthlyContribution: goalForm.monthlyContribution
          ? parseFloat(goalForm.monthlyContribution)
          : null,
        yieldRate: goalForm.yieldRate ? parseFloat(goalForm.yieldRate) : null,
        targetDate: goalForm.targetDate || null,
        accountId: goalForm.accountId !== 'none' ? goalForm.accountId : null,
        color: goalForm.color,
        ...(editingGoal && { id: editingGoal.id }),
      };

      const method = editingGoal ? 'PUT' : 'POST';
      const res = await fetch('/api/savings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('errors.saveGoal'));
        return;
      }

      toast.success(editingGoal ? t('toast.goalUpdated') : t('toast.goalCreated'));
      setShowGoalDialog(false);
      fetchGoals();
    } catch {
      toast.error(t('errors.connection'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const res = await fetch('/api/savings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success(t('toast.goalDeleted'));
        pendingDeletionFocus.current.add(id);
        setShowDeleteDialog(null);
        fetchGoals();
      } else {
        toast.error(t('errors.deleteGoal'));
      }
    } catch {
      toast.error(t('errors.connection'));
    }
  };

  // ── Deposit Actions ──────────────────────────────────────────────

  const openDepositDialog = (goal: SavingsGoal) => {
    setDepositingGoal(goal);
    setDepositForm(emptyDepositForm);
    setShowDepositDialog(true);
  };

  const handleDeposit = async () => {
    if (!depositingGoal) return;
    const amount = parseFloat(depositForm.amount);
    if (!amount || amount <= 0) {
      toast.error(t('errors.depositAmountInvalid'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/savings/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savingsGoalId: depositingGoal.id,
          amount,
          description: depositForm.description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('errors.depositError'));
        return;
      }

      toast.success(t('toast.depositSuccess', { amount: currencyFmt(amount, locale) }));
      setShowDepositDialog(false);
      setDepositingGoal(null);
      fetchGoals();
    } catch {
      toast.error(t('errors.connection'));
    } finally {
      setSubmitting(false);
    }
  };

  const dialogOrigin = useRef<HTMLButtonElement | null>(null);
  const captureDialogFocus = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOrigin.current = event.currentTarget;
  };
  const restoreDialogFocus = (event: Event) => {
    const target = dialogOrigin.current?.isConnected
      ? dialogOrigin.current
      : createButton.current ?? document.getElementById("savings-create");
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
        <Skeleton className="motion-reduce:animate-none h-24 rounded-xl" />
        <Skeleton className="motion-reduce:animate-none h-36 rounded-xl" />
      </section>
    );
  }

  const activeTypeLabel = SAVINGS_TYPE_KEYS[typeFilter] ? t(SAVINGS_TYPE_KEYS[typeFilter]) : typeFilter;

  return (
    <section aria-labelledby="savings-title" className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="savings-title" className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button id="savings-create" ref={createButton} className="min-h-11 self-start sm:self-auto" onClick={(event) => { captureDialogFocus(event); openCreateGoal(); }}>
          <Plus aria-hidden="true" /> {t('actions.newGoal')}
        </Button>
      </header>
      <dl aria-label={t('summary.ariaLabel')} className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
        <SavingsDatum label={t('summary.totalAccumulated')} value={currencyFmt(summary.totalAccumulated, locale)} note={t('summary.percentOfTargets', { percent: pct(summary.totalAccumulated, summary.totalTargets) })} />
        <SavingsDatum label={t('summary.totalGoals')} value={String(goals.length)} note={t('summary.inProgress', { count: goals.length - summary.completedCount })} />
        <SavingsDatum label={t('summary.completedGoals')} value={String(summary.completedCount)} note={goals.length > 0 ? t('summary.percentAchieved', { percent: pct(summary.completedCount, goals.length) }) : undefined} />
        <SavingsDatum label={t('summary.monthlyContribution')} value={currencyFmt(summary.monthlyTotal, locale)} note={t('summary.monthlyPlannedNote')} />
      </dl>
      <section aria-labelledby="savings-records-title" className="space-y-3">
        <h3 id="savings-records-title" className="text-base font-semibold">{t('list.title')}</h3>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList aria-label={t('filters.ariaLabel')} className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
            {SAVINGS_FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-h-10">{t(tab.labelKey)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p role="status" className="text-xs text-muted-foreground">{t('list.showingCount', { shown: filteredGoals.length, total: goals.length })}</p>
        {loadError && goals.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <p role="alert" className="text-sm text-muted-foreground">{t('list.loadError')}</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => { setLoading(true); void fetchGoals(); }}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              {t('actions.retry')}
            </Button>
          </div>
        ) : filteredGoals.length === 0 ? (
          <EmptyState icon={PiggyBank}
            title={typeFilter !== "ALL" ? t('list.emptyFilteredTitle', { type: activeTypeLabel }) : t('list.emptyAllTitle')}
            subtitle={typeFilter !== "ALL" ? t('list.emptyFilteredSubtitle') : t('list.emptyAllSubtitle')}
          />
        ) : (
          <ul aria-label={t('list.ariaLabel')} className="divide-y divide-border rounded-xl border border-border bg-card">
            {filteredGoals.map((goal) => (
              <SavingsGoalRow key={goal.id} goal={goal}
                onDeposit={(origin) => { dialogOrigin.current = origin; openDepositDialog(goal); }}
                onEdit={(origin) => { dialogOrigin.current = origin; openEditGoal(goal); }}
                onDelete={(origin) => { dialogOrigin.current = origin; setShowDeleteDialog(goal.id); }}
              />
            ))}
          </ul>
        )}
      </section>

        {/* ── Create / Edit Goal Dialog ─────────────────────────────── */}
        <SavingsGoalEditor
          mode={editingGoal ? 'edit' : 'create'}
          open={showGoalDialog}
          submitting={submitting}
          form={goalForm}
          accounts={accounts}
          onFieldChange={handleGoalFieldChange}
          onOpenChange={setShowGoalDialog}
          onCloseAutoFocus={restoreDialogFocus}
          onSubmit={handleSaveGoal}
        />

        {/* ── Deposit Dialog ────────────────────────────────────────── */}
        <SavingsContributionDialog
          open={showDepositDialog}
          submitting={submitting}
          goal={depositingGoal}
          form={depositForm}
          onFieldChange={handleDepositFieldChange}
          onOpenChange={setShowDepositDialog}
          onCloseAutoFocus={restoreDialogFocus}
          onSubmit={handleDeposit}
        />

        {/* ── Delete Confirmation Dialog ────────────────────────────── */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent onCloseAutoFocus={restoreDialogFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
                onClick={() => showDeleteDialog && handleDeleteGoal(showDeleteDialog)}
              >
                {t('delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </section>
  );
}
function SavingsDatum({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

export function SavingsGoalRow({ goal, onDeposit, onEdit, onDelete }: {
  goal: SavingsGoal;
  onDeposit: (origin: HTMLButtonElement | null) => void;
  onEdit: (origin: HTMLButtonElement | null) => void;
  onDelete: (origin: HTMLButtonElement | null) => void;
}) {
  const t = useSafeTranslations('savings');
  const locale = useSafeLocale();
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const openingDialog = useRef(false);
  const percent = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const isComplete = goal.isCompleted || goal.currentAmount >= goal.targetAmount;
  const barValue = Math.max(0, Math.round(percent));
  const openFromMenu = (action: (origin: HTMLButtonElement | null) => void) => {
    openingDialog.current = true;
    action(menuTrigger.current);
  };
  const typeLabel = SAVINGS_TYPE_KEYS[goal.type] ? t(SAVINGS_TYPE_KEYS[goal.type]) : goal.type;

  return (
    <li className="grid min-w-0 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-1.5 break-words">
        <h4 className="text-sm font-semibold">{goal.name}</h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{typeLabel}</Badge>
          {isComplete && <Badge variant="secondary" className="text-[var(--ds-accent-positive)]"><CheckCircle2 aria-hidden="true" /> {t('row.completed')}</Badge>}
        </div>
        {goal.description && <p className="text-xs text-muted-foreground">{goal.description}</p>}
        {goal.account && <p className="text-xs text-muted-foreground">{t('row.linkedAccount', { name: goal.account.name })}</p>}
        <p className="text-xs text-muted-foreground">
          {goal.monthlyContribution ? t('row.monthlyContribution', { amount: currencyFmt(goal.monthlyContribution, locale) }) : t('row.noMonthlyContribution')}
          {goal.targetDate && ` · ${t('row.targetDate', { date: dateFmt(goal.targetDate, locale) })}`}
          {goal.yieldRate != null && goal.yieldRate > 0 && ` · ${t('row.yieldRate', { rate: rateFmt(goal.yieldRate, locale) })}`}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <dl className="grid grid-cols-2 gap-3">
          <SavingsDatum label={t('row.accumulated')} value={currencyFmt(goal.currentAmount, locale)} />
          <SavingsDatum label={t('row.target')} value={currencyFmt(goal.targetAmount, locale)} />
        </dl>
        <FinanceProgress
          label={t('row.progressLabel')}
          ariaLabel={t('row.progressAriaLabel', { name: goal.name })}
          value={barValue}
          displayValue={`${Math.round(percent)}%`}
          valueText={t('row.progressValueText', {
            percent: Math.round(percent),
            current: currencyFmt(goal.currentAmount, locale),
            target: currencyFmt(goal.targetAmount, locale),
          })}
        />
        {!isComplete && remaining > 0 && <p className="text-xs text-muted-foreground">{t('row.remaining', { amount: currencyFmt(remaining, locale) })}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isComplete && (
          <Button variant="outline" className="min-h-11" aria-label={t('actions.depositAriaLabel', { name: goal.name })} onClick={(event) => onDeposit(event.currentTarget)}>
            <ArrowDownToLine aria-hidden="true" /> {t('actions.deposit')}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={menuTrigger} variant="outline" size="icon" className="size-11" aria-label={t('actions.moreActionsAriaLabel', { name: goal.name })}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
            if (openingDialog.current) { event.preventDefault(); openingDialog.current = false; }
          }}>
            <DropdownMenuItem onSelect={() => openFromMenu(onEdit)}><Pencil aria-hidden="true" /> {t('actions.edit')}</DropdownMenuItem>
            {!isComplete && (
              <DropdownMenuItem onSelect={() => openFromMenu(onDeposit)}><ArrowDownToLine aria-hidden="true" /> {t('actions.deposit')}</DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => openFromMenu(onDelete)}><Trash2 aria-hidden="true" /> {t('actions.delete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
