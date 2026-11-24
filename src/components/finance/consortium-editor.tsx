'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';

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
  const fieldPrefix = `consortium-${origin}`;
  return (
    <FinanceFormDialogShell
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-h-[85dvh] overflow-y-auto"
      title="Editar Consórcio"
      description="Atualize as informações de assembleia do consórcio"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={`${fieldPrefix}-next-assembly`}>Próxima Data de Assembleia</Label>
          <Input id={`${fieldPrefix}-next-assembly`}
            type="date"
            value={draft.nextAssemblyDate}
            onChange={(e) =>
              onFieldChange('nextAssemblyDate', e.target.value)
            }
          />
        </div>
        <div>
          <Label htmlFor={`${fieldPrefix}-assemblies-attended`}>Assembleias Assistidas</Label>
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
