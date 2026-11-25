const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const receiptDateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function civilPurchaseDate(value: string | Date, date = new Date(value)): string | undefined {
  if (typeof value === 'string' && dateOnly.test(value)) return value;

  // Prisma serializa a data do campo HTML como meia-noite UTC, sem hora de compra.
  if (date.getTime() % 86_400_000 === 0) return date.toISOString().slice(0, 10);
}

export function purchaseDateForInput(value?: string | Date, now = new Date()): string {
  const date = value ? new Date(value) : now;
  if (Number.isNaN(date.getTime())) return '';
  const civil = value && civilPurchaseDate(value, date);
  if (civil) return civil;

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function purchaseDateForSave(input: string, original?: string): string {
  return original && input === purchaseDateForInput(original) ? original : input;
}

export function formatPurchaseDate(value: string | Date, style: 'date' | 'receipt' = 'date'): string {
  const date = new Date(value);
  const civil = civilPurchaseDate(value, date);
  if (civil) {
    const [year, month, day] = civil.split('-');
    return `${day}/${month}/${year}`;
  }

  return style === 'receipt' ? receiptDateTime.format(date) : date.toLocaleDateString('pt-BR');
}
