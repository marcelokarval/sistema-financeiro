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
import { currencyFmt, dateFmt, pct } from '@/lib/helpers';
import { useAppStore } from '@/lib/store';
import { SavingsGoalEditor, type SavingsGoalDraft } from './savings-goal-editor';
import { SavingsContributionDialog, type SavingsContributionDraft } from './savings-contribution-dialog';

const TYPE_FILTER_TABS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'PIGGY_BANK', label: 'Porquinho' },
  { value: 'CDI', label: 'CDI' },
  { value: 'EMERGENCY_FUND', label: 'Reserva' },
  { value: 'INVESTMENT', label: 'Investimento' },
] as const;


const TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Poupança',
  PIGGY_BANK: 'Porquinho',
  CDI: 'Conta CDI',
  INVESTMENT: 'Investimento',
  EMERGENCY_FUND: 'Reserva de Emergência',
};

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

// ── Component ──────────────────────────────────────────────────────

export function SavingsView() {
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
      toast.error('O nome da meta é obrigatório');
      return;
    }
    const target = parseFloat(goalForm.targetAmount);
    if (!target || target <= 0) {
      toast.error('O valor alvo deve ser maior que zero');
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
        toast.error(err.error || 'Erro ao salvar meta');
        return;
      }

      toast.success(editingGoal ? 'Meta atualizada com sucesso!' : 'Meta criada com sucesso!');
      setShowGoalDialog(false);
      fetchGoals();
    } catch {
      toast.error('Erro de conexão');
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
        toast.success('Meta excluída com sucesso!');
        setShowDeleteDialog(null);
        fetchGoals();
      } else {
        toast.error('Erro ao excluir meta');
      }
    } catch {
      toast.error('Erro de conexão');
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
      toast.error('Informe um valor válido para o depósito');
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
        toast.error(err.error || 'Erro ao realizar depósito');
        return;
      }

      toast.success(`Depósito de ${currencyFmt(amount)} realizado!`);
      setShowDepositDialog(false);
      setDepositingGoal(null);
      fetchGoals();
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const dialogOrigin = useRef<HTMLButtonElement | null>(null);
  const captureDialogFocus = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOrigin.current = event.currentTarget;
  };
  const restoreDialogFocus = (event: Event) => {
    const target = dialogOrigin.current?.isConnected ? dialogOrigin.current : document.getElementById("savings-create");
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <p role="status" className="text-sm text-muted-foreground">Carregando caixinhas…</p>
        <Skeleton className="motion-reduce:animate-none h-24 rounded-xl" />
        <Skeleton className="motion-reduce:animate-none h-36 rounded-xl" />
      </section>
    );
  }

  return (
    <section aria-labelledby="savings-title" className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="savings-title" className="text-2xl font-semibold tracking-tight">Caixinhas</h2>
          <p className="text-sm text-muted-foreground">Acompanhe suas metas de poupança e investimentos.</p>
        </div>
        <Button id="savings-create" className="min-h-11 self-start sm:self-auto" onClick={(event) => { captureDialogFocus(event); openCreateGoal(); }}>
          <Plus aria-hidden="true" /> Nova meta
        </Button>
      </header>
      <dl aria-label="Resumo das caixinhas" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
        <SavingsDatum label="Total acumulado" value={currencyFmt(summary.totalAccumulated)} note={`${pct(summary.totalAccumulated, summary.totalTargets)}% do total das metas`} />
        <SavingsDatum label="Total de metas" value={String(goals.length)} note={`${goals.length - summary.completedCount} em andamento`} />
        <SavingsDatum label="Metas concluídas" value={String(summary.completedCount)} note={goals.length > 0 ? `${pct(summary.completedCount, goals.length)}% alcançadas` : undefined} />
        <SavingsDatum label="Contribuição mensal" value={currencyFmt(summary.monthlyTotal)} note="Total mensal planejado" />
      </dl>
      <section aria-labelledby="savings-records-title" className="space-y-3">
        <h3 id="savings-records-title" className="text-base font-semibold">Metas cadastradas</h3>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList aria-label="Filtrar metas por tipo" className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
            {TYPE_FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-h-10">{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p role="status" className="text-xs text-muted-foreground">{filteredGoals.length} de {goals.length} metas</p>
        {loadError && goals.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar as caixinhas.</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => { setLoading(true); void fetchGoals(); }}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : filteredGoals.length === 0 ? (
          <EmptyState icon={PiggyBank}
            title={typeFilter !== "ALL" ? `Nenhuma meta do tipo ${TYPE_LABELS[typeFilter] || typeFilter}` : "Nenhuma meta de poupança cadastrada"}
            subtitle={typeFilter !== "ALL" ? "Altere o filtro ou crie uma meta deste tipo." : "Use Nova meta para começar a poupar."}
          />
        ) : (
          <ul aria-label="Metas cadastradas" className="divide-y divide-border rounded-xl border border-border bg-card">
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
              <AlertDialogTitle>Excluir meta de poupança?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todo o histórico de depósitos será perdido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
                onClick={() => showDeleteDialog && handleDeleteGoal(showDeleteDialog)}
              >
                Excluir
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

  return (
    <li className="grid min-w-0 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-1.5 break-words">
        <h4 className="text-sm font-semibold">{goal.name}</h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{TYPE_LABELS[goal.type] || goal.type}</Badge>
          {isComplete && <Badge variant="secondary" className="text-[var(--ds-accent-positive)]"><CheckCircle2 aria-hidden="true" /> Concluída</Badge>}
        </div>
        {goal.description && <p className="text-xs text-muted-foreground">{goal.description}</p>}
        {goal.account && <p className="text-xs text-muted-foreground">Conta vinculada: {goal.account.name}</p>}
        <p className="text-xs text-muted-foreground">
          {goal.monthlyContribution ? `${currencyFmt(goal.monthlyContribution)}/mês` : "Sem contribuição mensal"}
          {goal.targetDate && ` · Prazo: ${dateFmt(goal.targetDate)}`}
          {goal.yieldRate != null && goal.yieldRate > 0 && ` · ${goal.yieldRate}% a.a.`}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <dl className="grid grid-cols-2 gap-3">
          <SavingsDatum label="Acumulado" value={currencyFmt(goal.currentAmount)} />
          <SavingsDatum label="Meta" value={currencyFmt(goal.targetAmount)} />
        </dl>
        <FinanceProgress
          label="Progresso da meta"
          ariaLabel={`Progresso da meta ${goal.name}`}
          value={barValue}
          displayValue={`${Math.round(percent)}%`}
          valueText={`${Math.round(percent)}% · ${currencyFmt(goal.currentAmount)} de ${currencyFmt(goal.targetAmount)}`}
        />
        {!isComplete && remaining > 0 && <p className="text-xs text-muted-foreground">Faltam {currencyFmt(remaining)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isComplete && (
          <Button variant="outline" className="min-h-11" aria-label={`Depositar em ${goal.name}`} onClick={(event) => onDeposit(event.currentTarget)}>
            <ArrowDownToLine aria-hidden="true" /> Depositar
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={menuTrigger} variant="outline" size="icon" className="size-11" aria-label={`Mais ações de ${goal.name}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
            if (openingDialog.current) { event.preventDefault(); openingDialog.current = false; }
          }}>
            <DropdownMenuItem onSelect={() => openFromMenu(onEdit)}><Pencil aria-hidden="true" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openFromMenu(onDeposit)}><ArrowDownToLine aria-hidden="true" /> Depositar</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => openFromMenu(onDelete)}><Trash2 aria-hidden="true" /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
