'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  Landmark,
  Smartphone,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ArrowLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  LayoutGrid,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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

// ── Helpers ────────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

const typeIcons: Record<string, React.ElementType> = {
  CASH: Wallet,
  BANK: Landmark,
  DIGITAL_WALLET: Smartphone,
};

const typeLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  BANK: 'Banco',
  DIGITAL_WALLET: 'Carteira Digital',
};

const accountColors = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#ef4444', '#ec4899',
];

// ── Animation Variants ─────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const summaryContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const summaryItem = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

const txItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

const detailEntry = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ── Interfaces ─────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  _count?: { transactions: number };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  category?: { id: string; name: string; color: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

// ── Component ──────────────────────────────────────────────────────
export function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  // Form state
  const [form, setForm] = useState({
    name: '',
    type: 'CASH',
    balance: '0',
    color: '#22c55e',
    icon: 'wallet',
  });
  const [txForm, setTxForm] = useState({
    type: 'EXPENSE',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    notes: '',
  });

  // ── Data fetching ────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/transactions?accountId=${accountId}`);
      if (res.ok) setTransactions(await res.json());
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
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  // ── Computed summary data ────────────────────────────────────────
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const allTxs: Transaction[] = [];
    // We'll compute from the transactions we have for the selected detail view
    // For the summary, we need all transactions this month
    // We'll use a separate fetch for this

    const totalPatrimonio = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const accountCount = accounts.length;

    return { totalPatrimonio, accountCount };
  }, [accounts]);

  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);

  const fetchMonthlyStats = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        .toISOString()
        .split('T')[0];

      const res = await fetch(
        `/api/transactions?from=${monthStart}&to=${monthEnd}`
      );
      if (res.ok) {
        const txs: Transaction[] = await res.json();
        let income = 0;
        let expense = 0;
        for (const tx of txs) {
          if (tx.type === 'INCOME') income += tx.amount;
          else if (tx.type === 'EXPENSE') expense += tx.amount;
        }
        setMonthIncome(income);
        setMonthExpense(expense);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyStats();
  }, [fetchMonthlyStats]);

  // ── Account detail computed stats ────────────────────────────────
  const accountStats = useMemo(() => {
    if (!selectedAccount) return { income: 0, expense: 0, count: 0 };
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === 'INCOME') income += tx.amount;
      else if (tx.type === 'EXPENSE') expense += tx.amount;
    }
    return { income, expense, count: transactions.length };
  }, [selectedAccount, transactions]);

  // ── Actions ──────────────────────────────────────────────────────
  const openAccount = (acc: Account) => {
    setSelectedAccount(acc);
    fetchTransactions(acc.id);
  };

  const openNewAccount = () => {
    setEditingAccount(null);
    setForm({ name: '', type: 'CASH', balance: '0', color: '#22c55e', icon: 'wallet' });
    setShowAccountDialog(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      type: acc.type,
      balance: String(acc.balance),
      color: acc.color,
      icon: acc.icon,
    });
    setShowAccountDialog(true);
  };

  const saveAccount = async () => {
    try {
      const body = { ...form, balance: parseFloat(form.balance) || 0 };
      if (editingAccount) {
        await fetch('/api/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAccount.id, ...body }),
        });
        toast.success('Conta atualizada!');
      } else {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Conta criada!');
      }
      setShowAccountDialog(false);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao salvar conta');
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Conta excluída!');
      setShowDeleteDialog(null);
      if (selectedAccount?.id === id) setSelectedAccount(null);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao excluir conta');
    }
  };

  const saveTransaction = async () => {
    if (!selectedAccount) return;
    try {
      const body = {
        ...txForm,
        amount: parseFloat(txForm.amount),
        accountId: selectedAccount.id,
      };
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.success('Transação registrada!');
      setShowTransactionDialog(false);
      setTxForm({
        type: 'EXPENSE',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        categoryId: '',
        notes: '',
      });
      fetchTransactions(selectedAccount.id);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao registrar transação');
    }
  };

  const saveTransfer = async () => {
    try {
      const body = {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: parseFloat(transferForm.amount),
        date: transferForm.date,
        description: transferForm.description || undefined,
      };

      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro na transferência');
        return;
      }

      toast.success('Transferência realizada com sucesso!');
      setShowTransferDialog(false);
      setTransferForm({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      fetchAccounts();
      fetchMonthlyStats();
      if (selectedAccount) {
        fetchTransactions(selectedAccount.id);
      }
    } catch {
      toast.error('Erro ao realizar transferência');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Account Detail View ──────────────────────────────────────────
  if (selectedAccount) {
    const Icon = typeIcons[selectedAccount.type] || Wallet;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="detail"
          variants={detailEntry}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="space-y-6"
        >
          {/* Back button + Header */}
          <motion.div
            variants={item}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccount(null)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${selectedAccount.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: selectedAccount.color }} />
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedAccount.name}</h2>
                <Badge
                  variant="outline"
                  className="text-xs mt-0.5"
                  style={{
                    borderColor: `${selectedAccount.color}40`,
                    color: selectedAccount.color,
                  }}
                >
                  {typeLabels[selectedAccount.type]}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-2xl font-bold tracking-tight"
                style={{ color: selectedAccount.color }}
              >
                {currencyFmt(selectedAccount.balance)}
              </p>
            </div>
          </motion.div>

          {/* Account summary card */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="overflow-hidden border-0 shadow-md">
              <div
                className="h-1.5"
                style={{
                  background: `linear-gradient(90deg, ${selectedAccount.color}, ${selectedAccount.color}88)`,
                }}
              />
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Receitas
                    </p>
                    <p className="text-sm font-bold text-emerald-500 mt-0.5">
                      {currencyFmt(accountStats.income)}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-rose-500/10 flex items-center justify-center mb-2">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Despesas
                    </p>
                    <p className="text-sm font-bold text-rose-500 mt-0.5">
                      {currencyFmt(accountStats.expense)}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-violet-500/10 flex items-center justify-center mb-2">
                      <ArrowLeftRight className="w-4 h-4 text-violet-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Transações
                    </p>
                    <p className="text-sm font-bold mt-0.5">
                      {accountStats.count}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Transaction list header */}
          <motion.div
            variants={item}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <h3 className="text-base font-semibold">Transações</h3>
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
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma transação registrada</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Adicione a primeira transação nesta conta
                    </p>
                  </div>
                ) : (
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="divide-y divide-border"
                  >
                    {transactions.map((tx) => (
                      <motion.div
                        key={tx.id}
                        variants={txItem}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-default"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-110 ${
                              tx.type === 'INCOME'
                                ? 'bg-emerald-500/10'
                                : 'bg-rose-500/10'
                            }`}
                          >
                            {tx.type === 'INCOME' ? (
                              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-rose-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {tx.description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-muted-foreground">
                                {dateFmt(tx.date)}
                              </p>
                              {tx.category && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                                  style={{
                                    backgroundColor: `${tx.category.color}15`,
                                    color: tx.category.color,
                                  }}
                                >
                                  {tx.category.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-bold whitespace-nowrap ml-2 ${
                            tx.type === 'INCOME'
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}
                          {currencyFmt(tx.amount)}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* New Transaction Dialog */}
          <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
                <DialogDescription>
                  Registrar nova transação em {selectedAccount.name}
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
                      <SelectItem value="EXPENSE">Despesa</SelectItem>
                      <SelectItem value="INCOME">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={txForm.description}
                    onChange={(e) =>
                      setTxForm({ ...txForm, description: e.target.value })
                    }
                    placeholder="Ex: Salário, Almoço..."
                  />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={txForm.amount}
                    onChange={(e) =>
                      setTxForm({ ...txForm, amount: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={txForm.date}
                    onChange={(e) =>
                      setTxForm({ ...txForm, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={txForm.categoryId}
                    onValueChange={(v) =>
                      setTxForm({ ...txForm, categoryId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.type === txForm.type)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowTransactionDialog(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={saveTransaction}>Registrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Accounts List View ───────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        variants={container}
        initial="hidden"
        animate="show"
        exit="hidden"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Contas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie suas contas e saldo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransferDialog(true)}
              className="gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Transferir</span>
            </Button>
            <Button onClick={openNewAccount} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Conta</span>
            </Button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          variants={summaryContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <motion.div variants={summaryItem}>
            <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Patrimônio Total
                    </p>
                    <p className="text-2xl font-bold mt-2 tracking-tight">
                      {currencyFmt(summary.totalPatrimonio)}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <PiggyBank className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {summary.accountCount} conta{summary.accountCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={summaryItem}>
            <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
              <div className="h-1 bg-gradient-to-r from-cyan-500 to-cyan-400" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Receitas do Mês
                    </p>
                    <p className="text-2xl font-bold mt-2 tracking-tight text-emerald-500">
                      {currencyFmt(monthIncome)}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    Entradas este mês
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={summaryItem}>
            <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
              <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Despesas do Mês
                    </p>
                    <p className="text-2xl font-bold mt-2 tracking-tight text-rose-500">
                      {currencyFmt(monthExpense)}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                    <TrendingDown className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-xs text-muted-foreground">
                    Saídas este mês
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={summaryItem}>
            <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Total de Contas
                    </p>
                    <p className="text-2xl font-bold mt-2 tracking-tight">
                      {summary.accountCount}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Contas ativas
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Account Cards Grid */}
        {accounts.length === 0 ? (
          <motion.div
            variants={item}
            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Wallet className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Clique em &quot;Nova Conta&quot; para começar
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {accounts.map((acc) => {
              const Icon = typeIcons[acc.type] || Wallet;
              const txCount = acc._count?.transactions || 0;
              return (
                <motion.div
                  key={acc.id}
                  variants={item}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Card
                    className="cursor-pointer shadow-md hover:shadow-lg transition-shadow group relative overflow-hidden border-0"
                    onClick={() => openAccount(acc)}
                  >
                    <div
                      className="h-1.5"
                      style={{
                        background: `linear-gradient(90deg, ${acc.color}, ${acc.color}66)`,
                      }}
                    />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${acc.color}15` }}
                          >
                            <Icon
                              className="w-5 h-5"
                              style={{ color: acc.color }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{acc.name}</p>
                            <Badge
                              variant="outline"
                              className="text-[10px] mt-1"
                              style={{
                                borderColor: `${acc.color}30`,
                                color: acc.color,
                              }}
                            >
                              {typeLabels[acc.type]}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {txCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium"
                            >
                              {txCount} transação{txCount !== 1 ? 'ões' : ''}
                            </Badge>
                          )}
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAccount(acc);
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
                                setShowDeleteDialog(acc.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-2xl font-bold mt-4 tracking-tight">
                        {currencyFmt(acc.balance)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Account Form Dialog */}
        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? 'Atualize os dados da conta'
                  : 'Preencha os dados da nova conta'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Nubank, Carteira..."
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
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="BANK">Banco</SelectItem>
                    <SelectItem value="DIGITAL_WALLET">Carteira Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Saldo Inicial (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })}
                />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2 mt-1">
                  {accountColors.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        form.color === c
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAccountDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={saveAccount}>
                {editingAccount ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer Dialog */}
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Transferir entre Contas
              </DialogTitle>
              <DialogDescription>
                Mova dinheiro de uma conta para outra
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>De (Origem)</Label>
                <Select
                  value={transferForm.fromAccountId}
                  onValueChange={(v) =>
                    setTransferForm({ ...transferForm, fromAccountId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== transferForm.toAccountId)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: acc.color }}
                            />
                            <span>{acc.name}</span>
                            <span className="text-muted-foreground text-xs ml-1">
                              {currencyFmt(acc.balance)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Para (Destino)</Label>
                <Select
                  value={transferForm.toAccountId}
                  onValueChange={(v) =>
                    setTransferForm({ ...transferForm, toAccountId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== transferForm.fromAccountId)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: acc.color }}
                            />
                            <span>{acc.name}</span>
                            <span className="text-muted-foreground text-xs ml-1">
                              {currencyFmt(acc.balance)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={transferForm.amount}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, amount: e.target.value })
                  }
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={transferForm.date}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={transferForm.description}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Ex: Transferência para investimento"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowTransferDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={saveTransfer}
                disabled={
                  !transferForm.fromAccountId ||
                  !transferForm.toAccountId ||
                  !transferForm.amount ||
                  parseFloat(transferForm.amount) <= 0
                }
              >
                Transferir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog
          open={!!showDeleteDialog}
          onOpenChange={() => setShowDeleteDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todas as transações
                vinculadas também serão removidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  showDeleteDialog && deleteAccount(showDeleteDialog)
                }
                className="bg-destructive text-white hover:bg-destructive/90"
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
