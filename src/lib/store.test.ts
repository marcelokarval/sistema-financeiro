/// <reference types="bun-types" />

import { beforeEach, describe, expect, test } from 'bun:test';
import ts from 'typescript';
import { useAppStore } from './store';

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('rascunho de transação por conta', () => {
  const draftA = { accountId: 'A', data: { description: 'Rascunho A' } };

  test('descarta o rascunho quando a resposta atual confirma que A sumiu', async () => {
    const { reconcileTransactionDraft } = await import('../components/finance/accounts-view');
    const draft = reconcileTransactionDraft(draftA, [{ id: 'B' }], true);
    expect(draft).toBeNull();
    expect(reconcileTransactionDraft(draft, [{ id: 'A' }, { id: 'B' }], false)).toBeNull();
  });

  test('mantém o rascunho para A após erro, resposta atrasada ou confirmação de A', async () => {
    const { reconcileTransactionDraft } = await import('../components/finance/accounts-view');
    expect(reconcileTransactionDraft(draftA, null, true)).toBe(draftA);
    expect(reconcileTransactionDraft(draftA, [{ id: 'B' }], false)).toBe(draftA);
    expect(reconcileTransactionDraft(draftA, [{ id: 'A' }], true)).toBe(draftA);
  });

  test('só prepara gravação se o rascunho pertence à conta atual ainda disponível', async () => {
    const { transactionDraftForAccount } = await import('../components/finance/accounts-view');
    const accounts = [{ id: 'A' }, { id: 'B' }];
    expect(transactionDraftForAccount(draftA, 'B', accounts)).toBeNull();
    expect(transactionDraftForAccount(draftA, 'A', [{ id: 'B' }])).toBeNull();
    expect(transactionDraftForAccount(draftA, 'A', accounts)).toBe(draftA);
  });
});

