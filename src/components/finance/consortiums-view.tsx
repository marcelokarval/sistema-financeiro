'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Building2,
  CalendarDays,
  CreditCard,
  Users,
  TrendingUp,
  HandCoins,
  PieChart,
  Clock,
  CircleDollarSign,
  FileCheck,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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

import {
  currencyFmt,
  dateFmt,
  pct,
  containerVariants,
  itemVariants,
  summaryContainerVariants,
  summaryItemVariants,
  listContainerVariants,
  listItemVariants,
  detailEntryVariants,
} from '@/lib/helpers';
import {
  StatCard,
  StatCardSkeleton,
  EmptyState,
  SectionHeader,
  ProgressBar,
  StatusBadge,
} from '@/components/shared/ui-helpers';

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

interface ConsortiumInstallment {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  notes: string;
  assemblyDate: string | null;
  assemblyResult: string;
  consortiumId: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

// ── Status Configs ────────────────────────────────────────────────
const consortiumStatusLabels: Record<string, { text: string; className: string }> = {
  ACTIVE: { text: 'Ativo', className: 'bg-emerald-500/15 text-emerald-600' },
  COMPLETED: { text: 'Concluído', className: 'bg-green-500/15 text-green-600' },
  CANCELLED: { text: 'Cancelado', className: 'bg-slate-500/15 text-slate-500' },
  CONTEMPLATED: { text: 'Contemplado', className: 'bg-amber-500/15 text-amber-600' },
};

const installmentStatusLabels: Record<string, { text: string; className: string }> = {
  PAID: { text: 'Paga', className: 'bg-emerald-500/15 text-emerald-600' },
  PENDING: { text: 'Pendente', className: 'bg-amber-500/15 text-amber-600' },
  OVERDUE: { text: 'Vencida', className: 'bg-rose-500/15 text-rose-600' },
};

type FilterStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'CONTEMPLATED';

// ── Component ─────────────────────────────────────────────────────
export function ConsortiumsView() {
  const [consortiums, setConsortiums] = useState<Consortium[]>([]);
  const [installments, setInstallments] = useState<ConsortiumInstallment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedConsortium, setSelectedConsortium] = useState<Consortium | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showPayDialog, setShowPayDialog] = useState<ConsortiumInstallment | null>(null);

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
  const [payForm, setPayForm] = useState({
    installmentId: '',
    paidDate: new Date().toISOString().split('T')[0],
    notes: '',
    assemblyDate: '',
    assemblyResult: '',
  });

  // ── Data Fetching ───────────────────────────────────────────────
  const fetchConsortiums = useCallback(async () => {
    try {
      const res = await fetch('/api/consortiums');
      if (res.ok) setConsortiums(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInstallments = useCallback(async (consortiumId: string) => {
    try {
      const res = await fetch(`/api/consortiums/installments?consortiumId=${consortiumId}`);
      if (res.ok) setInstallments(await res.json());
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
    fetchConsortiums();
    fetchCategories();
  }, [fetchConsortiums, fetchCategories]);

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
    setSelectedConsortium(c);
    fetchInstallments(c.id);
  };

  const openCreateDialog = () => {
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
    setShowCreateDialog(true);
  };

  const openEditDialog = (c: Consortium) => {
    setEditForm({
      id: c.id,
      nextAssemblyDate: c.nextAssemblyDate
        ? new Date(c.nextAssemblyDate).toISOString().split('T')[0]
        : '',
      assembliesAttended: String(c.assembliesAttended),
    });
    setShowEditDialog(true);
  };

  const openPayDialog = (inst: ConsortiumInstallment) => {
    setPayForm({
      installmentId: inst.id,
      paidDate: new Date().toISOString().split('T')[0],
      notes: '',
      assemblyDate: '',
      assemblyResult: '',
    });
    setShowPayDialog(inst);
  };

  const createConsortium = async () => {
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
        accountId: createForm.accountId || null,
      };
      const res = await fetch('/api/consortiums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao criar consórcio');
        return;
      }
      toast.success('Consórcio criado com sucesso!');
      setShowCreateDialog(false);
      fetchConsortiums();
    } catch {
      toast.error('Erro ao criar consórcio');
    }
  };

  const updateConsortium = async () => {
    try {
      const body = {
        id: editForm.id,
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
        toast.error(data.error || 'Erro ao atualizar consórcio');
        return;
      }
      toast.success('Consórcio atualizado!');
      setShowEditDialog(false);
      fetchConsortiums();
      if (selectedConsortium?.id === editForm.id) {
        fetchConsortiums().then(() => {
          const updated = consortiums.find((c) => c.id === editForm.id);
          if (updated) setSelectedConsortium(updated);
        });
      }
    } catch {
      toast.error('Erro ao atualizar consórcio');
    }
  };

  const deleteConsortium = async (id: string) => {
    try {
      await fetch('/api/consortiums', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Consórcio excluído!');
      setShowDeleteDialog(null);
      if (selectedConsortium?.id === id) setSelectedConsortium(null);
      fetchConsortiums();
    } catch {
      toast.error('Erro ao excluir consórcio');
    }
  };

  const markAsPaid = async () => {
    try {
      const body: Record<string, unknown> = {
        installmentId: payForm.installmentId,
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
        toast.error(data.error || 'Erro ao marcar parcela');
        return;
      }
      toast.success('Parcela marcada como paga!');
      setShowPayDialog(null);
      if (selectedConsortium) {
        fetchInstallments(selectedConsortium.id);
      }
      fetchConsortiums();
    } catch {
      toast.error('Erro ao marcar parcela como paga');
    }
  };

  // ── Loading State ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Detail View ─────────────────────────────────────────────────
  if (selectedConsortium) {
    const c = selectedConsortium;
    const progress = pct(c.fundedAmount, c.totalAmount);

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="consortium-detail"
          variants={detailEntryVariants}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="space-y-6"
        >
          {/* Back button + Header */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedConsortium(null);
                  setInstallments([]);
                }}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{c.description}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge status={c.status} labels={consortiumStatusLabels} />
                  {c.group && (
                    <Badge variant="outline" className="text-[10px]">
                      Grupo {c.group}
                    </Badge>
                  )}
                  {c.quota && (
                    <Badge variant="outline" className="text-[10px]">
                      Cota {c.quota}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openEditDialog(c)}
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(c.id)}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            </div>
          </motion.div>

          {/* Info Card */}
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="overflow-hidden border-0 shadow-md">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <InfoItem
                    label="Valor Total"
                    value={currencyFmt(c.totalAmount)}
                    icon={CircleDollarSign}
                    colorClass="text-teal-600"
                    bgClass="bg-teal-500/10"
                  />
                  <InfoItem
                    label="Valor Financiado"
                    value={currencyFmt(c.fundedAmount)}
                    icon={HandCoins}
                    colorClass="text-emerald-600"
                    bgClass="bg-emerald-500/10"
                  />
                  <InfoItem
                    label="Parcela Mensal"
                    value={currencyFmt(c.monthlyPayment)}
                    icon={CreditCard}
                    colorClass="text-amber-600"
                    bgClass="bg-amber-500/10"
                  />
                  <InfoItem
                    label="Parcelas"
                    value={`${c.paidInstallments}/${c.installmentCount}`}
                    icon={FileCheck}
                    colorClass="text-violet-600"
                    bgClass="bg-violet-500/10"
                  />
                  <InfoItem
                    label="Administradora"
                    value={c.administrator || '—'}
                    icon={Building2}
                    colorClass="text-slate-600"
                    bgClass="bg-slate-500/10"
                  />
                  <InfoItem
                    label="Assembleias"
                    value={`${c.assembliesAttended} assistidas`}
                    icon={Users}
                    colorClass="text-cyan-600"
                    bgClass="bg-cyan-500/10"
                  />
                  <InfoItem
                    label="Próxima Assembleia"
                    value={c.nextAssemblyDate ? dateFmt(c.nextAssemblyDate) : '—'}
                    icon={CalendarDays}
                    colorClass="text-indigo-600"
                    bgClass="bg-indigo-500/10"
                  />
                  <InfoItem
                    label="Data Início"
                    value={dateFmt(c.startDate)}
                    icon={CalendarDays}
                    colorClass="text-pink-600"
                    bgClass="bg-pink-500/10"
                  />
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Progresso do Financiamento
                    </span>
                    <span className="text-sm font-bold text-teal-600">{progress}%</span>
                  </div>
                  <ProgressBar
                    value={c.fundedAmount}
                    max={c.totalAmount}
                    color="bg-gradient-to-r from-teal-500 to-emerald-500"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Assembly History */}
          {c.assembliesAttended > 0 && (
            <motion.div variants={itemVariants} initial="hidden" animate="show">
              <Card className="overflow-hidden border-0 shadow-md">
                <div className="h-1 bg-gradient-to-r from-cyan-500 to-teal-400" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-semibold">Histórico de Assembleias</h3>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-500/5">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {c.assembliesAttended} assembleia{c.assembliesAttended !== 1 ? 's' : ''} assistida{c.assembliesAttended !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.nextAssemblyDate
                          ? `Próxima: ${dateFmt(c.nextAssemblyDate)}`
                          : 'Nenhuma assembleia agendada'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Installments Section */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className="flex items-center justify-between"
          >
            <div>
              <h3 className="text-base font-semibold">Parcelas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {installments.filter((i) => i.status === 'PAID').length} de{' '}
                {c.installmentCount} pagas
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="overflow-hidden border-0 shadow-md">
              <CardContent className="p-0">
                {installments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma parcela encontrada</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      As parcelas serão geradas ao criar o consórcio
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[480px]">
                    <motion.div
                      variants={listContainerVariants}
                      initial="hidden"
                      animate="show"
                      className="divide-y divide-border"
                    >
                      {installments.map((inst) => (
                        <motion.div
                          key={inst.id}
                          variants={listItemVariants}
                          className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                inst.status === 'PAID'
                                  ? 'bg-emerald-500/10'
                                  : inst.status === 'OVERDUE'
                                    ? 'bg-rose-500/10'
                                    : 'bg-amber-500/10'
                              }`}
                            >
                              {inst.status === 'PAID' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : inst.status === 'OVERDUE' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                Parcela {inst.number}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-muted-foreground">
                                  Venc: {dateFmt(inst.dueDate)}
                                </p>
                                {inst.paidDate && (
                                  <span className="text-[10px] text-emerald-500">
                                    Paga em {dateFmt(inst.paidDate)}
                                  </span>
                                )}
                                {inst.notes && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                    • {inst.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <StatusBadge status={inst.status} labels={installmentStatusLabels} />
                            <span className="text-sm font-bold whitespace-nowrap">
                              {currencyFmt(inst.amount)}
                            </span>
                            {inst.status !== 'PAID' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => openPayDialog(inst)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Consórcio</DialogTitle>
                <DialogDescription>
                  Atualize as informações de assembleia do consórcio
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Próxima Data de Assembleia</Label>
                  <Input
                    type="date"
                    value={editForm.nextAssemblyDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nextAssemblyDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Assembleias Assistidas</Label>
                  <Input
                    type="number"
                    value={editForm.assembliesAttended}
                    onChange={(e) =>
                      setEditForm({ ...editForm, assembliesAttended: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={updateConsortium}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Pay Installment Dialog */}
          <Dialog open={!!showPayDialog} onOpenChange={() => setShowPayDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Marcar Parcela como Paga</DialogTitle>
                <DialogDescription>
                  {showPayDialog && `Parcela ${showPayDialog.number} — ${currencyFmt(showPayDialog.amount)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={payForm.paidDate}
                    onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    placeholder="Nota opcional..."
                  />
                </div>
                <Separator />
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Informações da Assembleia (opcional)
                </div>
                <div>
                  <Label>Data da Assembleia</Label>
                  <Input
                    type="date"
                    value={payForm.assemblyDate}
                    onChange={(e) => setPayForm({ ...payForm, assemblyDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Resultado da Assembleia</Label>
                  <Input
                    value={payForm.assemblyResult}
                    onChange={(e) =>
                      setPayForm({ ...payForm, assemblyResult: e.target.value })
                    }
                    placeholder="Ex: Contemplado na assembleia..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPayDialog(null)}>
                  Cancelar
                </Button>
                <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600" onClick={markAsPaid}>
                  Confirmar Pagamento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Consórcio</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o consórcio &quot;{selectedConsortium.description}&quot;?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => showDeleteDialog && deleteConsortium(showDeleteDialog)}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── List View ───────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="consortium-list"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        exit="hidden"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <SectionHeader
            title="Consórcios"
            subtitle="Gerencie seus consórcios e parcelas"
          />
          <Button
            onClick={openCreateDialog}
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Consórcio</span>
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          variants={summaryContainerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total em Consórcios"
            value={currencyFmt(summary.totalEmConsortios)}
            icon={HandCoins}
            gradient="from-teal-500 to-emerald-500"
            subtitle={`${consortiums.length} consórcio${consortiums.length !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Total Pago"
            value={currencyFmt(summary.totalPago)}
            icon={TrendingUp}
            gradient="from-emerald-500 to-green-500"
            subtitle="Valor já financiado"
          />
          <StatCard
            label="Valor Restante"
            value={currencyFmt(summary.valorRestante)}
            icon={CreditCard}
            gradient="from-amber-500 to-orange-500"
            subtitle="Saldo remanescente"
          />
          <StatCard
            label="Taxa de Progresso"
            value={`${summary.taxaProgresso}%`}
            icon={PieChart}
            gradient="from-cyan-500 to-teal-500"
            subtitle="Média geral dos consórcios"
          />
        </motion.div>

        {/* Filter Tabs */}
        <motion.div variants={itemVariants} initial="hidden" animate="show">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="ALL">Todos</TabsTrigger>
              <TabsTrigger value="ACTIVE">Ativos</TabsTrigger>
              <TabsTrigger value="COMPLETED">Concluídos</TabsTrigger>
              <TabsTrigger value="CANCELLED">Cancelados</TabsTrigger>
              <TabsTrigger value="CONTEMPLATED">Contemplados</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Consortium Cards Grid */}
        {filteredConsortiums.length === 0 ? (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={Building2}
              title={
                filter === 'ALL'
                  ? 'Nenhum consórcio cadastrado'
                  : 'Nenhum consórcio encontrado'
              }
              subtitle={
                filter === 'ALL'
                  ? 'Clique em "Novo Consórcio" para começar'
                  : 'Tente mudar o filtro para ver mais resultados'
              }
            />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredConsortiums.map((c) => {
              const progress = pct(c.fundedAmount, c.totalAmount);
              return (
                <motion.div
                  key={c.id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Card
                    className="cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow group relative overflow-hidden border-0"
                    onClick={() => openConsortium(c)}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {c.description}
                            </p>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {c.group && (
                                <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-600">
                                  Grupo {c.group}
                                </Badge>
                              )}
                              {c.quota && (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                                  Cota {c.quota}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                          <StatusBadge status={c.status} labels={consortiumStatusLabels} />
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(c);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteDialog(c.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      {c.administrator && (
                        <p className="text-[11px] text-muted-foreground mt-3 truncate">
                          <Building2 className="w-3 h-3 inline mr-1" />
                          {c.administrator}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            {c.paidInstallments}/{c.installmentCount} parcelas
                          </span>
                          <span className="text-[10px] font-semibold text-teal-600">
                            {progress}%
                          </span>
                        </div>
                        <ProgressBar
                          value={c.fundedAmount}
                          max={c.totalAmount}
                          color="bg-gradient-to-r from-teal-500 to-emerald-500"
                        />
                      </div>

                      {/* Bottom info row */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            {currencyFmt(c.monthlyPayment)}/mês
                          </div>
                        </div>
                        {c.nextAssemblyDate && (
                          <div className="text-[11px] text-muted-foreground">
                            <CalendarDays className="w-3 h-3 inline mr-1" />
                            {dateFmt(c.nextAssemblyDate)}
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Create Consortium Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Consórcio</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo consórcio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Descrição do Bem</Label>
                  <Input
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    placeholder="Ex: Honda Civic 2024"
                  />
                </div>
                <div>
                  <Label>Grupo</Label>
                  <Input
                    value={createForm.group}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, group: e.target.value })
                    }
                    placeholder="Ex: 0123"
                  />
                </div>
                <div>
                  <Label>Cota</Label>
                  <Input
                    value={createForm.quota}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, quota: e.target.value })
                    }
                    placeholder="Ex: 0042"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Administradora</Label>
                  <Input
                    value={createForm.administrator}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, administrator: e.target.value })
                    }
                    placeholder="Ex: Banco do Brasil, Santander..."
                  />
                </div>
                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input
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
                  <Label>Parcela Mensal (R$)</Label>
                  <Input
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
                  <Label>Total de Parcelas</Label>
                  <Input
                    type="number"
                    value={createForm.installmentCount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, installmentCount: e.target.value })
                    }
                    placeholder="Ex: 120"
                  />
                </div>
                <div>
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Próxima Assembleia</Label>
                  <Input
                    type="date"
                    value={createForm.nextAssemblyDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, nextAssemblyDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={createForm.categoryId}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, categoryId: v })
                    }
                  >
                    <SelectTrigger>
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
                  <Label>Conta Vinculada</Label>
                  <Input
                    value={createForm.accountId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, accountId: e.target.value })
                    }
                    placeholder="ID da conta (opcional)"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                onClick={createConsortium}
              >
                Criar Consórcio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (list view) */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Consórcio</DialogTitle>
              <DialogDescription>
                Atualize as informações de assembleia do consórcio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Próxima Data de Assembleia</Label>
                <Input
                  type="date"
                  value={editForm.nextAssemblyDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nextAssemblyDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Assembleias Assistidas</Label>
                <Input
                  type="number"
                  value={editForm.assembliesAttended}
                  onChange={(e) =>
                    setEditForm({ ...editForm, assembliesAttended: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={updateConsortium}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Consórcio</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este consórcio? Esta ação não pode ser desfeita
                e todas as parcelas associadas serão removidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => showDeleteDialog && deleteConsortium(showDeleteDialog)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Info Item Sub-Component ───────────────────────────────────────
function InfoItem({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
      <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}
