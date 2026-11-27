'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, Wallet, Landmark, Smartphone, ArrowLeft, ArrowLeftRight, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
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
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceRow } from '@/components/shared/finance-row';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, dateFmt } from '@/lib/helpers';
import { purchaseDateForInput } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { useKeyedMutationLock } from '@/hooks/use-keyed-mutation-lock';
import {
  ACCOUNT_COLORS,
  ACCOUNT_TYPE_KEYS,
  createFallbackTranslator,
  PT_OPERATIONS_MESSAGES,
} from './operations-i18n';
import { AccountTransactionFields, type AccountTransactionForm } from './account-transaction-fields';
import { AccountPicker } from './account-picker';
import { AccountTransferDialog, type AccountTransferDraft } from './account-transfer-dialog';

// ── Helpers ────────────────────────────────────────────────────────
const typeIcons: Record<string, React.ElementType> = {
  CASH: Wallet,
  BANK: Landmark,
  DIGITAL_WALLET: Smartphone,
};

const accountPanel = 'min-w-0 rounded-xl border border-border bg-card';
const accountStrip = `${accountPanel} grid grid-cols-2 sm:grid-cols-4`;
const dialogSurface = 'max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none';

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
  categoryId?: string | null;
  notes?: string | null;
  category?: { id: string; name: string; color: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

type AccountIdentity = { id: string };
type BoundTransactionDraft<T> = { accountId: string; data: T };

export function reconcileTransactionDraft<T>(
  draft: BoundTransactionDraft<T> | null,
  accounts: readonly AccountIdentity[] | null,
  isCurrentResponse: boolean,
): BoundTransactionDraft<T> | null {
  if (!draft || !isCurrentResponse || !accounts) return draft;
  return accounts.some(({ id }) => id === draft.accountId) ? draft : null;
}

export function transactionDraftForAccount<T>(
  draft: BoundTransactionDraft<T> | null,
  accountId: string | null,
  accounts: readonly AccountIdentity[],
): BoundTransactionDraft<T> | null {
  return draft?.accountId === accountId ? reconcileTransactionDraft(draft, accounts, true) : null;
}

const emptyTransactionForm = (): AccountTransactionForm => ({
  type: 'EXPENSE',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  categoryId: '',
  notes: '',
});

type TransactionDraft = BoundTransactionDraft<AccountTransactionForm> & { session: symbol };

// ── Component ──────────────────────────────────────────────────────
export function AccountsView({ onLaunchClose, refreshCounter }: { onLaunchClose: () => void; refreshCounter: number }) {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('accounts'), PT_OPERATIONS_MESSAGES.accounts);
  const newTransactionRequested = useAppStore((state) => state.newTransactionRequested);
  const clearNewTransactionRequest = useAppStore((state) => state.clearNewTransactionRequest);
  const storeSelectedAccountId = useAppStore((state) => state.selectedAccountId);
  const setStoreSelectedAccountId = useAppStore((state) => state.setSelectedAccountId);
  const launchDialog = useRef<'transaction' | 'account' | null>(null);
  const transactionButton = useRef<HTMLButtonElement>(null);
  const newAccountButton = useRef<HTMLButtonElement>(null);
  const dialogReturn = useRef<HTMLButtonElement | null>(null);
  const detailReturn = useRef<string | null>(null);
  const detailBack = useRef<HTMLButtonElement>(null);
  const accountList = useRef<HTMLUListElement>(null);
  const latestAccountQuery = useRef(0);
  const latestTransactionQuery = useRef(0);
  const latestMonthlyQuery = useRef(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactionRefresh, setTransactionRefresh] = useState(0);
  const selectedAccount = accounts.find(({ id }) => id === selectedAccountId) ?? null;
  const [loading, setLoading] = useState(true);
  const [accountsLoadFailed, setAccountsLoadFailed] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState(false);

  // Dialogs
  const { pending, tryAcquire, release } = useKeyedMutationLock();
  const [showAccountDialog, setAccountDialogOpen] = useState(false);
  const accountOpening = useRef(0);
  const setShowAccountDialog = (open: boolean) => {
    ++accountOpening.current;
    setAccountDialogOpen(open);
  };
  const [showDeleteDialog, setDeleteTarget] = useState<string | null>(null);
  const deleteOpening = useRef(0);
  const setShowDeleteDialog = (id: string | null) => {
    ++deleteOpening.current;
    setDeleteTarget(id);
  };
  const [showTransferDialog, setTransferDialogOpen] = useState(false);
  const transferOpening = useRef(0);
  const setShowTransferDialog = (open: boolean) => {
    // Cancel preserves the form; only a later opening owns a different draft.
    if (open) ++transferOpening.current;
    setTransferDialogOpen(open);
  };
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editTxForm, setEditTxForm] = useState(emptyTransactionForm);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const editTxOpening = useRef(0);
  const deleteTxOpening = useRef(0);
  const txActionOrigin = useRef<HTMLButtonElement | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState<AccountTransferDraft>({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const changeTransferField = (field: keyof AccountTransferDraft, value: string) => {
    setTransferForm((current) => ({ ...current, [field]: value }));
  };

  // Form state
  const [form, setForm] = useState({
    name: '',
    type: 'CASH',
    balance: '0',
    color: '#22c55e',
    icon: 'wallet',
  });
  const confirmedAccounts = useRef<readonly Account[]>([]);
  const liveDraft = useRef<TransactionDraft | null>(null);
  const [draft, setDraftState] = useState<TransactionDraft | null>(null);
  const setDraft = useCallback((next: TransactionDraft | null) => {
    liveDraft.current = next;
    setDraftState(next);
  }, []);
  const activeDraft = draft?.accountId === selectedAccount?.id && selectedAccount ? draft : null;
  const txForm = activeDraft?.data;
  const closeTransaction = () => {
    if (activeDraft && liveDraft.current?.session === activeDraft.session) setDraft(null);
  };
  const setTxForm = (data: TransactionDraft['data']) => {
    const current = liveDraft.current;
    if (current && current.session === activeDraft?.session) setDraft({ ...current, data });
  };
  const openTransaction = (accountId: string) => {
    if (!confirmedAccounts.current.some(({ id }) => id === accountId)) return;
    setDraft({ accountId, data: emptyTransactionForm(), session: Symbol() });
  };

  // ── Data fetching ────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    const query = ++latestAccountQuery.current;
    try {
      const res = await fetch('/api/accounts');
      if (query !== latestAccountQuery.current) return;
      if (!res.ok) {
        setAccountsLoadFailed(true);
        return;
      }
      const result: Account[] = await res.json();
      if (query !== latestAccountQuery.current) return;
      confirmedAccounts.current = result;
      const draft = liveDraft.current;
      if (draft && !reconcileTransactionDraft(draft, result, true)) setDraft(null);
      setSelectedAccountId((id) => result.some((account) => account.id === id) ? id : null);
      setAccounts(result);
      setAccountsLoadFailed(false);
    } catch (e) {
      if (query === latestAccountQuery.current) setAccountsLoadFailed(true);
      console.error(e);
    } finally {
      if (query === latestAccountQuery.current) setLoading(false);
    }
  }, [setDraft]);

  const fetchTransactions = useCallback(async (accountId: string) => {
    const query = ++latestTransactionQuery.current;
    setTxLoading(true);
    setTxError(false);
    try {
      const res = await fetch(`/api/transactions?accountId=${accountId}`);
      if (!res.ok) {
        if (query === latestTransactionQuery.current) setTxError(true);
        return;
      }
      const result = await res.json();
      if (query === latestTransactionQuery.current) {
        setTransactions(result);
        setTxError(false);
      }
    } catch (e) {
      if (query === latestTransactionQuery.current) setTxError(true);
      console.error(e);
    } finally {
      if (query === latestTransactionQuery.current) setTxLoading(false);
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
  }, [fetchAccounts, fetchCategories, refreshCounter]);

  useEffect(() => {
    if (selectedAccountId) void fetchTransactions(selectedAccountId);
  }, [fetchTransactions, refreshCounter, selectedAccountId, transactionRefresh]);

  useEffect(() => {
    if (!storeSelectedAccountId || loading) return;
    const target = accounts.find(({ id }) => id === storeSelectedAccountId);
    if (target) {
      ++latestTransactionQuery.current;
      setTransactions([]);
      setSelectedAccountId(target.id);
    }
    setStoreSelectedAccountId(null);
  }, [accounts, loading, setStoreSelectedAccountId, storeSelectedAccountId]);

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
    const query = ++latestMonthlyQuery.current;
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
        if (query === latestMonthlyQuery.current) {
          setMonthIncome(income);
          setMonthExpense(expense);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyStats();
  }, [fetchMonthlyStats, refreshCounter]);

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
    if (selectedAccount?.id !== acc.id) {
      ++latestTransactionQuery.current;
      setTransactions([]);
    }
    setSelectedAccountId(acc.id);
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

  const saveKey = editingAccount ? `edit:${editingAccount.id}` : 'create';
  const saveAccount = async () => {
    if (!form.name.trim()) {
      toast.error(t('errors.accountNameRequired'));
      return;
    }
    if (!tryAcquire(saveKey)) return;
    const opening = accountOpening.current;
    try {
      const body = { ...form, balance: parseFloat(form.balance) || 0 };
      if (editingAccount) {
        const res = await fetch('/api/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAccount.id, ...body }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || t('errors.updateAccount')); return; }
        toast.success(t('toasts.accountUpdated'));
      } else {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || t('errors.createAccount')); return; }
        toast.success(t('toasts.accountCreated'));
      }
      if (accountOpening.current === opening) setShowAccountDialog(false);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error(t('errors.saveAccount'));
    } finally {
      release(saveKey);
    }
  };

  const deleteAccount = async (id: string) => {
    const key = `delete:${id}`;
    if (!tryAcquire(key)) return;
    const opening = deleteOpening.current;
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || t('errors.deleteAccount')); return; }
      toast.success(t('toasts.accountDeleted'));
      if (deleteOpening.current === opening) {
        dialogReturn.current = null;
        setShowDeleteDialog(null);
      }
      if (liveDraft.current?.accountId === id) setDraft(null);
      setSelectedAccountId((current) => current === id ? null : current);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error(t('errors.deleteAccount'));
    } finally {
      release(key);
    }
  };

  const saveTransaction = async () => {
    const draft = liveDraft.current;
    if (!draft || draft.session !== activeDraft?.session) return;
    const eligible = transactionDraftForAccount(draft, selectedAccountId, confirmedAccounts.current);
    if (!eligible) return;
    if (!eligible.data.description.trim()) {
      toast.error(t('errors.descriptionRequired'));
      return;
    }
    const parsedAmount = parseFloat(eligible.data.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('errors.amountPositive'));
      return;
    }
    const key = `transaction:${eligible.accountId}`;
    if (!tryAcquire(key)) return;
    try {
      const body = {
        ...eligible.data,
        description: eligible.data.description.trim(),
        amount: parsedAmount,
        accountId: eligible.accountId,
      };
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(t('errors.createTransaction'));
        return;
      }
      toast.success(t('toasts.transactionCreated'));
      if (liveDraft.current?.session === draft.session) setDraft(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error(t('errors.createTransaction'));
    } finally {
      release(key);
    }
  };

  const openEditTransaction = (tx: Transaction) => {
    ++editTxOpening.current;
    setEditingTransaction(tx);
    setEditTxForm({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description,
      date: purchaseDateForInput(tx.date),
      categoryId: tx.category?.id ?? tx.categoryId ?? '',
      notes: tx.notes ?? '',
    });
  };

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !selectedAccount) return;
    if (!editTxForm.description.trim()) {
      toast.error(t('errors.descriptionRequired'));
      return;
    }
    const parsedAmount = parseFloat(editTxForm.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('errors.amountPositive'));
      return;
    }
    const key = `tx-edit:${editingTransaction.id}`;
    if (!tryAcquire(key)) return;
    const opening = editTxOpening.current;
    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTransaction.id,
          type: editTxForm.type,
          amount: parsedAmount,
          description: editTxForm.description.trim(),
          date: editTxForm.date,
          categoryId: editTxForm.categoryId || null,
          notes: editTxForm.notes,
          accountId: selectedAccount.id,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t('errors.updateTransaction'));
        return;
      }
      toast.success(t('toasts.transactionUpdated'));
      if (editTxOpening.current === opening) setEditingTransaction(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error(t('errors.updateTransaction'));
    } finally {
      release(key);
    }
  };

  const deleteTransaction = async (id: string) => {
    const key = `tx-delete:${id}`;
    if (!tryAcquire(key)) return;
    const opening = deleteTxOpening.current;
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t('errors.deleteTransaction'));
        return;
      }
      toast.success(t('toasts.transactionDeleted'));
      if (deleteTxOpening.current === opening) setDeletingTransaction(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error(t('errors.deleteTransaction'));
    } finally {
      release(key);
    }
  };

  const saveTransfer = async () => {
    if (!tryAcquire('transfer')) return;
    const opening = transferOpening.current;
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
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || t('errors.transferFailed'));
        return;
      }

      toast.success(t('toasts.transferSuccess'));
      if (transferOpening.current === opening) {
        setShowTransferDialog(false);
        setTransferForm({
          fromAccountId: '',
          toAccountId: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: '',
        });
      }
      fetchAccounts();
      fetchMonthlyStats();
      setTransactionRefresh((current) => current + 1);
    } catch {
      toast.error(t('errors.transferError'));
    } finally {
      release('transfer');
    }
  };

  const restoreFocusAfterLaunch = (event: Event) => {
    event.preventDefault();
    launchDialog.current = null;
    onLaunchClose();
  };

  const restoreDialogFocus = (event: Event) => {
    event.preventDefault();
    const trigger = dialogReturn.current;
    dialogReturn.current = null;
    (trigger?.isConnected ? trigger : newAccountButton.current)?.focus();
  };

  useEffect(() => {
    if (selectedAccountId) {
      if (!launchDialog.current) detailBack.current?.focus();
    } else if (detailReturn.current) {
      const buttons = Array.from(accountList.current?.querySelectorAll<HTMLButtonElement>('[data-account-detail]') ?? []);
      (buttons.find((button) => button.dataset.accountDetail === detailReturn.current) ?? newAccountButton.current)?.focus();
      detailReturn.current = null;
    }
  }, [selectedAccountId]);

  const chooser = (
    <AccountPicker
      open={newTransactionRequested}
      loading={loading}
      loadFailed={accountsLoadFailed}
      accounts={accounts}
      onRetry={() => {
        setLoading(true);
        void fetchAccounts();
      }}
      onCreateAccount={() => {
        launchDialog.current = 'account';
        clearNewTransactionRequest();
        openNewAccount();
      }}
      onSelectAccount={(account) => {
        launchDialog.current = 'transaction';
        clearNewTransactionRequest();
        openAccount(account);
        openTransaction(account.id);
      }}
      onClose={clearNewTransactionRequest}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!launchDialog.current) onLaunchClose();
      }}
    />
  );

  const withChooser = (content: ReactNode) => <>{chooser}{content}</>;

  const resolveAccountTypeLabel = (type: string) =>
    (ACCOUNT_TYPE_KEYS as readonly string[]).includes(type) ? t(`accountTypes.${type}`) : type;

  if (loading) {
    return withChooser(
      <div role="status" className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
        <Skeleton aria-hidden="true" className="h-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-40 rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (selectedAccount) {
    return withChooser(
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <Button ref={detailBack} variant="ghost" className="min-h-11" onClick={() => setSelectedAccountId(null)}>
            <ArrowLeft aria-hidden="true" /> {t('actions.backToAccounts')}
          </Button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{resolveAccountTypeLabel(selectedAccount.type)}</p>
              <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{selectedAccount.name}</h2>
            </div>
            <Button ref={transactionButton} className="min-h-11" onClick={() => openTransaction(selectedAccount.id)} aria-label={t('actions.newTransaction')}>
              <Plus aria-hidden="true" /> {t('actions.newTransaction')}
            </Button>
          </div>
        </header>
        <dl aria-label={t('detail.ariaLabel')} className={accountStrip}>
          <FinanceMetric variant="strip" label={t('detail.currentBalance')} value={currencyFmt(selectedAccount.balance, locale)} />
          <FinanceMetric variant="strip" label={t('detail.listIncome')} value={currencyFmt(accountStats.income, locale)} />
          <FinanceMetric variant="strip" label={t('detail.listExpense')} value={currencyFmt(accountStats.expense, locale)} />
          <FinanceMetric variant="strip" label={t('detail.listCount')} value={accountStats.count} />
        </dl>

        <section aria-labelledby="account-transactions" className={accountPanel}>
          <h3 id="account-transactions" className="border-b border-border px-4 py-3 font-semibold">{t('detail.transactionsTitle')}</h3>
          {txLoading ? (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">{t('detail.loadingTransactions')}</p>
          ) : txError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
              <p className="text-destructive">{t('errors.loadTransactions')}</p>
              <Button variant="outline" className="min-h-11" onClick={() => void fetchTransactions(selectedAccount.id)}>
                {t('actions.retry')}
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t('detail.emptyTransactions')}</p>
          ) : (
            <ul aria-labelledby="account-transactions" className="divide-y divide-border">
              {transactions.map((tx) => (
                <FinanceRow
                  key={tx.id}
                  variant="default"
                  tone={tx.type === 'INCOME' ? 'positive' : tx.type === 'TRANSFER' ? 'neutral' : 'negative'}
                  description={tx.description}
                  metadata={`${tx.type === 'INCOME' ? t('detail.incomeType') : tx.type === 'TRANSFER' ? t('detail.transferType') : t('detail.expenseType')} · ${dateFmt(tx.date, locale)}${tx.category ? ` · ${tx.category.name}` : ''}`}
                  amount={tx.amount}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t('detail.editTransactionAria', { description: tx.description })}
                    onClick={(event) => { txActionOrigin.current = event.currentTarget; openEditTransaction(tx); }}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('detail.deleteTransactionAria', { description: tx.description })}
                    className="size-11 text-destructive hover:text-destructive"
                    onClick={(event) => {
                      txActionOrigin.current = event.currentTarget;
                      ++deleteTxOpening.current;
                      setDeletingTransaction(tx);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </FinanceRow>
              ))}
            </ul>
          )}
        </section>

        {/* New Transaction Dialog */}
        <Dialog open={!!activeDraft && !newTransactionRequested} onOpenChange={(open) => { if (!open) closeTransaction(); }}>
          {txForm && (
            <DialogContent
              showCloseButton={false}
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
              onCloseAutoFocus={(event) => {
                if (launchDialog.current === 'transaction') {
                  restoreFocusAfterLaunch(event);
                } else if (transactionButton.current) {
                  event.preventDefault();
                  transactionButton.current.focus();
                }
              }}
            >
              <DialogHeader className="relative pr-10 text-left">
                <DialogClose asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('actions.closeDialog')}
                    className="absolute right-0 top-0"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
                <DialogTitle>{t('transactionDialog.createTitle')}</DialogTitle>
                <DialogDescription>
                  {t('transactionDialog.createDescription', { account: selectedAccount.name })}
                </DialogDescription>
              </DialogHeader>
              <AccountTransactionFields mode="create" value={txForm} onChange={setTxForm} categories={categories} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeTransaction}
                >
                  {t('actions.cancel')}
                </Button>
                <Button aria-disabled={pending.has(`transaction:${selectedAccount.id}`)} onClick={saveTransaction}>{t('actions.register')}</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Edit Transaction Dialog */}
        <Dialog open={!!editingTransaction} onOpenChange={(open) => { if (!open) { ++editTxOpening.current; setEditingTransaction(null); } }}>
          {editingTransaction && (
            <DialogContent
              showCloseButton={false}
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const origin = txActionOrigin.current;
                txActionOrigin.current = null;
                (origin?.isConnected ? origin : transactionButton.current)?.focus();
              }}
            >
              <DialogHeader className="relative pr-10 text-left">
                <DialogClose asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('actions.closeDialog')}
                    className="absolute right-0 top-0"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
                <DialogTitle>{t('transactionDialog.editTitle')}</DialogTitle>
                <DialogDescription>{t('transactionDialog.editDescription', { account: selectedAccount.name })}</DialogDescription>
              </DialogHeader>
              <AccountTransactionFields mode="edit" value={editTxForm} onChange={setEditTxForm} categories={categories} />
              <DialogFooter>
                <Button variant="outline" onClick={() => { ++editTxOpening.current; setEditingTransaction(null); }}>{t('actions.cancel')}</Button>
                <Button aria-disabled={pending.has(`tx-edit:${editingTransaction.id}`)} onClick={() => void saveEditedTransaction()}>{t('actions.save')}</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Delete Transaction Dialog */}
        <AlertDialog open={!!deletingTransaction} onOpenChange={(open) => { if (!open) { ++deleteTxOpening.current; setDeletingTransaction(null); } }}>
          <AlertDialogContent
            className={dialogSurface}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const origin = txActionOrigin.current;
              txActionOrigin.current = null;
              (origin?.isConnected ? origin : transactionButton.current)?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t('transactionDialog.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('transactionDialog.deleteDescription', { account: selectedAccount.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                aria-disabled={deletingTransaction ? pending.has(`tx-delete:${deletingTransaction.id}`) : false}
                onClick={(event) => {
                  event.preventDefault();
                  if (deletingTransaction) void deleteTransaction(deletingTransaction.id);
                }}
                className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
              >
                {t('actions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return withChooser(
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" aria-label={t('actions.transfer')} onClick={(event) => { dialogReturn.current = event.currentTarget; setShowTransferDialog(true); }}>
            <ArrowLeftRight aria-hidden="true" /> {t('actions.transfer')}
          </Button>
          <Button ref={newAccountButton} className="min-h-11" onClick={(event) => { dialogReturn.current = event.currentTarget; openNewAccount(); }}>
            <Plus aria-hidden="true" /> {t('actions.newAccount')}
          </Button>
        </div>
      </header>

      {accountsLoadFailed && (
        <div className={`${accountPanel} flex flex-wrap items-center justify-between gap-2 p-4 text-sm`}>
          <p role="alert">{t('errors.loadAccounts')}</p>
          <Button variant="outline" className="min-h-11" onClick={() => void fetchAccounts()}>{t('actions.retry')}</Button>
        </div>
      )}
      {(!accountsLoadFailed || accounts.length > 0) && (
        <>
          <dl aria-label={t('summary.ariaLabel')} className={accountStrip}>
            <FinanceMetric variant="strip" label={t('summary.totalBalance')} value={currencyFmt(summary.totalPatrimonio, locale)} />
            <FinanceMetric variant="strip" label={t('summary.monthIncome')} value={currencyFmt(monthIncome, locale)} />
            <FinanceMetric variant="strip" label={t('summary.monthExpense')} value={currencyFmt(monthExpense, locale)} />
            <FinanceMetric variant="strip" label={t('summary.totalAccounts')} value={summary.accountCount} />
          </dl>
          <section aria-labelledby="account-list" className={accountPanel}>
            <h3 id="account-list" className="border-b border-border px-4 py-3 font-semibold">{t('list.title')}</h3>
            {accounts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t('list.empty')}</p>
            ) : (
              <ul ref={accountList} aria-label={t('list.title')} className="divide-y divide-border">
                {accounts.map((acc) => {
                  const Icon = typeIcons[acc.type] || Wallet;
                  const txCount = acc._count?.transactions || 0;
                  return (
                    <li key={acc.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] sm:gap-x-4">
                      <Button type="button" variant="ghost" aria-label={t('list.openAccountAria', { name: acc.name })} onClick={() => { detailReturn.current = acc.id; openAccount(acc); }} data-account-detail={acc.id} className="col-span-2 h-auto min-h-11 min-w-0 justify-start whitespace-normal px-0 text-left sm:col-span-1">
                        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                        <span className="min-w-0 wrap-anywhere">
                          <span className="block font-semibold">{acc.name}</span>
                          <span className="block text-xs text-muted-foreground">{resolveAccountTypeLabel(acc.type)}{txCount > 0 && ` · ${t('list.transactionCount', { count: txCount })}`}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
                      </Button>
                      <p className="wrap-anywhere font-mono text-sm font-semibold tabular-nums sm:text-right">{currencyFmt(acc.balance, locale)}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-11" aria-label={t('list.editAccountAria', { name: acc.name })} onClick={(event) => { dialogReturn.current = event.currentTarget; openEditAccount(acc); }}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t('list.deleteAccountAria', { name: acc.name })} onClick={(event) => { dialogReturn.current = event.currentTarget; setShowDeleteDialog(acc.id); }} className="size-11 text-destructive hover:text-destructive">
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Account Form Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent showCloseButton={false} className={dialogSurface} onCloseAutoFocus={(event) => {
          if (launchDialog.current === 'account') restoreFocusAfterLaunch(event);
          else restoreDialogFocus(event);
        }}>
          <DialogHeader className="relative pr-10 text-left">
            <DialogClose asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('actions.closeDialog')}
                className="absolute right-0 top-0"
              >
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
            <DialogTitle>
              {editingAccount ? t('accountForm.editTitle') : t('accountForm.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? t('accountForm.editDescription')
                : t('accountForm.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="account-name">{t('accountForm.nameLabel')}</Label>
              <Input id="account-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('accountForm.namePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="account-type">{t('accountForm.typeLabel')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>{t(`accountTypes.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account-balance">{t('accountForm.balanceLabel')}</Label>
              <Input id="account-balance"
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
            <div>
              <p id="account-color" className="text-sm font-medium">{t('accountForm.colorLabel')}</p>
              <div role="group" aria-labelledby="account-color" className="mt-2 flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map(({ value, key }) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={t(`colors.${key}`)}
                    aria-pressed={form.color === value}
                    className="size-8 rounded-full border border-border aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-foreground focus-visible:outline-ring"
                    style={{ backgroundColor: value }}
                    onClick={() => setForm({ ...form, color: value })}
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
              {t('actions.cancel')}
            </Button>
            <Button aria-disabled={pending.has(saveKey)} onClick={saveAccount}>
              {editingAccount ? t('actions.update') : t('actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccountTransferDialog
        open={showTransferDialog}
        pending={pending.has('transfer')}
        form={transferForm}
        accounts={accounts}
        onFieldChange={changeTransferField}
        onOpenChange={setShowTransferDialog}
        onCloseAutoFocus={restoreDialogFocus}
        onSubmit={saveTransfer}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={!!showDeleteDialog}
        onOpenChange={() => setShowDeleteDialog(null)}
      >
        <AlertDialogContent className={dialogSurface} onCloseAutoFocus={restoreDialogFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAccountDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteAccountDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              aria-disabled={pending.has(`delete:${showDeleteDialog}`)}
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) void deleteAccount(showDeleteDialog);
              }}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
