'use client';

import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-4 py-12 text-center text-muted-foreground">
      <div className="mb-3 flex size-12 items-center justify-center rounded-lg border border-border bg-muted">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
  labels: Record<string, { text: string; className: string }>;
}

export function StatusBadge({ status, labels }: StatusBadgeProps) {
  const info = labels[status] || { text: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', info.className)}>
      {info.text}
    </span>
  );
}
