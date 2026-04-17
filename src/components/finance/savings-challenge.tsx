'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  Wallet,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Clock,
  CheckCircle2,
  Star,
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

// --- Helpers ---
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// --- Types ---
interface ChallengeTarget {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progress: number;
  unit: 'currency' | 'percent';
}

interface SavingsData {
  currentMonthSavings: number;
  dailyAverageExpense: number;
  projectedMonthExpense: number;
  projectedSavings: number;
  savingsRate: number;
  daysRemaining: number;
  daysInMonth: number;
  daysElapsed: number;
  income: number;
  totalExpenses: number;
  todaySpending: number;
  dailyTarget: number;
  challengeTargets: ChallengeTarget[];
}

// --- Colors ---
function getSavingsColor(rate: number): { color: string; bgClass: string; textClass: string; label: string } {
  if (rate >= 30) return { color: '#22c55e', bgClass: 'bg-emerald-500', textClass: 'text-emerald-500', label: 'Excelente' };
  if (rate >= 20) return { color: '#14b8a6', bgClass: 'bg-teal-500', textClass: 'text-teal-500', label: 'Bom' };
  if (rate >= 10) return { color: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-500', label: 'Atenção' };
  if (rate >= 0) return { color: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-500', label: 'Baixo' };
  return { color: '#ef4444', bgClass: 'bg-rose-500', textClass: 'text-rose-500', label: 'Negativo' };
}

function getChallengeStatus(progress: number): { color: string; bg: string; label: string } {
  if (progress >= 80) return { color: '#22c55e', bg: 'bg-emerald-500/10', label: 'No caminho' };
  if (progress >= 50) return { color: '#f59e0b', bg: 'bg-amber-500/10', label: 'Quase lá' };
  return { color: '#ef4444', bg: 'bg-rose-500/10', label: 'Precisa melhorar' };
}

function getMotivationalMessage(data: SavingsData): { text: string; emoji: string } {
  const { savingsRate, projectedSavings, daysRemaining } = data;
  if (savingsRate >= 30) {
    return { text: `Incrível! Você está economizando ${savingsRate.toFixed(0)}% da sua renda. Continue assim!`, emoji: '🚀' };
  }
  if (savingsRate >= 20) {
    return { text: `Muito bem! Sua taxa de poupança está saudável. Faltam ${daysRemaining} dias — mantenha o foco!`, emoji: '💪' };
  }
  if (savingsRate >= 10) {
    return { text: `Você está no caminho certo. Tente reduzir pequenos gastos para atingir 20% de economia.`, emoji: '🎯' };
  }
  if (savingsRate >= 0) {
    return { text: `Sua taxa de poupança está baixa. Que tal cortar gastos desnecessários estes ${daysRemaining} dias?`, emoji: '💡' };
  }
  return { text: `Suas despesas ultrapassaram a renda. Revise seus gastos e busque formas de economizar.`, emoji: '⚠️' };
}

// --- Animated counter ---
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    const startDelay = 300;

    const step = (now: number) => {
      const elapsed = now - startTime - startDelay;
      if (elapsed < 0) {
        ref.current = requestAnimationFrame(step);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    };

    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);

  return (
    <span className="tabular-nums">
      {displayed}{suffix}
    </span>
  );
}

// --- Circular Progress Ring ---
function SavingsRateRing({ rate }: { rate: number }) {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(Math.max(rate, 0), 100);
  const offset = circumference - (clampedRate / 100) * circumference;
  const { color, label } = getSavingsColor(rate);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-25"
        style={{ backgroundColor: color }}
      />
      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          opacity={0.25}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className={`text-4xl font-extrabold ${label === 'Negativo' ? 'text-rose-500' : ''}`}
          style={{ color: label === 'Negativo' ? undefined : color }}
        >
          <AnimatedCounter target={Math.round(clampedRate)} />
          <span className="text-xl">%</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="text-[11px] font-medium text-muted-foreground mt-0.5"
        >
          Taxa de Poupança
        </motion.p>
      </div>
    </div>
  );
}

