'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag, TrendingUp, TrendingDown } from 'lucide-react';
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

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'tag', type: 'EXPENSE', color: '#64748b' });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

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
    if (!form.name) { toast.error('Informe o nome da categoria'); return; }
    try {
      if (editing) {
        await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...form }) });
        toast.success('Categoria atualizada!');
      } else {
        await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        toast.success('Categoria criada!');
      }
      setShowDialog(false);
      fetchCategories();
    } catch { toast.error('Erro ao salvar categoria'); }
  };

  const deleteCat = async (id: string) => {
    try {
      await fetch('/api/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success('Categoria excluída!');
      setShowDeleteDialog(null);
      fetchCategories();
    } catch { toast.error('Erro ao excluir categoria'); }
  };

  const filtered = categories.filter((c) => filter === 'all' || c.type === filter);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Categorias</h2>
          <p className="text-sm text-muted-foreground">Organize suas receitas e despesas</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todas ({categories.length})
        </Button>
        <Button
          variant={filter === 'INCOME' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('INCOME')}
        >
          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Receitas ({categories.filter(c => c.type === 'INCOME').length})
        </Button>
        <Button
          variant={filter === 'EXPENSE' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('EXPENSE')}
        >
          <TrendingDown className="w-3.5 h-3.5 mr-1" /> Despesas ({categories.filter(c => c.type === 'EXPENSE').length})
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((cat) => (
          <Card
            key={cat.id}
            className="group hover:shadow-md transition-all duration-200"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <Tag className="w-5 h-5" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{cat.name}</p>
                    <Badge
                      variant="outline"
                      className="text-[10px] mt-0.5"
                      style={{ borderColor: cat.color, color: cat.color }}
                    >
                      {cat.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
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
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{cat._count?.transactions || 0} transações</span>
                <span>·</span>
                <span>{cat._count?.purchases || 0} compras</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados da categoria' : 'Crie uma nova categoria'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Alimentação, Transporte..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ícone</Label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {iconOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {categoryColors.map((c) => (
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Atualizar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Transações e compras vinculadas perderão a categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteDialog && deleteCat(showDeleteDialog)} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
