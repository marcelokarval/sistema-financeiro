'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiggyBank,
  Gift,
  Landmark,
  TrendingUp,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  CircleDollarSign,
  Target,
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Wallet,
  ArrowDownToLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  StatCard,
  StatCardSkeleton,
  EmptyState,
  ProgressBar,
} from '@/components/shared/ui-helpers';
import {
  currencyFmt,
  dateFmt,
  pct,
  containerVariants,
  itemVariants,
  summaryContainerVariants,
  summaryItemVariants,
} from '@/lib/helpers';

// ── Constants ──────────────────────────────────────────────────────

const SAVINGS_TYPES = [
  { value: 'SAVINGS', label: 'Poupança', icon: PiggyBank, color: '#10b981' },
  { value: 'PIGGY_BANK', label: 'Porquinho', icon: Gift, color: '#f59e0b' },
  { value: 'CDI', label: 'Conta CDI', icon: Landmark, color: '#0ea5e9' },
  { value: 'INVESTMENT', label: 'Investimento', icon: TrendingUp, color: '#8b5cf6' },
  { value: 'EMERGENCY_FUND', label: 'Reserva', icon: ShieldCheck, color: '#f43f5e' },
] as const;

const TYPE_FILTER_TABS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'PIGGY_BANK', label: 'Porquinho' },
  { value: 'CDI', label: 'CDI' },
  { value: 'EMERGENCY_FUND', label: 'Reserva' },
  { value: 'INVESTMENT', label: 'Investimento' },
] as const;

const TYPE_ICONS: Record<string, React.ElementType> = {
  SAVINGS: PiggyBank,
  PIGGY_BANK: Gift,
  CDI: Landmark,
  INVESTMENT: TrendingUp,
  EMERGENCY_FUND: ShieldCheck,
};

const TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Poupança',
  PIGGY_BANK: 'Porquinho',
  CDI: 'Conta CDI',
  INVESTMENT: 'Investimento',
  EMERGENCY_FUND: 'Reserva de Emergência',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  SAVINGS: '#10b981',
  PIGGY_BANK: '#f59e0b',
  CDI: '#0ea5e9',
  INVESTMENT: '#8b5cf6',
  EMERGENCY_FUND: '#f43f5e',
};

