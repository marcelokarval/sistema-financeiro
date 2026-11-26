'use client';

import { CreditCard, FileText, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSafeTranslations } from '@/i18n/provider';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES } from './operations-i18n';
import type { ReceiptFields } from './receipt-fields';

function ReceiptFieldValue({ field, categoryColor }: {
  field: ReceiptFields['rows'][number];
  categoryColor: string;
}) {
  const { key, value } = field;
  switch (key) {
    case 'merchant':
    case 'description':
      return <span className="font-semibold text-right max-w-[60%]">{value}</span>;
    case 'type':
      return <span className="text-right font-semibold">{value}</span>;
    case 'category':
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }} />
          <span className="min-w-0 text-right font-medium">{value}</span>
        </div>
      );
    case 'account':
    case 'card': {
      const Icon = key === 'account' ? Wallet : CreditCard;
      return <span className="flex min-w-0 items-center gap-1 text-right font-medium"><Icon className="w-3 h-3" />{value}</span>;
    }
    default:
      return <span className="min-w-0 text-right font-medium">{value}</span>;
  }
}

export function ReceiptPreview({ fields, showValues = true }: { fields: ReceiptFields; showValues?: boolean }) {
  const t = createFallbackTranslator(useSafeTranslations('receipts'), PT_OPERATIONS_MESSAGES.receipts);
  const tShared = useSafeTranslations('shared');
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const { rows, categoryColor, items, notes, receiptNumber, issuedDate, total } = fields;
  const maskUnits = (units: string) => {
    const qtyMatch = /^(\d+x)\s+/.exec(units);
    return qtyMatch ? `${qtyMatch[1]} ${maskedValue}` : maskedValue;
  };

  return (
    <div className="space-y-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground">
            <FileText aria-hidden="true" className="size-4" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-foreground">{t('document.brandName')}</p>
            <p className="text-xs text-muted-foreground">{t('document.brandSubtitle')}</p>
          </div>
        </div>
        <div className="pt-2">
          <h3 className="text-lg font-semibold tracking-wide text-foreground">{t('document.receiptHeading')}</h3>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs font-mono px-2 py-0 h-5">
              {receiptNumber}
            </Badge>
            <span className="text-xs text-muted-foreground">{issuedDate}</span>
          </div>
        </div>
      </div>

      {/* Dashed divider */}
      <div className="border-t border-border" />

      {/* Details */}
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground text-xs">{row.label}</span>
            <ReceiptFieldValue field={row} categoryColor={categoryColor} />
          </div>
        ))}
      </div>

      {/* Itemized list for purchases */}
      {items && (
        <>
          <div className="border-t border-border" />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-semibold tracking-wide uppercase">
              {t('document.itemsHeading', { count: items.count ?? items.entries.length })}
            </p>
            {items.entries.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 text-xs py-0.5">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block">{item.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {showValues ? item.units : maskUnits(item.units)}
                  </span>
                </div>
                <span className="min-w-0 text-right font-mono font-semibold tabular-nums">
                  {showValues ? item.total.display : maskedValue}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      {notes && (
        <>
          <div className="border-t border-border" />
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('document.notes')}</p>
            <p className="text-xs italic">{notes}</p>
          </div>
        </>
      )}

      {/* Total */}
      <div className="border-t border-border" />
      <div className="flex items-start justify-between gap-3 py-1">
        <span className="text-sm font-semibold">{t('document.totalUpper')}</span>
        <span className="min-w-0 text-right font-mono text-lg font-semibold tabular-nums">
          {showValues ? total.display : maskedValue}
        </span>
      </div>

      {/* Footer */}
      <div className="border-t border-border" />
      <div className="text-center space-y-1.5 pt-1">
        <p className="text-xs text-muted-foreground">{t('document.thankYou')}</p>
        <p className="text-xs text-muted-foreground">
          {t('document.autoGeneratedPrint')}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {receiptNumber}
        </p>
      </div>
    </div>
  );
}
