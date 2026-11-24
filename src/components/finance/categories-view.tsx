'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Tag, Banknote, Laptop, TrendingUp, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, ShoppingBag, Receipt, House, Ellipsis, Gift, Plane, Baby, Dog, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogClose,
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
interface DialogOpening { origin: HTMLButtonElement | null; }

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const categoryColors = [
  { value: '#22c55e', label: 'Verde' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#f59e0b', label: 'Âmbar' },
  { value: '#64748b', label: 'Cinza ardósia' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#84cc16', label: 'Verde-lima' },
  { value: '#a855f7', label: 'Roxo' },
  { value: '#94a3b8', label: 'Cinza claro' },
];

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
  color: string;
  _count?: { transactions?: number; purchases?: number };
}

const iconOptions = [
  { value: 'banknote', label: 'Dinheiro', Icon: Banknote },
  { value: 'laptop', label: 'Laptop', Icon: Laptop },
  { value: 'trending-up', label: 'Investimento', Icon: TrendingUp },
  { value: 'utensils', label: 'Alimentação', Icon: Utensils },
  { value: 'car', label: 'Transporte', Icon: Car },
  { value: 'heart-pulse', label: 'Saúde', Icon: HeartPulse },
  { value: 'graduation-cap', label: 'Educação', Icon: GraduationCap },
  { value: 'gamepad-2', label: 'Entretenimento', Icon: Gamepad2 },
  { value: 'shopping-bag', label: 'Compras', Icon: ShoppingBag },
  { value: 'receipt', label: 'Contas', Icon: Receipt },
  { value: 'home', label: 'Moradia', Icon: House },
  { value: 'more-horizontal', label: 'Outros', Icon: Ellipsis },
  { value: 'tag', label: 'Tag', Icon: Tag },
  { value: 'gift', label: 'Presente', Icon: Gift },
  { value: 'plane', label: 'Viagem', Icon: Plane },
  { value: 'baby', label: 'Filhos', Icon: Baby },
  { value: 'dog', label: 'Pet', Icon: Dog },
];

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const listRead = useRef(0);
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' });

  const newButton = useRef<HTMLButtonElement>(null);
  const activeOpening = useRef<DialogOpening | null>(null);
  const [opening, setOpening] = useState<DialogOpening | null>(null);
  const mutationPending = useRef(false);

  const beginOpening = (origin: HTMLButtonElement) => {
    const session = { origin };
    activeOpening.current = session;
    setOpening(session);
  };

  const closeDialog = (kind: 'form' | 'delete') => {
    activeOpening.current = null;
    if (kind === 'form') setShowDialog(false);
    else setShowDeleteDialog(null);
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (activeOpening.current) return;
    const origin = opening?.origin;
    const target = origin?.isConnected ? origin : newButton.current;
    target?.focus();
  };

  /* ── data fetching ───────────────────────────────────────── */
  const fetchCategories = useCallback(async () => {
    const read = ++listRead.current;
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('HTTP error');
      const data = await res.json();
      if (read !== listRead.current) return;
      setCategories(data);
      setRefreshFailed(false);
    } catch {
      if (read === listRead.current) setRefreshFailed(true);
    } finally {
      if (read === listRead.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* ── CRUD handlers ───────────────────────────────────────── */
  const openNew = () => {
    setEditing(null);
    setForm({ name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' });
    setShowDialog(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon, type: cat.type, color: cat.color });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.name) {
      toast.error('Informe o nome da categoria');
      return;
    }
    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      if (editing) {
        const res = await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erro ao salvar categoria');
        }
        toast.success('Categoria atualizada!');
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erro ao salvar categoria');
        }
        toast.success('Categoria criada!');
      }
      await fetchCategories();
      if (activeOpening.current === submittedOpening) closeDialog('form');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao salvar categoria');
    } finally { mutationPending.current = false; }
  };

  const deleteCat = async (id: string) => {
    const submittedOpening = activeOpening.current;
    if (!submittedOpening || mutationPending.current) return;
    mutationPending.current = true;
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erro ao excluir categoria');
      }
      toast.success('Categoria excluída!');
      await fetchCategories();
      if (activeOpening.current === submittedOpening) {
        submittedOpening.origin = newButton.current;
        closeDialog('delete');
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao excluir categoria');
    } finally { mutationPending.current = false; }
  };

  /* ── computed values ─────────────────────────────────────── */
  const filtered = categories.filter((c) => filter === 'all' || c.type === filter);

  const incomeCount = categories.filter((c) => c.type === 'INCOME').length;
  const expenseCount = categories.filter((c) => c.type === 'EXPENSE').length;

  const maxUsage = Math.max(
    1,
    ...categories.map(
      (c) => (c._count?.transactions || 0) + (c._count?.purchases || 0),
    ),
  );

  const mostUsed = categories.reduce<Category | null>(
    (best, cat) => {
      const usage = (cat._count?.transactions || 0) + (cat._count?.purchases || 0);
      const bestUsage = best
        ? (best._count?.transactions || 0) + (best._count?.purchases || 0)
        : 0;
      return usage > bestUsage ? cat : best;
    },
    null,
  );

  const PreviewIcon = iconOptions.find((option) => option.value === form.icon)?.Icon ?? Tag;

  return (
    <section aria-labelledby="categories-heading" className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Movimentação</p>
          <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight">Categorias</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organize suas receitas e despesas.</p>
        </div>
        {!loading && (
          <Button ref={newButton} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={openNew} className={`min-h-11 ${focusStyle}`}>
            <Plus aria-hidden="true" /> Nova categoria
          </Button>
        )}
      </header>
      {refreshFailed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Não foi possível atualizar a lista de categorias.</p>
          <Button type="button" variant="outline" className={focusStyle} onClick={() => void fetchCategories()}>
            Tentar atualizar lista
          </Button>
        </div>
      )}
      {loading ? (
        <div role="status" className="space-y-3 text-sm text-muted-foreground">
          <p>Carregando categorias…</p>
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : (
        <>
          {categories.length > 0 && (
            <dl aria-label="Totais de categorias" className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-[1.2fr_1fr_1fr_1.3fr]">
              {[['Total de categorias', categories.length], ['Receitas', incomeCount], ['Despesas', expenseCount]].map(([label, count], i) => (
                <div key={label} className="min-w-0 bg-background px-3 py-4 sm:px-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`mt-1 font-mono font-semibold tabular-nums ${i === 0 ? 'text-2xl' : 'text-lg'}`}>{count}</dd>
                </div>
              ))}
              <div className="min-w-0 bg-background px-3 py-4 sm:px-4">
                <dt className="text-xs text-muted-foreground">Mais usada</dt>
                <dd className="mt-1 break-words text-sm font-semibold">{mostUsed?.name || '—'}</dd>
                {mostUsed && (
                  <dd className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                    {(mostUsed._count?.transactions || 0) + (mostUsed._count?.purchases || 0)} registros
                  </dd>
                )}
              </div>
            </dl>
          )}

          <section aria-labelledby="category-records-heading" className="min-w-0 rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-4 sm:px-4">
              <h3 id="category-records-heading" className="text-sm font-semibold">Categorias cadastradas</h3>
              <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
                {([
                  { key: 'all', label: 'Todas', count: categories.length },
                  { key: 'INCOME', label: 'Receitas', count: incomeCount },
                  { key: 'EXPENSE', label: 'Despesas', count: expenseCount },
                ] as const).map((f) => {
                  const active = filter === f.key;
                  return (
                    <button key={f.key} type="button" aria-pressed={active} onClick={() => setFilter(f.key)}
                      className={`min-h-11 rounded-md border px-2 text-xs font-semibold ${focusStyle} ${active ? 'border-border bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                      {f.label} <span className="font-mono tabular-nums">{f.count}</span>
                    </button>
                  );
                })}
              </div>
            </header>
            {filtered.length === 0 ? (
              <p role="status" className="px-4 py-8 text-sm text-muted-foreground">
                {filter === 'all' ? 'Nenhuma categoria cadastrada. Crie a primeira para começar.' : filter === 'INCOME' ? 'Nenhuma categoria de receita cadastrada.' : 'Nenhuma categoria de despesa cadastrada.'}
              </p>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {filtered.map((cat) => {
                  const txCount = cat._count?.transactions || 0;
                  const puCount = cat._count?.purchases || 0;
                  const totalUsage = txCount + puCount;
                  const usagePct = (totalUsage / maxUsage) * 100;
                  const Icon = iconOptions.find((option) => option.value === cat.icon)?.Icon ?? Tag;
                  return (
                    <li key={cat.id} className="flex min-w-0 items-start gap-1 px-2 py-2 sm:gap-2 sm:px-4">
                      <div aria-hidden="true" className="mt-1 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-2 py-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="min-w-0">
                          <h4 className="break-words text-sm font-semibold">{cat.name}</h4>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: cat.color }} />
                            {cat.type === 'INCOME' ? 'Receita' : 'Despesa'}
                          </p>
                        </div>
                        <div className="min-w-0 text-xs text-muted-foreground">
                          <p className="flex flex-wrap gap-x-3 gap-y-1">
                            <span><b className="font-mono font-medium tabular-nums text-foreground">{txCount}</b> {txCount === 1 ? 'transação' : 'transações'}</span>
                            <span><b className="font-mono font-medium tabular-nums text-foreground">{puCount}</b> {puCount === 1 ? 'compra' : 'compras'}</span>
                          </p>
                          <p className="mt-1">{totalUsage} {totalUsage === 1 ? 'registro' : 'registros'} no total</p>
                          <div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-muted-foreground/60" style={{ width: `${usagePct}%` }} />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`Editar categoria: ${cat.name}`} className={`size-11 shrink-0 ${focusStyle}`} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={() => openEdit(cat)}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Excluir categoria: ${cat.name}`} className={`size-11 shrink-0 text-destructive hover:text-destructive ${focusStyle}`} onClickCapture={(event) => beginOpening(event.currentTarget)} onClick={() => setShowDeleteDialog(cat.id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* ── Category Form Dialog ────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog('form'); }}>
        <DialogContent showCloseButton={false} onCloseAutoFocus={restoreFocus} className="motion-reduce:animate-none max-h-[90dvh] gap-4 overflow-y-auto border-border bg-card p-4 shadow-none sm:max-w-lg sm:p-6">
          <DialogHeader className="min-h-11 pr-12 text-left">
            <DialogTitle>
              {editing ? 'Editar categoria' : 'Nova categoria'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da categoria'
                : 'Crie uma nova categoria'}
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" className={`absolute right-3 top-3 size-11 ${focusStyle}`}>
              <X aria-hidden="true" />
            </Button>
          </DialogClose>

          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Nome</Label>
              <Input id="category-name" className={focusStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Alimentação, Transporte..."
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="category-type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger id="category-type" className={`w-full ${focusStyle}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">Ícone</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {iconOptions.map((opt) => {
                  const selected = form.icon === opt.value;
                  return (
                    <button key={opt.value} type="button" aria-pressed={selected}
                      onClick={() => setForm({ ...form, icon: opt.value })}
                      className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs ${focusStyle} ${selected ? 'border-primary bg-muted font-semibold text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      <opt.Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">Cor</legend>
              <div className="flex flex-wrap gap-1">
                {categoryColors.map((c) => {
                  const selected = form.color === c.value;
                  return (
                    <button key={c.value} type="button" aria-label={c.label} aria-pressed={selected} title={c.label}
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={`grid size-11 shrink-0 place-items-center rounded-md border ${focusStyle} ${selected ? 'border-primary bg-muted' : 'border-border hover:bg-muted'}`}>
                      <span aria-hidden="true" className="relative grid size-5 place-items-center rounded-full" style={{ backgroundColor: c.value }}>
                        {selected && <Check className="size-3.5 rounded-full bg-card text-foreground" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <p className="text-sm font-medium">Pré-visualização</p>
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground">
                  <PreviewIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{form.name || 'Nome da categoria'}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: form.color }} />
                    {form.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    {categoryColors.find((option) => option.value === form.color)?.label}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className={focusStyle} onClick={() => closeDialog('form')}>
              Cancelar
            </Button>
            <Button className={focusStyle} onClick={save}>
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <AlertDialog
        open={!!showDeleteDialog}
        onOpenChange={(open) => { if (!open) closeDialog('delete'); }}
      >
        <AlertDialogContent onCloseAutoFocus={restoreFocus} className="motion-reduce:animate-none border-border bg-card shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Transações e compras vinculadas
              perderão a categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={focusStyle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (showDeleteDialog) deleteCat(showDeleteDialog);
              }}
              className="bg-destructive text-[var(--ds-destructive-fg)] hover:bg-destructive hover:underline"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
