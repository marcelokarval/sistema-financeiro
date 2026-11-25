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

const cardColors = [
  ['#8b5cf6', 'Roxo'],
  ['#f97316', 'Laranja'],
  ['#ef4444', 'Vermelho'],
  ['#3b82f6', 'Azul'],
  ['#06b6d4', 'Ciano'],
  ['#22c55e', 'Verde'],
  ['#ec4899', 'Rosa'],
] as const;

export interface CardFormDraft {
  name: string;
  type: string;
  brand: string;
  lastFourDigits: string;
  creditLimit: string;
  closingDay: string;
  dueDay: string;
  color: string;
  flag: string;
}

export const emptyCardForm: CardFormDraft = {
  name: '',
  type: 'CREDIT',
  brand: 'VISA',
  lastFourDigits: '',
  creditLimit: '0',
  closingDay: '1',
  dueDay: '10',
  color: '#8b5cf6',
  flag: '',
};

export interface CardEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  pending: boolean;
  form: CardFormDraft;
  onFieldChange: (field: keyof CardFormDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSubmit: () => void | Promise<void>;
}

/** Modal form dialog for creating or editing a payment card. */
export function CardEditor({
  mode,
  open,
  pending,
  form,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: CardEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      title={isEditing ? 'Editar Cartão' : 'Novo Cartão'}
      description={isEditing ? 'Atualize os dados do cartão' : 'Adicione um novo cartão'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button aria-disabled={pending} onClick={onSubmit}>
            {isEditing ? 'Atualizar' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="card-name">Nome do Cartão</Label>
          <Input
            id="card-name"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder="Ex: Nubank Platinum"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="card-type">Tipo</Label>
            <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
              <SelectTrigger id="card-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">Crédito</SelectItem>
                <SelectItem value="DEBIT">Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="card-brand">Bandeira</Label>
            <Select value={form.brand} onValueChange={(v) => onFieldChange('brand', v)}>
              <SelectTrigger id="card-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VISA">Visa</SelectItem>
                <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                <SelectItem value="ELO">Elo</SelectItem>
                <SelectItem value="AMEX">American Express</SelectItem>
                <SelectItem value="HIPER">Hiper</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="card-digits">Últimos 4 dígitos</Label>
            <Input
              id="card-digits"
              value={form.lastFourDigits}
              onChange={(e) => onFieldChange('lastFourDigits', e.target.value.slice(0, 4))}
              placeholder="0000"
              maxLength={4}
            />
          </div>
          <div>
            <Label htmlFor="card-flag">Bandeira/Banco (opcional)</Label>
            <Input
              id="card-flag"
              value={form.flag}
              onChange={(e) => onFieldChange('flag', e.target.value)}
              placeholder="Ex: Nubank, Inter"
            />
          </div>
        </div>
        {form.type === 'CREDIT' && (
          <>
            <div>
              <Label htmlFor="card-limit">Limite de Crédito (R$)</Label>
              <Input
                id="card-limit"
                type="number"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => onFieldChange('creditLimit', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="card-close-day">Dia de Fechamento</Label>
                <Input
                  id="card-close-day"
                  type="number"
                  min="1"
                  max="31"
                  value={form.closingDay}
                  onChange={(e) => onFieldChange('closingDay', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="card-due-day">Dia de Vencimento</Label>
                <Input
                  id="card-due-day"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(e) => onFieldChange('dueDay', e.target.value)}
                />
              </div>
            </div>
          </>
        )}
        <div>
          <p id="card-color" className="text-sm font-medium">
            Cor
          </p>
          <div role="group" aria-labelledby="card-color" className="mt-2 flex flex-wrap gap-2">
            {cardColors.map(([c, name]) => (
              <button
                key={c}
                type="button"
                aria-label={name}
                aria-pressed={form.color === c}
                className="size-8 rounded-full border border-border aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-foreground focus-visible:outline-ring"
                style={{ backgroundColor: c }}
                onClick={() => onFieldChange('color', c)}
              />
            ))}
          </div>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
