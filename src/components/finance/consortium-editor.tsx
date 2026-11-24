'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <Dialog open={open} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Consórcio</DialogTitle>
          <DialogDescription>
            Atualize as informações de assembleia do consórcio
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
