'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type AccountTransactionForm = {
  type: string;
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  notes: string;
};

type AccountTransactionFieldsProps = {
  mode: 'create' | 'edit';
  value: AccountTransactionForm;
  onChange: (value: AccountTransactionForm) => void;
  categories: readonly { id: string; name: string; type: string }[];
};

// O sentinela do Select de edição não faz parte do rascunho nem do payload.
const NO_CATEGORY = '__none__';

export function AccountTransactionFields({ mode, value, onChange, categories }: AccountTransactionFieldsProps) {
  const editing = mode === 'edit';
  const prefix = editing ? 'edit-tx' : 'tx';
  const selectedCategory = editing ? value.categoryId || NO_CATEGORY : value.categoryId;
  const change = (field: keyof AccountTransactionForm, next: string) => onChange({ ...value, [field]: next });

  const changeCategory = (next: string) => change('categoryId', editing && next === NO_CATEGORY ? '' : next);
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${prefix}-type`}>Tipo</Label>
        <Select value={value.type} onValueChange={(type) => change('type', type)}>
          <SelectTrigger id={`${prefix}-type`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Despesa</SelectItem>
            <SelectItem value="INCOME">Receita</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-description`}>Descrição</Label>
        <Input
          id={`${prefix}-description`}
          value={value.description}
          onChange={(event) => change('description', event.target.value)}
          placeholder="Ex: Salário, Almoço..."
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-amount`}>Valor (R$)</Label>
        <Input
          id={`${prefix}-amount`}
          type="number"
          step="0.01"
          value={value.amount}
          onChange={(event) => change('amount', event.target.value)}
          placeholder="0,00"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-date`}>Data</Label>
        <Input
          id={`${prefix}-date`}
          type="date"
          value={value.date}
          onChange={(event) => change('date', event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-category`}>Categoria</Label>
        <Select
          value={selectedCategory}
          onValueChange={changeCategory}
        >
          <SelectTrigger id={`${prefix}-category`}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {editing && <SelectItem value={NO_CATEGORY}>Nenhuma</SelectItem>}
            {categories.filter((category) => category.type === value.type).map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
