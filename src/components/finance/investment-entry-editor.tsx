'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';

export interface InvestmentEntryDraft {
  type: string;
  amount: string;
  quantity: string;
  unitPrice: string;
  date: string;
  description: string;
  notes: string;
}

interface InvestmentEntryEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  saving: boolean;
  investmentName: string;
  form: InvestmentEntryDraft;
  onFieldChange: (field: keyof InvestmentEntryDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSave: () => Promise<void>;
}

/** Modal editor for creating or editing a single investment transaction. */
export function InvestmentEntryEditor({
  mode,
  open,
  saving,
  investmentName,
  form,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSave,
}: InvestmentEntryEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel="Fechar formulário"
      contentClassName="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto"
      title={isEditing ? 'Editar Transação' : 'Nova Transação'}
      description={
        isEditing
          ? `Atualizar transação em ${investmentName}`
          : `Registrar nova transação em ${investmentName}`
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="investment-tx-type">Tipo</Label>
          <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
            <SelectTrigger id="investment-tx-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APORTE">Aporte</SelectItem>
              <SelectItem value="DIVIDENDO">Dividendo</SelectItem>
              <SelectItem value="VENDA">Venda</SelectItem>
              <SelectItem value="REINVESTIMENTO">Reinvestimento</SelectItem>
              <SelectItem value="TAXA">Taxa</SelectItem>
              <SelectItem value="BONUS">Bônus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-tx-amount">Valor (R$)</Label>
            <Input
              id="investment-tx-amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => onFieldChange('amount', e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label htmlFor="investment-tx-date">Data</Label>
            <Input
              id="investment-tx-date"
              type="date"
              value={form.date}
              onChange={(e) => onFieldChange('date', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-tx-quantity">Quantidade</Label>
            <Input
              id="investment-tx-quantity"
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => onFieldChange('quantity', e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label htmlFor="investment-tx-unitPrice">Preço Unitário (R$)</Label>
            <Input
              id="investment-tx-unitPrice"
              type="number"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => onFieldChange('unitPrice', e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="investment-tx-description">Descrição</Label>
          <Input
            id="investment-tx-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder="Ex: Compra de cotas, Dividendo mensal..."
          />
        </div>
        <div>
          <Label htmlFor="investment-tx-notes">Observações</Label>
          <Input
            id="investment-tx-notes"
            value={form.notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            placeholder="Notas adicionais (opcional)"
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
