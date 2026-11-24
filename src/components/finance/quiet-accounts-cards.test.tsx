/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { reconcileTransactionDraft, transactionDraftForAccount } from './accounts-view';

function markup(file: string) {
  const source = ts.createSourceFile(file, new TextDecoder().decode(readFile(file)), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: ts.JsxOpeningLikeElement[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return elements;
}

function attribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find((attr): attr is ts.JsxAttribute => ts.isJsxAttribute(attr) && attr.name.getText() === name);
}

function namedAction(elements: ts.JsxOpeningLikeElement[], handler: string, label: string) {
  return elements.some((node) => ['Button', 'button'].includes(node.tagName.getText())
    && attribute(node, 'onClick')?.getText().includes(handler)
    && attribute(node, 'aria-label')?.getText().includes(label));
}

const accountView = markup('accounts-view.tsx');
const cardView = markup('cards-view.tsx');

for (const [name, nodes, summary, records] of [
  ['Contas', accountView, 'Posição das contas', 'Contas cadastradas'],
  ['Cartões', cardView, 'Posição dos cartões', 'Cartões cadastrados'],
] as const) {
  test(`${name}: faixa de indicadores antes dos registros`, () => {
    const strip = nodes.findIndex((node) => node.tagName.getText() === 'dl' && attribute(node, 'aria-label')?.getText().includes(summary));
    const list = nodes.findIndex((node) => node.tagName.getText() === 'ul' && attribute(node, 'aria-label')?.getText().includes(records));
    expect(strip).toBeGreaterThanOrEqual(0);
    expect(list).toBeGreaterThan(strip);
    expect(nodes.some((node) => /gradient|card-glow|blur-xl/.test(node.getText()))).toBe(false);
  });
}

test('Contas: detalhe e ações de cada conta têm botão e nome', () => {
  expect(namedAction(accountView, 'openAccount(acc)', 'Abrir conta')).toBe(true);
  expect(namedAction(accountView, 'openEditAccount(acc)', 'Editar conta')).toBe(true);
  expect(namedAction(accountView, 'setShowDeleteDialog(acc.id)', 'Excluir conta')).toBe(true);
  expect(namedAction(accountView, 'openTransaction(selectedAccount.id)', 'Nova transação')).toBe(true);
  expect(namedAction(accountView, 'setShowTransferDialog(true)', 'Transferir')).toBe(true);
});

test('Cartões: detalhe, cópia, edição e exclusão são botões nomeados', () => {
  expect(namedAction(cardView, 'openCard(card)', 'Abrir cartão')).toBe(true);
  expect(namedAction(cardView, 'copyNumber(card.id', 'Copiar número mascarado')).toBe(true);
  expect(namedAction(cardView, 'openEditCard(card)', 'Editar cartão')).toBe(true);
  expect(namedAction(cardView, 'setShowDeleteDialog(card.id)', 'Excluir cartão')).toBe(true);
});

test('Cartões: acionador de compra expõe o estado e o painel que controla', () => {
  const trigger = cardView.find((node) => attribute(node, 'onClick')?.getText().includes('setExpandedPurchase('));
  expect(trigger?.tagName.getText()).toBe('button');
  expect(attribute(trigger!, 'aria-expanded')).toBeDefined();
  expect(attribute(trigger!, 'aria-controls')).toBeDefined();
});

test('Contas: rascunho sintético não migra para outra conta nem sobrevive a remoção confirmada', () => {
  const draft = { accountId: 'conta-a', session: Symbol(), data: { amount: '7.25' } };
  const a = { id: 'conta-a' };
  const b = { id: 'conta-b' };
  expect(reconcileTransactionDraft(draft, [b], false)).toBe(draft);
  expect(reconcileTransactionDraft(draft, [b], true)).toBeNull();
  expect(transactionDraftForAccount(draft, b.id, [a, b])).toBeNull();
  expect(transactionDraftForAccount(draft, a.id, [a, b])).toBe(draft);
});

function readFile(file: string) {
  return readFileSync(new URL(file, import.meta.url));
}

// Portais Radix não aparecem no SSR; verificar o contrato das confirmações na view.
for (const [file, count] of [["accounts-view.tsx",2],["cards-view.tsx",1]] as const) {
  test(`${file}: confirmação destrutiva usa cores semânticas e hover legível`, async () => {
    const source = await Bun.file(new URL(file, import.meta.url)).text();
    const actions = [...source.matchAll(/<AlertDialogAction\b([\s\S]*?)<\/AlertDialogAction>/g)];
    expect(actions).toHaveLength(count);
    for (const [, attrs] of actions) {
      expect(attrs).toContain('bg-destructive');
      expect(attrs).toContain('text-[var(--ds-destructive-fg)]');
      expect(attrs).toContain('hover:bg-destructive');
      expect(attrs).toContain('hover:underline');
      expect(attrs).not.toMatch(/text-white|text-destructive-foreground|bg-rose-|hover:bg-destructive\/90/);
    }
  });
}

test('Contas consome selectedAccountId da store, trata erro/loading de transações e valida transação', async () => {
  const source = await Bun.file(new URL('accounts-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedAccountId');
  expect(source).toContain('setSelectedAccountId');
  expect(source).toContain('Carregando transações');
  expect(source).toContain('Não foi possível carregar as transações');
  expect(source).toContain('Informe a descrição da transação');
  expect(source).toContain('Informe um valor maior que zero');
});

test('Cartões consome selectedCardId da store, trata loading/erro/retry e valida nome do cartão', async () => {
  const source = await Bun.file(new URL('cards-view.tsx', import.meta.url)).text();
  expect(source).toContain('selectedCardId');
  expect(source).toContain('setSelectedCardId');
  expect(source).toContain('Não foi possível carregar os cartões');
  expect(source).toContain('Não foi possível carregar as compras do cartão');
  expect(source).toContain('Carregando compras do cartão');
  expect(source).toContain('Nome do cartão é obrigatório');
});
