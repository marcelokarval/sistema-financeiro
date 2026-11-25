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
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { PurchaseItemsEditor, type PurchaseItemDraft } from './purchase-items-editor';

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const amountStyle = 'font-mono tabular-nums [overflow-wrap:anywhere]';

export interface PurchaseFormDraft {
  merchant: string;
  cardId: string;
  categoryId: string;
  date: string;
  notes: string;
}

export interface PurchaseCardOption {
  id: string;
  name: string;
  lastFourDigits: string;
}

export interface PurchaseCategoryOption {
  id: string;
  name: string;
}

export interface PurchaseEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  form: PurchaseFormDraft;
  items: readonly PurchaseItemDraft[];
  cards: readonly PurchaseCardOption[];
  categories: readonly PurchaseCategoryOption[];
  totalAmount: number;
  onFieldChange: (field: keyof PurchaseFormDraft, value: string) => void;
  onItemChange: (index: number, field: keyof PurchaseItemDraft, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}

/** Modal form dialog for creating or editing a detailed purchase with items. */
export function PurchaseEditor({
  mode,
  open,
  form,
  items,
  cards,
  categories,
  totalAmount,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onOpenChange,
  onCloseAutoFocus,
  onCancel,
  onSubmit,
}: PurchaseEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel="Fechar formulário"
      contentClassName="motion-reduce:animate-none max-h-[90dvh] gap-4 overflow-y-auto border-border bg-card p-4 shadow-none sm:max-w-lg sm:p-6"
      title={isEditing ? 'Editar compra' : 'Nova compra'}
      description="Registre os detalhes da compra com todos os itens"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className={cn('mr-auto text-sm font-semibold', amountStyle)}>
            Total: {currencyFmt(totalAmount)}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className={focusStyle} onClick={onCancel}>
              Cancelar
            </Button>
            <Button className={focusStyle} onClick={onSubmit}>
              {isEditing ? 'Atualizar' : 'Registrar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-w-0">
        <div className="space-y-4 pb-4">
          <div>
            <Label htmlFor="purchase-merchant">Estabelecimento</Label>
            <Input
              className={focusStyle}
              id="purchase-merchant"
              value={form.merchant}
              onChange={(e) => onFieldChange('merchant', e.target.value)}
              placeholder="Ex: Carrefour, Amazon..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="purchase-card">Cartão</Label>
              <Select
                value={form.cardId || '__none__'}
                onValueChange={(v) => onFieldChange('cardId', v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="purchase-card" className={cn('w-full', focusStyle)}>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum cartão</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} •••• {c.lastFourDigits}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="purchase-category">Categoria</Label>
              <Select
                value={form.categoryId || '__none__'}
                onValueChange={(v) => onFieldChange('categoryId', v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="purchase-category" className={cn('w-full', focusStyle)}>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="purchase-date">Data</Label>
            <Input
              className={focusStyle}
              id="purchase-date"
              type="date"
              value={form.date}
              onChange={(e) => onFieldChange('date', e.target.value)}
            />
          </div>

          <PurchaseItemsEditor
            items={items}
            onItemChange={onItemChange}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
          />

          <div>
            <Label htmlFor="purchase-notes">Observações (opcional)</Label>
            <Input
              className={focusStyle}
              id="purchase-notes"
              value={form.notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              placeholder="Notas adicionais..."
            />
          </div>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
