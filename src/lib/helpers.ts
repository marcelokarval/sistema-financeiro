import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

export const dateFmt = (d: string) => {
  try {
    return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return d;
  }
};

export const dateShortFmt = (d: string) => {
  try {
    return format(parseISO(d), 'dd/MM/yy', { locale: ptBR });
  } catch {
    return d;
  }
};

export const percentFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

// Animation variants
export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const summaryContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export const summaryItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

export const listContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export const detailEntryVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
