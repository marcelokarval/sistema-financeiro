'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  BarChart3,
  Gift,
  Building2,
  Bitcoin,
  Landmark,
  BadgeDollarSign,
  PiggyBank,
  Receipt,
  RefreshCw,
  CircleDollarSign,
  Percent,
  Filter,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';

import {
  currencyFmt,
  percentFmt,
  dateFmt,
  containerVariants,
  itemVariants,
  summaryContainerVariants,
  summaryItemVariants,
  listItemVariants,
  detailEntryVariants,
} from '@/lib/helpers';
import { StatCard, StatCardSkeleton, EmptyState, ProgressBar } from '@/components/shared/ui-helpers';

// ── Constants ───────────────────────────────────────────────────────

const investmentTypes: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string }> = {
  STOCK:    { label: 'Ações',          color: 'text-emerald-500',  icon: TrendingUp,       gradient: 'from-emerald-500 to-emerald-400' },
  BOND:     { label: 'Renda Fixa',     color: 'text-sky-500',      icon: Landmark,         gradient: 'from-sky-500 to-sky-400' },
  FII:      { label: 'FIIs',           color: 'text-violet-500',   icon: Building2,        gradient: 'from-violet-500 to-violet-400' },
  CDB:      { label: 'CDB',            color: 'text-amber-500',    icon: BadgeDollarSign,  gradient: 'from-amber-500 to-amber-400' },
  LCI:      { label: 'LCI',            color: 'text-teal-500',     icon: CircleDollarSign, gradient: 'from-teal-500 to-teal-400' },
  LCA:      { label: 'LCA',            color: 'text-teal-500',     icon: CircleDollarSign, gradient: 'from-teal-500 to-teal-400' },
  TESOURO:  { label: 'Tesouro Direto', color: 'text-rose-500',     icon: BarChart3,        gradient: 'from-rose-500 to-rose-400' },
  CRYPTO:   { label: 'Cripto',         color: 'text-orange-500',   icon: Bitcoin,          gradient: 'from-orange-500 to-orange-400' },
  ETF:      { label: 'ETF',            color: 'text-cyan-500',     icon: RefreshCw,        gradient: 'from-cyan-500 to-cyan-400' },
  OTHER:    { label: 'Outro',          color: 'text-slate-500',    icon: Wallet,           gradient: 'from-slate-500 to-slate-400' },
};

const typeColorMap: Record<string, string> = {
  STOCK: '#10b981',
  BOND: '#0ea5e9',
  FII: '#8b5cf6',
  CDB: '#f59e0b',
  LCI: '#14b8a6',
  LCA: '#14b8a6',
  TESOURO: '#f43f5e',
  CRYPTO: '#f97316',
  ETF: '#06b6d4',
  OTHER: '#64748b',
};

const transactionTypes: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  APORTE:         { label: 'Aporte',         color: 'text-emerald-500', icon: Plus },
  DIVIDENDO:      { label: 'Dividendo',      color: 'text-amber-500',   icon: Gift },
  VENDA:          { label: 'Venda',          color: 'text-rose-500',    icon: ArrowDownRight },
  REINVESTIMENTO: { label: 'Reinvestimento',  color: 'text-cyan-500',    icon: RefreshCw },
  TAXA:           { label: 'Taxa',           color: 'text-slate-500',   icon: Receipt },
  BONUS:          { label: 'Bônus',          color: 'text-violet-500',  icon: DollarSign },
};

const filterTabs = [
  { value: 'all',    label: 'Todos' },
  { value: 'STOCK',  label: 'Ações' },
  { value: 'FII',    label: 'FIIs' },
  { value: 'BOND',   label: 'Renda Fixa' },
  { value: 'TESOURO', label: 'Tesouro' },
  { value: 'CRYPTO', label: 'Cripto' },
];

// ── Interfaces ──────────────────────────────────────────────────────

