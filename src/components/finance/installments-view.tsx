'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Landmark,
  CreditCard,
  HandCoins,
  User,
  Home,
  CalendarDays,
  CircleDollarSign,
  TrendingDown,
  Check,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  StatCard,
  StatCardSkeleton,
  EmptyState,
  ProgressBar,
} from '@/components/shared/ui-helpers';
import {
  currencyFmt,
  dateFmt,
  containerVariants,
  itemVariants,
  summaryContainerVariants,
  summaryItemVariants,
  detailEntryVariants,
  listContainerVariants,
  listItemVariants,
} from '@/lib/helpers';
import { toast } from 'sonner';

// ── Plan Type Config ──────────────────────────────────────────────
const planTypeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; gradient: string; bgClass: string }
> = {
  FINANCING: {
    label: 'Financiamento',
    icon: Landmark,
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-400',
    bgClass: 'bg-violet-500/10',
  },
  CARD_INSTALLMENT: {
    label: 'Parcelamento no Cartão',
    icon: CreditCard,
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-400',
    bgClass: 'bg-orange-500/10',
  },
  LOAN: {
    label: 'Empréstimo',
    icon: HandCoins,
    color: '#f43f5e',
    gradient: 'from-rose-500 to-pink-400',
    bgClass: 'bg-rose-500/10',
  },
  PERSONAL: {
    label: 'Empréstimo Pessoal',
    icon: User,
    color: '#0ea5e9',
    gradient: 'from-sky-500 to-cyan-400',
    bgClass: 'bg-sky-500/10',
  },
  RENTAL: {
    label: 'Aluguel',
    icon: Home,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    bgClass: 'bg-amber-500/10',
  },
};

