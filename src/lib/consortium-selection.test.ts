/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import { isCurrentConsortiumSelection, readConsortiumInstallments, findPayableConsortiumInstallment, resolveConsortiumPaymentRefresh } from './consortium-selection';

const a = { consortiumId: 'A' };
const b = { consortiumId: 'B' };
const reopenedA = { consortiumId: 'A' };
const installment = { id: 'a1', consortiumId: 'A', number: 1, amount: 125, dueDate: '2026-05-01',
  paidDate: null, status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '' };

test('cada abertura tem identidade própria inclusive no percurso A → B → A', () => {
  expect(isCurrentConsortiumSelection(b, a)).toBe(false);
  expect(isCurrentConsortiumSelection(reopenedA, a)).toBe(false);
  expect(isCurrentConsortiumSelection(reopenedA, reopenedA)).toBe(true);
  expect(isCurrentConsortiumSelection(null, a)).toBe(false);
});

test('sucesso relê a abertura vigente de A, mas sob B ou fechado só atualiza a lista', () => {
  expect(resolveConsortiumPaymentRefresh(reopenedA, a, true).detail).toBe(reopenedA);
  expect(resolveConsortiumPaymentRefresh(a, a, true)).toEqual({ detail: a, list: true });
  expect(resolveConsortiumPaymentRefresh(b, a, true)).toEqual({ detail: undefined, list: true });
  expect(resolveConsortiumPaymentRefresh(null, a, true)).toEqual({ detail: undefined, list: true });
});

test('erro mantém releitura defensiva sem invalidar a seleção de outro consórcio', () => {
  expect(resolveConsortiumPaymentRefresh(reopenedA, a, false)).toEqual({ detail: reopenedA, list: true });
  expect(resolveConsortiumPaymentRefresh(b, a, false)).toEqual({ detail: undefined, list: false });
});

test('a resposta inteira é recusada se contiver parcela alheia ou dado ausente', () => {
  const foreign = { ...installment, id: 'b1', consortiumId: 'B' };
  expect(readConsortiumInstallments(a, [installment, foreign])).toBeNull();
  expect(readConsortiumInstallments(a, [null])).toBeNull();
  expect(readConsortiumInstallments(a, null)).toBeNull();
  expect(readConsortiumInstallments(a, { error: 'falha sintética' })).toBeNull();
  expect(readConsortiumInstallments(a, [{ ...installment, status: 'UNKNOWN' }])).toBeNull();
  expect(readConsortiumInstallments(a, [installment, installment])).toBeNull();
  expect(readConsortiumInstallments(a, [])).toEqual([]);
  expect(readConsortiumInstallments(a, [installment])).toEqual([installment]);
});

test('o guard só resolve a parcela não paga dos dados vigentes da abertura', () => {
  const rows = readConsortiumInstallments(a, [installment]);
  expect(findPayableConsortiumInstallment(a, a, rows, 'a1')).toEqual(installment);
  expect(findPayableConsortiumInstallment(b, a, rows, 'a1')).toBeUndefined();
  expect(findPayableConsortiumInstallment(reopenedA, a, rows, 'a1')).toBeUndefined();
  expect(findPayableConsortiumInstallment(null, a, rows, 'a1')).toBeUndefined();
  expect(findPayableConsortiumInstallment(a, a, null, 'a1')).toBeUndefined();
  expect(findPayableConsortiumInstallment(a, a, rows, 'inexistente')).toBeUndefined();
  const paid = readConsortiumInstallments(a, [{ ...installment, status: 'PAID' }]);
  expect(findPayableConsortiumInstallment(a, a, paid, 'a1')).toBeUndefined();
  const overdue = readConsortiumInstallments(a, [{ ...installment, status: 'OVERDUE' }]);
  expect(findPayableConsortiumInstallment(a, a, overdue, 'a1')?.status).toBe('OVERDUE');
});