interface Investment {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  investedAmount: number;
  currentBalance: number;
  yieldRate: number;
  brokerage?: string | null;
  ticker?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  _count?: { transactions: number };
}

interface InvestmentTransaction {
  id: string;
  type: string;
  amount: number;
  quantity?: number | null;
  unitPrice?: number | null;
  date: string;
  description?: string | null;
  notes?: string | null;
}

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

// ── Component ──────────────────────────────────────────────────────

export function InvestmentsView() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  // Dialogs
  const [showInvestmentDialog, setShowInvestmentDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  // Investment form
  const [form, setForm] = useState({
    name: '',
    type: 'STOCK',
    description: '',
    investedAmount: '',
    yieldRate: '0',
    brokerage: '',
    ticker: '',
    accountId: '',
    categoryId: '',
  });

  // Transaction form
  const [txForm, setTxForm] = useState({
    type: 'APORTE',
    amount: '',
    quantity: '',
    unitPrice: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });

  // ── Data fetching ────────────────────────────────────────────────

  const fetchInvestments = useCallback(async () => {
    try {
      const res = await fetch('/api/investments');
      if (res.ok) setInvestments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (investmentId: string) => {
    try {
      const res = await fetch(`/api/investments/transactions?investmentId=${investmentId}`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) setAccounts(await res.json());
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
    fetchInvestments();
    fetchAccounts();
    fetchCategories();
  }, [fetchInvestments, fetchAccounts, fetchCategories]);

  // ── Computed data ────────────────────────────────────────────────

  const filteredInvestments = useMemo(() => {
    if (activeFilter === 'all') return investments;
    // "Renda Fixa" tab maps to BOND, LCI, LCA, CDB types
    if (activeFilter === 'BOND') {
      return investments.filter((inv) => ['BOND', 'LCI', 'LCA', 'CDB'].includes(inv.type));
    }
    return investments.filter((inv) => inv.type === activeFilter);
  }, [investments, activeFilter]);

  const summary = useMemo(() => {
    const totalInvested = investments.reduce((sum, inv) => sum + (inv.investedAmount || 0), 0);
    const currentTotal = investments.reduce((sum, inv) => sum + (inv.currentBalance || 0), 0);
    const rentabilidade = totalInvested > 0 ? ((currentTotal - totalInvested) / totalInvested) * 100 : 0;
    // Dividends from all transactions loaded so far (if any)
    return { totalInvested, currentTotal, rentabilidade, dividendsReceived: 0 };
  }, [investments]);

  const investmentStats = useMemo(() => {
    if (!selectedInvestment) return { totalAportes: 0, totalDividendos: 0, totalVendas: 0, txCount: transactions.length };
    let totalAportes = 0;
    let totalDividendos = 0;
    let totalVendas = 0;
    for (const tx of transactions) {
      if (tx.type === 'APORTE' || tx.type === 'REINVESTIMENTO' || tx.type === 'BONUS') {
        totalAportes += tx.amount;
      }
      if (tx.type === 'DIVIDENDO') {
        totalDividendos += tx.amount;
      }
      if (tx.type === 'VENDA') {
        totalVendas += tx.amount;
      }
    }
    return { totalAportes, totalDividendos, totalVendas, txCount: transactions.length };
  }, [selectedInvestment, transactions]);

  // ── Actions ──────────────────────────────────────────────────────

  const openInvestmentDetail = (inv: Investment) => {
    setSelectedInvestment(inv);
    fetchTransactions(inv.id);
  };

  const openNewInvestment = () => {
    setEditingInvestment(null);
    setForm({
      name: '',
      type: 'STOCK',
      description: '',
      investedAmount: '',
      yieldRate: '0',
      brokerage: '',
      ticker: '',
      accountId: '',
      categoryId: '',
    });
    setShowInvestmentDialog(true);
  };

  const openEditInvestment = (inv: Investment) => {
    setEditingInvestment(inv);
    setForm({
      name: inv.name,
      type: inv.type,
      description: inv.description || '',
      investedAmount: String(inv.investedAmount),
      yieldRate: String(inv.yieldRate),
      brokerage: inv.brokerage || '',
      ticker: inv.ticker || '',
      accountId: inv.accountId || '',
      categoryId: inv.categoryId || '',
    });
    setShowInvestmentDialog(true);
  };

  const saveInvestment = async () => {
    try {
      const body = {
        ...form,
        investedAmount: parseFloat(form.investedAmount) || 0,
        yieldRate: parseFloat(form.yieldRate) || 0,
        accountId: form.accountId || undefined,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
        brokerage: form.brokerage || undefined,
        ticker: form.ticker || undefined,
      };
      if (editingInvestment) {
        await fetch('/api/investments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingInvestment.id, ...body }),
        });
        toast.success('Investimento atualizado!');
      } else {
        await fetch('/api/investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Investimento criado!');
      }
      setShowInvestmentDialog(false);
      fetchInvestments();
      if (selectedInvestment?.id === editingInvestment?.id) {
        fetchTransactions(selectedInvestment.id);
      }
    } catch {
      toast.error('Erro ao salvar investimento');
    }
  };

  const deleteInvestment = async (id: string) => {
    try {
      await fetch('/api/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Investimento excluído!');
      setShowDeleteDialog(null);
      if (selectedInvestment?.id === id) setSelectedInvestment(null);
      fetchInvestments();
    } catch {
      toast.error('Erro ao excluir investimento');
    }
  };

  const saveTransaction = async () => {
    if (!selectedInvestment) return;
    try {
      const body = {
        ...txForm,
        amount: parseFloat(txForm.amount),
        quantity: txForm.quantity ? parseFloat(txForm.quantity) : null,
        unitPrice: txForm.unitPrice ? parseFloat(txForm.unitPrice) : null,
        investmentId: selectedInvestment.id,
        description: txForm.description || undefined,
        notes: txForm.notes || undefined,
      };
      await fetch('/api/investments/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.success('Transação registrada!');
      setShowTransactionDialog(false);
      setTxForm({
        type: 'APORTE',
        amount: '',
        quantity: '',
        unitPrice: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
      });
      fetchTransactions(selectedInvestment.id);
      fetchInvestments();
    } catch {
      toast.error('Erro ao registrar transação');
    }
  };

  const getYieldColor = (rate: number) => (rate >= 0 ? 'text-emerald-500' : 'text-rose-500');

  // ── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
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

  // ── Investment Detail View ───────────────────────────────────────

  if (selectedInvestment) {
    const invType = investmentTypes[selectedInvestment.type] || investmentTypes.OTHER;
    const InvIcon = invType.icon;
    const invColor = typeColorMap[selectedInvestment.type] || '#64748b';
    const yieldPct = selectedInvestment.investedAmount > 0
      ? ((selectedInvestment.currentBalance - selectedInvestment.investedAmount) / selectedInvestment.investedAmount) * 100
      : 0;
    const isPositive = yieldPct >= 0;

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
          {/* Back button + Header */}
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
                onClick={() => setSelectedInvestment(null)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${invColor}15` }}
              >
                <InvIcon className="w-5 h-5" style={{ color: invColor }} />
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedInvestment.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: `${invColor}40`, color: invColor }}
                  >
                    {invType.label}
                  </Badge>
                  {selectedInvestment.ticker && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {selectedInvestment.ticker}
                    </Badge>
                  )}
                  {selectedInvestment.brokerage && (
                    <span className="text-[11px] text-muted-foreground">
                      {selectedInvestment.brokerage}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEditInvestment(selectedInvestment)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(selectedInvestment.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Balance overview card */}
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="overflow-hidden border-0 shadow-md">
              <div
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${invColor}, ${invColor}88)` }}
              />
              <CardContent className="p-5">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Valor Atual
                    </p>
                    <p className="text-3xl font-bold mt-1 tracking-tight">
                      {currencyFmt(selectedInvestment.currentBalance)}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {percentFmt(yieldPct)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Investido
                    </p>
                    <p className="text-base font-bold mt-0.5">
                      {currencyFmt(selectedInvestment.investedAmount)}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Lucro / Prejuízo
                    </p>
                    <p className={`text-base font-bold mt-0.5 ${getYieldColor(yieldPct)}`}>
                      {isPositive ? '+' : ''}{currencyFmt(selectedInvestment.currentBalance - selectedInvestment.investedAmount)}
                    </p>
                  </div>
                </div>
                <ProgressBar
                  value={Math.max(0, selectedInvestment.currentBalance)}
                  max={selectedInvestment.investedAmount || 1}
                  className="mt-2"
                  color={isPositive ? 'bg-emerald-500' : 'bg-rose-500'}
                  showLabel
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  {isPositive
                    ? `Rentabilidade de ${percentFmt(yieldPct)} sobre o valor investido`
                    : `Queda de ${percentFmt(yieldPct)} sobre o valor investido`}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-4"
          >
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Total Aportes
                  </p>
                  <p className="text-sm font-bold text-emerald-500 mt-0.5">
                    {currencyFmt(investmentStats.totalAportes)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Dividendos
                  </p>
                  <p className="text-sm font-bold text-amber-500 mt-0.5">
                    {currencyFmt(investmentStats.totalDividendos)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-violet-500/10 flex items-center justify-center mb-2">
                    <BarChart3 className="w-4 h-4 text-violet-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Transações
                  </p>
                  <p className="text-sm font-bold mt-0.5">
                    {investmentStats.txCount}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Transaction list header */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <h3 className="text-base font-semibold">Histórico de Transações</h3>
            <Button
              onClick={() => setShowTransactionDialog(true)}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Transação
            </Button>
          </motion.div>

          {/* Transaction list */}
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma transação registrada</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Adicione a primeira transação neste investimento
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="divide-y divide-border"
                    >
                      {transactions.map((tx) => {
                        const txType = transactionTypes[tx.type] || transactionTypes.APORTE;
                        const TxIcon = txType.icon;
                        const isCredit = ['APORTE', 'DIVIDENDO', 'REINVESTIMENTO', 'BONUS'].includes(tx.type);
                        return (
                          <motion.div
                            key={tx.id}
                            variants={listItemVariants}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-default"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-110"
                                style={{ backgroundColor: `${invColor}15` }}
                              >
                                <TxIcon className={`w-4 h-4 ${txType.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {tx.description || txType.label}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] text-muted-foreground">
                                    {dateFmt(tx.date)}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-medium px-1.5 py-0"
                                    style={{ borderColor: `${invColor}30`, color: invColor }}
                                  >
                                    {txType.label}
                                  </Badge>
                                  {tx.quantity && tx.unitPrice && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {tx.quantity} x {currencyFmt(tx.unitPrice)}
                                    </span>
                                  )}
                                </div>
                                {tx.notes && (
                                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                                    {tx.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-sm font-bold whitespace-nowrap ml-2 ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}
                            >
                              {isCredit ? '+' : '-'}{currencyFmt(tx.amount)}
                            </span>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Transaction Dialog */}
          <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
                <DialogDescription>
                  Registrar nova transação em {selectedInvestment.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={txForm.type}
                    onValueChange={(v) => setTxForm({ ...txForm, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APORTE">Aporte</SelectItem>
                      <SelectItem value="DIVIDENDO">Dividendo</SelectItem>
                      <SelectItem value="VENDA">Venda</SelectItem>
                      <SelectItem value="REINVESTIMENTO">Reinvestimento</SelectItem>
                      <SelectItem value="TAXA">Taxa</SelectItem>
                      <SelectItem value="BONUS">Bônus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={txForm.date}
                      onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={txForm.quantity}
                      onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <Label>Preço Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={txForm.unitPrice}
                      onChange={(e) => setTxForm({ ...txForm, unitPrice: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={txForm.description}
                    onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                    placeholder="Ex: Compra de cotas, Dividendo mensal..."
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input
                    value={txForm.notes}
                    onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                    placeholder="Notas adicionais (opcional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTransactionDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveTransaction}>Registrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Investment Dialog (detail view) */}
          <Dialog open={showInvestmentDialog} onOpenChange={setShowInvestmentDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Investimento</DialogTitle>
                <DialogDescription>Atualize os dados do investimento</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: PETR4, Tesouro IPCA..."
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
                      <SelectItem value="STOCK">Ações</SelectItem>
                      <SelectItem value="BOND">Renda Fixa</SelectItem>
                      <SelectItem value="FII">FIIs</SelectItem>
                      <SelectItem value="CDB">CDB</SelectItem>
                      <SelectItem value="LCI">LCI</SelectItem>
                      <SelectItem value="LCA">LCA</SelectItem>
                      <SelectItem value="TESOURO">Tesouro Direto</SelectItem>
                      <SelectItem value="CRYPTO">Cripto</SelectItem>
                      <SelectItem value="ETF">ETF</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor Investido (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.investedAmount}
                      onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Rentabilidade (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.yieldRate}
                      onChange={(e) => setForm({ ...form, yieldRate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Corretora</Label>
                    <Input
                      value={form.brokerage}
                      onChange={(e) => setForm({ ...form, brokerage: e.target.value })}
                      placeholder="Ex: XP, Rico..."
                    />
                  </div>
                  <div>
                    <Label>Ticker</Label>
                    <Input
                      value={form.ticker}
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                      placeholder="Ex: PETR4, MXRF11..."
                    />
                  </div>
                </div>
                <div>
                  <Label>Conta</Label>
                  <Select
                    value={form.accountId}
                    onValueChange={(v) => setForm({ ...form, accountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
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
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInvestmentDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveInvestment}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Investimento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{selectedInvestment.name}</strong>? Esta ação não pode ser desfeita e todas as transações associadas serão perdidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteInvestment(selectedInvestment.id)}
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

  // ── Investments List View ────────────────────────────────────────
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
            <h2 className="text-xl font-bold">Investimentos</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie sua carteira de investimentos
            </p>
          </div>
          <Button onClick={openNewInvestment} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Investimento</span>
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
            label="Total Investido"
            value={currencyFmt(summary.totalInvested)}
            icon={PiggyBank}
            gradient="from-emerald-500 to-emerald-400"
            subtitle={`${investments.length} investimento${investments.length !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Valor Atual"
            value={currencyFmt(summary.currentTotal)}
            icon={BarChart3}
            gradient="from-cyan-500 to-cyan-400"
            subtitle="Soma dos saldos atuais"
          />
          <StatCard
            label="Rentabilidade Total"
            value={percentFmt(summary.rentabilidade)}
            icon={Percent}
            gradient={summary.rentabilidade >= 0 ? 'from-emerald-500 to-teal-400' : 'from-rose-500 to-pink-400'}
            subtitle={summary.rentabilidade >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado'}
          />
          <StatCard
            label="Dividendos Recebidos"
            value={currencyFmt(summary.dividendsReceived)}
            icon={Gift}
            gradient="from-amber-500 to-amber-400"
            subtitle="Rendimentos recebidos"
          />
        </motion.div>

        {/* Filter Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <TabsList className="flex-wrap gap-1 h-auto bg-transparent p-0">
              {filterTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground text-sm font-medium transition-colors"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Investment Cards Grid */}
        {filteredInvestments.length === 0 ? (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={activeFilter === 'all' ? BarChart3 : Filter}
              title={
                activeFilter === 'all'
                  ? 'Nenhum investimento cadastrado'
                  : `Nenhum investimento do tipo "${filterTabs.find((t) => t.value === activeFilter)?.label}"`
              }
              subtitle={
                activeFilter === 'all'
                  ? 'Clique em "Novo Investimento" para começar'
                  : 'Tente selecionar outro filtro'
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
            {filteredInvestments.map((inv) => {
              const invType = investmentTypes[inv.type] || investmentTypes.OTHER;
              const InvIcon = invType.icon;
              const invColor = typeColorMap[inv.type] || '#64748b';
              const yieldPct = inv.investedAmount > 0
                ? ((inv.currentBalance - inv.investedAmount) / inv.investedAmount) * 100
                : 0;
              const isPositive = yieldPct >= 0;

              return (
                <motion.div
                  key={inv.id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Card
                    className="cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow group relative overflow-hidden border-0"
                    onClick={() => openInvestmentDetail(inv)}
                  >
                    <div
                      className="h-1.5"
                      style={{ background: `linear-gradient(90deg, ${invColor}, ${invColor}66)` }}
                    />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${invColor}15` }}
                          >
                            <InvIcon className="w-5 h-5" style={{ color: invColor }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{inv.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                style={{ borderColor: `${invColor}30`, color: invColor }}
                              >
                                {invType.label}
                              </Badge>
                              {inv.ticker && (
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {inv.ticker}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div
                            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {percentFmt(yieldPct)}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditInvestment(inv);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteDialog(inv.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Brokerage */}
                      {inv.brokerage && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {inv.brokerage}
                        </p>
                      )}

                      {/* Amounts */}
                      <div className="flex items-end justify-between mt-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Investido
                          </p>
                          <p className="text-sm font-medium mt-0.5">
                            {currencyFmt(inv.investedAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Atual
                          </p>
                          <p className={`text-lg font-bold mt-0.5 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {currencyFmt(inv.currentBalance)}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <ProgressBar
                        value={Math.max(0, inv.currentBalance)}
                        max={inv.investedAmount || 1}
                        className="mt-3"
                        color={isPositive ? 'bg-emerald-500' : 'bg-rose-500'}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Create/Edit Investment Dialog */}
        <Dialog open={showInvestmentDialog} onOpenChange={setShowInvestmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingInvestment ? 'Editar Investimento' : 'Novo Investimento'}
              </DialogTitle>
              <DialogDescription>
                {editingInvestment
                  ? 'Atualize os dados do investimento'
                  : 'Preencha os dados do novo investimento'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: PETR4, Tesouro IPCA, MXRF11..."
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
                    <SelectItem value="STOCK">Ações</SelectItem>
                    <SelectItem value="BOND">Renda Fixa</SelectItem>
                    <SelectItem value="FII">FIIs</SelectItem>
                    <SelectItem value="CDB">CDB</SelectItem>
                    <SelectItem value="LCI">LCI</SelectItem>
                    <SelectItem value="LCA">LCA</SelectItem>
                    <SelectItem value="TESOURO">Tesouro Direto</SelectItem>
                    <SelectItem value="CRYPTO">Cripto</SelectItem>
                    <SelectItem value="ETF">ETF</SelectItem>
                    <SelectItem value="OTHER">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição opcional do investimento"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor Investido (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.investedAmount}
                    onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Rentabilidade (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.yieldRate}
                    onChange={(e) => setForm({ ...form, yieldRate: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Corretora</Label>
                  <Input
                    value={form.brokerage}
                    onChange={(e) => setForm({ ...form, brokerage: e.target.value })}
                    placeholder="Ex: XP, Rico, Clear..."
                  />
                </div>
                <div>
                  <Label>Ticker</Label>
                  <Input
                    value={form.ticker}
                    onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                    placeholder="Ex: PETR4, MXRF11..."
                  />
                </div>
              </div>
              <div>
                <Label>Conta</Label>
                <Select
                  value={form.accountId}
                  onValueChange={(v) => setForm({ ...form, accountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
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
                    <SelectValue placeholder="Selecione uma categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvestmentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={saveInvestment}>
                {editingInvestment ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Investimento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (showDeleteDialog) deleteInvestment(showDeleteDialog);
                }}
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
