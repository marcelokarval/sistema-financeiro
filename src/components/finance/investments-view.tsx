'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  DollarSign,
  BarChart3,
  Gift,
  Building2,
  Bitcoin,
  Landmark,
  BadgeDollarSign,
  Receipt,
  RefreshCw,
  CircleDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogClose,
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
} from '@/lib/helpers';
import { purchaseDateForInput } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';

// ── Constants ───────────────────────────────────────────────────────

const investmentTypes: Record<string, { label: string; icon: React.ElementType }> = {
  STOCK:    { label: 'Ações',          icon: TrendingUp },
  BOND:     { label: 'Renda Fixa',     icon: Landmark },
  FII:      { label: 'FIIs',           icon: Building2 },
  CDB:      { label: 'CDB',            icon: BadgeDollarSign },
  LCI:      { label: 'LCI',            icon: CircleDollarSign },
  LCA:      { label: 'LCA',            icon: CircleDollarSign },
  TESOURO:  { label: 'Tesouro Direto', icon: BarChart3 },
  CRYPTO:   { label: 'Cripto',         icon: Bitcoin },
  ETF:      { label: 'ETF',            icon: RefreshCw },
  OTHER:    { label: 'Outro',          icon: Wallet },
};

const transactionTypes: Record<string, { label: string; icon: React.ElementType }> = {
  APORTE:         { label: 'Aporte',         icon: Plus },
  DIVIDENDO:      { label: 'Dividendo',      icon: Gift },
  VENDA:          { label: 'Venda',          icon: ArrowDownRight },
  REINVESTIMENTO: { label: 'Reinvestimento',  icon: RefreshCw },
  TAXA:           { label: 'Taxa',           icon: Receipt },
  BONUS:          { label: 'Bônus',          icon: DollarSign },
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
  const [history, setHistory] = useState<
    { phase: 'loading' | 'error' } | { phase: 'ready'; transactions: InvestmentTransaction[] }
  >({ phase: 'loading' });
  const historyRequest = useRef(0);
  const activeInvestmentId = useRef<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const selectedInvestment = investments.find((investment) => investment.id === selectedInvestmentId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dividendEntries, setDividendEntries] = useState<{ investmentId?: string; type: string; amount: number }[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  // Dialogs
  const [showInvestmentDialog, setShowInvestmentDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [savingInvestment, setSavingInvestment] = useState(false);
  const saveInvestmentInFlight = useRef(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const saveTransactionInFlight = useRef(false);
  const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<InvestmentTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const deleteTxInFlight = useRef(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteInFlight = useRef(false);
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
    setLoadError(false);
    try {
      const res = await fetch('/api/investments');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setInvestments(await res.json());
    } catch (e) {
      setLoadError(true);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDividends = useCallback(async () => {
    try {
      const res = await fetch('/api/investments/transactions');
      if (!res.ok) return;
      const allTxs: { investmentId?: string; type: string; amount: number }[] = await res.json();
      setDividendEntries(allTxs.filter((tx) => tx.type === 'DIVIDENDO'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTransactions = useCallback(async (investmentId: string) => {
    if (activeInvestmentId.current !== investmentId) return;
    const requestId = ++historyRequest.current;
    setHistory({ phase: 'loading' });
    try {
      const res = await fetch(`/api/investments/transactions?investmentId=${investmentId}`);
      if (!res.ok) throw new Error('Falha ao consultar transações');
      const transactions: InvestmentTransaction[] = await res.json();
      if (requestId === historyRequest.current) setHistory({ phase: 'ready', transactions });
    } catch {
      if (requestId === historyRequest.current) setHistory({ phase: 'error' });
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
    fetchDividends();
    fetchAccounts();
    fetchCategories();
  }, [fetchInvestments, fetchDividends, fetchAccounts, fetchCategories]);

  useEffect(() => {
    const syncSelection = () => {
      const targetId = useAppStore.getState().selectedInvestmentId;
      if (!targetId || loading) return;
      const target = investments.find((inv) => inv.id === targetId);
      if (target) {
        activeInvestmentId.current = target.id;
        setSelectedInvestmentId(target.id);
        void fetchTransactions(target.id);
      }
      useAppStore.getState().setSelectedInvestmentId(null);
    };
    syncSelection();
    return useAppStore.subscribe(syncSelection);
  }, [fetchTransactions, investments, loading]);

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
    const dividendsReceived = dividendEntries.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    return { totalInvested, currentTotal, rentabilidade, dividendsReceived };
  }, [investments, dividendEntries]);

  const investmentStats = useMemo(() => {
    if (history.phase !== 'ready') return null;
    const { transactions } = history;
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
  }, [history]);

  // ── Actions ──────────────────────────────────────────────────────

  const openInvestmentDetail = (inv: Investment) => {
    activeInvestmentId.current = inv.id;
    setSelectedInvestmentId(inv.id);
    void fetchTransactions(inv.id);
  };

  const closeInvestmentDetail = () => {
    activeInvestmentId.current = null;
    historyRequest.current++;
    setSelectedInvestmentId(null);
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
    if (!form.name.trim()) {
      toast.error('Informe o nome do investimento');
      return;
    }
    if (saveInvestmentInFlight.current) return;
    saveInvestmentInFlight.current = true;
    setSavingInvestment(true);
    try {
      const body = {
        ...form,
        name: form.name.trim(),
        investedAmount: parseFloat(form.investedAmount) || 0,
        yieldRate: parseFloat(form.yieldRate) || 0,
        accountId: form.accountId || undefined,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
        brokerage: form.brokerage || undefined,
        ticker: form.ticker || undefined,
      };
      if (editingInvestment) {
        const res = await fetch('/api/investments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingInvestment.id, ...body }),
        });
        if (!res.ok) throw new Error('Falha ao atualizar investimento');
        toast.success('Investimento atualizado!');
      } else {
        const res = await fetch('/api/investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Falha ao criar investimento');
        toast.success('Investimento criado!');
      }
      setShowInvestmentDialog(false);
      fetchInvestments();
      if (editingInvestment) void fetchTransactions(editingInvestment.id);
    } catch {
      toast.error('Erro ao salvar investimento');
    } finally {
      saveInvestmentInFlight.current = false;
      setSavingInvestment(false);
    }
  };

  const deleteInvestment = async (id: string) => {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleting(true);
    try {
      const res = await fetch('/api/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Falha ao excluir investimento');
      toast.success('Investimento excluído!');
      prepareDeleteFocus();
      setShowDeleteDialog(null);
      setDividendEntries((entries) => entries.filter((entry) => entry.investmentId !== id));
      if (activeInvestmentId.current === id) closeInvestmentDetail();
      fetchInvestments();
    } catch {
      toast.error('Erro ao excluir investimento');
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const saveTransaction = async () => {
    if (!selectedInvestment) return;
    const parsedAmount = parseFloat(txForm.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor maior que zero');
      return;
    }
    if (saveTransactionInFlight.current) return;
    saveTransactionInFlight.current = true;
    setSavingTransaction(true);
    try {
      const body = {
        ...txForm,
        amount: parsedAmount,
        quantity: txForm.quantity ? parseFloat(txForm.quantity) : null,
        unitPrice: txForm.unitPrice ? parseFloat(txForm.unitPrice) : null,
        investmentId: selectedInvestment.id,
        description: txForm.description || undefined,
        notes: txForm.notes || undefined,
      };
      if (editingTransaction) {
        const res = await fetch('/api/investments/transactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTransaction.id, ...body }),
        });
        if (!res.ok) throw new Error('Falha ao atualizar transação');
        toast.success('Transação atualizada!');
        if (editingTransaction.type === 'DIVIDENDO' || txForm.type === 'DIVIDENDO') {
          void fetchDividends();
        }
      } else {
        const res = await fetch('/api/investments/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Falha ao registrar transação');
        toast.success('Transação registrada!');
        if (txForm.type === 'DIVIDENDO') {
          setDividendEntries((entries) => [...entries, { investmentId: selectedInvestment.id, type: 'DIVIDENDO', amount: parsedAmount }]);
        }
      }
      setEditingTransaction(null);
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
      toast.error(editingTransaction ? 'Erro ao atualizar transação' : 'Erro ao registrar transação');
    } finally {
      saveTransactionInFlight.current = false;
      setSavingTransaction(false);
    }
  };

  const deleteTransaction = async (tx: InvestmentTransaction) => {
    if (!selectedInvestment || deleteTxInFlight.current) return;
    deleteTxInFlight.current = true;
    setDeletingTx(true);
    try {
      const res = await fetch(`/api/investments/transactions?id=${encodeURIComponent(tx.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tx.id }),
      });
      if (!res.ok) throw new Error('Falha ao excluir transação');
      toast.success('Transação excluída!');
      setDeletingTransaction(null);
      if (tx.type === 'DIVIDENDO') {
        void fetchDividends();
      }
      fetchTransactions(selectedInvestment.id);
      fetchInvestments();
    } catch {
      toast.error('Erro ao excluir transação');
    } finally {
      deleteTxInFlight.current = false;
      setDeletingTx(false);
    }
  };

  const focusListAfterDelete = useRef(false);
  const detailOrigin = useRef<string | null>(null);
  const isShowingDetail = selectedInvestment !== undefined;
  useLayoutEffect(() => {
    if (isShowingDetail) {
      document.getElementById('investment-detail-title')?.focus();
      return;
    }
    if (focusListAfterDelete.current) {
      focusListAfterDelete.current = false;
      detailOrigin.current = null;
      document.getElementById('investments-title')?.focus();
      return;
    }
    const origin = detailOrigin.current;
    if (origin) {
      detailOrigin.current = null;
      const row = document.getElementById(origin);
      if (row) row.focus();
      else document.getElementById('investments-title')?.focus();
    }
  }, [isShowingDetail]);

  const dialogOrigin = useRef<HTMLElement | null>(null);
  const rememberDialogOrigin = (trigger: HTMLButtonElement, open: () => void) => {
    dialogOrigin.current = trigger;
    open();
  };
  const openTransactionDialog = (event: MouseEvent<HTMLButtonElement>) => {
    setEditingTransaction(null);
    setTxForm({
      type: 'APORTE',
      amount: '',
      quantity: '',
      unitPrice: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    });
    rememberDialogOrigin(event.currentTarget, () => setShowTransactionDialog(true));
  };
  const openEditTransaction = (tx: InvestmentTransaction, event: MouseEvent<HTMLButtonElement>) => {
    setEditingTransaction(tx);
    setTxForm({
      type: tx.type,
      amount: String(tx.amount),
      quantity: tx.quantity != null ? String(tx.quantity) : '',
      unitPrice: tx.unitPrice != null ? String(tx.unitPrice) : '',
      date: purchaseDateForInput(tx.date),
      description: tx.description || '',
      notes: tx.notes || '',
    });
    rememberDialogOrigin(event.currentTarget, () => setShowTransactionDialog(true));
  };
  const prepareDeleteFocus = () => {
    dialogOrigin.current = null;
    focusListAfterDelete.current = isShowingDetail;
  };
  const restoreDialogFocus = (event: Event) => {
    event.preventDefault();
    const origin = dialogOrigin.current;
    if (origin?.isConnected) origin.focus();
    else (document.getElementById('investments-title') ?? document.getElementById('investment-detail-title'))?.focus();
  };

  if (loading) {
    return (
      <section className="space-y-4" aria-labelledby="investments-title">
        <h2 id="investments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">Investimentos</h2>
        <div role="status" className="space-y-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p>Carregando investimentos…</p>
          <Skeleton aria-hidden="true" className="h-20 rounded-lg motion-reduce:animate-none" />
          <Skeleton aria-hidden="true" className="h-32 rounded-lg motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  if (selectedInvestment) {
    const invType = investmentTypes[selectedInvestment.type] || investmentTypes.OTHER;
    const yieldPct = selectedInvestment.investedAmount > 0
      ? ((selectedInvestment.currentBalance - selectedInvestment.investedAmount) / selectedInvestment.investedAmount) * 100
      : 0;
    const isPositive = yieldPct >= 0;

    return (
      <section className="min-w-0 space-y-5" aria-labelledby="investment-detail-title">
        <Button variant="ghost" size="sm" onClick={closeInvestmentDetail}><ArrowLeft aria-hidden="true" /> Voltar aos investimentos</Button>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="investment-detail-title" tabIndex={-1} className="break-words text-xl font-semibold tracking-tight">{selectedInvestment.name}</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {invType.label}{selectedInvestment.ticker && ` · ${selectedInvestment.ticker}`}{selectedInvestment.brokerage && ` · ${selectedInvestment.brokerage}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={(event) => rememberDialogOrigin(event.currentTarget, () => openEditInvestment(selectedInvestment))}><Pencil aria-hidden="true" /> Editar investimento</Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={(event) => rememberDialogOrigin(event.currentTarget, () => setShowDeleteDialog(selectedInvestment.id))}><Trash2 aria-hidden="true" /> Excluir investimento</Button>
          </div>
        </header>
        <InvestmentMetrics label="Posição do investimento" metrics={[
          { label: 'Valor atual', value: currencyFmt(selectedInvestment.currentBalance), note: `${isPositive ? 'Rentabilidade' : 'Queda'} de ${percentFmt(yieldPct)} sobre o valor investido` },
          { label: 'Valor investido', value: currencyFmt(selectedInvestment.investedAmount) },
          { label: 'Lucro ou prejuízo', value: `${isPositive ? '+' : ''}${currencyFmt(selectedInvestment.currentBalance - selectedInvestment.investedAmount)}` },
        ]} />
        {history.phase === 'ready' && investmentStats ? (
          <>
            <InvestmentMetrics label="Resumo das transações" metrics={[
              { label: 'Total de aportes', value: currencyFmt(investmentStats.totalAportes) },
              { label: 'Dividendos', value: currencyFmt(investmentStats.totalDividendos) },
              { label: 'Transações', value: String(investmentStats.txCount) },
            ]} />
            <InvestmentEntries
              transactions={history.transactions}
              onNew={openTransactionDialog}
              onEdit={openEditTransaction}
              onDelete={(tx, event) => rememberDialogOrigin(event.currentTarget, () => setDeletingTransaction(tx))}
            />
          </>
        ) : (
          <section aria-labelledby="investment-history-title" className="space-y-3">
            <InvestmentHistoryHeader onNew={openTransactionDialog} />
            {history.phase === 'error' ? (
              <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">Não foi possível carregar o histórico de transações.</p>
            ) : (
              <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Carregando histórico de transações…</p>
            )}
      </section>
        )}

          {/* Add/Edit Transaction Dialog */}
          <Dialog open={showTransactionDialog} onOpenChange={(open) => { if (!open) { setShowTransactionDialog(false); setEditingTransaction(null); } }}>
            <DialogContent showCloseButton={false} onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <DialogHeader className="relative pr-10 text-left">
                <DialogClose asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label="Fechar formulário" className="absolute right-0 top-0">
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
                <DialogTitle>{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
                <DialogDescription>
                  {editingTransaction
                    ? `Atualizar transação em ${selectedInvestment.name}`
                    : `Registrar nova transação em ${selectedInvestment.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="investment-tx-type">Tipo</Label>
                  <Select
                    value={txForm.type}
                    onValueChange={(v) => setTxForm({ ...txForm, type: v })}
                  >
                    <SelectTrigger id="investment-tx-type">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="investment-tx-amount">Valor (R$)</Label>
                    <Input id="investment-tx-amount"
                      type="number"
                      step="0.01"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-tx-date">Data</Label>
                    <Input id="investment-tx-date"
                      type="date"
                      value={txForm.date}
                      onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="investment-tx-quantity">Quantidade</Label>
                    <Input id="investment-tx-quantity"
                      type="number"
                      step="0.01"
                      value={txForm.quantity}
                      onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-tx-unitPrice">Preço Unitário (R$)</Label>
                    <Input id="investment-tx-unitPrice"
                      type="number"
                      step="0.01"
                      value={txForm.unitPrice}
                      onChange={(e) => setTxForm({ ...txForm, unitPrice: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="investment-tx-description">Descrição</Label>
                  <Input id="investment-tx-description"
                    value={txForm.description}
                    onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                    placeholder="Ex: Compra de cotas, Dividendo mensal..."
                  />
                </div>
                <div>
                  <Label htmlFor="investment-tx-notes">Observações</Label>
                  <Input id="investment-tx-notes"
                    value={txForm.notes}
                    onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                    placeholder="Notas adicionais (opcional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowTransactionDialog(false); setEditingTransaction(null); }}>
                  Cancelar
                </Button>
                <Button disabled={savingTransaction} onClick={saveTransaction}>
                  {savingTransaction ? 'Salvando…' : editingTransaction ? 'Salvar' : 'Registrar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Investment Dialog (detail view) */}
          <Dialog open={showInvestmentDialog} onOpenChange={setShowInvestmentDialog}>
            <DialogContent showCloseButton={false} onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <DialogHeader className="relative pr-10 text-left">
                <DialogClose asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label="Fechar formulário" className="absolute right-0 top-0">
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
                <DialogTitle>Editar Investimento</DialogTitle>
                <DialogDescription>Atualize os dados do investimento</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="investment-form-name">Nome</Label>
                  <Input id="investment-form-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: PETR4, Tesouro IPCA..."
                  />
                </div>
                <div>
                  <Label htmlFor="investment-form-type">Tipo</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger id="investment-form-type">
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
                  <Label htmlFor="investment-form-description">Descrição</Label>
                  <Input id="investment-form-description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="investment-form-investedAmount">Valor Investido (R$)</Label>
                    <Input id="investment-form-investedAmount"
                      type="number"
                      step="0.01"
                      value={form.investedAmount}
                      onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-form-yieldRate">Rentabilidade (%)</Label>
                    <Input id="investment-form-yieldRate"
                      type="number"
                      step="0.01"
                      value={form.yieldRate}
                      onChange={(e) => setForm({ ...form, yieldRate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="investment-form-brokerage">Corretora</Label>
                    <Input id="investment-form-brokerage"
                      value={form.brokerage}
                      onChange={(e) => setForm({ ...form, brokerage: e.target.value })}
                      placeholder="Ex: XP, Rico..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-form-ticker">Ticker</Label>
                    <Input id="investment-form-ticker"
                      value={form.ticker}
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                      placeholder="Ex: PETR4, MXRF11..."
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="investment-form-accountId">Conta</Label>
                  <Select
                    value={form.accountId}
                    onValueChange={(v) => setForm({ ...form, accountId: v })}
                  >
                    <SelectTrigger id="investment-form-accountId">
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
                  <Label htmlFor="investment-form-categoryId">Categoria</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm({ ...form, categoryId: v })}
                  >
                    <SelectTrigger id="investment-form-categoryId">
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
                <Button disabled={savingInvestment} onClick={saveInvestment}>{savingInvestment ? 'Salvando…' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open && !deleteInFlight.current) setShowDeleteDialog(null); }}>
            <AlertDialogContent onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Investimento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{selectedInvestment.name}</strong>? Esta ação não pode ser desfeita e todas as transações associadas serão perdidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={(event) => {
                    event.preventDefault();
                    return deleteInvestment(selectedInvestment.id);
                  }}
                  className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Delete Transaction Confirmation */}
          <AlertDialog open={!!deletingTransaction} onOpenChange={(open) => { if (!open && !deleteTxInFlight.current) setDeletingTransaction(null); }}>
            <AlertDialogContent onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir esta transação de <strong>{selectedInvestment.name}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingTx}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deletingTx}
                  onClick={(event) => {
                    event.preventDefault();
                    if (deletingTransaction) return deleteTransaction(deletingTransaction);
                  }}
                  className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </section>
    );
  }

  return (
    <>
      <InvestmentPortfolio summary={summary} count={investments.length} records={filteredInvestments} filter={activeFilter} loadError={loadError} onRetry={() => { setLoading(true); void fetchInvestments(); void fetchDividends(); }}
        onFilter={setActiveFilter} onNew={(event) => rememberDialogOrigin(event.currentTarget, openNewInvestment)} onOpen={(investment) => {
          detailOrigin.current = `investment-row-${investment.id}`;
          openInvestmentDetail(investment);
        }} onEdit={(investment, event) => rememberDialogOrigin(event.currentTarget, () => openEditInvestment(investment))}
        onDelete={(id, event) => rememberDialogOrigin(event.currentTarget, () => setShowDeleteDialog(id))} />

        {/* Create/Edit Investment Dialog */}
        <Dialog open={showInvestmentDialog} onOpenChange={setShowInvestmentDialog}>
          <DialogContent showCloseButton={false} onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader className="relative pr-10 text-left">
              <DialogClose asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Fechar formulário" className="absolute right-0 top-0">
                  <X aria-hidden="true" />
                </Button>
              </DialogClose>
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
                <Label htmlFor="investment-form-name">Nome</Label>
                <Input id="investment-form-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: PETR4, Tesouro IPCA, MXRF11..."
                />
              </div>
              <div>
                <Label htmlFor="investment-form-type">Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger id="investment-form-type">
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
                <Label htmlFor="investment-form-description">Descrição</Label>
                <Input id="investment-form-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição opcional do investimento"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="investment-form-investedAmount">Valor Investido (R$)</Label>
                  <Input id="investment-form-investedAmount"
                    type="number"
                    step="0.01"
                    value={form.investedAmount}
                    onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="investment-form-yieldRate">Rentabilidade (%)</Label>
                  <Input id="investment-form-yieldRate"
                    type="number"
                    step="0.01"
                    value={form.yieldRate}
                    onChange={(e) => setForm({ ...form, yieldRate: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="investment-form-brokerage">Corretora</Label>
                  <Input id="investment-form-brokerage"
                    value={form.brokerage}
                    onChange={(e) => setForm({ ...form, brokerage: e.target.value })}
                    placeholder="Ex: XP, Rico, Clear..."
                  />
                </div>
                <div>
                  <Label htmlFor="investment-form-ticker">Ticker</Label>
                  <Input id="investment-form-ticker"
                    value={form.ticker}
                    onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                    placeholder="Ex: PETR4, MXRF11..."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="investment-form-accountId">Conta</Label>
                <Select
                  value={form.accountId}
                  onValueChange={(v) => setForm({ ...form, accountId: v })}
                >
                  <SelectTrigger id="investment-form-accountId">
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
                <Label htmlFor="investment-form-categoryId">Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger id="investment-form-categoryId">
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
              <Button disabled={savingInvestment} onClick={saveInvestment}>
                {savingInvestment ? 'Salvando…' : editingInvestment ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open && !deleteInFlight.current) setShowDeleteDialog(null); }}>
          <AlertDialogContent onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Investimento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  if (showDeleteDialog) return deleteInvestment(showDeleteDialog);
                }}
                className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}

function InvestmentMetrics({ label, metrics }: { label: string; metrics: { label: string; value: string; note?: string }[] }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-lg border bg-card p-4 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {metrics.map((metric, index) => (
        <div key={metric.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className={`mt-1 break-words font-mono font-semibold tabular-nums ${index === 0 ? 'text-xl' : 'text-base'}`}>{metric.value}</dd>
          {metric.note && <dd className="mt-1 text-xs text-muted-foreground">{metric.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function InvestmentPortfolio({ summary, count, records, filter, loadError, onRetry, onFilter, onNew, onOpen, onEdit, onDelete }: {
  summary: { totalInvested: number; currentTotal: number; rentabilidade: number; dividendsReceived: number };
  count: number; records: Investment[]; filter: string; loadError?: boolean; onRetry?: () => void; onFilter: (value: string) => void; onNew: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (investment: Investment) => void; onEdit: (investment: Investment, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="investments-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="investments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">Investimentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Posição e movimentações da carteira</p>
        </div>
        <Button onClick={onNew} size="sm"><Plus aria-hidden="true" /> Novo investimento</Button>
      </header>
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
          <p className="text-destructive">Não foi possível carregar os investimentos.</p>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
        </div>
      )}
      <InvestmentMetrics label="Resumo da carteira" metrics={[
        { label: 'Valor atual', value: currencyFmt(summary.currentTotal), note: 'Soma dos saldos atuais' },
        { label: 'Total investido', value: currencyFmt(summary.totalInvested), note: `${count} investimento${count !== 1 ? 's' : ''}` },
        { label: 'Rentabilidade total', value: percentFmt(summary.rentabilidade), note: summary.rentabilidade >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado' },
        { label: 'Dividendos recebidos', value: currencyFmt(summary.dividendsReceived), note: 'Consulte o histórico de cada investimento' },
      ]} />
      <section aria-labelledby="investment-records-title" className="space-y-3">
        <h3 id="investment-records-title" className="font-semibold">Carteira</h3>
        <Tabs value={filter} onValueChange={onFilter}>
          <TabsList aria-label="Filtrar investimentos por tipo" className="h-auto max-w-full flex-wrap justify-start gap-1 border bg-card">
            {filterTabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">{tab.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {records.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{filter === 'all' ? 'Nenhum investimento cadastrado. Use “Novo investimento” para começar.' : 'Nenhum investimento neste filtro. Escolha outro tipo.'}</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {records.map((inv) => {
              const type = investmentTypes[inv.type] || investmentTypes.OTHER;
              const yieldPct = inv.investedAmount > 0 ? ((inv.currentBalance - inv.investedAmount) / inv.investedAmount) * 100 : 0;
              return (
                <li key={inv.id} className="grid min-w-0 gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <button type="button" id={`investment-row-${inv.id}`} onClick={() => onOpen(inv)} aria-label={`Abrir investimento: ${inv.name}`} className="grid min-w-0 gap-2 rounded-md p-2 text-left hover:bg-accent md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                    <span className="flex min-w-0 items-start gap-2">
                      <type.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{inv.name}</span>
                        <span className="block break-words text-xs text-muted-foreground">{type.label}{inv.ticker && ` · ${inv.ticker}`}{inv.brokerage && ` · ${inv.brokerage}`}</span>
                      </span>
                    </span>
                    <span className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0">Investido<span className="block break-words font-mono tabular-nums text-foreground">{currencyFmt(inv.investedAmount)}</span></span>
                      <span className="min-w-0">Atual<span className="block break-words font-mono font-semibold tabular-nums text-foreground">{currencyFmt(inv.currentBalance)}</span><span className="block">{percentFmt(yieldPct)}</span></span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1 px-2 md:px-0">
                    <Button size="icon" variant="ghost" aria-label={`Editar investimento: ${inv.name}`} onClick={(event) => onEdit(inv, event)}><Pencil aria-hidden="true" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Excluir investimento: ${inv.name}`} className="text-destructive" onClick={(event) => onDelete(inv.id, event)}><Trash2 aria-hidden="true" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

function InvestmentHistoryHeader({ onNew }: { onNew: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="investment-history-title" className="font-semibold">Histórico de transações</h3>
      <Button size="sm" onClick={onNew}><Plus aria-hidden="true" /> Nova transação</Button>
    </header>
  );
}

export function InvestmentEntries({ transactions, onNew, onEdit, onDelete }: {
  transactions: InvestmentTransaction[];
  onNew: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit?: (tx: InvestmentTransaction, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: (tx: InvestmentTransaction, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section aria-labelledby="investment-history-title" className="space-y-3">
      <InvestmentHistoryHeader onNew={onNew} />
      {transactions.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Nenhuma transação registrada neste investimento.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {transactions.map((tx) => {
            const type = transactionTypes[tx.type] || transactionTypes.APORTE;
            const isCredit = ['APORTE', 'DIVIDENDO', 'REINVESTIMENTO', 'BONUS'].includes(tx.type);
            const txTitle = tx.description || type.label;
            return (
              <li key={tx.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-2">
                  <type.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-medium">{txTitle}</p>
                    <p className="break-words text-xs text-muted-foreground">{dateFmt(tx.date)} · {type.label}{tx.quantity && tx.unitPrice ? ` · ${tx.quantity} × ${currencyFmt(tx.unitPrice)}` : null}</p>
                    {tx.notes && <p className="break-words text-xs text-muted-foreground">{tx.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-1 break-words font-mono text-sm font-semibold tabular-nums">{isCredit ? '+' : '-'}{currencyFmt(tx.amount)}</span>
                  {onEdit && (
                    <Button size="icon" variant="ghost" aria-label={`Editar transação: ${txTitle}`} onClick={(event) => onEdit(tx, event)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button size="icon" variant="ghost" aria-label={`Excluir transação: ${txTitle}`} className="text-destructive hover:text-destructive" onClick={(event) => onDelete(tx, event)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
