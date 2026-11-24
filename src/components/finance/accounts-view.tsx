'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, Wallet, Landmark, Smartphone, ArrowLeft, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { currencyFmt } from '@/lib/helpers';
import { purchaseDateForInput } from '@/lib/purchase-date';
import { useAppStore } from '@/lib/store';
import { useKeyedMutationLock } from '@/hooks/use-keyed-mutation-lock';
import { AccountTransactionFields, type AccountTransactionForm } from './account-transaction-fields';

// ── Helpers ────────────────────────────────────────────────────────
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
  ['#22c55e', 'Verde'], ['#3b82f6', 'Azul'], ['#8b5cf6', 'Roxo'], ['#06b6d4', 'Ciano'],
  ['#f97316', 'Laranja'], ['#ef4444', 'Vermelho'], ['#ec4899', 'Rosa'],
];

const accountPanel = 'min-w-0 rounded-xl border border-border bg-card';
const accountStrip = `${accountPanel} grid grid-cols-2 sm:grid-cols-4`;
const dialogSurface = 'max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none';

function AccountMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 border-b border-border p-3 even:border-l nth-[n+3]:border-b-0 sm:border-b-0 sm:p-4 sm:[&:not(:first-child)]:border-l">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-anywhere font-mono text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}

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
      toast.error('Nome da conta é obrigatório');
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
        if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Erro ao atualizar conta'); return; }
        toast.success('Conta atualizada!');
      } else {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Erro ao criar conta'); return; }
        toast.success('Conta criada!');
      }
      if (accountOpening.current === opening) setShowAccountDialog(false);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao salvar conta');
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Erro ao excluir conta'); return; }
      toast.success('Conta excluída!');
      if (deleteOpening.current === opening) setShowDeleteDialog(null);
      if (liveDraft.current?.accountId === id) setDraft(null);
      setSelectedAccountId((current) => current === id ? null : current);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao excluir conta');
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
      toast.error('Informe a descrição da transação');
      return;
    }
    const parsedAmount = parseFloat(eligible.data.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor maior que zero');
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
        toast.error('Erro ao registrar transação');
        return;
      }
      toast.success('Transação registrada!');
      if (liveDraft.current?.session === draft.session) setDraft(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao registrar transação');
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
      toast.error('Informe a descrição da transação');
      return;
    }
    const parsedAmount = parseFloat(editTxForm.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor maior que zero');
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
        toast.error(d.error || 'Erro ao atualizar transação');
        return;
      }
      toast.success('Transação atualizada!');
      if (editTxOpening.current === opening) setEditingTransaction(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao atualizar transação');
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
        toast.error(d.error || 'Erro ao excluir transação');
        return;
      }
      toast.success('Transação excluída!');
      if (deleteTxOpening.current === opening) setDeletingTransaction(null);
      setTransactionRefresh((current) => current + 1);
      fetchAccounts();
      fetchMonthlyStats();
    } catch {
      toast.error('Erro ao excluir transação');
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
        const data = await res.json();
        toast.error(data.error || 'Erro na transferência');
        return;
      }

      toast.success('Transferência realizada com sucesso!');
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
      toast.error('Erro ao realizar transferência');
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
    <Dialog open={newTransactionRequested} onOpenChange={(open) => { if (!open) clearNewTransactionRequest(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!launchDialog.current) onLaunchClose();
        }}
      >
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Escolha a conta em que deseja registrar a transação.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">Carregando contas…</p>
        ) : accountsLoadFailed ? (
          <div className="space-y-2 text-sm">
            <p role="alert">Não foi possível carregar as contas.</p>
            <Button variant="outline" onClick={() => { setLoading(true); void fetchAccounts(); }}>
              Tentar novamente
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-2 text-sm">
            <p>Cadastre uma conta antes de registrar um lançamento.</p>
            <Button onClick={() => {
              launchDialog.current = 'account';
              clearNewTransactionRequest();
              openNewAccount();
            }}>Cadastrar conta</Button>
          </div>
        ) : (
          <ul className="space-y-1" aria-label="Contas disponíveis">
            {accounts.map((account) => (
              <li key={account.id}>
                <Button
                  variant="outline"
                  className="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
                  onClick={() => {
                    launchDialog.current = 'transaction';
                    clearNewTransactionRequest();
                    openAccount(account);
                    openTransaction(account.id);
                  }}
                >
                  <span className="min-w-0 wrap-anywhere">{account.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={clearNewTransactionRequest}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const withChooser = (content: ReactNode) => <>{chooser}{content}</>;

  if (loading) {
    return withChooser(
      <div role="status" className="space-y-4">
        <p className="text-sm text-muted-foreground">Carregando contas…</p>
        <Skeleton aria-hidden="true" className="h-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-40 rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (selectedAccount) {
    return withChooser(
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <Button ref={detailBack} variant="ghost" size="sm" onClick={() => setSelectedAccountId(null)}>
            <ArrowLeft aria-hidden="true" /> Voltar para contas
          </Button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{typeLabels[selectedAccount.type]}</p>
              <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{selectedAccount.name}</h2>
            </div>
            <Button ref={transactionButton} onClick={() => openTransaction(selectedAccount.id)} aria-label="Nova transação">
              <Plus aria-hidden="true" /> Nova transação
            </Button>
          </div>
        </header>
        <dl aria-label="Posição da conta" className={accountStrip}>
          <AccountMetric label="Saldo atual" value={currencyFmt(selectedAccount.balance)} />
          <AccountMetric label="Receitas na lista" value={currencyFmt(accountStats.income)} />
          <AccountMetric label="Despesas na lista" value={currencyFmt(accountStats.expense)} />
          <AccountMetric label="Transações na lista" value={accountStats.count} />
        </dl>

        <section aria-labelledby="account-transactions" className={accountPanel}>
          <h3 id="account-transactions" className="border-b border-border px-4 py-3 font-semibold">Transações</h3>
          {txLoading ? (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Carregando transações…</p>
          ) : txError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
              <p className="text-destructive">Não foi possível carregar as transações.</p>
              <Button variant="outline" size="sm" onClick={() => void fetchTransactions(selectedAccount.id)}>
                Tentar novamente
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma transação registrada.</p>
          ) : (
            <ul aria-labelledby="account-transactions" className="divide-y divide-border">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="wrap-anywhere text-sm font-medium">{tx.description}</p>
                    <p className="wrap-anywhere text-xs text-muted-foreground">
                      {tx.type === 'INCOME' ? 'Receita' : 'Despesa'} · {dateFmt(tx.date)}{tx.category && ` · ${tx.category.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`mr-1 wrap-anywhere font-mono text-sm font-medium tabular-nums ${tx.type === 'INCOME' ? 'text-[var(--ds-accent-positive)]' : 'text-[var(--destructive)]'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{currencyFmt(tx.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar transação ${tx.description}`}
                      onClick={(event) => { txActionOrigin.current = event.currentTarget; openEditTransaction(tx); }}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir transação ${tx.description}`}
                      className="text-destructive hover:text-destructive"
                      onClick={(event) => {
                        txActionOrigin.current = event.currentTarget;
                        ++deleteTxOpening.current;
                        setDeletingTransaction(tx);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* New Transaction Dialog */}
        <Dialog open={!!activeDraft && !newTransactionRequested} onOpenChange={(open) => { if (!open) closeTransaction(); }}>
          {txForm && (
            <DialogContent
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
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
                <DialogDescription>
                  Registrar nova transação em {selectedAccount.name}
                </DialogDescription>
              </DialogHeader>
              <AccountTransactionFields mode="create" value={txForm} onChange={setTxForm} categories={categories} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeTransaction}
                >
                  Cancelar
                </Button>
                <Button aria-disabled={pending.has(`transaction:${selectedAccount.id}`)} onClick={saveTransaction}>Registrar</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Edit Transaction Dialog */}
        <Dialog open={!!editingTransaction} onOpenChange={(open) => { if (!open) { ++editTxOpening.current; setEditingTransaction(null); } }}>
          {editingTransaction && (
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const origin = txActionOrigin.current;
                txActionOrigin.current = null;
                (origin?.isConnected ? origin : transactionButton.current)?.focus();
              }}
            >
              <DialogHeader>
                <DialogTitle>Editar Transação</DialogTitle>
                <DialogDescription>Atualize os dados da transação em {selectedAccount.name}</DialogDescription>
              </DialogHeader>
              <AccountTransactionFields mode="edit" value={editTxForm} onChange={setEditTxForm} categories={categories} />
              <DialogFooter>
                <Button variant="outline" onClick={() => { ++editTxOpening.current; setEditingTransaction(null); }}>Cancelar</Button>
                <Button aria-disabled={pending.has(`tx-edit:${editingTransaction.id}`)} onClick={() => void saveEditedTransaction()}>Salvar</Button>
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
              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita e atualizará o saldo da conta {selectedAccount.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                aria-disabled={deletingTransaction ? pending.has(`tx-delete:${deletingTransaction.id}`) : false}
                onClick={(event) => {
                  event.preventDefault();
                  if (deletingTransaction) void deleteTransaction(deletingTransaction.id);
                }}
                className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
              >
                Excluir
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
          <h2 className="text-2xl font-semibold tracking-tight">Contas</h2>
          <p className="text-sm text-muted-foreground">Acompanhe seus saldos e movimentações.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" aria-label="Transferir" onClick={(event) => { dialogReturn.current = event.currentTarget; setShowTransferDialog(true); }}>
            <ArrowLeftRight aria-hidden="true" /> Transferir
          </Button>
          <Button ref={newAccountButton} onClick={(event) => { dialogReturn.current = event.currentTarget; openNewAccount(); }}>
            <Plus aria-hidden="true" /> Nova conta
          </Button>
        </div>
      </header>

      {accountsLoadFailed && (
        <div className={`${accountPanel} flex flex-wrap items-center justify-between gap-2 p-4 text-sm`}>
          <p role="alert">Não foi possível atualizar as contas.</p>
          <Button variant="outline" size="sm" onClick={() => void fetchAccounts()}>Tentar novamente</Button>
        </div>
      )}
      {(!accountsLoadFailed || accounts.length > 0) && (
        <>
          <dl aria-label="Posição das contas" className={accountStrip}>
            <AccountMetric label="Saldo em contas" value={currencyFmt(summary.totalPatrimonio)} />
            <AccountMetric label="Receitas do mês" value={currencyFmt(monthIncome)} />
            <AccountMetric label="Despesas do mês" value={currencyFmt(monthExpense)} />
            <AccountMetric label="Total de contas" value={summary.accountCount} />
          </dl>
          <section aria-labelledby="account-list" className={accountPanel}>
            <h3 id="account-list" className="border-b border-border px-4 py-3 font-semibold">Contas cadastradas</h3>
            {accounts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma conta cadastrada. Use “Nova conta” para começar.</p>
            ) : (
              <ul ref={accountList} aria-label="Contas cadastradas" className="divide-y divide-border">
                {accounts.map((acc) => {
                  const Icon = typeIcons[acc.type] || Wallet;
                  const txCount = acc._count?.transactions || 0;
                  return (
                    <li key={acc.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] sm:gap-x-4">
                      <Button type="button" variant="ghost" aria-label={`Abrir conta ${acc.name}`} onClick={() => { detailReturn.current = acc.id; openAccount(acc); }} data-account-detail={acc.id} className="col-span-2 h-auto min-h-10 min-w-0 justify-start whitespace-normal px-0 text-left sm:col-span-1">
                        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                        <span className="min-w-0 wrap-anywhere">
                          <span className="block font-semibold">{acc.name}</span>
                          <span className="block text-xs text-muted-foreground">{typeLabels[acc.type]}{txCount > 0 && ` · ${txCount} ${txCount === 1 ? 'transação' : 'transações'}`}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
                      </Button>
                      <p className="wrap-anywhere font-mono text-sm font-semibold tabular-nums sm:text-right">{currencyFmt(acc.balance)}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar conta ${acc.name}`} onClick={(event) => { dialogReturn.current = event.currentTarget; openEditAccount(acc); }}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Excluir conta ${acc.name}`} onClick={(event) => { dialogReturn.current = event.currentTarget; setShowDeleteDialog(acc.id); }} className="text-destructive hover:text-destructive">
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
        <DialogContent className={dialogSurface} onCloseAutoFocus={(event) => {
          if (launchDialog.current === 'account') restoreFocusAfterLaunch(event);
          else restoreDialogFocus(event);
        }}>
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
              <Label htmlFor="account-name">Nome</Label>
              <Input id="account-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Nubank, Carteira..."
              />
            </div>
            <div>
              <Label htmlFor="account-type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger id="account-type">
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
              <Label htmlFor="account-balance">Saldo Inicial (R$)</Label>
              <Input id="account-balance"
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
            <div>
              <p id="account-color" className="text-sm font-medium">Cor</p>
              <div role="group" aria-labelledby="account-color" className="mt-2 flex flex-wrap gap-2">
                {accountColors.map(([c, name]) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={name}
                    aria-pressed={form.color === c}
                    className="size-8 rounded-full border border-border aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-foreground focus-visible:outline-ring"
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
            <Button aria-disabled={pending.has(saveKey)} onClick={saveAccount}>
              {editingAccount ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className={dialogSurface} onCloseAutoFocus={restoreDialogFocus}>
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
              <Label htmlFor="transfer-from">De (Origem)</Label>
              <Select
                value={transferForm.fromAccountId}
                onValueChange={(v) =>
                  setTransferForm({ ...transferForm, fromAccountId: v })
                }
              >
                <SelectTrigger id="transfer-from">
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
              <Label htmlFor="transfer-to">Para (Destino)</Label>
              <Select
                value={transferForm.toAccountId}
                onValueChange={(v) =>
                  setTransferForm({ ...transferForm, toAccountId: v })
                }
              >
                <SelectTrigger id="transfer-to">
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
              <Label htmlFor="transfer-amount">Valor (R$)</Label>
              <Input id="transfer-amount"
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
              <Label htmlFor="transfer-date">Data</Label>
              <Input id="transfer-date"
                type="date"
                value={transferForm.date}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="transfer-description">Descrição (opcional)</Label>
              <Input id="transfer-description"
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
              aria-disabled={pending.has('transfer')}
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
        <AlertDialogContent className={dialogSurface} onCloseAutoFocus={restoreDialogFocus}>
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
              aria-disabled={pending.has(`delete:${showDeleteDialog}`)}
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) void deleteAccount(showDeleteDialog);
              }}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
