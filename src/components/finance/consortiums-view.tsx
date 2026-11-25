'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, Building2, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { ConsortiumEditor, type ConsortiumDraft } from './consortium-editor';
import { ConsortiumDeleteConfirmation } from './consortium-delete-confirmation';
import {
  ConsortiumInstallmentPayment,
  type ConsortiumInstallmentPaymentDraft,
} from './consortium-installment-payment';

import { currencyFmt, dateFmt, pct } from '@/lib/helpers';
import { findPayableConsortiumInstallment, isCurrentConsortiumSelection, readConsortiumInstallments,
  resolveConsortiumPaymentRefresh,
  type ConsortiumInstallment, type ConsortiumSelection } from '@/lib/consortium-selection';
import { EmptyState, StatusBadge } from '@/components/shared/ui-helpers';
import { useAppStore } from '@/lib/store';

// ── Types ─────────────────────────────────────────────────────────
interface Consortium {
  id: string;
  description: string;
  group: string;
  quota: string;
  administrator: string;
  totalAmount: number;
  fundedAmount: number;
  monthlyPayment: number;
  installmentCount: number;
  paidInstallments: number;
  startDate: string;
  endDate: string | null;
  nextAssemblyDate: string | null;
  assembliesAttended: number;
  status: string;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
  accountId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PayConfirmation {
  opening: ConsortiumSelection;
  installment: ConsortiumInstallment;
}

type InstallmentLoad = 'loading' | 'ready' | 'error';

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
}

