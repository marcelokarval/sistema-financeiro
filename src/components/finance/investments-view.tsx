'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

import {
  currencyFmt,
  percentFmt,
  dateFmt,
} from '@/lib/helpers';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { purchaseDateForInput } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import {
  INVESTMENT_FILTER_TABS,
  INVESTMENT_TX_META,
  INVESTMENT_TYPE_META,
} from './portfolio-i18n';
import { InvestmentDeleteConfirmation } from './investment-delete-confirmation';
import { InvestmentEditor, type InvestmentDraft } from './investment-editor';
import { InvestmentEntryEditor, type InvestmentEntryDraft } from './investment-entry-editor';

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
  const t = useSafeTranslations('investments');
  const locale = useSafeLocale();
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
  const [dividendLoadError, setDividendLoadError] = useState(false);
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
  const [form, setForm] = useState<InvestmentDraft>({
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
  const [txForm, setTxForm] = useState<InvestmentEntryDraft>({
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
    setDividendLoadError(false);
    try {
      const res = await fetch('/api/investments/transactions');
      if (!res.ok) {
        setDividendEntries([]);
        setDividendLoadError(true);
        return;
      }
      const allTxs: { investmentId?: string; type: string; amount: number }[] = await res.json();
      setDividendEntries(allTxs.filter((tx) => tx.type === 'DIVIDENDO'));
    } catch (e) {
      setDividendEntries([]);
      setDividendLoadError(true);
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

  const changeInvestmentField = (field: keyof InvestmentDraft, value: string) => {
    setForm((draft) => ({ ...draft, [field]: value }));
  };

  const saveInvestment = async () => {
    if (!form.name.trim()) {
      toast.error(t('errors.nameRequired'));
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
        toast.success(t('toast.updated'));
      } else {
        const res = await fetch('/api/investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Falha ao criar investimento');
        toast.success(t('toast.created'));
      }
      setShowInvestmentDialog(false);
      fetchInvestments();
      if (editingInvestment) void fetchTransactions(editingInvestment.id);
    } catch {
      toast.error(t('errors.saveInvestment'));
    } finally {
      saveInvestmentInFlight.current = false;
      setSavingInvestment(false);
    }
  };

  const changeDeleteConfirmation = (open: boolean) => {
    if (!open && !deleteInFlight.current) setShowDeleteDialog(null);
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
      toast.success(t('toast.deleted'));
      prepareDeleteFocus();
      setShowDeleteDialog(null);
      setDividendEntries((entries) => entries.filter((entry) => entry.investmentId !== id));
      if (activeInvestmentId.current === id) closeInvestmentDetail();
      fetchInvestments();
    } catch {
      toast.error(t('errors.deleteInvestment'));
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const changeTxField = (field: keyof InvestmentEntryDraft, value: string) => {
    setTxForm((draft) => ({ ...draft, [field]: value }));
  };

  const saveTransaction = async () => {
    if (!selectedInvestment) return;
    const parsedAmount = parseFloat(txForm.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('errors.amountPositive'));
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
        toast.success(t('toast.txUpdated'));
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
        toast.success(t('toast.txCreated'));
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
      toast.error(editingTransaction ? t('errors.updateTransaction') : t('errors.createTransaction'));
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
      toast.success(t('toast.txDeleted'));
      setDeletingTransaction(null);
      if (tx.type === 'DIVIDENDO') {
        void fetchDividends();
      }
      fetchTransactions(selectedInvestment.id);
      fetchInvestments();
    } catch {
      toast.error(t('errors.deleteTransaction'));
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
        <h2 id="investments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">{t('title')}</h2>
        <div role="status" className="space-y-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p>{t('loading')}</p>
          <Skeleton aria-hidden="true" className="h-20 rounded-lg motion-reduce:animate-none" />
          <Skeleton aria-hidden="true" className="h-32 rounded-lg motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  if (selectedInvestment) {
    const invType = INVESTMENT_TYPE_META[selectedInvestment.type] || INVESTMENT_TYPE_META.OTHER;
    const yieldPct = selectedInvestment.investedAmount > 0
      ? ((selectedInvestment.currentBalance - selectedInvestment.investedAmount) / selectedInvestment.investedAmount) * 100
      : 0;
    const isPositive = yieldPct >= 0;

    return (
      <section className="min-w-0 space-y-5" aria-labelledby="investment-detail-title">
        <Button variant="ghost" size="sm" onClick={closeInvestmentDetail}><ArrowLeft aria-hidden="true" /> {t('actions.backToPortfolio')}</Button>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="investment-detail-title" tabIndex={-1} className="break-words text-xl font-semibold tracking-tight">{selectedInvestment.name}</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {t(invType.labelKey)}{selectedInvestment.ticker && ` · ${selectedInvestment.ticker}`}{selectedInvestment.brokerage && ` · ${selectedInvestment.brokerage}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={(event) => rememberDialogOrigin(event.currentTarget, () => openEditInvestment(selectedInvestment))}><Pencil aria-hidden="true" /> {t('actions.editInvestment')}</Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={(event) => rememberDialogOrigin(event.currentTarget, () => setShowDeleteDialog(selectedInvestment.id))}><Trash2 aria-hidden="true" /> {t('actions.deleteInvestment')}</Button>
          </div>
        </header>
        <InvestmentMetrics label={t('detail.positionAriaLabel')} metrics={[
          {
            label: t('detail.currentValue'),
            value: currencyFmt(selectedInvestment.currentBalance, locale),
            note: isPositive
              ? t('detail.yieldPositive', { percent: percentFmt(yieldPct, locale) })
              : t('detail.yieldNegative', { percent: percentFmt(yieldPct, locale) }),
          },
          { label: t('detail.investedValue'), value: currencyFmt(selectedInvestment.investedAmount, locale) },
          { label: t('detail.profitOrLoss'), value: `${isPositive ? '+' : ''}${currencyFmt(selectedInvestment.currentBalance - selectedInvestment.investedAmount, locale)}` },
        ]} />
        {history.phase === 'ready' && investmentStats ? (
          <>
            <InvestmentMetrics label={t('detail.txSummaryAriaLabel')} metrics={[
              { label: t('detail.totalContributions'), value: currencyFmt(investmentStats.totalAportes, locale) },
              { label: t('detail.dividends'), value: currencyFmt(investmentStats.totalDividendos, locale) },
              { label: t('detail.transactions'), value: String(investmentStats.txCount) },
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
              <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">{t('errors.loadHistory')}</p>
            ) : (
              <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{t('loadingHistory')}</p>
            )}
      </section>
        )}

          <InvestmentEntryEditor
            mode={editingTransaction ? 'edit' : 'create'}
            open={showTransactionDialog}
            saving={savingTransaction}
            investmentName={selectedInvestment.name}
            form={txForm}
            onFieldChange={changeTxField}
            onOpenChange={(open) => {
              if (!open) {
                setShowTransactionDialog(false);
                setEditingTransaction(null);
              }
            }}
            onCloseAutoFocus={restoreDialogFocus}
            onSave={saveTransaction}
          />

          <InvestmentEditor
            mode="edit-detail"
            open={showInvestmentDialog}
            saving={savingInvestment}
            form={form}
            accounts={accounts}
            categories={categories}
            onFieldChange={changeInvestmentField}
            onOpenChange={setShowInvestmentDialog}
            onCloseAutoFocus={restoreDialogFocus}
            onSave={saveInvestment}
          />

          <InvestmentDeleteConfirmation
            open={!!showDeleteDialog}
            investmentName={selectedInvestment.name}
            deleting={deleting}
            onOpenChange={changeDeleteConfirmation}
            onCloseAutoFocus={restoreDialogFocus}
            onConfirm={() => deleteInvestment(selectedInvestment.id)}
          />
          {/* Delete Transaction Confirmation */}
          <AlertDialog open={!!deletingTransaction} onOpenChange={(open) => { if (!open && !deleteTxInFlight.current) setDeletingTransaction(null); }}>
            <AlertDialogContent onCloseAutoFocus={restoreDialogFocus} className="motion-reduce:animate-none">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteTx.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.rich('deleteTx.description', {
                    name: selectedInvestment.name,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingTx}>{t('deleteTx.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deletingTx}
                  onClick={(event) => {
                    event.preventDefault();
                    if (deletingTransaction) return deleteTransaction(deletingTransaction);
                  }}
                  className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
                >
                  {t('deleteTx.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </section>
    );
  }

  return (
    <>
      <InvestmentPortfolio summary={summary} count={investments.length} records={filteredInvestments} filter={activeFilter} loadError={loadError} dividendLoadError={dividendLoadError} onRetry={() => { setLoading(true); void fetchInvestments(); void fetchDividends(); }} onRetryDividends={() => { void fetchDividends(); }}
        onFilter={setActiveFilter} onNew={(event) => rememberDialogOrigin(event.currentTarget, openNewInvestment)} onOpen={(investment) => {
          detailOrigin.current = `investment-row-${investment.id}`;
          openInvestmentDetail(investment);
        }} onEdit={(investment, event) => rememberDialogOrigin(event.currentTarget, () => openEditInvestment(investment))}
        onDelete={(id, event) => rememberDialogOrigin(event.currentTarget, () => setShowDeleteDialog(id))} />

      <InvestmentEditor
        mode={editingInvestment ? 'edit-portfolio' : 'create'}
        open={showInvestmentDialog}
        saving={savingInvestment}
        form={form}
        accounts={accounts}
        categories={categories}
        onFieldChange={changeInvestmentField}
        onOpenChange={setShowInvestmentDialog}
        onCloseAutoFocus={restoreDialogFocus}
        onSave={saveInvestment}
      />

      <InvestmentDeleteConfirmation
        open={!!showDeleteDialog}
        deleting={deleting}
        onOpenChange={changeDeleteConfirmation}
        onCloseAutoFocus={restoreDialogFocus}
        onConfirm={() => showDeleteDialog ? deleteInvestment(showDeleteDialog) : undefined}
      />
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

export function InvestmentPortfolio({ summary, count, records, filter, loadError, dividendLoadError, onRetry, onRetryDividends, onFilter, onNew, onOpen, onEdit, onDelete }: {
  summary: { totalInvested: number; currentTotal: number; rentabilidade: number; dividendsReceived: number };
  count: number; records: Investment[]; filter: string; loadError?: boolean; dividendLoadError?: boolean; onRetry?: () => void; onRetryDividends?: () => void; onFilter: (value: string) => void; onNew: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (investment: Investment) => void; onEdit: (investment: Investment, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const t = useSafeTranslations('investments');
  const locale = useSafeLocale();
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="investments-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="investments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={onNew} size="sm"><Plus aria-hidden="true" /> {t('actions.newInvestment')}</Button>
      </header>
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
          <p className="text-destructive">{t('errors.loadPortfolio')}</p>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>{t('actions.retry')}</Button>}
        </div>
      )}
      {!loadError && dividendLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
          <p className="text-destructive">{t('errors.loadDividends')}</p>
          {onRetryDividends && <Button size="sm" variant="outline" onClick={onRetryDividends}>{t('actions.retry')}</Button>}
        </div>
      )}
      <InvestmentMetrics label={t('summary.ariaLabel')} metrics={[
        { label: t('summary.currentValue'), value: currencyFmt(summary.currentTotal, locale), note: t('summary.currentValueNote') },
        { label: t('summary.totalInvested'), value: currencyFmt(summary.totalInvested, locale), note: t('summary.investmentCount', { count }) },
        { label: t('summary.totalYield'), value: percentFmt(summary.rentabilidade, locale), note: summary.rentabilidade >= 0 ? t('summary.accumulatedProfit') : t('summary.accumulatedLoss') },
        {
          label: t('summary.dividendsReceived'),
          value: dividendLoadError ? '—' : currencyFmt(summary.dividendsReceived, locale),
          note: dividendLoadError ? t('errors.loadDividendsShort') : t('summary.dividendsNote'),
        },
      ]} />
      <section aria-labelledby="investment-records-title" className="space-y-3">
        <h3 id="investment-records-title" className="font-semibold">{t('portfolio.sectionTitle')}</h3>
        <Tabs value={filter} onValueChange={onFilter}>
          <TabsList aria-label={t('filters.ariaLabel')} className="h-auto max-w-full flex-wrap justify-start gap-1 border bg-card">
            {INVESTMENT_FILTER_TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">{t(tab.labelKey)}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {records.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{filter === 'all' ? t('portfolio.emptyAll') : t('portfolio.emptyFiltered')}</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {records.map((inv) => {
              const type = INVESTMENT_TYPE_META[inv.type] || INVESTMENT_TYPE_META.OTHER;
              const yieldPct = inv.investedAmount > 0 ? ((inv.currentBalance - inv.investedAmount) / inv.investedAmount) * 100 : 0;
              return (
                <li key={inv.id} className="grid min-w-0 gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <button type="button" id={`investment-row-${inv.id}`} onClick={() => onOpen(inv)} aria-label={t('actions.openAriaLabel', { name: inv.name })} className="grid min-w-0 gap-2 rounded-md p-2 text-left hover:bg-accent md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                    <span className="flex min-w-0 items-start gap-2">
                      <type.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{inv.name}</span>
                        <span className="block break-words text-xs text-muted-foreground">{t(type.labelKey)}{inv.ticker && ` · ${inv.ticker}`}{inv.brokerage && ` · ${inv.brokerage}`}</span>
                      </span>
                    </span>
                    <span className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0">{t('portfolio.investedLabel')}<span className="block break-words font-mono tabular-nums text-foreground">{currencyFmt(inv.investedAmount, locale)}</span></span>
                      <span className="min-w-0">{t('portfolio.currentLabel')}<span className="block break-words font-mono font-semibold tabular-nums text-foreground">{currencyFmt(inv.currentBalance, locale)}</span><span className="block">{percentFmt(yieldPct, locale)}</span></span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1 px-2 md:px-0">
                    <Button size="icon" variant="ghost" aria-label={t('actions.editAriaLabel', { name: inv.name })} onClick={(event) => onEdit(inv, event)}><Pencil aria-hidden="true" /></Button>
                    <Button size="icon" variant="ghost" aria-label={t('actions.deleteAriaLabel', { name: inv.name })} className="text-destructive" onClick={(event) => onDelete(inv.id, event)}><Trash2 aria-hidden="true" /></Button>
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
  const t = useSafeTranslations('investments');
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="investment-history-title" className="font-semibold">{t('detail.historyTitle')}</h3>
      <Button size="sm" onClick={onNew}><Plus aria-hidden="true" /> {t('actions.newTransaction')}</Button>
    </header>
  );
}

export function InvestmentEntries({ transactions, onNew, onEdit, onDelete }: {
  transactions: InvestmentTransaction[];
  onNew: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit?: (tx: InvestmentTransaction, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: (tx: InvestmentTransaction, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const t = useSafeTranslations('investments');
  const locale = useSafeLocale();
  return (
    <section aria-labelledby="investment-history-title" className="space-y-3">
      <InvestmentHistoryHeader onNew={onNew} />
      {transactions.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t('detail.emptyHistory')}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {transactions.map((tx) => {
            const type = INVESTMENT_TX_META[tx.type] || INVESTMENT_TX_META.APORTE;
            const isCredit = ['APORTE', 'DIVIDENDO', 'REINVESTIMENTO', 'BONUS'].includes(tx.type);
            const txTitle = tx.description || t(type.labelKey);
            return (
              <li key={tx.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-2">
                  <type.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-medium">{txTitle}</p>
                    <p className="break-words text-xs text-muted-foreground">{dateFmt(tx.date, locale)} · {t(type.labelKey)}{tx.quantity && tx.unitPrice ? ` · ${tx.quantity} × ${currencyFmt(tx.unitPrice, locale)}` : null}</p>
                    {tx.notes && <p className="break-words text-xs text-muted-foreground">{tx.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-1 break-words font-mono text-sm font-semibold tabular-nums">{isCredit ? '+' : '-'}{currencyFmt(tx.amount, locale)}</span>
                  {onEdit && (
                    <Button size="icon" variant="ghost" aria-label={t('actions.editTxAriaLabel', { title: txTitle })} onClick={(event) => onEdit(tx, event)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button size="icon" variant="ghost" aria-label={t('actions.deleteTxAriaLabel', { title: txTitle })} className="text-destructive hover:text-destructive" onClick={(event) => onDelete(tx, event)}>
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
