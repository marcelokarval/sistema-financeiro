'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { useSafeTranslations } from '@/i18n/provider';

export interface ConsortiumDraft {
  nextAssemblyDate: string;
  assembliesAttended: string;
}

interface ConsortiumEditorProps {
  origin: 'list' | 'detail';
  open: boolean;
  draft: ConsortiumDraft;
  saving: boolean;
  onFieldChange: (field: keyof ConsortiumDraft, value: string) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}

export function ConsortiumEditor({ origin, open, draft, saving, onFieldChange, onCancel, onSave, onCloseAutoFocus }: ConsortiumEditorProps) {
  const t = useSafeTranslations('consortiums');
  const fieldPrefix = `consortium-${origin}`;
  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t('editor.closeLabel')}
      contentClassName="max-h-[85dvh] overflow-y-auto"
      title={t('editor.title')}
      description={t('editor.description')}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {t('editor.cancel')}
          </Button>
          <Button onClick={onSave} disabled={saving}>{t('editor.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={`${fieldPrefix}-next-assembly`}>{t('editor.nextAssemblyLabel')}</Label>
          <Input id={`${fieldPrefix}-next-assembly`}
            type="date"
            value={draft.nextAssemblyDate}
            onChange={(e) =>
              onFieldChange('nextAssemblyDate', e.target.value)
            }
          />
        </div>
        <div>
          <Label htmlFor={`${fieldPrefix}-assemblies-attended`}>{t('editor.assembliesAttendedLabel')}</Label>
          <Input id={`${fieldPrefix}-assemblies-attended`}
            type="number"
            value={draft.assembliesAttended}
            onChange={(e) =>
              onFieldChange('assembliesAttended', e.target.value)
            }
          />
        </div>
      </div>
    </FinanceFormDialogShell>
  );
}
