'use client';

import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { Plus, Pencil, Trash2, RotateCcw, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { currencyFmt } from '@/lib/helpers';
import {
  RecurringTransactionEditor,
  type RecurringTransactionDraft,
} from './recurring-transaction-editor';
import { RecurringDeleteConfirmation } from './recurring-delete-confirmation';

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] motion-reduce:transition-none';

const dateFmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  frequency: string;
  nextDate: string;
  isActive: boolean;
  categoryId?: string | null;
  accountId?: string | null;
  cardId?: string | null;
  category?: { id: string; name: string; color: string; icon: string } | null;
  account?: { id: string; name: string; color: string; icon: string } | null;
  card?: { id: string; name: string; color: string; lastFourDigits: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface Account {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface CardItem {
  id: string;
  name: string;
  color: string;
  lastFourDigits: string;
}

interface RecurringPanelProps {
  recurring: RecurringTransaction[];
  loading: boolean;
  error?: boolean;
  processing: boolean;
  activeCount: number;
  inactiveCount: number;
  monthlyIncome: number;
  monthlyTotal: number;
  openNew: (event: React.MouseEvent<HTMLButtonElement>) => void;
  processRecurring: () => void;
  openEdit: (entry: RecurringTransaction, event: React.MouseEvent<HTMLButtonElement>) => void;
  requestDelete: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  toggleActive: (entry: RecurringTransaction) => void;
  onRetry?: () => void;
}

export function RecurringPanel({
  recurring, loading, error = false, processing, activeCount, inactiveCount, monthlyIncome, monthlyTotal,
  openNew, processRecurring, openEdit, requestDelete, toggleActive, onRetry,
}: RecurringPanelProps) {
  const headingId = useId();
  const listId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4" data-testid="quiet-recurring">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-lg font-semibold tracking-tight">Transações recorrentes</h3>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe lançamentos programados e gerencie suas próximas datas.</p>
        </div>
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openNew} className={focusClass} data-recurring-create="">
              <Plus aria-hidden="true" /> Nova transação recorrente
            </Button>
            <Button variant="outline" onClick={processRecurring} disabled={processing} className={focusClass}>
              <RotateCcw aria-hidden="true" /> {processing ? 'Processando…' : 'Processar'}
            </Button>
          </div>
        )}
      </header>
      {loading ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Carregando recorrências…
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <p role="alert" className="text-sm text-muted-foreground">
            Não foi possível carregar as transações recorrentes.
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <dl aria-label="Resumo das recorrências" className="grid grid-cols-2 gap-px rounded-xl border border-border bg-border sm:grid-cols-3">
            <div className="min-w-0 rounded-tl-xl bg-card p-3 sm:rounded-bl-xl sm:p-4">
              <dt className="text-xs text-muted-foreground">Receitas ativas</dt>
              <dd className="mt-1 break-words font-mono text-base font-semibold tabular-nums">{currencyFmt(monthlyIncome)}</dd>
            </div>
            <div className="min-w-0 rounded-tr-xl bg-card p-3 sm:rounded-none sm:p-4">
              <dt className="text-xs text-muted-foreground">Despesas ativas</dt>
              <dd className="mt-1 break-words font-mono text-base font-semibold tabular-nums">{currencyFmt(monthlyTotal)}</dd>
            </div>
            <div className="col-span-2 rounded-b-xl bg-card p-3 sm:col-span-1 sm:rounded-none sm:rounded-r-xl sm:p-4">
              <dt className="text-xs text-muted-foreground">Ativas / pausadas</dt>
              <dd className="mt-1 font-mono text-base font-semibold tabular-nums">{activeCount} / {inactiveCount}</dd>
            </div>
          </dl>
          <section aria-labelledby={listId} className="min-w-0 rounded-xl border border-border bg-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <h4 id={listId} className="text-sm font-semibold">Recorrências cadastradas</h4>
              <p className="text-xs tabular-nums text-muted-foreground">{recurring.length} {recurring.length === 1 ? 'registro' : 'registros'}</p>
            </header>
            {recurring.length === 0 ? (
              <div className="px-4 py-6">
                <p className="text-sm font-medium">Nenhuma transação recorrente</p>
                <p className="mt-1 text-sm text-muted-foreground">Use Nova transação recorrente para cadastrar um lançamento programado.</p>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {recurring.map((entry) => {
                  const isIncome = entry.type === 'INCOME';
                  const toggleLabel = entry.isActive ? 'Pausar' : 'Ativar';
                  return (
                    <li key={entry.id} className="grid min-w-0 grid-cols-2 items-start gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_minmax(7rem,auto)_auto] lg:items-center">
                      <div className="col-span-2 min-w-0 lg:col-span-1">
                        <p className="break-words text-sm font-semibold">{entry.description}</p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          {[isIncome ? 'Receita' : 'Despesa', frequencyLabels[entry.frequency] || entry.frequency, entry.category?.name, entry.account?.name, entry.card && `${entry.card.name} ****${entry.card.lastFourDigits}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Próxima data</p>
                        <time className="block break-words text-sm tabular-nums" dateTime={entry.nextDate}>{dateFmt(entry.nextDate)}</time>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="break-words font-mono text-sm font-semibold tabular-nums">{isIncome ? '+' : '-'}{currencyFmt(entry.amount)}</p>
                        <p className="text-xs text-muted-foreground">{entry.isActive ? 'Ativa' : 'Pausada'}</p>
                      </div>
                      <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1 lg:justify-end">
                        <Button variant="outline" size="sm" aria-label={`${toggleLabel} ${entry.description}`} onClick={() => toggleActive(entry)} className={focusClass}>
                          {entry.isActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {toggleLabel}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Editar ${entry.description}`} title="Editar" onClick={(event) => openEdit(entry, event)} className={focusClass}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Excluir ${entry.description}`} title="Excluir" onClick={(event) => requestDelete(entry.id, event)} className={focusClass}>
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
    </section>
  );
}

export function RecurringTransactionsWidget() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const formOpening = useRef<object | null>(null);
  const deleteOpening = useRef<object | null>(null);
  const pendingDeletes = useRef(new Set<string>());
  const submittingRef = useRef(false);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const target = returnFocus.current;
    (target?.isConnected ? target : panelRef.current?.querySelector<HTMLButtonElement>('[data-recurring-create]'))?.focus();
    returnFocus.current = null;
  };

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  // Form state
  const defaultNextDate = new Date();
  defaultNextDate.setMonth(defaultNextDate.getMonth() + 1);
  const defaultNextDateStr = defaultNextDate.toISOString().split('T')[0];

  const [form, setForm] = useState<RecurringTransactionDraft>({
    description: '',
    amount: '',
    type: 'EXPENSE',
    frequency: 'MONTHLY',
    nextDate: defaultNextDateStr,
    categoryId: '',
    accountId: '',
    cardId: '',
  });

  // ── Data fetching ────────────────────────────────────────────────
  const fetchRecurring = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/recurring');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setRecurring(await res.json());
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [catRes, accRes, cardRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/accounts'),
        fetch('/api/cards'),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
      if (cardRes.ok) setCards(await cardRes.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRecurring();
    fetchLookups();
  }, [fetchRecurring, fetchLookups]);

  // ── Computed ─────────────────────────────────────────────────────
  const activeCount = recurring.filter((r) => r.isActive).length;
  const inactiveCount = recurring.filter((r) => !r.isActive).length;
  const monthlyTotal = recurring
    .filter((r) => r.isActive && r.type === 'EXPENSE')
    .reduce((sum, r) => sum + r.amount, 0);
  const monthlyIncome = recurring
    .filter((r) => r.isActive && r.type === 'INCOME')
    .reduce((sum, r) => sum + r.amount, 0);

  // ── Actions ──────────────────────────────────────────────────────
  const openNew = () => {
    formOpening.current = {};
    setEditing(null);
    setForm({
      description: '',
      amount: '',
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: defaultNextDateStr,
      categoryId: '',
      accountId: '',
      cardId: '',
    });
    setShowFormDialog(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    formOpening.current = {};
    setEditing(r);
    setForm({
      description: r.description,
      amount: String(r.amount),
      type: r.type,
      frequency: r.frequency,
      nextDate: new Date(r.nextDate).toISOString().split('T')[0],
      categoryId: r.categoryId || '',
      accountId: r.accountId || '',
      cardId: r.cardId || '',
    });
    setShowFormDialog(true);
  };

  const toggleActive = async (r: RecurringTransaction) => {
    try {
      const response = await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      });
      if (!response.ok) throw new Error('Falha ao alterar status');
      toast.success(r.isActive ? 'Transação pausada' : 'Transação ativada');
      fetchRecurring();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const saveForm = async () => {
    const opening = formOpening.current;
    if (submittingRef.current) return;
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Preencha descrição e valor corretamente');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const body = {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        frequency: form.frequency,
        nextDate: form.nextDate,
        categoryId: form.categoryId || null,
        accountId: form.accountId || null,
        cardId: form.cardId || null,
      };

      if (editing) {
        const response = await fetch('/api/recurring', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        });
        if (!response.ok) throw new Error('Falha ao atualizar recorrência');
        toast.success('Transação recorrente atualizada!');
      } else {
        const response = await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Falha ao criar recorrência');
        toast.success('Transação recorrente criada!');
      }
      if (formOpening.current === opening) {
        formOpening.current = null;
        setShowFormDialog(false);
      }
      fetchRecurring();
    } catch {
      toast.error('Erro ao salvar transação recorrente');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const deleteRecurring = async (id: string) => {
    if (pendingDeletes.current.has(id)) return;
    pendingDeletes.current.add(id);
    const opening = deleteOpening.current;
    try {
      const response = await fetch('/api/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Falha ao excluir recorrência');
      toast.success('Transação recorrente excluída!');
      if (deleteOpening.current === opening) {
        deleteOpening.current = null;
        returnFocus.current = null;
        setShowDeleteDialog(null);
      }
      fetchRecurring();
    } catch {
      toast.error('Erro ao excluir');
    } finally {
      pendingDeletes.current.delete(id);
    }
  };

  const processRecurring = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/recurring/process', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Processamento concluído');
        fetchRecurring();
      } else {
        toast.error(data.error || 'Erro ao processar');
      }
    } catch {
      toast.error('Erro ao processar transações');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div ref={panelRef} className="min-w-0">
      <RecurringPanel
        recurring={recurring}
        loading={loading}
        error={loadError}
        processing={processing}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        monthlyIncome={monthlyIncome}
        monthlyTotal={monthlyTotal}
        processRecurring={processRecurring}
        openNew={(event) => { returnFocus.current = event.currentTarget; openNew(); }}
        openEdit={(entry, event) => { returnFocus.current = event.currentTarget; openEdit(entry); }}
        requestDelete={(id, event) => { returnFocus.current = event.currentTarget; deleteOpening.current = {}; setShowDeleteDialog(id); }}
        toggleActive={toggleActive}
        onRetry={() => { setLoading(true); void fetchRecurring(); }}
      />
      <RecurringTransactionEditor
        mode={editing ? 'edit' : 'create'}
        open={showFormDialog}
        submitting={submitting}
        form={form}
        categories={categories}
        accounts={accounts}
        cards={cards}
        onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        onOpenChange={(open) => {
          if (!open) formOpening.current = null;
          setShowFormDialog(open);
        }}
        onCloseAutoFocus={restoreFocus}
        onSave={saveForm}
      />

      <RecurringDeleteConfirmation
        open={showDeleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            deleteOpening.current = null;
            setShowDeleteDialog(null);
          }
        }}
        onCloseAutoFocus={restoreFocus}
        onConfirm={() => {
          if (showDeleteDialog) {
            return deleteRecurring(showDeleteDialog);
          }
        }}
      />
    </div>
  );
}
