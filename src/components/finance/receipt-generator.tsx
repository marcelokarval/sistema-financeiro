'use client';

import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { FileText, Printer, Download, Copy, Check, AlertCircle } from 'lucide-react';
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
import { toast } from 'sonner';
import { currencyFmt } from '@/lib/helpers';

import { buildReceiptFields, type ReceiptData } from './receipt-fields';
import { ReceiptPreview } from './receipt-preview';

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] motion-reduce:transition-none';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReceiptPrintHtml(receipt: ReceiptData): string {
  const { rows, items, notes, receiptNumber, issuedDate, total } = buildReceiptFields(receipt);
  const rowsHtml = rows
    .map(({ label, value }) => `<div class="receipt-row"><span class="receipt-label">${escapeHtml(label)}</span><span class="receipt-value">${escapeHtml(value ?? '—')}</span></div>`)
    .join('');

  const itemsHtml = items
    ? `<div class="receipt-divider"></div>
       <p class="receipt-section-title">Itens (${items.count ?? items.entries.length})</p>
       ${items.entries
         .map(
           (item) => `<div class="receipt-row">
             <span class="receipt-label">${escapeHtml(item.name)} (${escapeHtml(item.units)})</span>
             <span class="receipt-value">${escapeHtml(item.total.display)}</span>
           </div>`,
         )
         .join('')}`
    : '';

  const notesHtml = notes
    ? `<div class="receipt-divider"></div>
       <p class="receipt-label">Observações</p>
       <p class="receipt-notes">${escapeHtml(notes)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Recibo - FinanceApp</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 32px;
        max-width: 420px;
        margin: 0 auto;
        color: #111111;
        background: #ffffff;
        line-height: 1.5;
        font-size: 13px;
      }
      .receipt-header { text-align: center; margin-bottom: 16px; }
      .receipt-brand { font-size: 16px; font-weight: 700; }
      .receipt-subtitle, .receipt-meta { font-size: 12px; color: #555555; }
      .receipt-title { font-size: 15px; font-weight: 700; margin-top: 10px; letter-spacing: 0.06em; }
      .receipt-divider { border-top: 1px solid #d4d4d8; margin: 12px 0; }
      .receipt-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #555555; margin-bottom: 6px; }
      .receipt-row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
      .receipt-label { color: #555555; }
      .receipt-value { font-weight: 600; text-align: right; }
      .receipt-notes { font-size: 12px; font-style: italic; margin-top: 4px; }
      .receipt-total { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; font-weight: 700; padding: 4px 0; }
      .receipt-footer { text-align: center; font-size: 12px; color: #555555; margin-top: 8px; }
      @media print {
        body { padding: 16px; }
      }
    </style>
  </head>
  <body>
    <div class="receipt-header">
      <p class="receipt-brand">FinanceApp</p>
      <p class="receipt-subtitle">Gestão Financeira Inteligente</p>
      <p class="receipt-title">RECIBO</p>
      <p class="receipt-meta">${escapeHtml(receiptNumber)} · ${escapeHtml(issuedDate)}</p>
    </div>
    <div class="receipt-divider"></div>
    ${rowsHtml}
    ${itemsHtml}
    ${notesHtml}
    <div class="receipt-divider"></div>
    <div class="receipt-total">
      <span>VALOR TOTAL</span>
      <span>${escapeHtml(total.display)}</span>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <p>Obrigado pela preferência!</p>
      <p>Documento gerado automaticamente pelo FinanceApp</p>
      <p>${escapeHtml(receiptNumber)}</p>
    </div>
  </body>
</html>`;
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
    if (!receiptData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão.');
      return;
    }
    printWindow.document.write(buildReceiptPrintHtml(receiptData));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, [receiptData]);

  const buildPlainText = useCallback((): string => {
    if (!receiptData) return '';
    const { receiptNumber, issuedDate, rows, receiptType, items, notes, total } = buildReceiptFields(receiptData);

    const divider = '─'.repeat(36);
    const dividerDashed = '-'.repeat(36);

    let text = '';
    text += `${divider}\n`;
    text += `          F I N A N C E A P P\n`;
    text += `     Gestão Financeira Inteligente\n`;
    text += `${divider}\n\n`;
    text += `             R E C I B O\n\n`;
    text += `  Nº: ${receiptNumber}\n`;
    text += `  Emissão: ${issuedDate}\n\n`;
    text += `${dividerDashed}\n\n`;

    // Larguras das duas colunas do TXT legado, incluindo os dois-pontos.
    const labelWidth = receiptType === 'purchase' ? 17 : 12;
    for (const { label, value } of rows) {
      text += `  ${(label + ':').padEnd(labelWidth)}${value}\n`;
    }

    if (items) {
      text += `\n${dividerDashed}\n`;
      text += `  ITENS (${items.count})\n`;
      text += `${dividerDashed}\n`;
      items.entries.forEach((item, idx) => {
        text += `  ${idx + 1}. ${item.name}\n`;
        text += `     ${item.units} = ${item.total.text}\n`;
      });
    }

    if (notes) {
      text += `\n${dividerDashed}\n`;
      text += `  Observações: ${notes}\n`;
    }

    text += `\n${divider}\n`;
    text += `  VALOR TOTAL:  ${total.text}\n`;
    text += `${divider}\n\n`;
    text += `    Obrigado pela preferência!\n\n`;
    text += `  Documento gerado pelo FinanceApp\n`;
    text += `  ${receiptNumber}\n`;

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
    <ReceiptWorkspace
      receiptType={receiptType}
      setReceiptType={setReceiptType}
      receiptId={receiptId}
      setReceiptId={setReceiptId}
      receiptData={receiptData}
      isLoading={isLoading}
      error={error}
      copied={copied}
      receiptRef={receiptRef}
      generateReceipt={generateReceipt}
      handlePrint={handlePrint}
      handleDownload={handleDownload}
      handleCopy={handleCopy}
    />
  );
}

