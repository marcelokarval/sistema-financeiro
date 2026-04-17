'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
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
  Lock,
  Check,
  Flame,
  RefreshCw,
  Medal,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

// ─── Icon Map ──────────────────────────────────────────────────
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

// ─── Category Config ───────────────────────────────────────────
const categoryConfig: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  poupanca: {
    label: 'Poupança',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/20',
  },
  controle: {
    label: 'Controle',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-500/20',
  },
  investimento: {
    label: 'Investimento',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-500/20',
  },
  exploracao: {
    label: 'Exploração',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500',
    borderColor: 'border-violet-500/20',
  },
};

// ─── Types ─────────────────────────────────────────────────────
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

// ─── Animation Variants ────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

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

// ─── Main Component ────────────────────────────────────────────
export function AchievementBadges() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('todas');

  const fetchAchievements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/achievements');
      if (res.ok) {
        const json = await res.json();
        setAchievements(json.achievements || []);
      }
    } catch (e) {
      console.error('Erro ao buscar conquistas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

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

  // ─── Loading Skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats row skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          {/* Filter tabs skeleton */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {/* Badge grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────
  if (!achievements.length) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <Medal className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sistema de conquistas ainda não disponível.
          </p>
          <Button variant="outline" size="sm" onClick={fetchAchievements}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Conquistas
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gamificação — gerencie bem e desbloqueie medalhas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-xs px-3 py-1 border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {unlockedCount}/{totalCount} desbloqueadas
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchAchievements}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ═══════════════════════════════════════════════════════
              STATS ROW
          ═══════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Desbloqueadas */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Desbloqueadas
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {unlockedCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{totalCount}
                  </span>
                </p>
              </div>

              {/* Completude */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Medal className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Completude
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {completionPct}
                  <span className="text-sm font-normal text-muted-foreground">
                    %
                  </span>
                </p>
                <div className="mt-2">
                  <Progress value={completionPct} className="h-1.5" />
                </div>
              </div>

              {/* Sequência */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-rose-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Sequência Ativa
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {unlockedCount > 0 ? unlockedCount : 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    medalha(s)
                  </span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════
              CATEGORY FILTER TABS
          ═══════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterTabs.map((tab) => {
                const isActive = activeFilter === tab.key;
                const catCfg =
                  tab.key !== 'todas' ? categoryConfig[tab.key] : null;
                const count =
                  tab.key === 'todas'
                    ? totalCount
                    : achievements.filter((a) => a.category === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                      transition-all duration-200 border
                      ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground'
                      }
                    `}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0 rounded-full ${
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════
              BADGE GRID
          ═══════════════════════════════════════════════════════ */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key={activeFilter}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((achievement) => {
                const IconComp = iconMap[achievement.icon] || Trophy;
                const catCfg = categoryConfig[achievement.category];

                return (
                  <motion.div
                    key={achievement.id}
                    variants={itemVariants}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{
                      scale: 1.03,
                      boxShadow: '0 8px 25px -5px rgba(0,0,0,0.12)',
                    }}
                    className="relative rounded-xl border border-border/60 bg-card p-4 shadow-sm overflow-hidden transition-shadow duration-200"
                  >
                    {achievement.unlocked && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 60%)',
                        }}
                      />
                    )}

                    {/* Top row: icon + status */}
                    <div className="flex items-start justify-between relative">
                      <div
                        className={`
                          w-11 h-11 rounded-xl flex items-center justify-center
                          transition-all duration-300
                          ${
                            achievement.unlocked
                              ? `bg-gradient-to-br ${catCfg.bgColor} shadow-lg`
                              : 'bg-muted'
                          }
                        `}
                        style={
                          achievement.unlocked
                            ? {
                                boxShadow: `0 4px 15px -3px ${catCfg.bgColor.replace('bg-', 'rgba(')}40)`,
                              }
                            : undefined
                        }
                      >
                        {achievement.unlocked ? (
                          <IconComp className="w-5 h-5 text-white" />
                        ) : (
                          <div className="relative">
                            <IconComp className="w-5 h-5 text-muted-foreground/50" />
                            <Lock className="w-3 h-3 text-muted-foreground/60 absolute -bottom-1 -right-1 bg-background rounded-full p-0.5" />
                          </div>
                        )}
                      </div>

                      {/* Checkmark or category badge */}
                      <div className="flex items-center gap-1.5">
                        {achievement.unlocked ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 border ${catCfg.borderColor} ${catCfg.color}`}
                          >
                            {catCfg.label}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Title + Description */}
                    <div className="mt-3 space-y-1">
                      <h3
                        className={`text-sm font-semibold leading-tight ${
                          achievement.unlocked
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {achievement.title}
                      </h3>
                      <p
                        className={`text-[11px] leading-relaxed ${
                          achievement.unlocked
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/60 blur-[0.5px]'
                        }`}
                      >
                        {achievement.description}
                      </p>
                    </div>

                    {/* Progress / Unlocked info */}
                    <div className="mt-3">
                      {achievement.unlocked ? (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Desbloqueada em {formatDate(achievement.unlockedAt)}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              Progresso
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {Math.round(achievement.progress)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(100, achievement.progress)}%`,
                              }}
                              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════
              MOTIVATIONAL FOOTER
          ═══════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-center gap-2 py-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] text-muted-foreground">
                {completionPct === 100
                  ? 'Parabéns! Você desbloqueou todas as conquistas! 🎉'
                  : completionPct >= 50
                    ? 'Você está indo muito bem! Continue assim! 💪'
                    : 'Comece a registrar suas finanças para desbloquear conquistas! 🚀'}
              </span>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
