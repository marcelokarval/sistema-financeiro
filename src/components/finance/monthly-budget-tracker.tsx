'use client';

import { useEffect, useId, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { currencyFmt } from '@/lib/helpers';
import { observeQuery, type QueryResult, type SettledQuery } from './dashboard-query';

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

interface CategoryOption {
  id: string;
  name: string;
  color: string;
  icon: string;
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
          <p className={`${smallText} ${moneyClass}`}>{money(budget.spent)} de {money(budget.amount)}</p>
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
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
        </div>
      )}
      <div className={`mt-1.5 flex flex-wrap justify-between gap-x-2 ${smallText}`}>
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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
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
    type Category = CategoryOption & { type: string };
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
      if (editingBudget) {
        const res = await fetch('/api/monthly-budgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingBudget.id, amount }),
        });
        if (res.ok) {
          toast.success('Orçamento atualizado');
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao atualizar');
        }
      } else {
        const res = await fetch('/api/monthly-budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: formCategoryId, amount, month, year }),
        });
        if (res.ok) {
          toast.success('Orçamento criado');
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao criar');
        }
      }
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

  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
            </DialogTitle>
            <DialogDescription>Informe a categoria, o valor e o período do limite.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-category`}>Categoria</Label>
              <Select
                value={formCategoryId}
                onValueChange={setFormCategoryId}
              >
                <SelectTrigger id={`${fieldId}-category`} className="w-full">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-amount`}>Valor do Limite (R$)</Label>
              <Input
                id={`${fieldId}-amount`}
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-month`}>Mês</Label>
                <Select value={formMonth} onValueChange={setFormMonth}>
                  <SelectTrigger id={`${fieldId}-month`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-year`}>Ano</Label>
                <Select value={formYear} onValueChange={setFormYear}>
                  <SelectTrigger id={`${fieldId}-year`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formCategoryId || !formAmount}
            >
              {submitting ? 'Salvando...' : editingBudget ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <p className={`${smallText} mt-1`}>Mês atual · {monthLabel}.</p>
        </div>
        {status !== 'loading' && <Button variant="outline" size="sm" onClick={openCreateDialog}><Plus aria-hidden="true" />Novo limite</Button>}
      </div>
      {status === 'loading' && <p role="status" className={`${smallText} mt-4`}>Carregando orçamento…</p>}
      {status === 'error' && <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-destructive">Não foi possível carregar o orçamento.</p><Button size="sm" variant="outline" onClick={refreshBudgets}>Tentar novamente</Button></div>}
    </>
  );
}
