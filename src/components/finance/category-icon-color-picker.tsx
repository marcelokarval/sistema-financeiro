'use client';

import {
  Tag,
  Banknote,
  Laptop,
  TrendingUp,
  Utensils,
  Car,
  HeartPulse,
  GraduationCap,
  Gamepad2,
  ShoppingBag,
  Receipt,
  House,
  Ellipsis,
  Gift,
  Plane,
  Baby,
  Dog,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const categoryColors = [
  { value: '#22c55e', label: 'Verde' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#f59e0b', label: 'Âmbar' },
  { value: '#64748b', label: 'Cinza ardósia' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#84cc16', label: 'Verde-lima' },
  { value: '#a855f7', label: 'Roxo' },
  { value: '#94a3b8', label: 'Cinza claro' },
];

export const iconOptions = [
  { value: 'banknote', label: 'Dinheiro', Icon: Banknote },
  { value: 'laptop', label: 'Laptop', Icon: Laptop },
  { value: 'trending-up', label: 'Investimento', Icon: TrendingUp },
  { value: 'utensils', label: 'Alimentação', Icon: Utensils },
  { value: 'car', label: 'Transporte', Icon: Car },
  { value: 'heart-pulse', label: 'Saúde', Icon: HeartPulse },
  { value: 'graduation-cap', label: 'Educação', Icon: GraduationCap },
  { value: 'gamepad-2', label: 'Entretenimento', Icon: Gamepad2 },
  { value: 'shopping-bag', label: 'Compras', Icon: ShoppingBag },
  { value: 'receipt', label: 'Contas', Icon: Receipt },
  { value: 'home', label: 'Moradia', Icon: House },
  { value: 'more-horizontal', label: 'Outros', Icon: Ellipsis },
  { value: 'tag', label: 'Tag', Icon: Tag },
  { value: 'gift', label: 'Presente', Icon: Gift },
  { value: 'plane', label: 'Viagem', Icon: Plane },
  { value: 'baby', label: 'Filhos', Icon: Baby },
  { value: 'dog', label: 'Pet', Icon: Dog },
];

export interface CategoryIconColorPickerProps {
  name: string;
  type: string;
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

/** Accessible icon and color fieldset picker with live category preview. */
export function CategoryIconColorPicker({
  name,
  type,
  icon,
  color,
  onIconChange,
  onColorChange,
}: CategoryIconColorPickerProps) {
  const PreviewIcon = iconOptions.find((option) => option.value === icon)?.Icon ?? Tag;
  const colorLabel = categoryColors.find((option) => option.value === color)?.label;

  return (
    <>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Ícone</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {iconOptions.map((opt) => {
            const selected = icon === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onIconChange(opt.value)}
                className={cn(
                  'flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs',
                  focusStyle,
                  selected
                    ? 'border-primary bg-muted font-semibold text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                <opt.Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-1">
          {categoryColors.map((c) => {
            const selected = color === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-label={c.label}
                aria-pressed={selected}
                title={c.label}
                onClick={() => onColorChange(c.value)}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-md border',
                  focusStyle,
                  selected ? 'border-primary bg-muted' : 'border-border hover:bg-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className="relative grid size-5 place-items-center rounded-full"
                  style={{ backgroundColor: c.value }}
                >
                  {selected && <Check className="size-3.5 rounded-full bg-card text-foreground" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium">Pré-visualização</p>
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground"
          >
            <PreviewIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">{name || 'Nome da categoria'}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
              {type === 'INCOME' ? 'Receita' : 'Despesa'}
              {colorLabel}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