// ── Status Configs ────────────────────────────────────────────────
const consortiumStatusLabels: Record<string, { text: string; className: string }> = {
  ACTIVE: { text: 'Ativo', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  COMPLETED: { text: 'Concluído', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  CANCELLED: { text: 'Cancelado', className: 'bg-muted text-muted-foreground' },
  CONTEMPLATED: { text: 'Contemplado', className: 'bg-muted text-[var(--ds-accent-warning)]' },
};

const installmentStatusLabels: Record<string, { text: string; className: string }> = {
  PAID: { text: 'Paga', className: 'bg-muted text-[var(--ds-accent-positive)]' },
  PENDING: { text: 'Pendente', className: 'bg-muted text-[var(--ds-accent-warning)]' },
  OVERDUE: { text: 'Vencida', className: 'bg-muted text-destructive' },
};

type FilterStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'CONTEMPLATED';

const assemblyDateForInput = (value: string | null) => value?.slice(0, 10) ?? '';

function formatAssemblyDate(value: string) {
  // A API serializa o dia escolhido no input como ISO em UTC.
  const [year, month, day] = assemblyDateForInput(value).split('-');
  return `${day}/${month}/${year}`;
}

// ── Component ─────────────────────────────────────────────────────
export function ConsortiumsView() {
  const [consortiums, setConsortiums] = useState<Consortium[]>([]);
  const [installments, setInstallments] = useState<ConsortiumInstallment[]>([]);
  const [installmentLoad, setInstallmentLoad] = useState<InstallmentLoad>('loading');
  const currentOpening = useRef<ConsortiumSelection | null>(null);
  const currentRows = useRef<ConsortiumInstallment[] | null>(null);
  const installmentRequest = useRef<AbortController | null>(null);
  const listRequest = useRef(0);
  const detailSummaryRequest = useRef(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selection, setSelection] = useState<{ opening: ConsortiumSelection; consortium: Consortium } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  // Dialog states
  const [createOpening, setCreateOpening] = useState<symbol | null>(null);
  const [editOpening, setEditOpening] = useState<symbol | null>(null);
  const currentCreateOpening = useRef<symbol | null>(null);
  const currentEditOpening = useRef<symbol | null>(null);
  const pendingCreates = useRef(new Set<symbol>());
  const pendingEdits = useRef(new Set<string>());
  const [creating, setCreating] = useState<symbol | null>(null);
  const [editingIds, setEditingIds] = useState(new Set<string>());
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteInFlight = useRef(false);
  const [payConfirmation, setPayConfirmation] = useState<PayConfirmation | null>(null);
  const currentConfirmation = useRef<PayConfirmation | null>(null);
  const [submitting, setSubmitting] = useState<PayConfirmation | null>(null);
  const pendingConsortiumPayments = useRef(new Set<string>());
  const paidInSession = useRef(new Set<string>());

  // Create form
  const [createForm, setCreateForm] = useState({
    description: '',
    group: '',
    quota: '',
    administrator: '',
    totalAmount: '',
    monthlyPayment: '',
    installmentCount: '',
    startDate: new Date().toISOString().split('T')[0],
    nextAssemblyDate: '',
    categoryId: '',
    accountId: '',
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    id: '',
    nextAssemblyDate: '',
    assembliesAttended: '',
  });

  // Pay installment form
  const [payForm, setPayForm] = useState<ConsortiumInstallmentPaymentDraft>({
    paidDate: new Date().toISOString().split('T')[0],
    notes: '',
    assemblyDate: '',
    assemblyResult: '',
  });

  // ── Data Fetching ───────────────────────────────────────────────
  const fetchInstallmentsRef = useRef<(opening: ConsortiumSelection) => Promise<void>>(async () => {});

  const fetchConsortiums = useCallback(async (opening?: ConsortiumSelection) => {
    const request = ++listRequest.current;
    if (opening) detailSummaryRequest.current = request;
    if (!opening) setLoadError(false);
    try {
      const res = await fetch('/api/consortiums');
      if (!res.ok) {
        if (!opening && request === listRequest.current) setLoadError(true);
        return;
      }
      const rows: Consortium[] = await res.json();
      if (request === listRequest.current) setConsortiums(rows);
      if (request === listRequest.current) setLoadError(false);
      if (opening && request === detailSummaryRequest.current
        && isCurrentConsortiumSelection(currentOpening.current, opening)) {
        const updated = rows.find((row) => row.id === opening.consortiumId);
        if (updated) setSelection({ opening, consortium: updated });
      } else if (!opening && request === listRequest.current) {
        const selectedId = useAppStore.getState().selectedConsortiumId;
        if (selectedId) {
          const target = rows.find((row) => row.id === selectedId);
          useAppStore.getState().setSelectedConsortiumId(null);
          if (target) {
            const nextOpening = { consortiumId: target.id };
            currentOpening.current = nextOpening;
            setSelection({ opening: nextOpening, consortium: target });
            void fetchInstallmentsRef.current(nextOpening);
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (!opening && request === listRequest.current) setLoadError(true);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, []);

  const closePayDialog = useCallback(() => {
    currentConfirmation.current = null;
    setPayConfirmation(null);
  }, []);

  const fetchInstallments = useCallback(async (opening: ConsortiumSelection) => {
    if (!isCurrentConsortiumSelection(currentOpening.current, opening)) return;
    installmentRequest.current?.abort();
    const request = new AbortController();
    installmentRequest.current = request;
    currentRows.current = null;
    closePayDialog();
    setInstallments([]);
    setInstallmentLoad('loading');

    let rows: ConsortiumInstallment[] | null = null;
    try {
      const res = await fetch(`/api/consortiums/installments?consortiumId=${encodeURIComponent(opening.consortiumId)}`,
        { signal: request.signal });
      if (res.ok) rows = readConsortiumInstallments(opening, await res.json());
    } catch {
      // Falha de rede ou JSON inválido: nenhuma parcela fica disponível.
    }
    if (request.signal.aborted || !isCurrentConsortiumSelection(currentOpening.current, opening)) return;
    currentRows.current = rows;
    setInstallments(rows ?? []);
    setInstallmentLoad(rows ? 'ready' : 'error');
  }, [closePayDialog]);
  fetchInstallmentsRef.current = fetchInstallments;

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
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

  useEffect(() => {
    fetchConsortiums();
    fetchCategories();
    fetchAccounts();
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!state.selectedConsortiumId) return;
      const targetId = state.selectedConsortiumId;
      useAppStore.getState().setSelectedConsortiumId(null);
      setConsortiums((current) => {
        const match = current.find((c) => c.id === targetId);
        if (match) {
          const nextOpening = { consortiumId: match.id };
          currentOpening.current = nextOpening;
          setSelection({ opening: nextOpening, consortium: match });
          void fetchInstallments(nextOpening);
        }
        return current;
      });
    });
    return () => {
      unsubscribe();
      currentCreateOpening.current = null;
      currentEditOpening.current = null;
      currentOpening.current = null;
      currentConfirmation.current = null;
      currentRows.current = null;
      installmentRequest.current?.abort();
      listRequest.current++;
    };
  }, [fetchConsortiums, fetchCategories, fetchAccounts, fetchInstallments]);

  // ── Computed Summary ────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalEmConsortios = consortiums.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalPago = consortiums.reduce((sum, c) => sum + c.fundedAmount, 0);
    const valorRestante = totalEmConsortios - totalPago;
    const taxaProgresso = totalEmConsortios > 0 ? pct(totalPago, totalEmConsortios) : 0;
    return { totalEmConsortios, totalPago, valorRestante, taxaProgresso };
  }, [consortiums]);

  // ── Filtered Consortiums ────────────────────────────────────────
  const filteredConsortiums = useMemo(() => {
    if (filter === 'ALL') return consortiums;
    return consortiums.filter((c) => c.status === filter);
  }, [consortiums, filter]);

  // ── Actions ─────────────────────────────────────────────────────
  const openConsortium = (c: Consortium) => {
    closeCreateDialog();
    closeEditDialog();
    const opening = { consortiumId: c.id };
    currentOpening.current = opening;
    setSelection({ opening, consortium: c });
    void fetchInstallments(opening);
  };

  const closeConsortium = () => {
    closeEditDialog();
    currentOpening.current = null;
    currentRows.current = null;
    installmentRequest.current?.abort();
    closePayDialog();
    setSelection(null);
    setInstallments([]);
    setInstallmentLoad('loading');
  };

  const closeCreateDialog = () => {
    currentCreateOpening.current = null;
    setCreateOpening(null);
  };

  const closeEditDialog = () => {
    currentEditOpening.current = null;
    setEditOpening(null);
  };

  const openCreateDialog = () => {
    const opening = Symbol();
    currentCreateOpening.current = opening;
    setCreateForm({
      description: '',
      group: '',
      quota: '',
      administrator: '',
      totalAmount: '',
      monthlyPayment: '',
      installmentCount: '',
      startDate: new Date().toISOString().split('T')[0],
      nextAssemblyDate: '',
      categoryId: '',
      accountId: '',
    });
    setCreateOpening(opening);
  };

  const openEditDialog = (c: Consortium) => {
    const opening = Symbol();
    currentEditOpening.current = opening;
    setEditForm({
      id: c.id,
      nextAssemblyDate: assemblyDateForInput(c.nextAssemblyDate),
      assembliesAttended: String(c.assembliesAttended),
    });
    setEditOpening(opening);
  };

  const openPayDialog = (opening: ConsortiumSelection, inst: ConsortiumInstallment, event: MouseEvent<HTMLButtonElement>) => {
    const installment = findPayableConsortiumInstallment(currentOpening.current, opening, currentRows.current, inst.id);
    if (!installment) return;
    if (installment !== inst || pendingConsortiumPayments.current.has(opening.consortiumId) || paidInSession.current.has(installment.id)) return;
    captureDialogFocus(event);
    setPayForm({
      paidDate: new Date().toISOString().split('T')[0],
      notes: '',
      assemblyDate: '',
      assemblyResult: '',
    });
    const confirmation = { opening, installment };
    currentConfirmation.current = confirmation;
    setPayConfirmation(confirmation);
  };

  const createConsortium = async () => {
    const opening = createOpening;
    if (!opening || currentCreateOpening.current !== opening || pendingCreates.current.has(opening)) return;
    pendingCreates.current.add(opening);
    setCreating(opening);
    try {
      const body = {
        description: createForm.description,
        group: createForm.group,
        quota: createForm.quota,
        administrator: createForm.administrator,
        totalAmount: parseFloat(createForm.totalAmount) || 0,
        monthlyPayment: parseFloat(createForm.monthlyPayment) || 0,
        installmentCount: parseInt(createForm.installmentCount) || 0,
        startDate: createForm.startDate || new Date().toISOString(),
        nextAssemblyDate: createForm.nextAssemblyDate || null,
        categoryId: createForm.categoryId || null,
        accountId: createForm.accountId && createForm.accountId !== 'none' ? createForm.accountId : null,
      };
      const res = await fetch('/api/consortiums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        if (currentCreateOpening.current === opening) toast.error(data.error || 'Erro ao criar consórcio');
        return;
      }
      if (currentCreateOpening.current === opening) {
        toast.success('Consórcio criado com sucesso!');
        closeCreateDialog();
      }
      void fetchConsortiums();
    } catch {
      if (currentCreateOpening.current === opening) toast.error('Erro ao criar consórcio');
    } finally {
      pendingCreates.current.delete(opening);
      setCreating((current) => current === opening ? null : current);
    }
  };

  const changeEditField = (field: keyof ConsortiumDraft, value: string) => {
    setEditForm({ ...editForm, [field]: value });
  };

  const updateConsortium = async () => {
    const opening = editOpening;
    const id = editForm.id;
    if (!opening || currentEditOpening.current !== opening || pendingEdits.current.has(id)) return;
    pendingEdits.current.add(id);
    setEditingIds(new Set(pendingEdits.current));
    try {
      const body = {
        id,
        nextAssemblyDate: editForm.nextAssemblyDate || null,
        assembliesAttended: parseInt(editForm.assembliesAttended) || 0,
      };
      const res = await fetch('/api/consortiums', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        if (currentEditOpening.current === opening) toast.error(data.error || 'Erro ao atualizar consórcio');
        return;
      }
      if (currentEditOpening.current === opening) {
        toast.success('Consórcio atualizado!');
        closeEditDialog();
      }
      const detailOpening = currentOpening.current;
      void fetchConsortiums(detailOpening?.consortiumId === id ? detailOpening : undefined);
    } catch {
      if (currentEditOpening.current === opening) toast.error('Erro ao atualizar consórcio');
    } finally {
      pendingEdits.current.delete(id);
      setEditingIds(new Set(pendingEdits.current));
    }
  };

  const onDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleteInFlight.current) setShowDeleteDialog(null);
  };

  const confirmDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const id = showDeleteDialog;
    if (!id || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleting(true);
    const opening = selection?.opening;
    const originAtConfirm = dialogOrigin.current;
    try {
      const res = await fetch('/api/consortiums', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast.error('Erro ao excluir consórcio');
        return;
      }
      toast.success('Consórcio excluído!');
      if (dialogOrigin.current === originAtConfirm) dialogOrigin.current = null;
      setShowDeleteDialog((current) => current === id ? null : current);
      if (opening?.consortiumId === id && isCurrentConsortiumSelection(currentOpening.current, opening)) closeConsortium();
      void fetchConsortiums();
    } catch {
      toast.error('Erro ao excluir consórcio');
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const changePayField = (field: keyof ConsortiumInstallmentPaymentDraft, value: string) => {
    setPayForm((draft) => ({ ...draft, [field]: value }));
  };

  const markAsPaid = async () => {
    const confirmation = payConfirmation;
    if (!confirmation || currentConfirmation.current !== confirmation) return;
    const { opening, installment: confirmed } = confirmation;
    const installment = findPayableConsortiumInstallment(currentOpening.current, opening, currentRows.current, confirmed.id);
    if (!installment) return;
    if (installment !== confirmed || pendingConsortiumPayments.current.has(opening.consortiumId) || paidInSession.current.has(installment.id)) return;
    pendingConsortiumPayments.current.add(opening.consortiumId);
    setSubmitting(confirmation);

    let succeeded = false;
    try {
      const body: Record<string, unknown> = {
        installmentId: installment.id,
        paidDate: payForm.paidDate || new Date().toISOString(),
      };
      if (payForm.notes) body.notes = payForm.notes;
      if (payForm.assemblyDate) body.assemblyDate = payForm.assemblyDate;
      if (payForm.assemblyResult) body.assemblyResult = payForm.assemblyResult;

      const res = await fetch('/api/consortiums/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        if (currentConfirmation.current === confirmation) toast.error(data.error || 'Erro ao marcar parcela');
        return;
      }
      succeeded = true;
      paidInSession.current.add(installment.id);
      if (currentConfirmation.current === confirmation) toast.success('Parcela marcada como paga!');
    } catch {
      if (currentConfirmation.current === confirmation) toast.error('Erro ao marcar parcela como paga');
    } finally {
      // Releia sem reaproveitar a confirmação, inclusive após erro de resultado incerto.
      const refresh = resolveConsortiumPaymentRefresh(currentOpening.current, opening, succeeded);
      if (refresh.detail) void fetchInstallments(refresh.detail);
      if (refresh.list) void fetchConsortiums(refresh.detail);
      pendingConsortiumPayments.current.delete(opening.consortiumId);
      setSubmitting((current) => current === confirmation ? null : current);
    }
  };

  const dialogOrigin = useRef<HTMLButtonElement | null>(null);
  const detailOrigin = useRef<string | null>(null);
  const captureDialogFocus = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOrigin.current = event.currentTarget;
  };
  const restoreDialogFocus = (event: Event) => {
    const target = dialogOrigin.current?.isConnected
      ? dialogOrigin.current
      : document.getElementById("consortium-detail-title") ?? document.getElementById("consortium-create");
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };
  const detailHeading = useCallback((node: HTMLHeadingElement | null) => {
    if (node) node.focus();
  }, []);
  const listHeading = useCallback((node: HTMLHeadingElement | null) => {
    if (node && detailOrigin.current) {
      (document.getElementById(`consortium-open-${detailOrigin.current}`) || node).focus();
      detailOrigin.current = null;
    }
  }, []);

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <p role="status" className="text-sm text-muted-foreground">Carregando consórcios…</p>
        <Skeleton className="motion-reduce:animate-none h-24 rounded-xl" />
        <Skeleton className="motion-reduce:animate-none h-36 rounded-xl" />
      </section>
    );
  }

  if (selection) {
    const { consortium: c, opening } = selection;
    return (
      <section className="min-w-0 space-y-6" aria-labelledby="consortium-detail-title">
        <header className="space-y-3">
          <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={closeConsortium}>
            <ArrowLeft aria-hidden="true" /> Voltar aos consórcios
          </Button>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 space-y-2">
              <h2 ref={detailHeading} tabIndex={-1} id="consortium-detail-title" className="break-words text-2xl font-semibold tracking-tight">{c.description}</h2>
              <ConsortiumIdentity consortium={c} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={(event) => { captureDialogFocus(event); openEditDialog(c); }}>
                <Pencil aria-hidden="true" /> Editar
              </Button>
              <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" onClick={(event) => { captureDialogFocus(event); setShowDeleteDialog(c.id); }}>
                <Trash2 aria-hidden="true" /> Excluir
              </Button>
            </div>
          </div>
        </header>

        <ConsortiumDetail consortium={c} installments={installments} installmentLoad={installmentLoad}
          onPay={(inst, event) => openPayDialog(opening, inst, event)}
        />

          <ConsortiumEditor origin="detail" open={!!editOpening} draft={editForm} saving={editingIds.has(editForm.id)}
            onFieldChange={changeEditField} onCancel={closeEditDialog} onSave={updateConsortium} onCloseAutoFocus={restoreDialogFocus} />

          <ConsortiumInstallmentPayment
            open={!!payConfirmation}
            installment={payConfirmation?.installment ?? null}
            form={payForm}
            submitting={!payConfirmation || submitting === payConfirmation}
            onFieldChange={changePayField}
            onCancel={closePayDialog}
            onConfirm={markAsPaid}
            onCloseAutoFocus={restoreDialogFocus}
          />

          <ConsortiumDeleteConfirmation context={{ origin: 'detail', description: c.description }} open={!!showDeleteDialog} deleting={deleting}
            onOpenChange={onDeleteDialogOpenChange} onConfirm={confirmDelete} onCloseAutoFocus={restoreDialogFocus} />
      </section>
    );
  }

  // ── List View ───────────────────────────────────────────────────
  return (
    <section className="min-w-0 space-y-6" aria-labelledby="consortium-list-title">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="consortium-list-title" ref={listHeading} tabIndex={-1} className="text-2xl font-semibold tracking-tight">Consórcios</h2>
          <p className="text-sm text-muted-foreground">Acompanhe parcelas, pagamentos e assembleias.</p>
        </div>
        <Button id="consortium-create" className="min-h-11 self-start sm:self-auto" onClick={(event) => { captureDialogFocus(event); openCreateDialog(); }}>
          <Plus aria-hidden="true" /> Novo consórcio
        </Button>
      </header>
      <dl aria-label="Resumo de consórcios" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
        <ConsortiumDatum label="Total em consórcios" value={currencyFmt(summary.totalEmConsortios)} />
        <ConsortiumDatum label="Total pago" value={currencyFmt(summary.totalPago)} />
        <ConsortiumDatum label="Valor restante" value={currencyFmt(summary.valorRestante)} />
        <ConsortiumDatum label="Progresso geral" value={`${summary.taxaProgresso}%`} />
      </dl>
      <section aria-labelledby="consortium-records-title" className="space-y-3">
        <h3 id="consortium-records-title" className="text-base font-semibold">Consórcios cadastrados</h3>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
          <TabsList aria-label="Filtrar consórcios por situação" className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger className="min-h-10" value="ALL">Todos</TabsTrigger>
            <TabsTrigger className="min-h-10" value="ACTIVE">Ativos</TabsTrigger>
            <TabsTrigger className="min-h-10" value="COMPLETED">Concluídos</TabsTrigger>
            <TabsTrigger className="min-h-10" value="CANCELLED">Cancelados</TabsTrigger>
            <TabsTrigger className="min-h-10" value="CONTEMPLATED">Contemplados</TabsTrigger>
          </TabsList>
        </Tabs>
        <p role="status" className="text-xs text-muted-foreground">{filteredConsortiums.length} de {consortiums.length} consórcios</p>
        {loadError && consortiums.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os consórcios.</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => { setLoading(true); void fetchConsortiums(); }}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : filteredConsortiums.length === 0 ? (
          <EmptyState icon={Building2}
            title={filter === "ALL" ? "Nenhum consórcio cadastrado" : "Nenhum consórcio encontrado"}
            subtitle={filter === "ALL" ? "Use Novo consórcio para começar." : "Altere o filtro para ver mais resultados."}
          />
        ) : (
          <ul aria-label="Consórcios cadastrados" className="divide-y divide-border rounded-xl border border-border bg-card">
            {filteredConsortiums.map((c) => (
              <ConsortiumRow key={c.id} consortium={c}
                onOpen={() => { detailOrigin.current = c.id; openConsortium(c); }}
                onEdit={(event) => { captureDialogFocus(event); openEditDialog(c); }}
                onDelete={(event) => { captureDialogFocus(event); setShowDeleteDialog(c.id); }}
              />
            ))}
          </ul>
        )}
      </section>

        {/* Create Consortium Dialog */}
        <Dialog open={!!createOpening} onOpenChange={(open) => { if (!open) closeCreateDialog(); }}>
          <DialogContent onCloseAutoFocus={restoreDialogFocus} className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Consórcio</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo consórcio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="consortium-description">Descrição do Bem</Label>
                  <Input id="consortium-description"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    placeholder="Ex: Honda Civic 2024"
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-group">Grupo</Label>
                  <Input id="consortium-group"
                    value={createForm.group}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, group: e.target.value })
                    }
                    placeholder="Ex: 0123"
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-quota">Cota</Label>
                  <Input id="consortium-quota"
                    value={createForm.quota}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, quota: e.target.value })
                    }
                    placeholder="Ex: 0042"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="consortium-administrator">Administradora</Label>
                  <Input id="consortium-administrator"
                    value={createForm.administrator}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, administrator: e.target.value })
                    }
                    placeholder="Ex: Banco do Brasil, Santander..."
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-total-amount">Valor Total (R$)</Label>
                  <Input id="consortium-total-amount"
                    type="number"
                    step="0.01"
                    value={createForm.totalAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, totalAmount: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-monthly-payment">Parcela Mensal (R$)</Label>
                  <Input id="consortium-monthly-payment"
                    type="number"
                    step="0.01"
                    value={createForm.monthlyPayment}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, monthlyPayment: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-installment-count">Total de Parcelas</Label>
                  <Input id="consortium-installment-count"
                    type="number"
                    value={createForm.installmentCount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, installmentCount: e.target.value })
                    }
                    placeholder="Ex: 120"
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-start-date">Data de Início</Label>
                  <Input id="consortium-start-date"
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-next-assembly">Próxima Assembleia</Label>
                  <Input id="consortium-next-assembly"
                    type="date"
                    value={createForm.nextAssemblyDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, nextAssemblyDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-category">Categoria</Label>
                  <Select
                    value={createForm.categoryId}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, categoryId: v })
                    }
                  >
                    <SelectTrigger id="consortium-category" className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="consortium-account">Conta Vinculada</Label>
                  <Select
                    value={createForm.accountId || 'none'}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, accountId: v === 'none' ? '' : v })
                    }
                  >
                    <SelectTrigger id="consortium-account" className="w-full">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeCreateDialog}>
                Cancelar
              </Button>
              <Button
                onClick={createConsortium} disabled={createOpening !== null && creating === createOpening}
              >
                Criar Consórcio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConsortiumEditor origin="list" open={!!editOpening} draft={editForm} saving={editingIds.has(editForm.id)}
          onFieldChange={changeEditField} onCancel={closeEditDialog} onSave={updateConsortium} onCloseAutoFocus={restoreDialogFocus} />

        <ConsortiumDeleteConfirmation context={{ origin: 'list' }} open={!!showDeleteDialog} deleting={deleting}
          onOpenChange={onDeleteDialogOpenChange} onConfirm={confirmDelete} onCloseAutoFocus={restoreDialogFocus} />
    </section>
  );
}

function ConsortiumDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ConsortiumIdentity({ consortium: c }: { consortium: Consortium }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusBadge status={c.status} labels={consortiumStatusLabels} />
      {c.group && <span className="break-words">Grupo {c.group}</span>}
      {c.quota && <span className="break-words">Cota {c.quota}</span>}
    </div>
  );
}

function ConsortiumProgress({ consortium: c }: { consortium: Consortium }) {
  const progress = pct(c.fundedAmount, c.totalAmount);
  const barValue = Math.min(100, Math.max(0, progress));
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>Progresso do financiamento</span>
        <span className="font-mono text-foreground tabular-nums">{progress}%</span>
      </div>
      <div role="progressbar" aria-label={`Progresso do financiamento de ${c.description}`} aria-valuenow={barValue}
        aria-valuetext={`${progress}% · ${currencyFmt(c.fundedAmount)} de ${currencyFmt(c.totalAmount)}`} className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${barValue}%` }} />
      </div>
    </div>
  );
}

export function ConsortiumRow({ consortium: c, onOpen, onEdit, onDelete }: {
  consortium: Consortium;
  onOpen: () => void;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li className="grid min-w-0 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-1.5">
        <Button id={`consortium-open-${c.id}`} variant="ghost" className="h-auto min-h-11 max-w-full justify-start whitespace-normal px-2 text-left"
          aria-label={`Abrir consórcio ${c.description}`} onClick={onOpen}>
          <span className="min-w-0 break-words font-semibold">{c.description}</span><ChevronRight aria-hidden="true" />
        </Button>
        <ConsortiumIdentity consortium={c} />
        {c.administrator && <p className="break-words text-xs text-muted-foreground">{c.administrator}</p>}
      </div>
      <div className="min-w-0 space-y-2">
        <ConsortiumProgress consortium={c} />
        <p className="break-words text-xs text-muted-foreground">
          {c.paidInstallments}/{c.installmentCount} parcelas pagas · <span className="font-mono tabular-nums">{currencyFmt(c.monthlyPayment)}</span>/mês
        </p>
        {c.nextAssemblyDate && <p className="text-xs text-muted-foreground">Próxima assembleia: {formatAssemblyDate(c.nextAssemblyDate)}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" aria-label={`Editar consórcio ${c.description}`} onClick={onEdit}><Pencil aria-hidden="true" /> Editar</Button>
        <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" aria-label={`Excluir consórcio ${c.description}`} onClick={onDelete}><Trash2 aria-hidden="true" /> Excluir</Button>
      </div>
    </li>
  );
}
export function ConsortiumDetail({ consortium: c, installments, installmentLoad = 'ready', onPay }: {
  consortium: Consortium;
  installments: ConsortiumInstallment[];
  installmentLoad?: InstallmentLoad;
  onPay: (installment: ConsortiumInstallment, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const rows = installmentLoad === 'ready' && installments.every((row) => row.consortiumId === c.id) ? installments : [];
  return (
    <>
      <div className="space-y-3">
        <dl aria-label="Resumo do consórcio" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
          <ConsortiumDatum label="Valor total" value={currencyFmt(c.totalAmount)} />
          <ConsortiumDatum label="Valor financiado" value={currencyFmt(c.fundedAmount)} />
          <ConsortiumDatum label="Parcela mensal" value={currencyFmt(c.monthlyPayment)} />
          <ConsortiumDatum label="Parcelas pagas" value={`${c.paidInstallments}/${c.installmentCount}`} />
        </dl>
        <ConsortiumProgress consortium={c} />
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,0.45fr)]">
        <section aria-labelledby="consortium-installments" className="min-w-0 rounded-xl border border-border bg-card">
          <header className="px-4 py-3">
            <h3 id="consortium-installments" className="text-base font-semibold">Parcelas</h3>
            <p className="text-sm text-muted-foreground">
              {rows.filter((i) => i.status === 'PAID').length} de {c.installmentCount} pagas
            </p>
          </header>
          {installmentLoad === 'loading' ? (
            <p role="status" className="border-t border-border px-4 py-6 text-sm text-muted-foreground">Carregando parcelas…</p>
          ) : installmentLoad === 'error' ? (
            <p role="status" className="border-t border-border px-4 py-6 text-sm text-muted-foreground">Não foi possível carregar as parcelas. Volte e abra o consórcio novamente.</p>
          ) : rows.length === 0 ? (
            <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground">Nenhuma parcela encontrada</p>
          ) : (
            <ul aria-label="Parcelas do consórcio" className="divide-y divide-border border-t border-border">
              {rows.map((inst) => (
                <li key={inst.id} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0 space-y-1 break-words">
                    <p className="text-sm font-semibold">Parcela {inst.number}</p>
                    <p className="text-xs text-muted-foreground">Vencimento: {dateFmt(inst.dueDate)}</p>
                    {inst.paidDate && <p className="text-xs text-muted-foreground">Paga em {dateFmt(inst.paidDate)}</p>}
                    {inst.notes && <p className="text-xs text-muted-foreground">{inst.notes}</p>}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                    <StatusBadge status={inst.status} labels={installmentStatusLabels} />
                    <span className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(inst.amount)}</span>
                    {(inst.status === 'PENDING' || inst.status === 'OVERDUE') && (
                      <Button variant="outline" className="min-h-11" aria-label={`Marcar parcela ${inst.number} como paga`} onClick={(event) => onPay(inst, event)}>
                        <CheckCircle2 aria-hidden="true" /> Marcar como paga
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="consortium-assemblies" className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h3 id="consortium-assemblies" className="text-base font-semibold">Assembleias e cadastro</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-1">
            <ConsortiumDatum label="Assembleias assistidas" value={String(c.assembliesAttended)} />
            <ConsortiumDatum label="Próxima assembleia" value={c.nextAssemblyDate ? formatAssemblyDate(c.nextAssemblyDate) : "Não agendada"} />
            <ConsortiumDatum label="Administradora" value={c.administrator || "—"} />
            <ConsortiumDatum label="Data de início" value={dateFmt(c.startDate)} />
          </dl>
        </section>
      </div>
    </>
  );
}
