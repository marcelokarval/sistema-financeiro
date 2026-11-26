'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES, type NamespaceTranslate } from './operations-i18n';

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const amountStyle = 'font-mono tabular-nums [overflow-wrap:anywhere]';

export interface PurchaseItemDraft {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseItemsEditorProps {
  items: readonly PurchaseItemDraft[];
  onItemChange: (index: number, field: keyof PurchaseItemDraft, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

function PurchaseItemRow({
  idx,
  item,
  canRemove,
  locale,
  t,
  onItemChange,
  onRemove,
}: {
  idx: number;
  item: PurchaseItemDraft;
  canRemove: boolean;
  locale: string;
  t: NamespaceTranslate;
  onItemChange: (index: number, field: keyof PurchaseItemDraft, value: string | number) => void;
  onRemove: () => void;
}) {
  return (
    <div role="group" aria-label={t('itemsEditor.itemGroupAria', { index: idx + 1 })} className="grid min-w-0 grid-cols-2 gap-2 border-b border-border pb-3">
      <div className="col-span-2 min-w-0 space-y-1">
        <Label htmlFor={`purchase-item-name-${idx}`}>{t('itemsEditor.itemNameLabel')}</Label>
        <Input
          className={focusStyle}
          id={`purchase-item-name-${idx}`}
          value={item.name}
          onChange={(e) => onItemChange(idx, 'name', e.target.value)}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`purchase-item-quantity-${idx}`}>{t('itemsEditor.quantityLabel')}</Label>
        <Input
          className={focusStyle}
          id={`purchase-item-quantity-${idx}`}
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`purchase-item-price-${idx}`}>{t('itemsEditor.unitPriceLabel')}</Label>
        <Input
          className={focusStyle}
          id={`purchase-item-price-${idx}`}
          type="number"
          step="0.01"
          value={item.unitPrice || ''}
          onChange={(e) => onItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2">
        <p className={cn('min-w-0 text-xs', amountStyle)}>{t('itemsEditor.subtotalPrefix', { amount: currencyFmt(item.totalPrice, locale) })}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('itemsEditor.removeItemAria', { index: idx + 1 })}
          className={cn('size-11 shrink-0 text-destructive hover:text-destructive', focusStyle)}
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Fieldset editor for line items inside a purchase form. */
export function PurchaseItemsEditor({
  items,
  onItemChange,
  onAddItem,
  onRemoveItem,
}: PurchaseItemsEditorProps) {
  const locale = useSafeLocale();
  const t = createFallbackTranslator(useSafeTranslations('purchases'), PT_OPERATIONS_MESSAGES.purchases);

  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <legend className="px-1 text-sm font-medium">{t('itemsEditor.legend')}</legend>
      {items.map((item, idx) => (
        <PurchaseItemRow
          key={idx}
          idx={idx}
          item={item}
          canRemove={items.length > 1}
          locale={locale}
          t={t}
          onItemChange={onItemChange}
          onRemove={() => onRemoveItem(idx)}
        />
      ))}
      <Button type="button" variant="outline" className={cn('min-h-11', focusStyle)} onClick={onAddItem}>
        <Plus aria-hidden="true" /> {t('itemsEditor.addItem')}
      </Button>
    </fieldset>
  );
}
