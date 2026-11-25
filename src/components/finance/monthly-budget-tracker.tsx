'use client';

import { useEffect, useId, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { observeQuery, type QueryResult, type SettledQuery } from './dashboard-query';
import {
  MonthlyBudgetEditor,
  type MonthlyBudgetCategoryOption,
  type MonthlyBudgetDraft,
} from './monthly-budget-editor';

interface BudgetItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

const smallText = 'text-xs leading-relaxed text-muted-foreground';
const moneyClass = 'font-mono tabular-nums tracking-tight';

function BudgetRow({ budget, money, showValues, onEdit, onDelete }: {
  budget: BudgetItem; money: (amount: number) => string; showValues: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const label = budget.isOverBudget ? 'Excedido' : budget.percentage >= 90 ? 'Crítico' : budget.percentage >= 60 ? 'Atenção' : 'Bom';
  const bar = budget.isOverBudget || budget.percentage >= 90 ? 'bg-destructive' : budget.percentage >= 60 ? 'bg-[var(--ds-accent-warning)]' : 'bg-primary';
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{budget.categoryName}</p>
          <p className={cn(smallText, moneyClass)}>{money(budget.spent)} de {money(budget.amount)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações do limite de ${budget.categoryName}`}><MoreHorizontal aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil aria-hidden="true" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 aria-hidden="true" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showValues && (
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
        </div>
      )}
      <div className={cn('mt-1.5 flex flex-wrap justify-between gap-x-2', smallText)}>
        <span>{label}{showValues && ` · ${budget.percentage.toFixed(0)}% utilizado`}</span>
        <span className={moneyClass}>{budget.isOverBudget ? `Excedido em ${money(Math.abs(budget.remaining))}` : `Resta ${money(budget.remaining)}`}</span>
      </div>
    </li>
  );
}

export function MonthlyBudgetTracker({ showValues = true, refreshCounter = 0 }: { showValues?: boolean; refreshCounter?: number } = {}) {
  const fieldId = useId();
  const [request, setRequest] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: SettledQuery<BudgetItem[]> } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categories, setCategories] = useState<MonthlyBudgetCategoryOption[]>([]);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = format(now, 'MMMM yyyy', { locale: ptBR });
  const key = `${currentYear}-${currentMonth}-${request}-${refreshCounter}`;
  const query = settled?.key === key ? settled.result : { status: 'loading' as const };
  const refreshBudgets = () => setRequest((value) => value + 1);
  const money = (amount: number) => showValues ? currencyFmt(amount) : 'R$ ••••••';

  useEffect(() => observeQuery(async (signal) => {
    const response = await fetch(`/api/monthly-budgets?month=${currentMonth}&year=${currentYear}`, { signal });
    if (!response.ok) throw new Error('Orçamento indisponível');
    const data: { budgets: BudgetItem[] } = await response.json();
    if (!Array.isArray(data?.budgets)) throw new Error('Dados de orçamento inválidos');
    return data.budgets;
  }, (result) => setSettled({ key, result })), [currentMonth, currentYear, key]);

  useEffect(() => observeQuery(async (signal) => {
    const response = await fetch('/api/categories', { signal });
    if (!response.ok) throw new Error('Categorias indisponíveis');
    type Category = MonthlyBudgetCategoryOption & { type: string };
    const data: { categories: Category[] } | Category[] = await response.json();
    return (Array.isArray(data) ? data : data.categories).filter((category) => category.type === 'EXPENSE');
  }, (result) => { if (result.status === 'ready') setCategories(result.data); }), [refreshCounter]);

  // Open create dialog
  const openCreateDialog = () => {
    setEditingBudget(null);
    setFormCategoryId('');
    setFormAmount('');
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (budget: BudgetItem) => {
    setEditingBudget(budget);
    setFormCategoryId(budget.categoryId);
    setFormAmount(String(budget.amount));
    setFormMonth(String(currentMonth));
    setFormYear(String(currentYear));
    setDialogOpen(true);
  };

  const handleFieldChange = (field: keyof MonthlyBudgetDraft, value: string) => {
    if (field === 'categoryId') setFormCategoryId(value);
    else if (field === 'amount') setFormAmount(value);
    else if (field === 'month') setFormMonth(value);
    else if (field === 'year') setFormYear(value);
  };

  // Submit handler
  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!formCategoryId || !amount || amount <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }
    const month = parseInt(formMonth);
    const year = parseInt(formYear);
    if (month < 1 || month > 12 || year < 2021) {
      toast.error('Mês ou ano inválido');
      return;
    }

    setSubmitting(true);
    try {
      const res = editingBudget
        ? await fetch('/api/monthly-budgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingBudget.id, amount }),
          })
        : await fetch('/api/monthly-budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: formCategoryId, amount, month, year }),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || (editingBudget ? 'Erro ao atualizar' : 'Erro ao criar'));
        return;
      }

      toast.success(editingBudget ? 'Orçamento atualizado' : 'Orçamento criado');
      setDialogOpen(false);
      refreshBudgets();
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/monthly-budgets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Orçamento excluído');
        setPendingDeleteBudget(null);
        refreshBudgets();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setDeleting(false);
    }
  };

  const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

  const budgets = query.status === 'ready' ? query.data : [];
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalOverBudget = totalSpent > totalBudget;

  return (
    <section aria-label="Orçamento mensal" className="h-full min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
      <BudgetHeader status={query.status} monthLabel={monthLabel} openCreateDialog={openCreateDialog} refreshBudgets={refreshBudgets} />
      {query.status === 'ready' && (budgets.length ? (
        <>
          <dl className="my-3 grid gap-1.5 rounded-md border border-border p-2.5 text-xs">
            {([['Orçamento total', totalBudget], ['Gasto total', totalSpent], ['Disponível', totalRemaining]] as const).map(([label, amount]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-2"><dt className={smallText}>{label}</dt><dd className={moneyClass}>{money(amount)}</dd></div>
            ))}
          </dl>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {budgets.map((budget) => <BudgetRow key={budget.id} budget={budget} money={money} showValues={showValues} onEdit={() => openEditDialog(budget)} onDelete={() => setPendingDeleteBudget(budget)} />)}
          </ul>
          {totalOverBudget && <p className="mt-2 border-t border-border pt-2 text-xs text-destructive"><strong>Atenção:</strong> orçamento total do mês ultrapassado em {money(Math.abs(totalRemaining))}.</p>}
        </>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Nenhum orçamento definido.</p>
          <p className={smallText}>Defina limites de gastos por categoria para acompanhar o mês.</p>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <MonthlyBudgetEditor
        mode={editingBudget ? 'edit' : 'create'}
        open={dialogOpen}
        submitting={submitting}
        fieldId={fieldId}
        form={{
          categoryId: formCategoryId,
          amount: formAmount,
          month: formMonth,
          year: formYear,
        }}
        categories={categories}
        years={years}
        onFieldChange={handleFieldChange}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!pendingDeleteBudget}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDeleteBudget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteBudget
                ? `Tem certeza que deseja excluir o limite da categoria "${pendingDeleteBudget.categoryName}"?`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDeleteBudget) void handleDelete(pendingDeleteBudget.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function BudgetHeader({ status, monthLabel, openCreateDialog, refreshBudgets }: {
  status: QueryResult<BudgetItem[]>['status']; monthLabel: string; openCreateDialog: () => void; refreshBudgets: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">Orçamento mensal</h2>
          <p className={cn(smallText, 'mt-1')}>Mês atual · {monthLabel}.</p>
        </div>
        {status !== 'loading' && <Button variant="outline" size="sm" onClick={openCreateDialog}><Plus aria-hidden="true" />Novo limite</Button>}
      </div>
      {status === 'loading' && <p role="status" className={cn(smallText, 'mt-4')}>Carregando orçamento…</p>}
      {status === 'error' && <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-destructive">Não foi possível carregar o orçamento.</p><Button size="sm" variant="outline" onClick={refreshBudgets}>Tentar novamente</Button></div>}
    </>
  );
}
