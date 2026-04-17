'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { itemVariants } from '@/lib/helpers';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  gradient: string;
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, gradient, subtitle, className }: StatCardProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
        <div className={cn('h-1 bg-gradient-to-r', gradient)} />
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
              <p className="text-2xl font-bold mt-2 tracking-tight tabular-nums">{value}</p>
            </div>
            <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg', gradient)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-3">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return <Skeleton className="h-36 rounded-2xl" />;
}

interface MiniStatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  colorClass: string;
}

export function MiniStatCard({ label, value, icon: Icon, colorClass }: MiniStatCardProps) {
  return (
    <Card className={cn('bg-gradient-to-br border card-elevated hover-lift focus-gradient', colorClass)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-sm font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, max, className, color, showLabel }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn('space-y-1', className)}>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn('h-full rounded-full', color || 'bg-primary')}
        />
      </div>
      {showLabel && <p className="text-xs text-muted-foreground">{percent}%</p>}
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
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', info.className)}>
      {info.text}
    </span>
  );
}
