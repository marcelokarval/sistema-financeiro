'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import {
  PiggyBank,
  Gift,
  Landmark,
  TrendingUp,
  ShieldCheck,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EmptyState } from '@/components/shared/ui-helpers';
import { currencyFmt, dateFmt, pct } from '@/lib/helpers';
import { useAppStore } from '@/lib/store';

const SAVINGS_TYPES = [
  { value: 'SAVINGS', label: 'Poupança', icon: PiggyBank },
  { value: 'PIGGY_BANK', label: 'Porquinho', icon: Gift },
  { value: 'CDI', label: 'Conta CDI', icon: Landmark },
  { value: 'INVESTMENT', label: 'Investimento', icon: TrendingUp },
  { value: 'EMERGENCY_FUND', label: 'Reserva', icon: ShieldCheck },
] as const;

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

const GOAL_COLORS = [
  { value: '#10b981', label: 'Verde' }, { value: '#0ea5e9', label: 'Azul' },
  { value: '#8b5cf6', label: 'Violeta' }, { value: '#f59e0b', label: 'Âmbar' },
  { value: '#f43f5e', label: 'Rosa coral' }, { value: '#06b6d4', label: 'Ciano' },
  { value: '#6366f1', label: 'Índigo' }, { value: '#ec4899', label: 'Rosa' },
  { value: '#14b8a6', label: 'Verde-azulado' }, { value: '#84cc16', label: 'Verde-lima' },
];

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

interface GoalFormData {
  name: string;
  type: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  yieldRate: string;
  targetDate: string;
  accountId: string;
  color: string;
}

const emptyGoalForm: GoalFormData = {
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

interface DepositFormData {
  amount: string;
  description: string;
}

const emptyDepositForm: DepositFormData = {
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
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm);
  const [depositForm, setDepositForm] = useState<DepositFormData>(emptyDepositForm);
  const [submitting, setSubmitting] = useState(false);

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
        <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
          <DialogContent onCloseAutoFocus={restoreDialogFocus} className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? 'Editar Meta' : 'Nova Meta de Poupança'}
              </DialogTitle>
              <DialogDescription>
                {editingGoal
                  ? 'Atualize os dados da sua meta de poupança.'
                  : 'Defina um objetivo financeiro para começar a poupar.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="goal-name">Nome da meta *</Label>
                <Input
                  id="goal-name"
                  placeholder="Ex: Viagem, Carro novo..."
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                />
              </div>

              {/* Type + Color row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-type">Tipo *</Label>
                  <Select
                    value={goalForm.type}
                    onValueChange={(v) => setGoalForm({ ...goalForm, type: v })}
                  >
                    <SelectTrigger id="goal-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SAVINGS_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p id="goal-color-label" className="text-sm font-medium">Cor</p>
                  <div role="group" aria-labelledby="goal-color-label" className="mt-1 flex flex-wrap gap-2">
                    {GOAL_COLORS.map(({ value: c, label }) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={label}
                        aria-pressed={goalForm.color === c}
                        className={`size-8 rounded-full border-2 ${
                          goalForm.color === c
                            ? 'border-foreground'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setGoalForm({ ...goalForm, color: c })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="goal-desc">Descrição</Label>
                <Textarea
                  id="goal-desc"
                  placeholder="Descreva sua meta (opcional)"
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Target + Current amounts */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-target">Valor alvo (R$) *</Label>
                  <Input
                    id="goal-target"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    value={goalForm.targetAmount}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, targetAmount: e.target.value })
                    }
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
                    value={goalForm.currentAmount}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, currentAmount: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Monthly Contribution + Yield Rate */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-monthly">Contribuição mensal (R$)</Label>
                  <Input
                    id="goal-monthly"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={goalForm.monthlyContribution}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, monthlyContribution: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-yield">Rendimento (% a.a.)</Label>
                  <Input
                    id="goal-yield"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={goalForm.yieldRate}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, yieldRate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Target Date + Account */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-date">Data alvo</Label>
                  <Input
                    id="goal-date"
                    type="date"
                    value={goalForm.targetDate}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, targetDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-account">Conta vinculada</Label>
                  <Select
                    value={goalForm.accountId}
                    onValueChange={(v) => setGoalForm({ ...goalForm, accountId: v })}
                  >
                    <SelectTrigger id="goal-account" className="w-full">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
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
                onClick={() => setShowGoalDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveGoal} disabled={submitting} className="gap-1.5">
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

        {/* ── Deposit Dialog ────────────────────────────────────────── */}
        <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
          <DialogContent onCloseAutoFocus={restoreDialogFocus} className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Depositar</DialogTitle>
              <DialogDescription>
                {depositingGoal
                  ? `Adicione um valor à meta "${depositingGoal.name}". Atual: ${currencyFmt(depositingGoal.currentAmount)}`
                  : 'Adicione um valor à meta selecionada.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {depositingGoal && (
                <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  Conta vinculada: {depositingGoal.account?.name ?? (depositingGoal.accountId ? "Conta vinculada à meta" : "Nenhuma")}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Valor do depósito (R$) *</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={depositForm.amount}
                  onChange={(e) =>
                    setDepositForm({ ...depositForm, amount: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-desc">Descrição (opcional)</Label>
                <Input
                  id="deposit-desc"
                  placeholder="Ex: Bônus, Economia do mês..."
                  value={depositForm.description}
                  onChange={(e) =>
                    setDepositForm({ ...depositForm, description: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDepositDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleDeposit} disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <>
                    Depositando...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    Depositar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
        <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
          <span>Progresso da meta</span>
          <span className="font-mono tabular-nums text-foreground">{Math.round(percent)}%</span>
        </div>
        <div role="progressbar" aria-label={`Progresso da meta ${goal.name}`} aria-valuenow={barValue}
          aria-valuetext={`${Math.round(percent)}% · ${currencyFmt(goal.currentAmount)} de ${currencyFmt(goal.targetAmount)}`} className="h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${barValue}%` }} />
        </div>
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
