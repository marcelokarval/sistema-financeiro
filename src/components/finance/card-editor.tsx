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
import {
  CARD_BRAND_KEYS,
  CARD_COLORS,
  CARD_TYPE_KEYS,
  createFallbackTranslator,
  PT_OPERATIONS_MESSAGES,
} from './operations-i18n';

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
  const t = createFallbackTranslator(useSafeTranslations('cards'), PT_OPERATIONS_MESSAGES.cards);
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      title={isEditing ? t('editor.editTitle') : t('editor.createTitle')}
      description={isEditing ? t('editor.editDescription') : t('editor.createDescription')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('editor.cancel')}
          </Button>
          <Button aria-disabled={pending} onClick={onSubmit}>
            {isEditing ? t('editor.update') : t('editor.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="card-name">{t('editor.nameLabel')}</Label>
          <Input
            id="card-name"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder={t('editor.namePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="card-type">{t('editor.typeLabel')}</Label>
            <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
              <SelectTrigger id="card-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>{t(`types.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="card-brand">{t('editor.brandLabel')}</Label>
            <Select value={form.brand} onValueChange={(v) => onFieldChange('brand', v)}>
              <SelectTrigger id="card-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_BRAND_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>{t(`brands.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="card-digits">{t('editor.digitsLabel')}</Label>
            <Input
              id="card-digits"
              value={form.lastFourDigits}
              onChange={(e) => onFieldChange('lastFourDigits', e.target.value.slice(0, 4))}
              placeholder={t('editor.digitsPlaceholder')}
              maxLength={4}
            />
          </div>
          <div>
            <Label htmlFor="card-flag">{t('editor.flagLabel')}</Label>
            <Input
              id="card-flag"
              value={form.flag}
              onChange={(e) => onFieldChange('flag', e.target.value)}
              placeholder={t('editor.flagPlaceholder')}
            />
          </div>
        </div>
        {form.type === 'CREDIT' && (
          <>
            <div>
              <Label htmlFor="card-limit">{t('editor.limitLabel')}</Label>
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
                <Label htmlFor="card-close-day">{t('editor.closingDayLabel')}</Label>
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
                <Label htmlFor="card-due-day">{t('editor.dueDayLabel')}</Label>
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
            {t('editor.colorLabel')}
          </p>
          <div role="group" aria-labelledby="card-color" className="mt-2 flex flex-wrap gap-2">
            {CARD_COLORS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                aria-label={t(`editor.colors.${key}`)}
                aria-pressed={form.color === value}
                className="size-8 rounded-full border border-border aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-foreground focus-visible:outline-ring"
                style={{ backgroundColor: value }}
                onClick={() => onFieldChange('color', value)}
              />
            ))}
          </div>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
