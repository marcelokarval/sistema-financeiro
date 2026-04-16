'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Wallet, Landmark, Smartphone, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); }
  catch { return d; }
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

const accountColors = ['#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#ef4444', '#ec4899'];

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  category?: { id: string; name: string; color: string };
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

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
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', type: 'CASH', balance: '0', color: '#22c55e', icon: 'wallet',
  });
  const [txForm, setTxForm] = useState({
    type: 'EXPENSE', amount: '', description: '', date: new Date().toISOString().split('T')[0],
    categoryId: '', notes: '',
  });

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchTransactions = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/transactions?accountId=${accountId}`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchAccounts(); fetchCategories(); }, [fetchAccounts, fetchCategories]);

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
    setForm({ name: acc.name, type: acc.type, balance: String(acc.balance), color: acc.color, icon: acc.icon });
    setShowAccountDialog(true);
  };

  const saveAccount = async () => {
    try {
      const body = { ...form, balance: parseFloat(form.balance) || 0 };
      if (editingAccount) {
        await fetch('/api/accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingAccount.id, ...body }) });
        toast.success('Conta atualizada!');
      } else {
        await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast.success('Conta criada!');
      }
      setShowAccountDialog(false);
      fetchAccounts();
    } catch { toast.error('Erro ao salvar conta'); }
  };

  const deleteAccount = async (id: string) => {
    try {
      await fetch('/api/accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success('Conta excluída!');
      setShowDeleteDialog(null);
      if (selectedAccount?.id === id) setSelectedAccount(null);
      fetchAccounts();
    } catch { toast.error('Erro ao excluir conta'); }
  };

  const saveTransaction = async () => {
    if (!selectedAccount) return;
    try {
      const body = { ...txForm, amount: parseFloat(txForm.amount), accountId: selectedAccount.id };
      await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success('Transação registrada!');
      setShowTransactionDialog(false);
      setTxForm({ type: 'EXPENSE', amount: '', description: '', date: new Date().toISOString().split('T')[0], categoryId: '', notes: '' });
      fetchTransactions(selectedAccount.id);
      fetchAccounts();
    } catch { toast.error('Erro ao registrar transação'); }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  if (selectedAccount) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedAccount(null)}>
            <X className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAccount.color }} />
            <h2 className="text-lg font-semibold">{selectedAccount.name}</h2>
            <Badge variant="outline">{typeLabels[selectedAccount.type]}</Badge>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold">{currencyFmt(selectedAccount.balance)}</p>
          </div>
          <Button onClick={() => setShowTransactionDialog(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Transação
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma transação registrada
                </p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                        {tx.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateFmt(tx.date)}
                          {tx.category && ` · ${tx.category.name}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{currencyFmt(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* New Transaction Dialog */}
        <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
              <DialogDescription>Registrar nova transação em {selectedAccount.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={txForm.type} onValueChange={(v) => setTxForm({ ...txForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Label>Descrição</Label>
                <Input value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="Ex: Salário, Almoço..." />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} placeholder="0,00" />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={txForm.categoryId} onValueChange={(v) => setTxForm({ ...txForm, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === txForm.type).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransactionDialog(false)}>Cancelar</Button>
              <Button onClick={saveTransaction}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas contas e saldo</p>
        </div>
        <Button onClick={openNewAccount} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const Icon = typeIcons[acc.type] || Wallet;
          return (
            <Card
              key={acc.id}
              className="cursor-pointer hover:shadow-md transition-all duration-200 group relative"
              onClick={() => openAccount(acc)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${acc.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: acc.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{acc.name}</p>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {typeLabels[acc.type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openEditAccount(acc); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(acc.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-2xl font-bold mt-4">{currencyFmt(acc.balance)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Account Form Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Atualize os dados da conta' : 'Preencha os dados da nova conta'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank, Carteira..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="BANK">Banco</SelectItem>
                  <SelectItem value="DIGITAL_WALLET">Carteira Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Saldo Inicial (R$)</Label>
              <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {accountColors.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountDialog(false)}>Cancelar</Button>
            <Button onClick={saveAccount}>{editingAccount ? 'Atualizar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as transações vinculadas também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteDialog && deleteAccount(showDeleteDialog)} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
