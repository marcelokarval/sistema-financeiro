'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShoppingBag, Target, Download } from 'lucide-react';
import { useAppStore, type ViewType } from '@/lib/store';

// ── Types ──────────────────────────────────────────────────────────
interface QuickAction {
  label: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  shadow: string;
  view?: ViewType;
  action?: 'export' | 'goal';
}

const actions: QuickAction[] = [
  {
    label: 'Nova Transação',
    icon: Plus,
    bg: 'bg-emerald-500',
    color: 'text-white',
    shadow: 'shadow-lg shadow-emerald-500/30',
    view: 'accounts',
  },
  {
    label: 'Nova Compra',
    icon: ShoppingBag,
    bg: 'bg-violet-500',
    color: 'text-white',
    shadow: 'shadow-lg shadow-violet-500/30',
    view: 'purchases',
  },
  {
    label: 'Nova Meta',
    icon: Target,
    bg: 'bg-amber-500',
    color: 'text-white',
    shadow: 'shadow-lg shadow-amber-500/30',
    action: 'goal',
  },
  {
    label: 'Exportar Dados',
    icon: Download,
    bg: 'bg-blue-500',
    color: 'text-white',
    shadow: 'shadow-lg shadow-blue-500/30',
    action: 'export',
  },
];

// ── Animation variants ─────────────────────────────────────────────
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15, delay: 0.05 } },
};

const fabIconVariants = {
  closed: { rotate: 0 },
  open: { rotate: 45 },
};

const menuItemVariants = {
  hidden: { opacity: 0, scale: 0.5, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 24,
      delay: i * 0.06,
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    scale: 0.5,
    y: 10,
    transition: {
      duration: 0.12,
      delay: (actions.length - 1 - i) * 0.03,
    },
  }),
};

const tooltipVariants = {
  hidden: { opacity: 0, x: -8, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { delay: i * 0.06 + 0.08, duration: 0.2 },
  }),
  exit: {
    opacity: 0,
    x: -8,
    scale: 0.9,
    transition: { duration: 0.1 },
  },
};

// ── Props ──────────────────────────────────────────────────────────
interface QuickActionsProps {
  onNavigate?: (view: string) => void;
  onExport?: () => void;
  onNewGoal?: () => void;
}

// ── Component ──────────────────────────────────────────────────────
export function QuickActions({ onNavigate, onExport, onNewGoal }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { setCurrentView } = useAppStore();

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleAction = useCallback(
    (action: QuickAction) => {
      if (action.action === 'export') {
        onExport?.();
      } else if (action.action === 'goal') {
        onNewGoal?.();
      } else if (action.view) {
        if (onNavigate) {
          onNavigate(action.view);
        } else {
          setCurrentView(action.view);
        }
      }
      handleClose();
    },
    [onNavigate, onExport, onNewGoal, setCurrentView, handleClose],
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              key="backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={handleClose}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
              aria-hidden="true"
            />

            {/* Action items */}
            {actions.map((action, i) => {
              const Icon = action.icon;
              return (
                <div key={action.label} className="flex items-center gap-3">
                  {/* Tooltip label */}
                  <motion.span
                    custom={i}
                    variants={tooltipVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="hidden sm:block px-3 py-1.5 rounded-xl bg-card border border-border/60 shadow-lg text-sm font-medium text-foreground whitespace-nowrap"
                  >
                    {action.label}
                  </motion.span>

                  {/* Action button */}
                  <motion.button
                    custom={i}
                    variants={menuItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={() => handleAction(action)}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.92 }}
                    className={`w-12 h-12 rounded-2xl ${action.bg} ${action.color} ${action.shadow} flex items-center justify-center`}
                    aria-label={action.label}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.button>
                </div>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.div
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.button
          onClick={() => setIsOpen((prev) => !prev)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-shadow flex items-center justify-center"
          aria-label={isOpen ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
        >
          <motion.span
            variants={fabIconVariants}
            animate={isOpen ? 'open' : 'closed'}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex items-center justify-center"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  );
}
