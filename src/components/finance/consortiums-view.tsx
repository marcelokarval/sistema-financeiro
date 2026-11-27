'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, Building2, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { ConsortiumEditor, type ConsortiumDraft } from './consortium-editor';
import { ConsortiumDeleteConfirmation } from './consortium-delete-confirmation';
import {
  ConsortiumInstallmentPayment,
  type ConsortiumInstallmentPaymentDraft,
} from './consortium-installment-payment';

import { currencyFmt, dateFmt, pct } from '@/lib/helpers';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { findPayableConsortiumInstallment, isCurrentConsortiumSelection, readConsortiumInstallments,
  resolveConsortiumPaymentRefresh,
  type ConsortiumInstallment, type ConsortiumSelection } from '@/lib/consortium-selection';
import { EmptyState, StatusBadge } from '@/components/shared/ui-helpers';
import { useAppStore } from '@/lib/store';
import {
  buildStatusBadgeLabels,
  CONSORTIUM_FILTER_TABS,
  CONSORTIUM_INSTALLMENT_STATUS_META,
  CONSORTIUM_STATUS_META,
  formatCivilDate,
} from './portfolio-i18n';

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

type FilterStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'CONTEMPLATED';

const assemblyDateForInput = (value: string | null) => value?.slice(0, 10) ?? '';

function formatAssemblyDate(value: string, locale?: string) {
  // A API serializa o dia escolhido no input como ISO em UTC.
  return formatCivilDate(value, locale);
}

