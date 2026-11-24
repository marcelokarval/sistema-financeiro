'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import {
  Plus,
  ArrowLeft,
  Landmark,
  CreditCard,
  HandCoins,
  User,
  Home,
  Check,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  currencyFmt,
  dateFmt,
} from '@/lib/helpers';
import { createInstallmentSelection, type InstallmentPlan, type InstallmentSelection } from '@/lib/installment-selection';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { InstallmentPlanEditor, type InstallmentPlanDraft } from './installment-plan-editor';
import { InstallmentDeleteConfirmation } from './installment-delete-confirmation';

// ── Plan Type Config ──────────────────────────────────────────────
const planTypeConfig: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  FINANCING: {
    label: 'Financiamento',
    icon: Landmark,
  },
  CARD_INSTALLMENT: {
    label: 'Parcelamento no Cartão',
    icon: CreditCard,
  },
  LOAN: {
    label: 'Empréstimo',
    icon: HandCoins,
  },
  PERSONAL: {
    label: 'Empréstimo Pessoal',
    icon: User,
  },
  RENTAL: {
    label: 'Aluguel',
    icon: Home,
  },
};

const statusConfig: Record<string, { text: string }> = {
  ACTIVE: { text: 'Ativo' },
  COMPLETED: { text: 'Concluído' },
  CANCELLED: { text: 'Cancelado' },
  OVERDUE: { text: 'Atrasado' },
};

const installmentStatusConfig: Record<string, { text: string; className: string }> = {
  PAID: {
    text: 'Pago',
    className: 'border border-(--ds-accent-positive)/30 bg-(--ds-accent-positive)/10 text-(--ds-accent-positive)',
  },
  PENDING: {
    text: 'Pendente',
    className: 'border border-(--ds-accent-warning)/30 bg-(--ds-accent-warning)/10 text-(--ds-accent-warning)',
  },
  OVERDUE: {
    text: 'Atrasado',
    className: 'border border-(--ds-accent-danger)/30 bg-(--ds-accent-danger)/10 text-(--ds-accent-danger)',
  },
};

