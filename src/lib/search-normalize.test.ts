/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { normalizeSearchText } from './search-normalize';

describe('normalizeSearchText', () => {
  test('remove diacríticos e normaliza caixa para Saúde vs saude e Farmácia vs farmacia', () => {
    expect(normalizeSearchText('Saúde')).toBe('saude');
    expect(normalizeSearchText('saude')).toBe('saude');
    expect(normalizeSearchText('Saúde').includes(normalizeSearchText('saude'))).toBe(true);

    expect(normalizeSearchText('Farmácia Raia')).toBe('farmacia raia');
    expect(normalizeSearchText('farmacia')).toBe('farmacia');
    expect(normalizeSearchText('Farmácia Raia').includes(normalizeSearchText('farmacia'))).toBe(true);
  });

  test('normaliza cedilha, til, trema e combinações maiúsculas/minúsculas', () => {
    expect(normalizeSearchText('ALIMENTAÇÃO & Refeição')).toBe('alimentacao & refeicao');
    expect(normalizeSearchText('Çedilha Ñandú Über')).toBe('cedilha nandu uber');
    expect(normalizeSearchText('Cartão Crédito — Pão de Açúcar')).toBe('cartao credito — pao de acucar');
  });

  test('preserva string vazia, números e sinais sem lançar exceções', () => {
    expect(normalizeSearchText('')).toBe('');
    expect(normalizeSearchText('1234-5678')).toBe('1234-5678');
    expect(normalizeSearchText('R$ 42,50')).toBe('r$ 42,50');
  });
});
