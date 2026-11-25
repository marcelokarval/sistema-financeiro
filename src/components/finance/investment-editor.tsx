'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';

export interface InvestmentDraft {
  name: string;
  type: string;
  description: string;
  investedAmount: string;
  yieldRate: string;
  brokerage: string;
  ticker: string;
  accountId: string;
  categoryId: string;
}

interface InvestmentEditorProps {
  mode: 'create' | 'edit-portfolio' | 'edit-detail';
  open: boolean;
  saving: boolean;
  form: InvestmentDraft;
  accounts: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
  onFieldChange: (field: keyof InvestmentDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSave: () => Promise<void>;
}

export function InvestmentEditor({
  mode, open, saving, form, accounts, categories, onFieldChange, onOpenChange, onCloseAutoFocus, onSave,
}: InvestmentEditorProps) {
  const isEditing = mode !== 'create';
  const fromDetail = mode === 'edit-detail';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel="Fechar formulário"
      contentClassName="motion-reduce:animate-none max-h-[calc(100dvh-2rem)] overflow-y-auto"
      title={isEditing ? 'Editar Investimento' : 'Novo Investimento'}
      description={
        isEditing
          ? 'Atualize os dados do investimento'
          : 'Preencha os dados do novo investimento'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="investment-form-name">Nome</Label>
          <Input id="investment-form-name"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder={fromDetail ? 'Ex: PETR4, Tesouro IPCA...' : 'Ex: PETR4, Tesouro IPCA, MXRF11...'}
          />
        </div>
        <div>
          <Label htmlFor="investment-form-type">Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onFieldChange('type', v)}
          >
            <SelectTrigger id="investment-form-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STOCK">Ações</SelectItem>
              <SelectItem value="BOND">Renda Fixa</SelectItem>
              <SelectItem value="FII">FIIs</SelectItem>
              <SelectItem value="CDB">CDB</SelectItem>
              <SelectItem value="LCI">LCI</SelectItem>
              <SelectItem value="LCA">LCA</SelectItem>
              <SelectItem value="TESOURO">Tesouro Direto</SelectItem>
              <SelectItem value="CRYPTO">Cripto</SelectItem>
              <SelectItem value="ETF">ETF</SelectItem>
              <SelectItem value="OTHER">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="investment-form-description">Descrição</Label>
          <Input id="investment-form-description"
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={fromDetail ? 'Descrição opcional' : 'Descrição opcional do investimento'}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-form-investedAmount">Valor Investido (R$)</Label>
            <Input id="investment-form-investedAmount"
              type="number"
              step="0.01"
              value={form.investedAmount}
              onChange={(e) => onFieldChange('investedAmount', e.target.value)}
              placeholder={fromDetail ? undefined : '0,00'}
            />
          </div>
          <div>
            <Label htmlFor="investment-form-yieldRate">Rentabilidade (%)</Label>
            <Input id="investment-form-yieldRate"
              type="number"
              step="0.01"
              value={form.yieldRate}
              onChange={(e) => onFieldChange('yieldRate', e.target.value)}
              placeholder={fromDetail ? undefined : '0,00'}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="investment-form-brokerage">Corretora</Label>
            <Input id="investment-form-brokerage"
              value={form.brokerage}
              onChange={(e) => onFieldChange('brokerage', e.target.value)}
              placeholder={fromDetail ? 'Ex: XP, Rico...' : 'Ex: XP, Rico, Clear...'}
            />
          </div>
          <div>
            <Label htmlFor="investment-form-ticker">Ticker</Label>
            <Input id="investment-form-ticker"
              value={form.ticker}
              onChange={(e) => onFieldChange('ticker', e.target.value)}
              placeholder="Ex: PETR4, MXRF11..."
            />
          </div>
        </div>
        <div>
          <Label htmlFor="investment-form-accountId">Conta</Label>
          <Select
            value={form.accountId}
            onValueChange={(v) => onFieldChange('accountId', v)}
          >
            <SelectTrigger id="investment-form-accountId">
              <SelectValue placeholder={fromDetail ? 'Selecione...' : 'Selecione uma conta...'} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="investment-form-categoryId">Categoria</Label>
          <Select
            value={form.categoryId}
            onValueChange={(v) => onFieldChange('categoryId', v)}
          >
            <SelectTrigger id="investment-form-categoryId">
              <SelectValue placeholder={fromDetail ? 'Selecione...' : 'Selecione uma categoria...'} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
