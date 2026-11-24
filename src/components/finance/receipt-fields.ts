import { currencyFmt } from '@/lib/helpers';

export interface ReceiptData {
  receiptType: 'transaction' | 'purchase';
  receiptNumber: string;
  issuedAt: string;
  data: {
    id: string;
    type?: string;
    rawType?: string;
    description?: string;
    merchant?: string;
    amount?: string;
    totalAmount?: string;
    amountRaw?: number;
    totalAmountRaw?: number;
    date: string;
    category: string;
    categoryColor: string;
    account?: string;
    accountColor?: string;
    card: string | null;
    cardBrand?: string | null;
    installment?: string | null;
    notes: string | null;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      totalPriceRaw: number;
    }>;
    itemsCount?: number;
  };
}

type ReceiptFieldKey = 'merchant' | 'description' | 'type' | 'category' | 'account' | 'card' | 'installment' | 'date';

const labels: Record<ReceiptFieldKey, string> = {
  merchant: 'Estabelecimento',
  description: 'Descrição',
  type: 'Tipo',
  category: 'Categoria',
  account: 'Conta',
  card: 'Cartão',
  installment: 'Parcela',
  date: 'Data',
};

function field(key: ReceiptFieldKey, value: string | undefined) {
  return { key, label: labels[key], value };
}

export function buildReceiptFields(receipt: ReceiptData) {
  const d = receipt.data;
  const isPurchase = receipt.receiptType === 'purchase';
  const rawTotal = isPurchase ? d.totalAmountRaw : d.amountRaw;
  const rows = isPurchase
    ? [field('merchant', d.merchant), field('category', d.category),
        ...(d.card ? [field('card', d.card)] : []),
        ...(d.installment ? [field('installment', d.installment)] : []),
        field('date', d.date)]
    : [field('description', d.description), field('type', d.type), field('category', d.category),
        ...(d.account ? [field('account', d.account)] : []),
        ...(d.card ? [field('card', d.card)] : []),
        field('date', d.date)];

  return {
    receiptType: receipt.receiptType,
    receiptNumber: receipt.receiptNumber,
    issuedDate: new Date(receipt.issuedAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    rows,
    categoryColor: d.categoryColor,
    items: isPurchase && d.items?.length ? {
      count: d.itemsCount,
      entries: d.items.map((item) => ({
        name: item.name,
        units: `${item.quantity}x ${item.unitPrice}`,
        total: { display: currencyFmt(item.totalPriceRaw), text: item.totalPrice },
      })),
    } : null,
    notes: d.notes,
    // A prévia e a impressão validam o número. O TXT conserva o valor formatado pela API.
    total: {
      display: typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? currencyFmt(rawTotal) : 'Valor indisponível',
      text: isPurchase ? d.totalAmount : d.amount,
    },
  };
}

export type ReceiptFields = ReturnType<typeof buildReceiptFields>;
