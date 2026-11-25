/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test';
import {
  computeEndOfWeek,
  mapPrismaError,
  normalizeRecurringToMonthly,
  parseCivilDateEnd,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
  resolveCardDueDate,
  toLocalCivilDateKey,
} from './api-validation';

describe('parseJsonBody', () => {
  it('retorna ok: true com data quando o corpo é um objeto JSON válido', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Conta', amount: 100 }),
    });

    const result = await parseJsonBody<{ name: string; amount: number }>(req);
    expect(result).toEqual({ ok: true, data: { name: 'Conta', amount: 100 } });
  });

  it.each([
    ['JSON malformado', '{invalid'],
    ['corpo vazio', ''],
    ['apenas espaços', '   '],
    ['null literal', 'null'],
    ['array JSON', '[1, 2, 3]'],
    ['string JSON', '"texto"'],
    ['número JSON', '42'],
    ['booleano JSON', 'true'],
  ])('retorna ok: false com HTTP 400 para %s', async (_label, rawBody) => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: rawBody,
    });

    const result = await parseJsonBody(req, 'Payload inválido.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: 'Payload inválido.' });
    }
  });
});

describe('mapPrismaError', () => {
  it('mapeia erro P2003 para HTTP 400', async () => {
    const response = mapPrismaError({ code: 'P2003' }, { fk: 'FK inválida.' });
    expect(response).not.toBeNull();
    expect(response!.status).toBe(400);
    expect(await response!.json()).toEqual({ error: 'FK inválida.' });
  });

  it('mapeia erro P2025 para HTTP 404', async () => {
    const response = mapPrismaError({ code: 'P2025' }, { notFound: 'Não encontrado.' });
    expect(response).not.toBeNull();
    expect(response!.status).toBe(404);
    expect(await response!.json()).toEqual({ error: 'Não encontrado.' });
  });

  it('retorna null para outros códigos ou valores não-Prisma', () => {
    expect(mapPrismaError({ code: 'P2002' })).toBeNull();
    expect(mapPrismaError(new Error('Generic error'))).toBeNull();
    expect(mapPrismaError(null)).toBeNull();
  });
});

describe('parseCivilDateStart e parseCivilDateEnd', () => {
  it('interpreta YYYY-MM-DD no início e fim do dia civil local sem retroceder dia', () => {
    const start = parseCivilDateStart('2026-11-25');
    const end = parseCivilDateEnd('2026-11-25');

    expect(start).not.toBeNull();
    expect(end).not.toBeNull();

    expect(start!.getFullYear()).toBe(2026);
    expect(start!.getMonth()).toBe(10);
    expect(start!.getDate()).toBe(25);
    expect(start!.getHours()).toBe(0);
    expect(start!.getMinutes()).toBe(0);
    expect(start!.getSeconds()).toBe(0);
    expect(start!.getMilliseconds()).toBe(0);

    expect(end!.getFullYear()).toBe(2026);
    expect(end!.getMonth()).toBe(10);
    expect(end!.getDate()).toBe(25);
    expect(end!.getHours()).toBe(23);
    expect(end!.getMinutes()).toBe(59);
    expect(end!.getSeconds()).toBe(59);
    expect(end!.getMilliseconds()).toBe(999);
  });

  it('aceita timestamps completos com componente de hora', () => {
    const start = parseCivilDateStart('2026-11-25T15:30:00.000Z');
    const end = parseCivilDateEnd('2026-11-25T15:30:00.000Z');

    expect(start?.toISOString()).toBe('2026-11-25T15:30:00.000Z');
    expect(end?.toISOString()).toBe('2026-11-25T15:30:00.000Z');
  });

  it.each(['2026-02-30', '2026-13-01', 'invalida', '', '   ', '2026-02-30T10:00:00Z'])(
    'rejeita data inválida "%s" retornando null',
    (invalidValue) => {
      expect(parseCivilDateStart(invalidValue)).toBeNull();
      expect(parseCivilDateEnd(invalidValue)).toBeNull();
    }
  );
});