describe('shell Quiet Financial OS', () => {
  test('os widgets secundários do resumo têm imports locais', async () => {
    const path = new URL('../app/page.tsx', import.meta.url);
    const page = ts.createSourceFile(path.pathname, await Bun.file(path).text(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const composition = page.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'DashboardWithWidgets');
    if (!composition) throw new Error("Composição do resumo ausente");
    const imports = new Set(page.statements.flatMap((node) => {
      if (!ts.isImportDeclaration(node)) return [];
      const bindings = node.importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings) ? bindings.elements.map(({ name }) => name.text) : [];
    }));
    const unbound: string[] = [];
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
        const name = node.tagName.text;
        if (/^[A-Z]/.test(name) && !imports.has(name)) unbound.push(name);
      }
      ts.forEachChild(node, visit);
    };
    visit(composition);
    expect(unbound).toEqual([]);
  });

  test('ancora Ações rápidas no cabeçalho sem reintroduzir o botão flutuante', async () => {
    const page = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const actions = await Bun.file(new URL('../components/finance/quick-actions.tsx', import.meta.url)).text();
    expect(page).toMatch(/<header\b[\s\S]*<QuickActions\b[\s\S]*<\/header>/);
    expect(actions).toContain('aria-label="Ações rápidas"');
    expect(actions).toMatch(/<DropdownMenuTrigger\b/);
    expect(actions).not.toMatch(/\bfixed\b|bg-gradient|backdrop-blur/);
  });

  test('preserva os quatro atalhos e seus destinos ou callbacks', async () => {
    const page = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const actions = await Bun.file(new URL('../components/finance/quick-actions.tsx', import.meta.url)).text();
    expect(actions).toMatch(/label: 'Nova Transação'[^}]*view: 'accounts'/);
    expect(actions).toMatch(/label: 'Nova Compra'[^}]*view: 'purchases'/);
    expect(actions).toMatch(/label: 'Nova Meta'[^}]*action: 'goal'/);
    expect(actions).toMatch(/label: 'Exportar Dados'[^}]*action: 'export'/);
    expect(actions).toContain('onNewGoal?.()');
    expect(actions).toContain('onExport?.()');
    expect(page).toContain('/api/export?type=transactions&format=csv');
    expect(page).toMatch(/view === "accounts"[\s\S]{0,100}startLaunch\(/);
  });

  test('mantém a instância do assistente no diálogo oculto e inerte ao fechar', async () => {
    const page = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const nativeDialog = page.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0] ?? '';
    expect(nativeDialog).toContain('inert={!aiAssistantVisible}');
    expect(nativeDialog).toContain('<AIAdvisor />');
    expect(page).toContain('.showModal()');
    expect(page).toContain('.close()');
  });

  test('atualiza Contas e Resumo pelo contador sem remontá-los e mantém os demais destinos', async () => {
    const page = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const accounts = await Bun.file(new URL('../components/finance/accounts-view.tsx', import.meta.url)).text();
    expect(page).not.toContain('key={`${currentView}-${refreshCounter}`}');
    expect(page).toMatch(/<AccountsView[^>]+refreshCounter={refreshCounter}/);
    expect(page).toMatch(/<DashboardView[^>]+refreshCounter={refreshCounter}/);
    expect(page).toContain('`${currentView}-${refreshCounter}`');
    expect(accounts).toMatch(/[fetchAccounts, fetchCategories, refreshCounter]/);
    expect(accounts).toMatch(/[fetchMonthlyStats, refreshCounter]/);
    expect(accounts).toMatch(/[fetchTransactions, refreshCounter, selectedAccountId]/);
  });

  test('inicia com o assistente fechado e permite abri-lo sob demanda', () => {
    expect(useAppStore.getState().aiAssistantVisible).toBe(false);
    useAppStore.getState().toggleAiAssistant();
    expect(useAppStore.getState().aiAssistantVisible).toBe(true);
  });

  test('abre a escolha em Contas sem selecionar automaticamente', () => {
    expect(useAppStore.getState().newTransactionRequested).toBe(false);
    useAppStore.getState().requestNewTransaction();
    expect(useAppStore.getState()).toMatchObject({
      currentView: 'accounts',
      newTransactionRequested: true,
      selectedAccountId: null,
    });
  });

  test('pede nova escolha mesmo com seleção anterior e permite cancelar', () => {
    useAppStore.getState().setSelectedAccountId('conta-anterior');
    useAppStore.getState().requestNewTransaction();
    expect(useAppStore.getState()).toMatchObject({
      newTransactionRequested: true,
      selectedAccountId: 'conta-anterior',
    });
    useAppStore.getState().clearNewTransactionRequest();
    expect(useAppStore.getState().newTransactionRequested).toBe(false);
  });

  test('descarta a intenção ao navegar e não reabre a caixa ao voltar', () => {
    useAppStore.getState().requestNewTransaction();
    useAppStore.getState().setCurrentView('cards');
    useAppStore.getState().setCurrentView('accounts');
    expect(useAppStore.getState().newTransactionRequested).toBe(false);
  });

  test('solicita Nova Meta indo para savings e limpa a intenção ao cancelar ou navegar', () => {
    expect(useAppStore.getState().newGoalRequested).toBe(false);
    useAppStore.getState().requestNewGoal();
    expect(useAppStore.getState()).toMatchObject({
      currentView: 'savings',
      newGoalRequested: true,
    });
    useAppStore.getState().clearNewGoalRequest();
    expect(useAppStore.getState().newGoalRequested).toBe(false);

    useAppStore.getState().requestNewGoal();
    useAppStore.getState().setCurrentView('dashboard');
    expect(useAppStore.getState().newGoalRequested).toBe(false);
  });

  test('conecta onNewGoal, refreshCounter, seleção da busca global e shell de carregamento em page.tsx e ícone local em layout.tsx', async () => {
    const page = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const layout = await Bun.file(new URL('../app/layout.tsx', import.meta.url)).text();
    expect(page).toContain('onNewGoal={');
    expect(page).toContain('requestNewGoal()');
    expect(page).toContain('<QuickStatsOverview refreshCounter={refreshCounter}');
    expect(page).toContain('setSelectedAccountId(');
    expect(page).toContain('setSelectedCardId(');
    expect(page).toContain('setSelectedPurchaseId(');
    expect(page).not.toContain('if (!mounted) return null;');
    expect(page).toMatch(/if\s*\(!mounted\)\s*\{\s*return\s*\(/);
    expect(page).toContain('role="status"');
    expect(layout).not.toContain('https://z-cdn.chatglm.cn');
    expect(layout).toContain('/logo.svg');
  });
});
