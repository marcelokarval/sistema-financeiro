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
import { cn } from '@/lib/utils';
import { CategoryIconColorPicker } from './category-icon-color-picker';
import { createFallbackTranslator, PT_OPERATIONS_MESSAGES } from './operations-i18n';

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
  const t = createFallbackTranslator(useSafeTranslations('categories'), PT_OPERATIONS_MESSAGES.categories);
  const isEditing = mode === 'edit';

  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="motion-reduce:animate-none max-h-[90dvh] gap-4 overflow-y-auto border-border bg-card p-4 shadow-none sm:max-w-lg sm:p-6"
      title={isEditing ? t('editor.editTitle') : t('editor.createTitle')}
      description={isEditing ? t('editor.editDescription') : t('editor.createDescription')}
      footer={
        <>
          <Button variant="outline" className={focusStyle} onClick={onCancel}>
            {t('editor.cancel')}
          </Button>
          <Button className={focusStyle} onClick={onSubmit}>
            {isEditing ? t('editor.update') : t('editor.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">{t('editor.nameLabel')}</Label>
          <Input
            id="category-name"
            className={focusStyle}
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder={t('editor.namePlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-type">{t('editor.typeLabel')}</Label>
          <Select value={form.type} onValueChange={(v) => onFieldChange('type', v)}>
            <SelectTrigger id="category-type" className={cn('w-full', focusStyle)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">{t('types.EXPENSE')}</SelectItem>
              <SelectItem value="INCOME">{t('types.INCOME')}</SelectItem>
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