describe('toLocalCivilDateKey', () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzTest = timeZone === 'America/Bahia' || timeZone === 'UTC' ? it : it.skip;

  tzTest('formata chave YYYY-MM-DD respeitando o fuso horário local', () => {
    const instant = new Date('2026-11-26T01:30:00Z');
    const expected = timeZone === 'America/Bahia' ? '2026-11-25' : '2026-11-26';
    expect(toLocalCivilDateKey(instant)).toBe(expected);
  });
});

describe('parseFiniteNumber e parsePositiveFiniteNumber', () => {
  it('aceita números finitos válidos e rejeita NaN, Infinity, strings vazias e booleanos', () => {
    expect(parseFiniteNumber(0)).toBe(0);
    expect(parseFiniteNumber(-12.5)).toBe(-12.5);
    expect(parseFiniteNumber('42.75')).toBe(42.75);

    expect(parseFiniteNumber(NaN)).toBeNull();
    expect(parseFiniteNumber('NaN')).toBeNull();
    expect(parseFiniteNumber(Infinity)).toBeNull();
    expect(parseFiniteNumber('')).toBeNull();
    expect(parseFiniteNumber('   ')).toBeNull();
    expect(parseFiniteNumber(true)).toBeNull();
    expect(parseFiniteNumber(null)).toBeNull();
    expect(parseFiniteNumber(undefined)).toBeNull();
  });

  it('parsePositiveFiniteNumber exige valor estritamente maior que zero', () => {
    expect(parsePositiveFiniteNumber(10)).toBe(10);
    expect(parsePositiveFiniteNumber('0.01')).toBe(0.01);
    expect(parsePositiveFiniteNumber(0)).toBeNull();
    expect(parsePositiveFiniteNumber(-5)).toBeNull();
    expect(parsePositiveFiniteNumber(Infinity)).toBeNull();
  });
});

describe('normalizeRecurringToMonthly', () => {
  it('normaliza todas as frequências para base mensal', () => {
    expect(normalizeRecurringToMonthly(100, 'WEEKLY')).toBeCloseTo(100 * (52 / 12), 6);
    expect(normalizeRecurringToMonthly(100, 'BIWEEKLY')).toBeCloseTo(100 * (26 / 12), 6);
    expect(normalizeRecurringToMonthly(100, 'MONTHLY')).toBe(100);
    expect(normalizeRecurringToMonthly(300, 'QUARTERLY')).toBe(100);
    expect(normalizeRecurringToMonthly(1200, 'YEARLY')).toBe(100);
  });
});

describe('resolveCardDueDate', () => {
  it('limita dueDay = 31 ao último dia de fevereiro em ano comum e bissexto', () => {
    const feb2026 = resolveCardDueDate(2026, 1, 31);
    expect(feb2026.getFullYear()).toBe(2026);
    expect(feb2026.getMonth()).toBe(1);
    expect(feb2026.getDate()).toBe(28);

    const feb2024 = resolveCardDueDate(2024, 1, 31);
    expect(feb2024.getFullYear()).toBe(2024);
    expect(feb2024.getMonth()).toBe(1);
    expect(feb2024.getDate()).toBe(29);
  });

  it('avança para o mês seguinte quando o vencimento já passou de todayStart', () => {
    const todayStart = new Date(2026, 0, 20, 0, 0, 0, 0);
    const nextDue = resolveCardDueDate(2026, 0, 10, todayStart);
    expect(nextDue.getFullYear()).toBe(2026);
    expect(nextDue.getMonth()).toBe(1);
    expect(nextDue.getDate()).toBe(10);

    const nextDueClamped = resolveCardDueDate(2026, 0, 31, new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(nextDueClamped.getFullYear()).toBe(2026);
    expect(nextDueClamped.getMonth()).toBe(1);
    expect(nextDueClamped.getDate()).toBe(28);
  });
});

describe('computeEndOfWeek', () => {
  it('mantém endOfWeek às 23:59:59.999 do próprio domingo quando executado no domingo', () => {
    const sunday = new Date(2026, 10, 22, 10, 15, 0, 0);
    expect(sunday.getDay()).toBe(0);

    const end = computeEndOfWeek(sunday);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(22);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('calcula o domingo seguinte para dias úteis da semana', () => {
    const wednesday = new Date(2026, 10, 25, 14, 0, 0, 0);
    const end = computeEndOfWeek(wednesday);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(29);
    expect(end.getDay()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });
});