// ── Component ─────────────────────────────────────────────────────
export function ConsortiumsView() {
  const t = useSafeTranslations('consortiums');
  const locale = useSafeLocale();
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

    const description = createForm.description.trim();
    if (!description) {
      toast.error(t('errors.descriptionRequired'));
      return;
    }
    const totalAmount = Number(createForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      toast.error(t('errors.totalPositive'));
      return;
    }
    const monthlyPayment = Number(createForm.monthlyPayment);
    if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
      toast.error(t('errors.monthlyPositive'));
      return;
    }
    const installmentCount = Number(createForm.installmentCount);
    if (!Number.isInteger(installmentCount) || installmentCount < 1) {
      toast.error(t('errors.installmentCountInvalid'));
      return;
    }

    pendingCreates.current.add(opening);
    setCreating(opening);
    try {
      const body = {
        description,
        group: createForm.group,
        quota: createForm.quota,
        administrator: createForm.administrator,
        totalAmount,
        monthlyPayment,
        installmentCount,
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
        const data = await res.json().catch(() => ({}));
        if (currentCreateOpening.current === opening) toast.error(data?.error || t('errors.create'));
        return;
      }
      if (currentCreateOpening.current === opening) {
        toast.success(t('toast.created'));
        closeCreateDialog();
      }
      void fetchConsortiums();
    } catch {
      if (currentCreateOpening.current === opening) toast.error(t('errors.create'));
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
        if (currentEditOpening.current === opening) toast.error(data.error || t('errors.update'));
        return;
      }
      if (currentEditOpening.current === opening) {
        toast.success(t('toast.updated'));
        closeEditDialog();
      }
      const detailOpening = currentOpening.current;
      void fetchConsortiums(detailOpening?.consortiumId === id ? detailOpening : undefined);
    } catch {
      if (currentEditOpening.current === opening) toast.error(t('errors.update'));
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
        toast.error(t('errors.delete'));
        return;
      }
      toast.success(t('toast.deleted'));
      if (dialogOrigin.current === originAtConfirm) dialogOrigin.current = null;
      setShowDeleteDialog((current) => current === id ? null : current);
      if (opening?.consortiumId === id && isCurrentConsortiumSelection(currentOpening.current, opening)) closeConsortium();
      void fetchConsortiums();
    } catch {
      toast.error(t('errors.delete'));
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
        if (currentConfirmation.current === confirmation) toast.error(data.error || t('errors.markPaid'));
        return;
      }
      succeeded = true;
      paidInSession.current.add(installment.id);
      if (currentConfirmation.current === confirmation) toast.success(t('toast.installmentPaid'));
    } catch {
      if (currentConfirmation.current === confirmation) toast.error(t('errors.markPaidError'));
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
        <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
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
            <ArrowLeft aria-hidden="true" /> {t('actions.backToConsortiums')}
          </Button>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 space-y-2">
              <h2 ref={detailHeading} tabIndex={-1} id="consortium-detail-title" className="break-words text-2xl font-semibold tracking-tight">{c.description}</h2>
              <ConsortiumIdentity consortium={c} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={(event) => { captureDialogFocus(event); openEditDialog(c); }}>
                <Pencil aria-hidden="true" /> {t('actions.edit')}
              </Button>
              <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" onClick={(event) => { captureDialogFocus(event); setShowDeleteDialog(c.id); }}>
                <Trash2 aria-hidden="true" /> {t('actions.delete')}
              </Button>
            </div>
          </div>
        </header>

        <ConsortiumDetail key={c.id} consortium={c} installments={installments} installmentLoad={installmentLoad}
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
          <h2 id="consortium-list-title" ref={listHeading} tabIndex={-1} className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button id="consortium-create" className="min-h-11 self-start sm:self-auto" onClick={(event) => { captureDialogFocus(event); openCreateDialog(); }}>
          <Plus aria-hidden="true" /> {t('actions.newConsortium')}
        </Button>
      </header>
      <dl aria-label={t('summary.ariaLabel')} className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
        <ConsortiumDatum label={t('summary.totalInConsortiums')} value={currencyFmt(summary.totalEmConsortios, locale)} />
        <ConsortiumDatum label={t('summary.totalPaid')} value={currencyFmt(summary.totalPago, locale)} />
        <ConsortiumDatum label={t('summary.remainingAmount')} value={currencyFmt(summary.valorRestante, locale)} />
        <ConsortiumDatum label={t('summary.overallProgress')} value={`${summary.taxaProgresso}%`} />
      </dl>
      <section aria-labelledby="consortium-records-title" className="space-y-3">
        <h3 id="consortium-records-title" className="text-base font-semibold">{t('list.title')}</h3>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
          <TabsList aria-label={t('filters.ariaLabel')} className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
            {CONSORTIUM_FILTER_TABS.map((status) => (
              <TabsTrigger key={status} className="min-h-10" value={status}>{t(`filters.${status}`)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p role="status" className="text-xs text-muted-foreground">{t('list.showingCount', { shown: filteredConsortiums.length, total: consortiums.length })}</p>
        {loadError && consortiums.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <p role="alert" className="text-sm text-muted-foreground">{t('errors.loadList')}</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => { setLoading(true); void fetchConsortiums(); }}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              {t('actions.retry')}
            </Button>
          </div>
        ) : filteredConsortiums.length === 0 ? (
          <EmptyState icon={Building2}
            title={filter === "ALL" ? t('list.emptyAllTitle') : t('list.emptyFilteredTitle')}
            subtitle={filter === "ALL" ? t('list.emptyAllSubtitle') : t('list.emptyFilteredSubtitle')}
          />
        ) : (
          <ul aria-label={t('list.ariaLabel')} className="divide-y divide-border rounded-xl border border-border bg-card">
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
        <FinanceFormDialogShell
          open={!!createOpening}
          onOpenChange={(open) => { if (!open) closeCreateDialog(); }}
          onCloseAutoFocus={restoreDialogFocus}
          closeLabel={t('createDialog.closeLabel')}
          contentClassName="max-h-[85dvh] overflow-y-auto"
          title={t('createDialog.title')}
          description={t('createDialog.description')}
          footer={
            <>
              <Button variant="outline" onClick={closeCreateDialog}>
                {t('createDialog.cancel')}
              </Button>
              <Button
                onClick={createConsortium} disabled={createOpening !== null && creating === createOpening}
              >
                {t('createDialog.submit')}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="consortium-description">{t('createDialog.descriptionLabel')}</Label>
                  <Input id="consortium-description"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    placeholder={t('createDialog.descriptionPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-group">{t('createDialog.groupLabel')}</Label>
                  <Input id="consortium-group"
                    value={createForm.group}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, group: e.target.value })
                    }
                    placeholder={t('createDialog.groupPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-quota">{t('createDialog.quotaLabel')}</Label>
                  <Input id="consortium-quota"
                    value={createForm.quota}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, quota: e.target.value })
                    }
                    placeholder={t('createDialog.quotaPlaceholder')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="consortium-administrator">{t('createDialog.administratorLabel')}</Label>
                  <Input id="consortium-administrator"
                    value={createForm.administrator}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, administrator: e.target.value })
                    }
                    placeholder={t('createDialog.administratorPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-total-amount">{t('createDialog.totalAmountLabel')}</Label>
                  <Input id="consortium-total-amount"
                    type="number"
                    step="0.01"
                    value={createForm.totalAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, totalAmount: e.target.value })
                    }
                    placeholder={t('createDialog.decimalPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-monthly-payment">{t('createDialog.monthlyPaymentLabel')}</Label>
                  <Input id="consortium-monthly-payment"
                    type="number"
                    step="0.01"
                    value={createForm.monthlyPayment}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, monthlyPayment: e.target.value })
                    }
                    placeholder={t('createDialog.decimalPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-installment-count">{t('createDialog.installmentCountLabel')}</Label>
                  <Input id="consortium-installment-count"
                    type="number"
                    value={createForm.installmentCount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, installmentCount: e.target.value })
                    }
                    placeholder={t('createDialog.installmentCountPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-start-date">{t('createDialog.startDateLabel')}</Label>
                  <Input id="consortium-start-date"
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-next-assembly">{t('createDialog.nextAssemblyLabel')}</Label>
                  <Input id="consortium-next-assembly"
                    type="date"
                    value={createForm.nextAssemblyDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, nextAssemblyDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="consortium-category">{t('createDialog.categoryLabel')}</Label>
                  <Select
                    value={createForm.categoryId}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, categoryId: v })
                    }
                  >
                    <SelectTrigger id="consortium-category" className="w-full">
                      <SelectValue placeholder={t('createDialog.categoryPlaceholder')} />
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
                  <Label htmlFor="consortium-account">{t('createDialog.accountLabel')}</Label>
                  <Select
                    value={createForm.accountId || 'none'}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, accountId: v === 'none' ? '' : v })
                    }
                  >
                    <SelectTrigger id="consortium-account" className="w-full">
                      <SelectValue placeholder={t('createDialog.accountNone')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('createDialog.accountNone')}</SelectItem>
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
        </FinanceFormDialogShell>

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
  const t = useSafeTranslations('consortiums');
  const statusLabels = useMemo(() => buildStatusBadgeLabels(CONSORTIUM_STATUS_META, t), [t]);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusBadge status={c.status} labels={statusLabels} />
      {c.group && <span className="break-words">{t('list.group', { group: c.group })}</span>}
      {c.quota && <span className="break-words">{t('list.quota', { quota: c.quota })}</span>}
    </div>
  );
}

