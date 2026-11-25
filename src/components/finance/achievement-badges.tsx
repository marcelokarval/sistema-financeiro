'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, PiggyBank, Target, TrendingUp, Wallet, CreditCard, Tag, Award, Shield, BarChart3, Zap, Star, Crown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';

const iconMap: Record<string, React.ElementType> = {
  PiggyBank,
  Target,
  TrendingUp,
  Wallet,
  CreditCard,
  Tag,
  Award,
  Shield,
  BarChart3,
  Zap,
  Star,
  Crown,
};

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'poupanca' | 'controle' | 'investimento' | 'exploracao';
  unlocked: boolean;
  progress: number;
  currentValue: number;
  targetValue: number;
  unlockedAt: string | null;
}

type FilterCategory = 'todas' | 'poupanca' | 'controle' | 'investimento' | 'exploracao';

const filterTabs: { key: FilterCategory; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'poupanca', label: 'Poupança' },
  { key: 'controle', label: 'Controle' },
  { key: 'investimento', label: 'Investimento' },
  { key: 'exploracao', label: 'Exploração' },
];

// ─── Helpers ───────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';

export function AchievementRow({ achievement }: { achievement: Achievement }) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const width = Math.min(100, Math.max(achievement.progress, 0));
  const label = filterTabs.find((tab) => tab.key === achievement.category)?.label;
  return (
    <li className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-4">
      <div className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="break-words text-sm font-medium">{achievement.title}</h3>
          <p className="break-words text-xs text-muted-foreground">{achievement.description}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="flex flex-wrap justify-between gap-x-2"><span className="text-muted-foreground">{label}</span><span>{achievement.unlocked ? 'Desbloqueada' : 'Bloqueada'}</span></p>
        {achievement.unlocked ? (
          achievement.unlockedAt && <p className="text-muted-foreground">Desbloqueada em {formatDate(achievement.unlockedAt)}</p>
        ) : (
          <>
            <p className="font-mono tabular-nums">{Math.round(achievement.progress)}%</p>
            <FinanceProgress
              label={`Progresso de ${achievement.title}`}
              value={width}
              min={0}
              max={100}
              unit="%"
              valueText={`${Math.round(achievement.progress)}%`}
              showHeader={false}
            />
          </>
        )}
      </div>
    </li>
  );
}

export function AchievementBadges() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('todas');

  const fetchAchievements = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch('/api/achievements');
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = await res.json();
      setAchievements(json.achievements || []);
    } catch (e) {
      console.error('Erro ao buscar conquistas:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  return (
    <AchievementBadgesContent
      achievements={achievements}
      loading={loading}
      error={error}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      onRetry={fetchAchievements}
    />
  );
}

export function AchievementBadgesContent({
  achievements,
  loading,
  error,
  activeFilter,
  onFilterChange,
  onRetry,
}: {
  achievements: Achievement[];
  loading: boolean;
  error: boolean;
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  onRetry: () => void;
}) {
  // ─── Computed stats ─────────────────────────────────────────
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPct =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // ─── Filtered achievements ──────────────────────────────────
  const filtered =
    activeFilter === 'todas'
      ? achievements
      : achievements.filter((a) => a.category === activeFilter);

  return (
    <section data-qa="quiet-achievements" aria-label="Conquistas" aria-busy={loading || undefined} className={panel}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="font-semibold">Conquistas</h2><p className="text-xs text-muted-foreground">Medalhas e progresso por categoria</p></div>
        {!loading && achievements.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="min-h-9"><RefreshCw aria-hidden="true" /> Atualizar conquistas</Button>
        )}
      </header>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Carregando conquistas…</p> : error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar as conquistas.</p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>Tentar novamente</Button>
        </div>
      ) : !achievements.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma conquista disponível no momento.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">
            <FinanceMetric variant="compact" label="Desbloqueadas" value={`${unlockedCount}/${totalCount}`} valueClassName="text-lg" />
            <div>
              <dt className="text-xs text-muted-foreground">Completude</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{completionPct}%</dd>
              <dd aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${completionPct}%` }} />
              </dd>
            </div>
          </dl>
          <div role="group" aria-label="Filtrar conquistas por categoria" className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.key;
              const count = tab.key === 'todas' ? totalCount : achievements.filter((a) => a.category === tab.key).length;
              return (
                <Button key={tab.key} type="button" variant={isActive ? 'default' : 'outline'} size="sm" aria-pressed={isActive} className="min-h-9" onClick={() => onFilterChange(tab.key)}>
                  {tab.label} <span className="font-mono tabular-nums">{count}</span>
                </Button>
              );
            })}
          </div>
          {filtered.length > 0 ? (
            <ul className="divide-y divide-border">{filtered.map((achievement) => <AchievementRow key={achievement.id} achievement={achievement} />)}</ul>
          ) : <p className="text-sm text-muted-foreground">Nenhuma conquista nesta categoria.</p>}
        </>
      )}
    </section>
  );
}