const statusConfig: Record<string, { text: string; className: string }> = {
  ACTIVE: { text: 'Ativo', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  COMPLETED: { text: 'Concluído', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  CANCELLED: { text: 'Cancelado', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
  OVERDUE: { text: 'Atrasado', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
};

const installmentStatusConfig: Record<string, { text: string; className: string; dotClass: string }> = {
  PAID: {
    text: 'Pago',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    dotClass: 'bg-green-500',
  },
  PENDING: {
    text: 'Pendente',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  OVERDUE: {
    text: 'Atrasado',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    dotClass: 'bg-rose-500',
  },
};

// ── Interfaces ─────────────────────────────────────────────────────
interface Installment {
  id: string;
  planId: string;
  installmentNumber: number;
  dueDate: string;
  paidDate: string | null;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
}

interface InstallmentPlan {
  id: string;
  description: string;
  type: string;
  totalAmount: number;
  installmentCount: number;
  monthlyValue: number;
  paidInstallments: number;
  interestRate: number;
  startDate: string;
  status: string;
  cardId: string | null;
  categoryId: string | null;
  card?: { id: string; name: string; color: string } | null;
  category?: { id: string; name: string; color: string } | null;
  installments?: Installment[];
}

interface CardOption {
  id: string;
  name: string;
  color: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  color: string;
}

// ── Component ──────────────────────────────────────────────────────
export function InstallmentsView() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [payingInstallment, setPayingInstallment] = useState<string | null>(null);

  // Options for selects
  const [cards, setCards] = useState<CardOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Create form
  const [form, setForm] = useState({
    description: '',
    totalAmount: '',
    installmentCount: '',
    monthlyValue: '',
    interestRate: '',
    type: 'FINANCING',
    startDate: new Date().toISOString().split('T')[0],
    cardId: '',
    categoryId: '',
  });

  // ── Data fetching ────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/installments');
      if (res.ok) setPlans(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (res.ok) setCards(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchCards();
    fetchCategories();
  }, [fetchPlans, fetchCards, fetchCategories]);

  // ── Auto-calculate monthly value ─────────────────────────────────
  const handleAmountChange = (amount: string) => {
    const a = parseFloat(amount) || 0;
    const c = parseInt(form.installmentCount) || 1;
    const mv = c > 0 ? a / c : 0;
    setForm({ ...form, totalAmount: amount, monthlyValue: mv > 0 ? mv.toFixed(2) : '' });
  };

  const handleCountChange = (count: string) => {
    const a = parseFloat(form.totalAmount) || 0;
    const c = parseInt(count) || 1;
    const mv = c > 0 ? a / c : 0;
    setForm({ ...form, installmentCount: count, monthlyValue: mv > 0 ? mv.toFixed(2) : '' });
  };

  // ── Computed summary ─────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalFinanced = plans.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalPaid = plans.reduce((s, p) => s + (p.paidInstallments || 0) * (p.monthlyValue || 0), 0);
    const remaining = Math.max(0, totalFinanced - totalPaid);
    const overdueCount = plans.reduce((s, p) => {
      return s + (p.installments?.filter((i) => i.status === 'OVERDUE').length || 0);
    }, 0);
    return { totalFinanced, totalPaid, remaining, overdueCount };
  }, [plans]);

  // ── Filtered plans ───────────────────────────────────────────────
  const filteredPlans = useMemo(() => {
    switch (activeTab) {
      case 'ACTIVE':
        return plans.filter((p) => p.status === 'ACTIVE');
      case 'COMPLETED':
        return plans.filter((p) => p.status === 'COMPLETED');
      case 'OVERDUE':
        return plans.filter((p) => p.status === 'OVERDUE' || p.status === 'ACTIVE');
      default:
        return plans;
    }
  }, [plans, activeTab]);

  // ── Actions ──────────────────────────────────────────────────────
  const openPlanDetail = async (plan: InstallmentPlan) => {
    try {
      const res = await fetch(`/api/installments?id=${plan.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPlan(data);
      }
    } catch {
      setSelectedPlan(plan);
    }
  };

  const createPlan = async () => {
    try {
      const body = {
        description: form.description,
        totalAmount: parseFloat(form.totalAmount) || 0,
        installmentCount: parseInt(form.installmentCount) || 1,
        monthlyValue: parseFloat(form.monthlyValue) || 0,
        interestRate: parseFloat(form.interestRate) || 0,
        type: form.type,
        startDate: form.startDate,
        cardId: form.cardId || null,
        categoryId: form.categoryId || null,
      };

      const res = await fetch('/api/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao criar plano');
        return;
      }

      toast.success('Plano criado com sucesso!');
      setShowCreateDialog(false);
      setForm({
        description: '',
        totalAmount: '',
        installmentCount: '',
        monthlyValue: '',
        interestRate: '',
        type: 'FINANCING',
        startDate: new Date().toISOString().split('T')[0],
        cardId: '',
        categoryId: '',
      });
      fetchPlans();
    } catch {
      toast.error('Erro ao criar plano');
    }
  };

  const deletePlan = async (id: string) => {
    try {
      await fetch('/api/installments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Plano excluído!');
      setShowDeleteDialog(null);
      if (selectedPlan?.id === id) setSelectedPlan(null);
      fetchPlans();
    } catch {
      toast.error('Erro ao excluir plano');
    }
  };

  const markAsPaid = async (installmentId: string, paidDate?: string) => {
    setPayingInstallment(installmentId);
    try {
      const body: { installmentId: string; paidDate?: string } = { installmentId };
      if (paidDate) body.paidDate = paidDate;

      const res = await fetch('/api/installments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao registrar pagamento');
        return;
      }

      toast.success('Parcela marcada como paga!');

      // Refresh plan detail
      if (selectedPlan) {
        const updated = await fetch(`/api/installments?id=${selectedPlan.id}`);
        if (updated.ok) {
          setSelectedPlan(await updated.json());
        }
      }
      fetchPlans();
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      setPayingInstallment(null);
    }
  };

  // ── Loading state ────────────────────────────────────────────────
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
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Plan Detail View ─────────────────────────────────────────────
  if (selectedPlan) {
    const config = planTypeConfig[selectedPlan.type] || planTypeConfig.FINANCING;
    const Icon = config.icon;
    const progressPct =
      selectedPlan.installmentCount > 0
        ? Math.round((selectedPlan.paidInstallments / selectedPlan.installmentCount) * 100)
        : 0;
    const paidAmount = (selectedPlan.paidInstallments || 0) * (selectedPlan.monthlyValue || 0);
    const remainingAmount = Math.max(0, (selectedPlan.totalAmount || 0) - paidAmount);

    // Find next pending installment
    const nextInstallment = selectedPlan.installments?.find((i) => i.status === 'PENDING' || i.status === 'OVERDUE');

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="detail"
          variants={detailEntryVariants}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="space-y-6"
        >
          {/* Header with back button */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlan(null)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bgClass}`}>
                <Icon className="w-5 h-5" style={{ color: config.color }} />
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedPlan.description}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: `${config.color}15`, color: config.color }}
                  >
                    {config.label}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig[selectedPlan.status]?.className || ''}`}
                  >
                    {statusConfig[selectedPlan.status]?.text || selectedPlan.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(selectedPlan.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Progress section */}
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="overflow-hidden border-0 shadow-md">
              <div
                className="h-1.5"
                style={{
                  background: `linear-gradient(90deg, ${config.color}, ${config.color}88)`,
                }}
              />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Progresso do Pagamento</h3>
                  <span className="text-2xl font-bold" style={{ color: config.color }}>
                    {progressPct}%
                  </span>
                </div>

                <Progress value={progressPct} className="h-3 mb-4" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Total Financiado
                    </p>
                    <p className="text-sm font-bold mt-1">
                      {currencyFmt(selectedPlan.totalAmount)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Valor Pago
                    </p>
                    <p className="text-sm font-bold mt-1 text-green-500">
                      {currencyFmt(paidAmount)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Valor Restante
                    </p>
                    <p className="text-sm font-bold mt-1 text-rose-500">
                      {currencyFmt(remainingAmount)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Próximo Vencimento
                    </p>
                    <p className="text-sm font-bold mt-1">
                      {nextInstallment ? dateFmt(nextInstallment.dueDate) : '—'}
                    </p>
                  </div>
                </div>

                {selectedPlan.interestRate > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Taxa de juros:{' '}
                      <span className="font-semibold text-foreground">
                        {selectedPlan.interestRate}%
                      </span>
                      {' · '}
                      Parcela mensal:{' '}
                      <span className="font-semibold text-foreground">
                        {currencyFmt(selectedPlan.monthlyValue)}
                      </span>
                      {' · '}
                      Início:{' '}
                      <span className="font-semibold text-foreground">
                        {dateFmt(selectedPlan.startDate)}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Installment list */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <h3 className="text-base font-semibold">
              Parcelas ({selectedPlan.paidInstallments}/{selectedPlan.installmentCount})
            </h3>
          </motion.div>

          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                {!selectedPlan.installments || selectedPlan.installments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma parcela encontrada</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      As parcelas serão geradas automaticamente
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <motion.div
                      variants={listContainerVariants}
                      initial="hidden"
                      animate="show"
                      className="divide-y divide-border"
                    >
                      {selectedPlan.installments.map((inst) => {
                        const instConfig = installmentStatusConfig[inst.status] || installmentStatusConfig.PENDING;
                        const isPaying = payingInstallment === inst.id;
                        return (
                          <motion.div
                            key={inst.id}
                            variants={listItemVariants}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  inst.status === 'PAID'
                                    ? 'bg-green-500/10'
                                    : inst.status === 'OVERDUE'
                                      ? 'bg-rose-500/10'
                                      : 'bg-amber-500/10'
                                }`}
                              >
                                {inst.status === 'PAID' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : inst.status === 'OVERDUE' ? (
                                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  Parcela {inst.installmentNumber}
                                  <span className="text-muted-foreground font-normal">
                                    {' '}de {selectedPlan.installmentCount}
                                  </span>
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] text-muted-foreground">
                                    Venc: {dateFmt(inst.dueDate)}
                                  </p>
                                  {inst.paidDate && (
                                    <p className="text-[11px] text-green-500">
                                      Pago em {dateFmt(inst.paidDate)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${instConfig.className}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${instConfig.dotClass}`} />
                                {instConfig.text}
                              </span>
                              <span className="text-sm font-bold tabular-nums min-w-[80px] text-right">
                                {currencyFmt(inst.amount)}
                              </span>
                              {inst.status !== 'PAID' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600"
                                  disabled={isPaying}
                                  onClick={() => markAsPaid(inst.id)}
                                >
                                  {isPaying ? (
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                      className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full"
                                    />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Pagar
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Delete confirmation */}
          <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir plano</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o plano &quot;{selectedPlan.description}&quot;? Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => showDeleteDialog && deletePlan(showDeleteDialog)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

  // ── Plans List View ──────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        exit="hidden"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Parcelas e Financiamentos</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie seus financiamentos, empréstimos e parcelamentos
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Plano</span>
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
            label="Total Financiado"
            value={currencyFmt(summary.totalFinanced)}
            icon={CircleDollarSign}
            gradient="from-violet-500 to-purple-400"
            subtitle={`${plans.length} plano${plans.length !== 1 ? 's' : ''} ativo${plans.length !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Total Pago"
            value={currencyFmt(summary.totalPaid)}
            icon={CheckCircle2}
            gradient="from-green-500 to-emerald-400"
            subtitle="Valor total já pago"
          />
          <StatCard
            label="Valor Restante"
            value={currencyFmt(summary.remaining)}
            icon={TrendingDown}
            gradient="from-rose-500 to-pink-400"
            subtitle="Saldo devedor total"
          />
          <StatCard
            label="Parcelas em Atraso"
            value={String(summary.overdueCount)}
            icon={AlertTriangle}
            gradient="from-amber-500 to-yellow-400"
            subtitle={summary.overdueCount > 0 ? 'Atenção necessária' : 'Nenhum atraso'}
          />
        </motion.div>

        {/* Status filter tabs */}
        <motion.div variants={itemVariants} initial="hidden" animate="show">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'ACTIVE', label: 'Ativos' },
              { key: 'COMPLETED', label: 'Concluídos' },
              { key: 'OVERDUE', label: 'Atrasados' },
            ].map((tab) => (
              <Button
                key={tab.key}
                size="sm"
                variant={activeTab === tab.key ? 'default' : 'outline'}
                className={`shrink-0 gap-1.5 ${
                  activeTab === tab.key
                    ? 'shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.key === 'ACTIVE' && <Clock className="w-3.5 h-3.5" />}
                {tab.key === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {tab.key === 'OVERDUE' && <AlertTriangle className="w-3.5 h-3.5" />}
                {tab.label}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Plan Cards Grid */}
        {filteredPlans.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={
              activeTab === 'ALL'
                ? 'Nenhum plano cadastrado'
                : activeTab === 'ACTIVE'
                  ? 'Nenhum plano ativo'
                  : activeTab === 'COMPLETED'
                    ? 'Nenhum plano concluído'
                    : 'Nenhum plano em atraso'
            }
            subtitle={
              activeTab === 'ALL'
                ? 'Clique em "Novo Plano" para adicionar um financiamento'
                : 'Altere o filtro para ver outros planos'
            }
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredPlans.map((plan) => {
              const config = planTypeConfig[plan.type] || planTypeConfig.FINANCING;
              const PlanIcon = config.icon;
              const progressPct =
                plan.installmentCount > 0
                  ? Math.round((plan.paidInstallments / plan.installmentCount) * 100)
                  : 0;

              // Find next pending/overdue installment
              const nextInstallment = plan.installments?.find(
                (i) => i.status === 'PENDING' || i.status === 'OVERDUE'
              );

              const overdueInstallments =
                plan.installments?.filter((i) => i.status === 'OVERDUE').length || 0;

              return (
                <motion.div
                  key={plan.id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Card
                    className="cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow group relative overflow-hidden border-0"
                    onClick={() => openPlanDetail(plan)}
                  >
                    {/* Top color bar with glow effect */}
                    <div className="relative">
                      <div
                        className="h-1.5"
                        style={{
                          background: `linear-gradient(90deg, ${config.color}, ${config.color}66)`,
                        }}
                      />
                      {/* Subtle glow */}
                      <div
                        className="absolute top-0 left-0 right-0 h-8 opacity-20 blur-lg"
                        style={{ backgroundColor: config.color }}
                      />
                    </div>

                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${config.bgClass}`}
                          >
                            <PlanIcon className="w-5 h-5" style={{ color: config.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{plan.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${config.color}15`,
                                  color: config.color,
                                }}
                              >
                                {config.label}
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusConfig[plan.status]?.className || ''}`}
                              >
                                {statusConfig[plan.status]?.text || plan.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        {overdueInstallments > 0 && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] shrink-0"
                          >
                            {overdueInstallments} atraso{overdueInstallments > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {/* Amount and monthly value */}
                      <p className="text-2xl font-bold tracking-tight">
                        {currencyFmt(plan.totalAmount)}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {currencyFmt(plan.monthlyValue)}/mês
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {plan.installmentCount}x
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] text-muted-foreground">
                            {plan.paidInstallments}/{plan.installmentCount} parcelas
                          </p>
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: config.color }}
                          >
                            {progressPct}%
                          </p>
                        </div>
                        <ProgressBar
                          value={plan.paidInstallments}
                          max={plan.installmentCount}
                          color={config.color}
                        />
                      </div>

                      {/* Next payment */}
                      {nextInstallment && plan.status === 'ACTIVE' && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground">
                            Próximo vencimento:{' '}
                            <span className="font-medium text-foreground">
                              {dateFmt(nextInstallment.dueDate)}
                            </span>
                          </p>
                        </div>
                      )}

                      {/* Card / Category info */}
                      {(plan.card || plan.category) && (
                        <div className="mt-2 flex items-center gap-2">
                          {plan.card && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                backgroundColor: `${plan.card.color}15`,
                                color: plan.card.color,
                              }}
                            >
                              <CreditCard className="w-2.5 h-2.5 mr-1" />
                              {plan.card.name}
                            </span>
                          )}
                          {plan.category && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                backgroundColor: `${plan.category.color}15`,
                                color: plan.category.color,
                              }}
                            >
                              {plan.category.name}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Create Plan Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Plano de Parcelas</DialogTitle>
              <DialogDescription>
                Cadastre um novo financiamento, empréstimo ou parcelamento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Financiamento do Apartamento..."
                />
              </div>

              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(planTypeConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <cfg.icon className="w-4 h-4" />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.totalAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.installmentCount}
                    onChange={(e) => handleCountChange(e.target.value)}
                    placeholder="12"
                  />
                </div>
              </div>

              <div>
                <Label>Valor da Parcela (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monthlyValue}
                  onChange={(e) => setForm({ ...form, monthlyValue: e.target.value })}
                  placeholder="Auto-calculado"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Calculado automaticamente pelo valor total ÷ parcelas
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Taxa de Juros (% a.a.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Cartão (opcional)</Label>
                <Select
                  value={form.cardId}
                  onValueChange={(v) => setForm({ ...form, cardId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => c.type === 'EXPENSE')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={createPlan}
                disabled={!form.description || !form.totalAmount || !form.installmentCount}
              >
                Criar Plano
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir plano</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteDialog && deletePlan(showDeleteDialog)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