// --- Challenge Card ---
function ChallengeCard({ challenge, index }: { challenge: ChallengeTarget; index: number }) {
  const status = getChallengeStatus(challenge.progress);
  const [started, setStarted] = useState(false);

  const formatValue = (v: number, unit: string) => {
    if (unit === 'currency') return currencyFmt(v);
    return `${v.toFixed(1)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${status.color}15` }}
              >
                {challenge.id === 'daily-spend' && <Flame className="w-4 h-4" style={{ color: status.color }} />}
                {challenge.id === 'monthly-save' && <Trophy className="w-4 h-4" style={{ color: status.color }} />}
                {challenge.id === 'savings-rate' && <Target className="w-4 h-4" style={{ color: status.color }} />}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-medium leading-tight">{challenge.title}</h4>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 shrink-0 border"
              style={{
                backgroundColor: `${status.color}10`,
                color: status.color,
                borderColor: `${status.color}30`,
              }}
            >
              {status.label}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">{challenge.description}</p>

          {/* Progress bar */}
          <div className="flex-1 flex flex-col justify-end gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatValue(challenge.current, challenge.unit)}
              </span>
              <span className="font-medium tabular-nums" style={{ color: status.color }}>
                {challenge.progress.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: status.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(challenge.progress, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 + index * 0.12 }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Meta: {formatValue(challenge.target, challenge.unit)}
            </p>
          </div>

          {/* Start button */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs px-3 w-full mt-auto ${started ? 'text-emerald-600' : ''}`}
            onClick={() => setStarted(true)}
            disabled={started}
          >
            {started ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Desafio aceito!
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1" />
                Iniciar Desafio
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Animation variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// --- Loading skeleton ---
function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <Skeleton className="w-40 h-40 rounded-full" />
          <div className="flex-1 w-full space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Component ---
export function SavingsChallenge() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/savings-challenge');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Erro ao carregar dados do desafio de economia', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Erro ao carregar dados do desafio de economia.</p>
        </CardContent>
      </Card>
    );
  }

  const motivation = getMotivationalMessage(data);
  const savingsInfo = getSavingsColor(data.savingsRate);
  const todayProgress = data.dailyTarget > 0 ? Math.min((data.todaySpending / data.dailyTarget) * 100, 100) : 0;
  const todayColor = todayProgress >= 80 ? '#ef4444' : todayProgress >= 60 ? '#f59e0b' : '#22c55e';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md">
        {/* Gradient top border */}
        <div className="h-1 rounded-t-xl bg-gradient-to-r from-emerald-500 to-teal-500" />

        <CardHeader className="pb-3">
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Desafio de Economia</CardTitle>
                <span className="text-lg" role="img" aria-label="troféu">🏆</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gamifique suas finanças e alcance suas metas
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-medium gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </Badge>
          </motion.div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Savings Rate Ring */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center gap-3 shrink-0"
            >
              <SavingsRateRing rate={data.savingsRate} />
              <Badge
                className="text-xs font-medium border"
                style={{
                  backgroundColor: `${savingsInfo.color}10`,
                  color: savingsInfo.color,
                  borderColor: `${savingsInfo.color}30`,
                }}
              >
                {savingsInfo.label}
              </Badge>
            </motion.div>

            {/* Right side content */}
            <div className="flex-1 w-full space-y-5">
              {/* Quick stats row */}
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground font-medium">Economizado</span>
                  <span className={`text-sm font-bold tabular-nums ${data.currentMonthSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {currencyFmt(data.currentMonthSavings)}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                  <TrendingDown className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground font-medium">Média/dia</span>
                  <span className="text-sm font-bold tabular-nums text-amber-500">
                    {currencyFmt(data.dailyAverageExpense)}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                  <TrendingUp className="w-4 h-4 text-teal-500" />
                  <span className="text-[10px] text-muted-foreground font-medium">Projetado</span>
                  <span className={`text-sm font-bold tabular-nums ${data.projectedSavings >= 0 ? 'text-teal-500' : 'text-rose-500'}`}>
                    {currencyFmt(data.projectedSavings)}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                  <Clock className="w-4 h-4 text-violet-500" />
                  <span className="text-[10px] text-muted-foreground font-medium">Dias restantes</span>
                  <span className="text-sm font-bold tabular-nums text-violet-500">{data.daysRemaining}</span>
                </div>
              </motion.div>

              {/* Challenge cards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Desafios Ativos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.challengeTargets.map((challenge, i) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} index={i} />
                  ))}
                </div>
              </div>

              {/* Daily tracking */}
              <motion.div
                variants={itemVariants}
                className="rounded-xl border border-border/50 bg-gradient-to-r from-muted/30 to-transparent p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-medium">Gastos de Hoje</h4>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs border-teal-500/30 text-teal-600 dark:text-teal-400"
                  >
                    Meta diária: {currencyFmt(data.dailyTarget)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-lg font-bold tabular-nums ${data.todaySpending > data.dailyTarget ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {currencyFmt(data.todaySpending)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    de {currencyFmt(data.dailyTarget)} disponíveis
                  </span>
                  {data.todaySpending === 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                      Nenhum gasto ainda!
                    </Badge>
                  )}
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: todayColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(todayProgress, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {todayProgress.toFixed(0)}% da meta diária utilizada
                  </span>
                  {data.todaySpending > data.dailyTarget ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-rose-500 font-medium">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      Meta ultrapassada
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-500 font-medium">
                      <ArrowDownRight className="w-2.5 h-2.5" />
                      Dentro da meta
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Motivational message */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="rounded-xl bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent border border-emerald-500/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{motivation.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                      {motivation.text}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Receita: {currencyFmt(data.income)} · Despesas: {currencyFmt(data.totalExpenses)} ·{' '}
                      {data.daysElapsed} de {data.daysInMonth} dias
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