const GOAL_COLORS = [
  '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e',
  '#06b6d4', '#6366f1', '#ec4899', '#14b8a6', '#84cc16',
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

// ── Animation Variants ─────────────────────────────────────────────

const cardHover = {
  hover: { y: -3, transition: { type: 'spring', stiffness: 300, damping: 20 } },
};

// ── Helpers ────────────────────────────────────────────────────────

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

function getColorProgressColor(goalColor: string, percent: number): string {
  return goalColor || getProgressColor(percent);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Circular Progress ─────────────────────────────────────────────

function SavingsCircularProgress({
  percent,
  size = 80,
  strokeWidth = 6,
  color,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const progressColor = color || getProgressColor(percent);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <defs>
        <linearGradient id={`grad-${progressColor.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={progressColor} />
          <stop offset="100%" stopColor={hexToRgba(progressColor, 0.6)} />
        </linearGradient>
      </defs>
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
        stroke={`url(#grad-${progressColor.replace('#', '')})`}
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
    try {
      const res = await fetch('/api/savings');
      if (res.ok) setGoals(await res.json());
    } catch (e) {
      console.error('Erro ao carregar metas de poupança', e);
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

  // ── Loading State ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="savings-view"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        exit="hidden"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Caixinhas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe suas metas de poupança e investimentos
            </p>
          </div>
          <Button onClick={openCreateGoal} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Meta</span>
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          variants={summaryContainerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total Acumulado"
            value={currencyFmt(summary.totalAccumulated)}
            icon={CircleDollarSign}
            gradient="from-emerald-500 to-emerald-600"
            subtitle={`${pct(summary.totalAccumulated, summary.totalTargets)}% do total`}
          />
          <StatCard
            label="Total de Metas"
            value={String(goals.length)}
            icon={Target}
            gradient="from-violet-500 to-purple-600"
            subtitle={`${goals.length - summary.completedCount} em andamento`}
          />
          <StatCard
            label="Metas Concluídas"
            value={String(summary.completedCount)}
            icon={CheckCircle2}
            gradient="from-cyan-500 to-sky-600"
            subtitle={
              goals.length > 0
                ? `${pct(summary.completedCount, goals.length)}% alcançadas`
                : 'Crie sua primeira meta'
            }
          />
          <StatCard
            label="Contribuição Mensal"
            value={currencyFmt(summary.monthlyTotal)}
            icon={Wallet}
            gradient="from-amber-500 to-orange-600"
            subtitle="Total mensal planejado"
          />
        </motion.div>

        {/* Type Filter Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {TYPE_FILTER_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs px-3 py-1.5 data-[state=active]:shadow-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Savings Goal Cards */}
        {filteredGoals.length === 0 ? (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={PiggyBank}
              title={
                typeFilter !== 'ALL'
                  ? `Nenhuma meta do tipo ${TYPE_LABELS[typeFilter] || typeFilter}`
                  : 'Nenhuma meta de poupança cadastrada'
              }
              subtitle={
                typeFilter !== 'ALL'
                  ? 'Crie uma meta deste tipo ou altere o filtro'
                  : 'Clique em "Nova Meta" para começar a poupar'
              }
            />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filteredGoals.map((goal) => {
                const percent =
                  goal.targetAmount > 0
                    ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                    : 0;
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
                const isComplete = goal.isCompleted || goal.currentAmount >= goal.targetAmount;
                const TypeIcon = TYPE_ICONS[goal.type] || PiggyBank;
                const badgeColor = TYPE_BADGE_COLORS[goal.type] || goal.color;
                const progressColor = getColorProgressColor(goal.color, percent);

                return (
                  <motion.div
                    key={goal.id}
                    variants={itemVariants}
                    layout
                    whileHover={cardHover.hover}
                    className="relative"
                  >
                    <Card
                      className={`overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 group ${
                        isComplete ? 'ring-1 ring-emerald-500/20' : ''
                      }`}
                    >
                      {/* Top gradient bar */}
                      <div
                        className="h-1.5"
                        style={{
                          background: `linear-gradient(90deg, ${goal.color}, ${hexToRgba(goal.color, 0.4)})`,
                        }}
                      />

                      <CardContent className="p-5">
                        {/* Header row: icon + name + badge + actions */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${goal.color}15` }}
                            >
                              <TypeIcon className="w-5 h-5" style={{ color: goal.color }} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold truncate">{goal.name}</h3>
                              <Badge
                                variant="outline"
                                className="text-[10px] mt-1"
                                style={{
                                  borderColor: `${badgeColor}30`,
                                  color: badgeColor,
                                }}
                              >
                                {TYPE_LABELS[goal.type] || goal.type}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {isComplete && (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Concluída
                              </Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditGoal(goal)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDepositDialog(goal)}>
                                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                                  Depositar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setShowDeleteDialog(goal.id)}
                                  className="text-rose-500 focus:text-rose-500"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Description */}
                        {goal.description && (
                          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">
                            {goal.description}
                          </p>
                        )}

                        {/* Progress Circle + Amounts */}
                        <div className="flex items-start gap-4 mt-4">
                          <div className="relative shrink-0">
                            <SavingsCircularProgress
                              percent={percent}
                              size={76}
                              strokeWidth={6}
                              color={goal.color}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span
                                className={`text-sm font-bold ${getProgressColorClass(percent)}`}
                              >
                                {Math.round(percent)}%
                              </span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Atual</span>
                              <span className="font-medium" style={{ color: goal.color }}>
                                {currencyFmt(goal.currentAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Meta</span>
                              <span className="font-semibold">{currencyFmt(goal.targetAmount)}</span>
                            </div>
                            {!isComplete && remaining > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Faltam</span>
                                <span className="font-medium text-rose-500">
                                  {currencyFmt(remaining)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Linear progress bar */}
                        <div className="mt-4">
                          <ProgressBar
                            value={goal.currentAmount}
                            max={goal.targetAmount}
                            className="w-full"
                            color={
                              percent >= 70
                                ? 'bg-emerald-500'
                                : percent >= 30
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }
                          />
                        </div>

                        {/* Info Row: monthly contribution + target date */}
                        <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            <span>
                              {goal.monthlyContribution
                                ? `${currencyFmt(goal.monthlyContribution)}/mês`
                                : 'Sem contribuição mensal'}
                            </span>
                          </div>
                          {goal.targetDate && (
                            <div className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              <span>{dateFmt(goal.targetDate)}</span>
                            </div>
                          )}
                        </div>

                        {/* Yield rate badge */}
                        {goal.yieldRate && goal.yieldRate > 0 && (
                          <div className="mt-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-emerald-500/10 text-emerald-600"
                            >
                              {goal.yieldRate}% a.a.
                            </Badge>
                          </div>
                        )}

                        {/* Linked account badge */}
                        {goal.account && (
                          <div className="mt-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              style={{
                                backgroundColor: `${goal.color}10`,
                                color: goal.color,
                              }}
                            >
                              <Landmark className="w-3 h-3 mr-1" />
                              {goal.account.name}
                            </Badge>
                          </div>
                        )}

                        {/* Deposit Button */}
                        {!isComplete && (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <Button
                              size="sm"
                              className="w-full h-8 text-xs gap-1.5"
                              style={{
                                backgroundColor: goal.color,
                                color: '#fff',
                              }}
                              onClick={() => openDepositDialog(goal)}
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              Depositar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Create / Edit Goal Dialog ─────────────────────────────── */}
        <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={goalForm.type}
                    onValueChange={(v) => setGoalForm({ ...goalForm, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SAVINGS_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {GOAL_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          goalForm.color === c
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-105'
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>Conta vinculada</Label>
                  <Select
                    value={goalForm.accountId}
                    onValueChange={(v) => setGoalForm({ ...goalForm, accountId: v })}
                  >
                    <SelectTrigger>
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
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <PiggyBank className="w-4 h-4" />
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

        {/* ── Deposit Dialog ────────────────────────────────────────── */}
        <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Depositar</DialogTitle>
              <DialogDescription>
                {depositingGoal
                  ? `Adicione um valor à meta "${depositingGoal.name}". Atual: ${currencyFmt(depositingGoal.currentAmount)}`
                  : 'Adicione um valor à meta selecionada.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
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
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                    </motion.div>
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir meta de poupança?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todo o histórico de depósitos será perdido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-500 hover:bg-rose-600"
                onClick={() => showDeleteDialog && handleDeleteGoal(showDeleteDialog)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  );
}
