'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSafeTranslations } from '@/i18n/provider';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES } from './operations-i18n';

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
  const t = createFallbackTranslator(useSafeTranslations('accounts'), PT_OPERATIONS_MESSAGES.accounts);
  const editing = mode === 'edit';
  const prefix = editing ? 'edit-tx' : 'tx';
  const selectedCategory = editing ? value.categoryId || NO_CATEGORY : value.categoryId;
  const change = (field: keyof AccountTransactionForm, next: string) => onChange({ ...value, [field]: next });

  const changeCategory = (next: string) => change('categoryId', editing && next === NO_CATEGORY ? '' : next);
  const isTransfer = value.type === 'TRANSFER';
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${prefix}-type`}>{t('transactionFields.typeLabel')}</Label>
        <Select
          value={value.type}
          onValueChange={(type) => {
            if (isTransfer && type !== 'TRANSFER') return;
            change('type', type);
          }}
          disabled={isTransfer}
        >
          <SelectTrigger id={`${prefix}-type`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {isTransfer ? (
              <SelectItem value="TRANSFER">{t('transactionFields.transfer')}</SelectItem>
            ) : (
              <>
                <SelectItem value="EXPENSE">{t('transactionFields.expense')}</SelectItem>
                <SelectItem value="INCOME">{t('transactionFields.income')}</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-description`}>{t('transactionFields.descriptionLabel')}</Label>
        <Input
          id={`${prefix}-description`}
          value={value.description}
          onChange={(event) => change('description', event.target.value)}
          placeholder={t('transactionFields.descriptionPlaceholder')}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-amount`}>{t('transactionFields.amountLabel')}</Label>
        <Input
          id={`${prefix}-amount`}
          type="number"
          step="0.01"
          value={value.amount}
          onChange={(event) => change('amount', event.target.value)}
          placeholder={t('transactionFields.amountPlaceholder')}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-date`}>{t('transactionFields.dateLabel')}</Label>
        <Input
          id={`${prefix}-date`}
          type="date"
          value={value.date}
          onChange={(event) => change('date', event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-category`}>{t('transactionFields.categoryLabel')}</Label>
        <Select
          value={selectedCategory}
          onValueChange={changeCategory}
        >
          <SelectTrigger id={`${prefix}-category`}><SelectValue placeholder={t('transactionFields.categoryPlaceholder')} /></SelectTrigger>
          <SelectContent>
            {editing && <SelectItem value={NO_CATEGORY}>{t('transactionFields.noCategory')}</SelectItem>}
            {categories.filter((category) => category.type === value.type).map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-notes`}>{t('transactionFields.notesLabel')}</Label>
        <Input
          id={`${prefix}-notes`}
          value={value.notes}
          onChange={(event) => change('notes', event.target.value)}
          placeholder={t('transactionFields.notesPlaceholder')}
        />
      </div>
    </div>
  );
}
