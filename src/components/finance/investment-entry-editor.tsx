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
import { useSafeTranslations } from '@/i18n/provider';
import { INVESTMENT_TX_TYPE_KEYS } from './portfolio-i18n';

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
  const t = useSafeTranslations('investments');
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('entryEditor.closeLabel')}
      contentClassName="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto"
      title={isEditing ? t('entryEditor.editTitle') : t('entryEditor.createTitle')}
      description={
        isEditing
          ? t('entryEditor.editDescription', { name: investmentName })
          : t('entryEditor.createDescription', { name: investmentName })
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('entryEditor.cancel')}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? t('entryEditor.saving') : isEditing ? t('entryEditor.save') : t('entryEditor.register')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="investment-tx-type">{t('entryEditor.typeLabel')}</Label>
          <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
            <SelectTrigger id="investment-tx-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_TX_TYPE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{t(`transactionTypes.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-tx-amount">{t('entryEditor.amountLabel')}</Label>
            <Input
              id="investment-tx-amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => onFieldChange('amount', e.target.value)}
              placeholder={t('entryEditor.amountPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="investment-tx-date">{t('entryEditor.dateLabel')}</Label>
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
            <Label htmlFor="investment-tx-quantity">{t('entryEditor.quantityLabel')}</Label>
            <Input
              id="investment-tx-quantity"
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => onFieldChange('quantity', e.target.value)}
              placeholder={t('entryEditor.optionalPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="investment-tx-unitPrice">{t('entryEditor.unitPriceLabel')}</Label>
            <Input
              id="investment-tx-unitPrice"
              type="number"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => onFieldChange('unitPrice', e.target.value)}
              placeholder={t('entryEditor.optionalPlaceholder')}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="investment-tx-description">{t('entryEditor.descriptionLabel')}</Label>
          <Input
            id="investment-tx-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={t('entryEditor.descriptionPlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor="investment-tx-notes">{t('entryEditor.notesLabel')}</Label>
          <Input
            id="investment-tx-notes"
            value={form.notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            placeholder={t('entryEditor.notesPlaceholder')}
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