function ConsortiumProgress({ consortium: c }: { consortium: Consortium }) {
  const t = useSafeTranslations('consortiums');
  const locale = useSafeLocale();
  const progress = pct(c.fundedAmount, c.totalAmount);
  const barValue = Math.min(100, Math.max(0, progress));
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{t('progress.label')}</span>
        <span className="font-mono text-foreground tabular-nums">{progress}%</span>
      </div>
      <div role="progressbar" aria-label={t('progress.ariaLabel', { description: c.description })} aria-valuenow={barValue}
        aria-valuetext={t('progress.valueText', { percent: progress, funded: currencyFmt(c.fundedAmount, locale), total: currencyFmt(c.totalAmount, locale) })} className="h-1.5 rounded-full bg-muted">
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
  const t = useSafeTranslations('consortiums');
  const locale = useSafeLocale();
  return (
    <li className="grid min-w-0 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-1.5">
        <Button id={`consortium-open-${c.id}`} variant="ghost" className="h-auto min-h-11 max-w-full justify-start whitespace-normal px-2 text-left"
          aria-label={t('actions.openAriaLabel', { description: c.description })} onClick={onOpen}>
          <span className="min-w-0 break-words font-semibold">{c.description}</span><ChevronRight aria-hidden="true" />
        </Button>
        <ConsortiumIdentity consortium={c} />
        {c.administrator && <p className="break-words text-xs text-muted-foreground">{c.administrator}</p>}
      </div>
      <div className="min-w-0 space-y-2">
        <ConsortiumProgress consortium={c} />
        <p className="break-words text-xs text-muted-foreground">
          {t.rich('list.paidInstallmentsMonthly', {
            paid: c.paidInstallments,
            total: c.installmentCount,
            monthly: currencyFmt(c.monthlyPayment, locale),
            mono: (chunks) => <span className="font-mono tabular-nums">{chunks}</span>,
          })}
        </p>
        {c.nextAssemblyDate && <p className="text-xs text-muted-foreground">{t('list.nextAssembly', { date: formatAssemblyDate(c.nextAssemblyDate, locale) })}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" aria-label={t('actions.editAriaLabel', { description: c.description })} onClick={onEdit}><Pencil aria-hidden="true" /> {t('actions.edit')}</Button>
        <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" aria-label={t('actions.deleteAriaLabel', { description: c.description })} onClick={onDelete}><Trash2 aria-hidden="true" /> {t('actions.delete')}</Button>
      </div>
    </li>
  );
}
type InstallmentEntryFilter = 'ALL' | 'PENDING' | 'PAID';

export function ConsortiumDetail({ consortium: c, installments, installmentLoad = 'ready', onPay }: {
  consortium: Consortium;
  installments: ConsortiumInstallment[];
  installmentLoad?: InstallmentLoad;
  onPay: (installment: ConsortiumInstallment, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const t = useSafeTranslations('consortiums');
  const locale = useSafeLocale();
  const [entryFilter, setEntryFilter] = useState<InstallmentEntryFilter>('ALL');
  const pendingJumpIdRef = useRef<string | null>(null);
  const entryRefs = useRef(new Map<string, HTMLLIElement>());
  const payButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const installmentStatusLabels = useMemo(
    () => buildStatusBadgeLabels(CONSORTIUM_INSTALLMENT_STATUS_META, t),
    [t],
  );
  const rows = useMemo(
    () => (installmentLoad === 'ready' && installments.every((row) => row.consortiumId === c.id) ? installments : []),
    [installmentLoad, installments, c.id],
  );
  const filteredRows = useMemo(() => {
    if (entryFilter === 'PENDING') {
      return rows.filter((inst) => inst.status === 'PENDING' || inst.status === 'OVERDUE');
    }
    if (entryFilter === 'PAID') {
      return rows.filter((inst) => inst.status === 'PAID');
    }
    return rows;
  }, [rows, entryFilter]);
  const firstOpenInstallment = useMemo(
    () => rows.find((inst) => inst.status === 'PENDING' || inst.status === 'OVERDUE'),
    [rows],
  );

  const focusPendingEntry = useCallback((targetId: string) => {
    const rowEl = entryRefs.current.get(targetId);
    const actionEl = payButtonRefs.current.get(targetId);
    if (!rowEl && !actionEl) return false;
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    rowEl?.scrollIntoView?.({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    if (actionEl && !actionEl.disabled) {
      actionEl.focus();
    } else {
      rowEl?.focus();
    }
    return true;
  }, []);

  useEffect(() => {
    const targetId = pendingJumpIdRef.current;
    if (!targetId) return;
    if (focusPendingEntry(targetId)) {
      pendingJumpIdRef.current = null;
    }
  }, [entryFilter, filteredRows, focusPendingEntry]);

  const jumpToNextPending = () => {
    if (!firstOpenInstallment) return;
    if (entryFilter === 'PAID') {
      pendingJumpIdRef.current = firstOpenInstallment.id;
      setEntryFilter('ALL');
      return;
    }
    pendingJumpIdRef.current = null;
    focusPendingEntry(firstOpenInstallment.id);
  };

  return (
    <>
      <div className="space-y-3">
        <dl aria-label={t('detail.summaryAriaLabel')} className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border px-2 py-4 sm:grid-cols-4">
          <ConsortiumDatum label={t('detail.totalAmount')} value={currencyFmt(c.totalAmount, locale)} />
          <ConsortiumDatum label={t('detail.fundedAmount')} value={currencyFmt(c.fundedAmount, locale)} />
          <ConsortiumDatum label={t('detail.monthlyPayment')} value={currencyFmt(c.monthlyPayment, locale)} />
          <ConsortiumDatum label={t('detail.paidInstallments')} value={`${c.paidInstallments}/${c.installmentCount}`} />
        </dl>
        <ConsortiumProgress consortium={c} />
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,0.45fr)]">
        <section aria-labelledby="consortium-installments" className="min-w-0 rounded-xl border border-border bg-card">
          <header className="px-4 py-3">
            <h3 id="consortium-installments" className="text-base font-semibold">{t('detail.installmentsTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('detail.paidOf', { paid: rows.filter((i) => i.status === 'PAID').length, total: c.installmentCount })}
            </p>
          </header>
          {installmentLoad === 'loading' ? (
            <p role="status" className="border-t border-border px-4 py-6 text-sm text-muted-foreground">{t('loadingInstallments')}</p>
          ) : installmentLoad === 'error' ? (
            <p role="status" className="border-t border-border px-4 py-6 text-sm text-muted-foreground">{t('errors.loadInstallments')}</p>
          ) : rows.length === 0 ? (
            <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground">{t('detail.emptyInstallments')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <div role="group" aria-label={t('detail.installmentFilters.ariaLabel')} className="flex flex-wrap gap-2">
                  {(['ALL', 'PENDING', 'PAID'] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={entryFilter === status ? 'secondary' : 'outline'}
                      className="min-h-11"
                      aria-pressed={entryFilter === status}
                      onClick={() => setEntryFilter(status)}
                    >
                      {t(`detail.installmentFilters.${status}`)}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!firstOpenInstallment}
                  onClick={jumpToNextPending}
                >
                  {t('actions.jumpToNextPending')}
                </Button>
              </div>
              {filteredRows.length === 0 ? (
                <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground">{t('detail.emptyFilteredInstallments')}</p>
              ) : (
                <ul aria-label={t('detail.installmentsAriaLabel')} className="divide-y divide-border border-t border-border">
                  {filteredRows.map((inst) => (
                    <li
                      key={inst.id}
                      tabIndex={-1}
                      ref={(node) => {
                        if (node) entryRefs.current.set(inst.id, node);
                        else entryRefs.current.delete(inst.id);
                      }}
                      className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0 space-y-1 break-words">
                        <p className="text-sm font-semibold">{t('detail.installmentLabel', { number: inst.number })}</p>
                        <p className="text-xs text-muted-foreground">{t('detail.dueDate', { date: dateFmt(inst.dueDate, locale) })}</p>
                        {inst.paidDate && <p className="text-xs text-muted-foreground">{t('detail.paidOn', { date: dateFmt(inst.paidDate, locale) })}</p>}
                        {inst.notes && <p className="text-xs text-muted-foreground">{inst.notes}</p>}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                        <StatusBadge status={inst.status} labels={installmentStatusLabels} />
                        <span className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(inst.amount, locale)}</span>
                        {(inst.status === 'PENDING' || inst.status === 'OVERDUE') && (
                          <Button
                            ref={(node) => {
                              if (node) payButtonRefs.current.set(inst.id, node);
                              else payButtonRefs.current.delete(inst.id);
                            }}
                            variant="outline"
                            className="min-h-11"
                            aria-label={t('actions.markPaidAriaLabel', { number: inst.number })}
                            onClick={(event) => onPay(inst, event)}
                          >
                            <CheckCircle2 aria-hidden="true" /> {t('actions.markPaid')}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        <section aria-labelledby="consortium-assemblies" className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h3 id="consortium-assemblies" className="text-base font-semibold">{t('detail.assembliesTitle')}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-1">
            <ConsortiumDatum label={t('detail.assembliesAttended')} value={String(c.assembliesAttended)} />
            <ConsortiumDatum label={t('detail.nextAssembly')} value={c.nextAssemblyDate ? formatAssemblyDate(c.nextAssemblyDate, locale) : t('detail.notScheduled')} />
            <ConsortiumDatum label={t('detail.administrator')} value={c.administrator || "—"} />
            <ConsortiumDatum label={t('detail.startDate')} value={dateFmt(c.startDate, locale)} />
          </dl>
        </section>
      </div>
    </>
  );
}
