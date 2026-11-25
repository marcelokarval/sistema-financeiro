import { NextResponse } from 'next/server';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}/;

function isValidCivilCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(year, month - 1, day);
  if (year < 100) {
    probe.setFullYear(year);
  }
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

function parseCivilDate(value: string, isEnd: boolean): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!isValidCivilCalendarDate(year, month, day)) {
      return null;
    }
    const resolved = isEnd
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
    if (year < 100) {
      resolved.setFullYear(year);
    }
    return resolved;
  }

  const dateTimeMatch = ISO_DATETIME_PREFIX_PATTERN.exec(trimmed);
  if (!dateTimeMatch) {
    return null;
  }

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]);
  const day = Number(dateTimeMatch[3]);
  if (!isValidCivilCalendarDate(year, month, day)) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampDayInMonth(year: number, month: number, dueDay: number): Date {
  const normalizedBase = new Date(year, month, 1);
  const resolvedYear = normalizedBase.getFullYear();
  const resolvedMonth = normalizedBase.getMonth();
  const lastDay = new Date(resolvedYear, resolvedMonth + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, Math.trunc(dueDay)), lastDay);
  return new Date(resolvedYear, resolvedMonth, safeDay);
}

/**
 * Faz parsing seguro de corpo JSON esperando um objeto plano (não nulo e não array).
 */
export async function parseJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  request: Request,
  errorMessage = 'Corpo da requisição JSON inválido.'
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: errorMessage }, { status: 400 }),
    };
  }

  if (!rawText.trim()) {
    return {
      ok: false,
      response: NextResponse.json({ error: errorMessage }, { status: 400 }),
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawText);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        response: NextResponse.json({ error: errorMessage }, { status: 400 }),
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: errorMessage }, { status: 400 }),
    };
  }
}

/**
 * Mapeia erros conhecidos do Prisma (P2003 -> 400, P2025 -> 404).
 */
export function mapPrismaError(
  error: unknown,
  messages?: { fk?: string; notFound?: string }
): NextResponse | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  if (code === 'P2003') {
    return NextResponse.json(
      { error: messages?.fk ?? 'Referência inválida.' },
      { status: 400 }
    );
  }
  if (code === 'P2025') {
    return NextResponse.json(
      { error: messages?.notFound ?? 'Registro não encontrado.' },
      { status: 404 }
    );
  }

  return null;
}

/**
 * Interpreta YYYY-MM-DD como início do dia civil local (00:00:00.000) ou timestamp ISO válido.
 */
export function parseCivilDateStart(value: string): Date | null {
  return parseCivilDate(value, false);
}

/**
 * Interpreta YYYY-MM-DD como fim do dia civil local (23:59:59.999) ou timestamp ISO válido.
 */
export function parseCivilDateEnd(value: string): Date | null {
  return parseCivilDate(value, true);
}

/**
 * Formata uma instância Date para chave civil local YYYY-MM-DD.
 */
export function toLocalCivilDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte número ou string numérica finita, rejeitando strings vazias, NaN, Infinity e booleanos.
 */
export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    if (!value.trim()) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Valida número finito estritamente maior que zero.
 */
export function parsePositiveFiniteNumber(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

/**
 * Normaliza valores recorrentes para equivalente mensal usando fator anual padrão.
 */
export function normalizeRecurringToMonthly(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY':
      return amount * (52 / 12);
    case 'BIWEEKLY':
      return amount * (26 / 12);
    case 'QUARTERLY':
      return amount / 3;
    case 'YEARLY':
      return amount / 12;
    case 'MONTHLY':
    default:
      return amount;
  }
}

/**
 * Calcula a data de vencimento do cartão sem overflow para dias 29-31 e avança para o mês seguinte se já passou.
 */
export function resolveCardDueDate(
  year: number,
  month: number,
  dueDay: number,
  todayStart?: Date
): Date {
  const candidate = clampDayInMonth(year, month, dueDay);
  if (todayStart && candidate < todayStart) {
    return clampDayInMonth(year, month + 1, dueDay);
  }
  return candidate;
}

/**
 * Calcula o fim da semana corrente (domingo às 23:59:59.999), permanecendo no próprio dia quando executado no domingo.
 */
export function computeEndOfWeek(reference: Date): Date {
  const dayOfWeek = reference.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + daysUntilSunday,
    23,
    59,
    59,
    999
  );
}
