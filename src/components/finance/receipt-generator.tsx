'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Printer,
  Download,
  Copy,
  Check,
  Sparkles,
  Tag,
  CreditCard,
  Wallet,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// --- Types ---
interface ReceiptData {
  receiptType: 'transaction' | 'purchase';
  receiptNumber: string;
  issuedAt: string;
  data: {
    id: string;
    type?: string;
    rawType?: string;
    description?: string;
    merchant?: string;
    amount: string;
    amountRaw: number;
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

// --- Animation variants ---
const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const receiptSlideIn = {
  hidden: { opacity: 0, x: 40, scale: 0.95 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    x: -20,
    scale: 0.97,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const errorShake = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 30 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const typeIcons: Record<string, React.ElementType> = {
  INCOME: ArrowUpRight,
  EXPENSE: ArrowDownRight,
  TRANSFER: ArrowLeftRight,
  Receita: ArrowUpRight,
  Despesa: ArrowDownRight,
  'Transferência': ArrowLeftRight,
};

function getTypeColor(rawType?: string) {
  if (rawType === 'INCOME') return 'text-emerald-500';
  if (rawType === 'EXPENSE') return 'text-rose-500';
  return 'text-violet-500';
}

// --- Receipt Print View ---
function ReceiptContent({ receipt }: { receipt: ReceiptData }) {
  const isPurchase = receipt.receiptType === 'purchase';
  const d = receipt.data;
  const issuedDate = new Date(receipt.issuedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const typeColor = isPurchase ? 'text-violet-500' : getTypeColor(d.rawType);

  return (
    <div className="font-mono text-[13px] leading-relaxed space-y-4">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-foreground">FinanceApp</p>
            <p className="text-[10px] text-muted-foreground">Gestão Financeira Inteligente</p>
          </div>
        </div>
        <div className="pt-2">
          <h3 className="text-xl font-black tracking-widest text-foreground">RECIBO</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 h-5">
              {receipt.receiptNumber}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{issuedDate}</span>
          </div>
        </div>
      </div>

      {/* Dashed divider */}
      <div className="border-t-2 border-dashed border-border/60" />

      {/* Details */}
      <div className="space-y-2.5">
        {isPurchase ? (
          <>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground text-xs">Estabelecimento</span>
              <span className="font-semibold text-right max-w-[60%]">{d.merchant}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Categoria</span>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.categoryColor }}
                />
                <span className="font-medium">{d.category}</span>
              </div>
            </div>
            {d.card && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Cartão</span>
                <span className="font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  {d.card}
                </span>
              </div>
            )}
            {d.installment && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Parcela</span>
                <span className="font-medium">{d.installment}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Data</span>
              <span className="font-medium">{d.date}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground text-xs">Descrição</span>
              <span className="font-semibold text-right max-w-[60%]">{d.description}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Tipo</span>
              <span className={`font-semibold ${typeColor}`}>
                {d.type}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Categoria</span>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.categoryColor }}
                />
                <span className="font-medium">{d.category}</span>
              </div>
            </div>
            {d.account && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Conta</span>
                <span className="font-medium flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  {d.account}
                </span>
              </div>
            )}
            {d.card && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Cartão</span>
                <span className="font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  {d.card}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Data</span>
              <span className="font-medium">{d.date}</span>
            </div>
          </>
        )}
      </div>

      {/* Itemized list for purchases */}
      {isPurchase && d.items && d.items.length > 0 && (
        <>
          <div className="border-t border-dashed border-border/40" />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-semibold tracking-wide uppercase">
              Itens ({d.itemsCount})
            </p>
            {d.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-xs py-0.5">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="truncate block">{item.name}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {item.quantity}x {item.unitPrice}
                  </span>
                </div>
                <span className="font-semibold shrink-0 tabular-nums">{item.totalPrice}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      {d.notes && (
        <>
          <div className="border-t border-dashed border-border/40" />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Observações</p>
            <p className="text-xs italic">{d.notes}</p>
          </div>
        </>
      )}

      {/* Total */}
      <div className="border-t-2 border-dashed border-border/60" />
      <div className="flex justify-between items-center py-1">
        <span className="text-sm font-bold">VALOR TOTAL</span>
        <span className={`text-lg font-black tabular-nums ${typeColor}`}>
          {d.amount}
        </span>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-dashed border-border/60" />
      <div className="text-center space-y-1.5 pt-1">
        <p className="text-xs text-muted-foreground">Obrigado pela preferência!</p>
        <p className="text-[10px] text-muted-foreground/60">
          Documento gerado automaticamente pelo FinanceApp
        </p>
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          {receipt.receiptNumber}
        </p>
      </div>
    </div>
  );
}

// --- Loading skeleton ---
function ReceiptSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 mx-auto" />
        <Skeleton className="h-4 w-40 mx-auto" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="text-center space-y-1">
        <Skeleton className="h-3 w-40 mx-auto" />
        <Skeleton className="h-2.5 w-52 mx-auto" />
      </div>
    </div>
  );
}

// --- Main Component ---
export function ReceiptGenerator() {
  const [receiptType, setReceiptType] = useState<string>('transaction');
  const [receiptId, setReceiptId] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const generateReceipt = useCallback(async () => {
    if (!receiptId.trim()) {
      setError('Informe o ID para gerar o recibo.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReceiptData(null);
    setCopied(false);

    try {
      const res = await fetch(
        `/api/receipt?type=${receiptType}&id=${receiptId.trim()}`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error || 'Erro ao gerar recibo. Tente novamente.'
        );
      }

      const data: ReceiptData = await res.json();
      setReceiptData(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [receiptType, receiptId]);

  const handlePrint = useCallback(() => {
    if (!receiptRef.current) return;
    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <title>Recibo - FinanceApp</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 32px;
              max-width: 400px;
              margin: 0 auto;
              color: #1a1a1a;
              line-height: 1.6;
            }
            @media print {
              body { padding: 16px; }
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, []);

  const buildPlainText = useCallback((): string => {
    if (!receiptData) return '';
    const r = receiptData;
    const d = r.data;
    const issuedDate = new Date(r.issuedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const divider = '─'.repeat(36);
    const dividerDashed = '-'.repeat(36);

    let text = '';
    text += `${divider}\n`;
    text += `          F I N A N C E A P P\n`;
    text += `     Gestão Financeira Inteligente\n`;
    text += `${divider}\n\n`;
    text += `             R E C I B O\n\n`;
    text += `  Nº: ${r.receiptNumber}\n`;
    text += `  Emissão: ${issuedDate}\n\n`;
    text += `${dividerDashed}\n\n`;

    if (r.receiptType === 'purchase') {
      text += `  Estabelecimento: ${d.merchant}\n`;
      text += `  Categoria:       ${d.category}\n`;
      if (d.card) text += `  Cartão:          ${d.card}\n`;
      if (d.installment) text += `  Parcela:         ${d.installment}\n`;
      text += `  Data:            ${d.date}\n`;

      if (d.items && d.items.length > 0) {
        text += `\n${dividerDashed}\n`;
        text += `  ITENS (${d.itemsCount})\n`;
        text += `${dividerDashed}\n`;
        d.items.forEach((item, idx) => {
          text += `  ${idx + 1}. ${item.name}\n`;
          text += `     ${item.quantity}x ${item.unitPrice} = ${item.totalPrice}\n`;
        });
      }
    } else {
      text += `  Descrição:  ${d.description}\n`;
      text += `  Tipo:       ${d.type}\n`;
      text += `  Categoria:  ${d.category}\n`;
      if (d.account) text += `  Conta:      ${d.account}\n`;
      if (d.card) text += `  Cartão:     ${d.card}\n`;
      text += `  Data:       ${d.date}\n`;
    }

    if (d.notes) {
      text += `\n${dividerDashed}\n`;
      text += `  Observações: ${d.notes}\n`;
    }

    text += `\n${divider}\n`;
    text += `  VALOR TOTAL:  ${d.amount}\n`;
    text += `${divider}\n\n`;
    text += `    Obrigado pela preferência!\n\n`;
    text += `  Documento gerado pelo FinanceApp\n`;
    text += `  ${r.receiptNumber}\n`;

    return text;
  }, [receiptData]);

  const handleDownload = useCallback(() => {
    if (!receiptData) return;
    const text = buildPlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-${receiptData.receiptNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Recibo baixado com sucesso!');
  }, [receiptData, buildPlainText]);

  const handleCopy = useCallback(async () => {
    if (!receiptData) return;
    const text = buildPlainText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Recibo copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar recibo.');
    }
  }, [receiptData, buildPlainText]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <Card className="border-0 shadow-md card-glow overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-bold tracking-tight">
                  Gerador de Recibos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gere recibos para transações e compras
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="text-[10px] px-2 py-0 h-5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            >
              <FileText className="w-3 h-3 mr-1" />
              Recibo
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Input section */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger className="w-full h-10 rounded-lg bg-muted/30 border-border/50">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5" />
                      Transação
                    </div>
                  </SelectItem>
                  <SelectItem value="purchase">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Compra
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Input
                type="text"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
                placeholder="ID da transação ou compra..."
                className="h-10 rounded-lg bg-muted/30 border-border/50 text-sm placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generateReceipt();
                }}
              />
            </div>
            <Button
              onClick={generateReceipt}
              disabled={isLoading || !receiptId.trim()}
              className="h-10 px-5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1.5" />
              )}
              Gerar
            </Button>
          </div>

          {/* Error state */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                variants={errorShake}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
              >
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Receipt preview */}
          <AnimatePresence mode="wait">
            {(receiptData || isLoading) && (
              <motion.div
                key="receipt"
                variants={receiptSlideIn}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <div
                  ref={receiptRef}
                  className="relative bg-white dark:bg-zinc-950 border-2 border-dashed border-border/60 rounded-2xl p-5 shadow-inner"
                >
                  {/* Zigzag top */}
                  <div className="absolute -top-[1px] left-0 right-0 flex justify-center">
                    <div className="w-full overflow-hidden flex">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[18px] h-[8px] bg-background -rotate-[45deg] -mr-[8px] -mt-[4px]"
                        />
                      ))}
                    </div>
                  </div>

                  {isLoading ? (
                    <ReceiptSkeleton />
                  ) : receiptData ? (
                    <ReceiptContent receipt={receiptData} />
                  ) : null}

                  {/* Zigzag bottom */}
                  <div className="absolute -bottom-[1px] left-0 right-0 flex justify-center">
                    <div className="w-full overflow-hidden flex">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[18px] h-[8px] bg-background -rotate-[45deg] -mr-[8px] -mt-[4px]"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {!isLoading && receiptData && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="flex flex-wrap gap-2 mt-4"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="h-8 text-xs gap-1.5 rounded-lg border-border/50 hover:bg-muted/50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="h-8 text-xs gap-1.5 rounded-lg border-border/50 hover:bg-muted/50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar .txt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="h-8 text-xs gap-1.5 rounded-lg border-border/50 hover:bg-muted/50"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!receiptData && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-amber-500/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione o tipo e insira o ID para gerar um recibo
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Funciona para transações e compras cadastradas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
