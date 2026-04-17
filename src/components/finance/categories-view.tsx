'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag, TrendingUp, TrendingDown, Layers, BarChart3, Trophy } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';

const categoryColors = [
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316',
  '#f59e0b', '#64748b', '#ec4899', '#84cc16', '#a855f7', '#94a3b8',
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
  { value: 'banknote', label: 'Dinheiro' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'trending-up', label: 'Investimento' },
  { value: 'utensils', label: 'Alimentação' },
  { value: 'car', label: 'Transporte' },
  { value: 'heart-pulse', label: 'Saúde' },
  { value: 'graduation-cap', label: 'Educação' },
  { value: 'gamepad-2', label: 'Entretenimento' },
  { value: 'shopping-bag', label: 'Compras' },
  { value: 'receipt', label: 'Contas' },
  { value: 'home', label: 'Moradia' },
  { value: 'more-horizontal', label: 'Outros' },
  { value: 'tag', label: 'Tag' },
  { value: 'gift', label: 'Presente' },
  { value: 'plane', label: 'Viagem' },
  { value: 'baby', label: 'Filhos' },
  { value: 'dog', label: 'Pet' },
];

/* ── animation presets ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const filterBtnVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.25 },
  }),
};

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' });

  /* ── data fetching ───────────────────────────────────────── */
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
    try {
      if (editing) {
        await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
        toast.success('Categoria atualizada!');
      } else {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        toast.success('Categoria criada!');
      }
      setShowDialog(false);
      fetchCategories();
    } catch {
      toast.error('Erro ao salvar categoria');
    }
  };

  const deleteCat = async (id: string) => {
    try {
      await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Categoria excluída!');
      setShowDeleteDialog(null);
      fetchCategories();
    } catch {
      toast.error('Erro ao excluir categoria');
    }
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

  /* ── loading skeleton ────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ── main render ─────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-lg font-semibold">Categorias</h2>
          <p className="text-sm text-muted-foreground">
            Organize suas receitas e despesas
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="rounded-full px-5">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Categoria
        </Button>
      </motion.div>

      {/* ── Summary Stats Row ────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Total */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-lg transition-all duration-300 card-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{categories.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Income */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-lg transition-all duration-300 card-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {incomeCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-lg transition-all duration-300 card-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                  {expenseCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Most Used */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-lg transition-all duration-300 card-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mais usada</p>
                <p className="text-sm font-bold truncate">
                  {mostUsed
                    ? mostUsed.name
                    : '—'}
                </p>
                {mostUsed && (
                  <p className="text-[11px] text-muted-foreground">
                    {(mostUsed._count?.transactions || 0) + (mostUsed._count?.purchases || 0)} registros
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Enhanced Type Filter ─────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: 'all' as const, label: 'Todas', count: categories.length, Icon: Layers },
            { key: 'INCOME' as const, label: 'Receitas', count: incomeCount, Icon: TrendingUp },
            { key: 'EXPENSE' as const, label: 'Despesas', count: expenseCount, Icon: TrendingDown },
          ] as const
        ).map((f, i) => {
          const active = filter === f.key;
          return (
            <motion.button
              key={f.key}
              custom={i}
              variants={filterBtnVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(f.key)}
              className={`
                relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                text-sm font-medium transition-colors duration-200 cursor-pointer
                ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              <f.Icon className="w-3.5 h-3.5" />
              <span>{f.label}</span>
              <span
                className={`
                  ml-0.5 text-[11px] font-semibold rounded-full px-1.5 py-0.5
                  ${
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background/60 text-muted-foreground'
                  }
                `}
              >
                {f.count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Category Card Grid ──────────────────────────────── */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Tag className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma categoria encontrada
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {filter === 'all'
                ? 'Crie sua primeira categoria para começar.'
                : `Nenhuma categoria do tipo ${
                    filter === 'INCOME' ? 'Receita' : 'Despesa'
                  } cadastrada.`}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={filter}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((cat) => {
              const txCount = cat._count?.transactions || 0;
              const puCount = cat._count?.purchases || 0;
              const totalUsage = txCount + puCount;
              const usagePct = (totalUsage / maxUsage) * 100;

              return (
                <motion.div
                  key={cat.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  layout
                >
                  <Card className="group shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow overflow-hidden">
                    <CardContent className="p-0">
                      {/* Left accent bar */}
                      <div className="flex">
                        <div
                          className="w-1 rounded-l-lg flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />

                        <div className="flex-1 p-5">
                          {/* Top row: icon + name + actions */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Larger icon circle */}
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${cat.color}18` }}
                              >
                                <Tag
                                  className="w-5 h-5"
                                  style={{ color: cat.color }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {cat.name}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] mt-1"
                                  style={{
                                    borderColor: cat.color,
                                    color: cat.color,
                                  }}
                                >
                                  {cat.type === 'INCOME'
                                    ? 'Receita'
                                    : 'Despesa'}
                                </Badge>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(cat)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setShowDeleteDialog(cat.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Usage stats with mini progress bars */}
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                {txCount} transações
                              </span>
                              <span>{puCount} compras</span>
                            </div>
                            {/* Mini progress bar */}
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: cat.color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${usagePct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground/70">
                              {totalUsage} registro{totalUsage !== 1 ? 's' : ''} no total
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Form Dialog ────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da categoria'
                : 'Crie uma nova categoria'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Alimentação, Transporte..."
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Icon Picker – 3-column grid */}
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {iconOptions.map((opt) => {
                  const selected = form.icon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, icon: opt.value })}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                        transition-colors duration-150 cursor-pointer
                        ${
                          selected
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker – larger 10-column swatches */}
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="grid grid-cols-10 gap-2">
                {categoryColors.map((c) => {
                  const selected = form.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`
                        w-full aspect-square rounded-lg transition-all duration-150 cursor-pointer
                        ${selected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-105'}
                      `}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  );
                })}
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-1.5">
              <Label>Pré-visualização</Label>
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${form.color}18` }}
                  >
                    <Tag className="w-5 h-5" style={{ color: form.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {form.name || 'Nome da categoria'}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] mt-1"
                      style={{ borderColor: form.color, color: form.color }}
                    >
                      {form.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <AlertDialog
        open={!!showDeleteDialog}
        onOpenChange={() => setShowDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Transações e compras vinculadas
              perderão a categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteCat(showDeleteDialog)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