interface ReceiptRecordOption {
  id: string;
  label: string;
}

interface ReceiptWorkspaceProps {
  receiptType: string;
  setReceiptType: (type: string) => void;
  receiptId: string;
  setReceiptId: (id: string) => void;
  receiptData: ReceiptData | null;
  isLoading: boolean;
  error: string | null;
  copied: boolean;
  records?: ReceiptRecordOption[];
  receiptRef?: React.Ref<HTMLDivElement>;
  generateReceipt: () => void;
  handlePrint: () => void;
  handleDownload: () => void;
  handleCopy: () => void;
}

export function ReceiptWorkspace({
  receiptType, setReceiptType, receiptId, setReceiptId, receiptData, isLoading, error, copied,
  records, receiptRef, generateReceipt, handlePrint, handleDownload, handleCopy,
}: ReceiptWorkspaceProps) {
  const id = useId();
  const [fetchedRecords, setFetchedRecords] = useState<ReceiptRecordOption[]>([]);
  useEffect(() => {
    if (records !== undefined) return;
    let active = true;
    const endpoint = receiptType === 'purchase' ? '/api/purchases' : '/api/transactions';
    void fetch(endpoint)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<Record<string, unknown>>) => {
        if (!active || !Array.isArray(rows)) return;
        const mapped = rows.slice(0, 20).flatMap((row) => {
          const itemId = typeof row.id === 'string' ? row.id : '';
          if (!itemId) return [];
          const labelBase = receiptType === 'purchase'
            ? (typeof row.merchant === 'string' ? row.merchant : itemId)
            : (typeof row.description === 'string' ? row.description : itemId);
          const rawAmount = receiptType === 'purchase' ? row.totalAmount : row.amount;
          const amountLabel = typeof rawAmount === 'number' ? ` · ${currencyFmt(rawAmount)}` : '';
          return [{ id: itemId, label: `${labelBase}${amountLabel}` }];
        });
        setFetchedRecords(mapped);
      })
      .catch(() => {
        if (active) setFetchedRecords([]);
      });
    return () => { active = false; };
  }, [receiptType, records]);

  const availableRecords = records ?? fetchedRecords;
  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-4" data-testid="quiet-receipts">
      <header>
        <h3 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">Gerador de recibos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Gere comprovantes de transações e compras cadastradas.</p>
      </header>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby={`${id}-source`} className="min-w-0 rounded-lg border border-border bg-card p-4">
          <h4 id={`${id}-source`} className="text-sm font-semibold">Origem do recibo</h4>
          <div className="mt-4 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-receipt-type`}>Tipo de registro</Label>
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger id={`${id}-receipt-type`} className={`w-full ${focusClass}`}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction">Transação</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-receipt-picker`}>Selecionar registro recente</Label>
              <Select
                value={availableRecords.some((r) => r.id === receiptId) ? receiptId : ''}
                onValueChange={setReceiptId}
              >
                <SelectTrigger id={`${id}-receipt-picker`} className={`w-full ${focusClass}`}>
                  <SelectValue placeholder="Escolha um registro recente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {availableRecords.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Nenhum registro encontrado</SelectItem>
                  ) : (
                    availableRecords.map((rec) => (
                      <SelectItem key={rec.id} value={rec.id}>{rec.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-receipt-id`}>ID do registro</Label>
              <Input
                id={`${id}-receipt-id`}
                type="text"
                value={receiptId}
                onChange={(event) => setReceiptId(event.target.value)}
                placeholder="ID da transação ou compra"
                className={focusClass}
                onKeyDown={(event) => { if (event.key === 'Enter') generateReceipt(); }}
              />
            </div>
            <Button onClick={generateReceipt} disabled={isLoading || !receiptId.trim()} className={`justify-self-start ${focusClass}`}>
              <FileText aria-hidden="true" /> Gerar recibo
            </Button>
          </div>
        </section>

        <section aria-labelledby={`${id}-preview`} className="min-w-0 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h4 id={`${id}-preview`} className="text-sm font-semibold">Prévia do recibo</h4>
          </header>
          <div className="min-w-0 space-y-4 p-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-border p-3 text-sm [overflow-wrap:anywhere]">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>{error}</p>
              </div>
            )}
            {isLoading ? (
              <p role="status" className="py-4 text-sm text-muted-foreground">Gerando recibo…</p>
            ) : receiptData ? (
              <>
                <div ref={receiptRef} className="min-w-0 rounded-lg border border-border bg-background p-3 sm:p-4">
                  <ReceiptPreview fields={buildReceiptFields(receiptData)} />
                </div>
                <div role="group" aria-label="Ações do recibo" className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint} className={focusClass}>
                    <Printer aria-hidden="true" /> Imprimir
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className={focusClass}>
                    <Download aria-hidden="true" /> Baixar .txt
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy} className={focusClass}>
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </>
            ) : !error && (
              <p className="py-4 text-sm text-muted-foreground">Selecione o tipo e informe o ID do registro para ver o recibo aqui.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