// ── Interfaces ─────────────────────────────────────────────────────
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
  const [selection, setSelection] = useState<InstallmentSelection>(null);
  const [confirmedPlanId, setConfirmedPlanId] = useState<string | null>(null);
  const [detailSelection] = useState(() => createInstallmentSelection((next) => {
    setSelection(next);
    if (next?.phase === 'ready') setConfirmedPlanId(next.id);
    else if (!next) setConfirmedPlanId(null);
  }));
  const selectedPlan = selection?.phase === 'ready' ? selection.detail : null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const createInFlight = useRef(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteInFlight = useRef(false);
  const [payingInstallment, setPayingInstallment] = useState<string | null>(null);
  const paymentInFlight = useRef(false);

  // Options for selects
  const [cards, setCards] = useState<CardOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Create form
  const [form, setForm] = useState<InstallmentPlanDraft>({
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
  const handleFormFieldChange = (field: keyof InstallmentPlanDraft, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ── Data fetching ────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/installments');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setPlans(await res.json());
    } catch (e) {
      setLoadError(true);
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

  useEffect(() => {
    const syncSelection = () => {
      const targetId = useAppStore.getState().selectedInstallmentPlanId;
      if (!targetId || loading) return;
      const target = plans.find((p) => p.id === targetId);
      if (target) void detailSelection.open(target);
      useAppStore.getState().setSelectedInstallmentPlanId(null);
    };
    syncSelection();
    return useAppStore.subscribe(syncSelection);
  }, [detailSelection, loading, plans]);

  // ── Auto-calculate monthly value ─────────────────────────────────
  const handleAmountChange = (amount: string) => {
    setForm((prev) => {
      const a = parseFloat(amount) || 0;
      const c = parseInt(prev.installmentCount) || 1;
      const mv = c > 0 ? a / c : 0;
      return { ...prev, totalAmount: amount, monthlyValue: mv > 0 ? mv.toFixed(2) : '' };
    });
  };

  const handleCountChange = (count: string) => {
    setForm((prev) => {
      const a = parseFloat(prev.totalAmount) || 0;
      const c = parseInt(count) || 1;
      const mv = c > 0 ? a / c : 0;
      return { ...prev, installmentCount: count, monthlyValue: mv > 0 ? mv.toFixed(2) : '' };
    });
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
        return plans.filter((p) => p.status === 'OVERDUE' || (p.installments?.some((i) => i.status === 'OVERDUE') ?? false));
      default:
        return plans;
    }
  }, [plans, activeTab]);

  // ── Actions ──────────────────────────────────────────────────────
  const closePlanDetail = () => {
    setShowDeleteDialog(null);
    detailSelection.close();
  };

  const createPlan = async () => {
    if (createInFlight.current) return;
    createInFlight.current = true;
    setCreating(true);
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
        const data = await res.json().catch(() => ({}));
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
    } finally {
      createInFlight.current = false;
      setCreating(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleting(true);
    try {
      const res = await fetch('/api/installments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Falha ao excluir plano');
      toast.success('Plano excluído!');
      prepareDeleteFocus();
      setShowDeleteDialog(null);
      if (selection?.id === id) detailSelection.close(selection);
      fetchPlans();
    } catch {
      toast.error('Erro ao excluir plano');
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const markAsPaid = async (installmentId: string, paidDate?: string) => {
    const target = detailSelection.paymentTarget(selection, installmentId);
    if (!target || paymentInFlight.current) return;
    paymentInFlight.current = true;
    setPayingInstallment(target);
    try {
      const body: { installmentId: string; paidDate?: string } = { installmentId: target };
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

      await detailSelection.refresh(selection);
      fetchPlans();
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      paymentInFlight.current = false;
      setPayingInstallment(null);
    }
  };

  const focusListAfterDelete = useRef(false);
  const detailOrigin = useRef<string | null>(null);
  const isShowingDetail = selection !== null;
  useLayoutEffect(() => {
    if (isShowingDetail) {
      document.getElementById('plan-detail-title')?.focus();
      return;
    }
    if (focusListAfterDelete.current) {
      focusListAfterDelete.current = false;
      detailOrigin.current = null;
      document.getElementById('installments-title')?.focus();
      return;
    }
    const origin = detailOrigin.current;
    if (origin) {
      detailOrigin.current = null;
      const row = document.getElementById(origin);
      if (row) row.focus();
      else document.getElementById('installments-title')?.focus();
    }
  }, [isShowingDetail]);

  const dialogOrigin = useRef<HTMLElement | null>(null);
  const rememberDialogOrigin = (trigger: HTMLButtonElement, open: () => void) => {
    dialogOrigin.current = trigger;
    open();
  };
  const prepareDeleteFocus = () => {
    dialogOrigin.current = null;
    focusListAfterDelete.current = isShowingDetail;
  };
  const restoreDialogFocus = (event: Event) => {
    event.preventDefault();
    const origin = dialogOrigin.current;
    if (origin?.isConnected) origin.focus();
    else (document.getElementById('installments-title') ?? document.getElementById('plan-detail-title'))?.focus();
  };

  if (loading) {
    return (
      <section className="space-y-4" aria-labelledby="installments-title">
        <h2 id="installments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">Parcelas e financiamentos</h2>
        <div role="status" className="space-y-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p>Carregando planos…</p>
          <Skeleton aria-hidden="true" className="h-20 rounded-lg motion-reduce:animate-none" />
          <Skeleton aria-hidden="true" className="h-32 rounded-lg motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  // ── Plan Detail View ─────────────────────────────────────────────
  if (selection) {
    const config = selectedPlan && (planTypeConfig[selectedPlan.type] || planTypeConfig.FINANCING);
    const progressPct = selectedPlan && selectedPlan.installmentCount > 0
      ? Math.round((selectedPlan.paidInstallments / selectedPlan.installmentCount) * 100)
      : 0;
    const paidAmount = (selectedPlan?.paidInstallments || 0) * (selectedPlan?.monthlyValue || 0);
    const remainingAmount = Math.max(0, (selectedPlan?.totalAmount || 0) - paidAmount);
    const nextInstallment = selectedPlan?.installments?.find((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
    return (
      <section key={selection.id} className="min-w-0 space-y-5" aria-labelledby="plan-detail-title">
        <Button variant="ghost" size="sm" onClick={closePlanDetail}><ArrowLeft aria-hidden="true" /> Voltar aos planos</Button>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="plan-detail-title" tabIndex={-1} className="break-words text-xl font-semibold tracking-tight">{selection.description}</h2>
            {selectedPlan && config && (
              <p className="mt-1 text-sm text-muted-foreground">{config.label} · {statusConfig[selectedPlan.status]?.text || selectedPlan.status}</p>
            )}
          </div>
          {confirmedPlanId === selection.id && (
            <Button variant="outline" size="sm" className="text-destructive aria-disabled:opacity-50" aria-disabled={!selectedPlan}
              onClick={(event) => {
                if (selectedPlan) rememberDialogOrigin(event.currentTarget, () => setShowDeleteDialog(selectedPlan.id));
              }}><Trash2 aria-hidden="true" /> Excluir plano</Button>
          )}
        </header>
        {selectedPlan ? (
          <>
            <InstallmentMetrics label="Resumo do plano" metrics={[
              { label: 'Valor restante', value: currencyFmt(remainingAmount) },
              { label: 'Total financiado', value: currencyFmt(selectedPlan.totalAmount) },
              { label: 'Valor pago', value: currencyFmt(paidAmount) },
              { label: 'Próximo vencimento', value: nextInstallment ? dateFmt(nextInstallment.dueDate) : '—' },
            ]} />
            <section aria-labelledby="plan-progress-title" className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="plan-progress-title" className="text-sm font-semibold">Progresso do pagamento</h3>
                <p className="font-mono text-sm tabular-nums">{selectedPlan.paidInstallments} de {selectedPlan.installmentCount} pagas · {progressPct}%</p>
              </div>
              <Progress aria-labelledby="plan-progress-title" value={progressPct} className="h-2 motion-reduce:[&>div]:transition-none" />
              {selectedPlan.interestRate > 0 && (
                <p className="text-sm text-muted-foreground">
                  Taxa de juros: <strong>{selectedPlan.interestRate}%</strong> · Parcela mensal: <strong className="font-mono tabular-nums">{currencyFmt(selectedPlan.monthlyValue)}</strong> · Início: <strong>{dateFmt(selectedPlan.startDate)}</strong>
                </p>
              )}
            </section>
            <InstallmentEntries plan={selectedPlan} paying={payingInstallment} onPay={markAsPaid} />
          </>
        ) : selection.phase === 'loading' ? (
          <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Carregando parcelas…</p>
        ) : (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">Não foi possível carregar os detalhes do plano.</p>
        )}
        {confirmedPlanId === selection.id && (
          <InstallmentDeleteConfirmation
            open={!!showDeleteDialog}
            deleting={deleting}
            planDescription={selection.description}
            actionDisabled={!selectedPlan}
            onOpenChange={(open) => { if (!open && !deleteInFlight.current) setShowDeleteDialog(null); }}
            onCloseAutoFocus={restoreDialogFocus}
            onConfirm={() => {
              if (selectedPlan?.id === showDeleteDialog) return deletePlan(selectedPlan.id);
            }}
          />
        )}
      </section>
    );
  }

  return (
    <>
      <InstallmentPortfolio summary={summary} count={plans.length} records={filteredPlans} filter={activeTab} loadError={loadError} onRetry={() => { setLoading(true); void fetchPlans(); }}
        onFilter={setActiveTab} onNew={(event) => rememberDialogOrigin(event.currentTarget, () => setShowCreateDialog(true))} onOpen={(plan) => {
          detailOrigin.current = `plan-row-${plan.id}`;
          void detailSelection.open(plan);
        }} />

        {/* Create Plan Dialog */}
        <InstallmentPlanEditor
          open={showCreateDialog}
          creating={creating}
          form={form}
          cards={cards}
          categories={categories}
          planTypes={planTypeConfig}
          onFieldChange={handleFormFieldChange}
          onAmountChange={handleAmountChange}
          onCountChange={handleCountChange}
          onOpenChange={setShowCreateDialog}
          onCloseAutoFocus={restoreDialogFocus}
          onSubmit={createPlan}
        />

        {/* Delete confirmation */}
        <InstallmentDeleteConfirmation
          open={!!showDeleteDialog}
          deleting={deleting}
          onOpenChange={(open) => { if (!open && !deleteInFlight.current) setShowDeleteDialog(null); }}
          onCloseAutoFocus={restoreDialogFocus}
          onConfirm={() => {
            if (showDeleteDialog) return deletePlan(showDeleteDialog);
          }}
        />
    </>
  );
}

function InstallmentMetrics({ label, metrics }: { label: string; metrics: { label: string; value: string; note?: string }[] }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-lg border bg-card p-4 md:grid-cols-4">
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

const planFilters = [
  { key: 'ALL', label: 'Todos', empty: 'Nenhum plano cadastrado. Use “Novo plano” para começar.' },
  { key: 'ACTIVE', label: 'Ativos', empty: 'Nenhum plano ativo.' },
  { key: 'COMPLETED', label: 'Concluídos', empty: 'Nenhum plano concluído.' },
  { key: 'OVERDUE', label: 'Atrasados', empty: 'Nenhum plano em atraso.' },
];

export function InstallmentPortfolio({ summary, count, records, filter, loadError, onRetry, onFilter, onNew, onOpen }: {
  summary: { totalFinanced: number; totalPaid: number; remaining: number; overdueCount: number };
  count: number; records: InstallmentPlan[]; filter: string; loadError?: boolean; onRetry?: () => void; onFilter: (value: string) => void; onNew: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (plan: InstallmentPlan) => void;
}) {
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="installments-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="installments-title" tabIndex={-1} className="text-xl font-semibold tracking-tight">Parcelas e financiamentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe seus planos e pagamentos</p>
        </div>
        <Button size="sm" onClick={onNew}><Plus aria-hidden="true" /> Novo plano</Button>
      </header>
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
          <p className="text-destructive">Não foi possível carregar os planos.</p>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
        </div>
      )}
      <InstallmentMetrics label="Resumo dos planos" metrics={[
        { label: 'Valor restante', value: currencyFmt(summary.remaining), note: 'Saldo devedor total' },
        { label: 'Total financiado', value: currencyFmt(summary.totalFinanced), note: `${count} plano${count !== 1 ? 's' : ''} no total` },
        { label: 'Total pago', value: currencyFmt(summary.totalPaid) },
        { label: 'Parcelas em atraso', value: String(summary.overdueCount), note: summary.overdueCount > 0 ? 'Atenção necessária' : 'Nenhum atraso' },
      ]} />
      <section aria-labelledby="plan-records-title" className="space-y-3">
        <h3 id="plan-records-title" className="font-semibold">Planos</h3>
        <div role="group" aria-label="Filtrar planos por situação" className="flex flex-wrap gap-2">
          {planFilters.map((tab) => (
            <Button key={tab.key} size="sm" variant={filter === tab.key ? 'secondary' : 'outline'}
              aria-pressed={filter === tab.key} onClick={() => onFilter(tab.key)}>{tab.label}</Button>
          ))}
        </div>
        {records.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{planFilters.find((tab) => tab.key === filter)?.empty}</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {records.map((plan) => {
              const config = planTypeConfig[plan.type] || planTypeConfig.FINANCING;
              const progressPct = plan.installmentCount > 0 ? Math.round((plan.paidInstallments / plan.installmentCount) * 100) : 0;
              const nextInstallment = plan.installments?.find((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
              const overdueInstallments = plan.installments?.filter((i) => i.status === 'OVERDUE').length || 0;
              return (
                <li key={plan.id} className="min-w-0 p-2">
                  <button type="button" id={`plan-row-${plan.id}`} aria-label={`Abrir plano: ${plan.description}`} onClick={() => onOpen(plan)}
                    className="grid w-full min-w-0 gap-3 rounded-md p-2 text-left hover:bg-accent md:grid-cols-3 md:items-center">
                    <span className="flex min-w-0 items-start gap-2">
                      <config.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{plan.description}</span>
                        <span className="block text-xs text-muted-foreground">{config.label} · {statusConfig[plan.status]?.text || plan.status}</span>
                        {(plan.card || plan.category) && <span className="block break-words text-xs text-muted-foreground">{[plan.card?.name, plan.category?.name].filter(Boolean).join(' · ')}</span>}
                      </span>
                    </span>
                    <span className="min-w-0 text-xs text-muted-foreground">
                      Total <span className="break-words font-mono font-semibold tabular-nums text-foreground">{currencyFmt(plan.totalAmount)}</span>
                      <span className="block font-mono tabular-nums">{currencyFmt(plan.monthlyValue)}/mês · {plan.installmentCount}x</span>
                    </span>
                    <span className="min-w-0 text-xs text-muted-foreground">
                      <span className="block font-mono tabular-nums">{plan.paidInstallments} de {plan.installmentCount} pagas · {progressPct}%</span>
                      {overdueInstallments > 0 && <span className="block text-destructive">{overdueInstallments} em atraso</span>}
                      {nextInstallment && plan.status === 'ACTIVE' && <span className="block">Próximo vencimento: {dateFmt(nextInstallment.dueDate)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

export function InstallmentEntries({ plan, paying, onPay }: { plan: InstallmentPlan; paying: string | null; onPay: (id: string) => void }) {
  return (
    <section aria-labelledby="plan-entries-title" className="space-y-3">
      <h3 id="plan-entries-title" className="font-semibold">Parcelas</h3>
      {!plan.installments?.length ? (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Nenhuma parcela encontrada. As parcelas serão geradas automaticamente.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {plan.installments.map((inst) => {
            const config = installmentStatusConfig[inst.status] || installmentStatusConfig.PENDING;
            const isPaying = paying === inst.id;
            const label = `Parcela ${inst.number} de ${plan.installmentCount}`;
            return (
              <li key={inst.id} className="grid min-w-0 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">Vencimento: {dateFmt(inst.dueDate)}{inst.paidDate && ` · Pago em ${dateFmt(inst.paidDate)}`}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.className}`}>{config.text}</span>
                  <span className="break-words font-mono text-sm font-semibold tabular-nums">{currencyFmt(inst.amount)}</span>
                  {inst.installmentPlanId === plan.id && inst.status !== 'PAID' && (
                    <Button size="sm" variant="outline" disabled={paying !== null} aria-label={`Pagar ${label.toLowerCase()}`}
                      aria-busy={isPaying} onClick={(event) => {
                        const button = event.currentTarget;
                        // Preserve keyboard focus before the control is disabled or replaced.
                        if (button.ownerDocument.activeElement === button) {
                          button.ownerDocument.getElementById('plan-detail-title')?.focus();
                        }
                        return onPay(inst.id);
                      }}>
                      <Check aria-hidden="true" /> {isPaying ? 'Pagando…' : 'Pagar'}
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
