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
import { cn } from '@/lib/utils';
import { CategoryIconColorPicker } from './category-icon-color-picker';

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export interface CategoryFormDraft {
  name: string;
  icon: string;
  type: string;
  color: string;
}

export interface CategoryEditorProps {
  mode: 'create' | 'edit';
  open: boolean;
  form: CategoryFormDraft;
  onFieldChange: (field: keyof CategoryFormDraft, value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}

/** Modal form dialog for creating or editing a category with icon and color selection. */
export function CategoryEditor({
  mode,
  open,
  form,
  onFieldChange,
  onOpenChange,
  onCloseAutoFocus,
  onCancel,
  onSubmit,
}: CategoryEditorProps) {
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel="Fechar formulário"
      contentClassName="motion-reduce:animate-none max-h-[90dvh] gap-4 overflow-y-auto border-border bg-card p-4 shadow-none sm:max-w-lg sm:p-6"
      title={isEditing ? 'Editar categoria' : 'Nova categoria'}
      description={isEditing ? 'Atualize os dados da categoria' : 'Crie uma nova categoria'}
      footer={
        <>
          <Button variant="outline" className={focusStyle} onClick={onCancel}>
            Cancelar
          </Button>
          <Button className={focusStyle} onClick={onSubmit}>
            {isEditing ? 'Atualizar' : 'Criar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Nome</Label>
          <Input
            id="category-name"
            className={focusStyle}
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder="Ex: Alimentação, Transporte..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-type">Tipo</Label>
          <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
            <SelectTrigger id="category-type" className={cn('w-full', focusStyle)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CategoryIconColorPicker
          name={form.name}
          type={form.type}
          icon={form.icon}
          color={form.color}
          onIconChange={(value) => onFieldChange('icon', value)}
          onColorChange={(value) => onFieldChange('color', value)}
        />
      </div>
    </FinanceFormDialogShell>
  );
}
