/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';

const purchases = readFileSync(new URL('./purchases-view.tsx', import.meta.url), 'utf8');
const categories = readFileSync(new URL('./categories-view.tsx', import.meta.url), 'utf8');

// Contratos de composição e ligação dos controles. A interação e os efeitos
// de gravação são provados separadamente no navegador com fixture sintética.
test('Compras põe o total da coleção antes da lista e deixa o ranking secundário', () => {
  const strip = purchases.indexOf('aria-label="Totais de compras"');
  const list = purchases.indexOf('aria-labelledby="purchase-records-heading"');
  const ranking = purchases.indexOf('id="purchase-ranking-heading"');
  expect(strip).toBeGreaterThan(-1);
  expect(list).toBeGreaterThan(strip);
  expect(ranking).toBeGreaterThan(list);
  expect(purchases).toContain("import { currencyFmt } from '@/lib/helpers';");
  expect(purchases).not.toMatch(/card-glow|bg-gradient|<motion\./);
});

test('Compras expõe um controle de expansão por registro e nomeia as ações de compra e itens', () => {
  expect(purchases.match(/onClick=\{\(\) => setExpandedId/g)).toHaveLength(1);
  expect(purchases).toContain('aria-expanded={isExpanded}');
  expect(purchases).toMatch(/aria-label=\{`Editar compra: \$\{purchase\.merchant\}`\}[\s\S]*?onClick=\{\(\) => openEdit\(purchase\)\}/);
  expect(purchases).toMatch(/aria-label=\{`Excluir compra: \$\{purchase\.merchant\}`\}[\s\S]*?onClick=\{\(\) => setShowDeleteDialog\(purchase\.id\)\}/);
  expect(purchases).toContain('onClick={openNew}');
  expect(purchases).toContain('onClick={addItem}');
  expect(purchases).toMatch(/aria-label=\{`Remover item \$\{idx \+ 1\}`\}[\s\S]*?onClick=\{\(\) => removeItem\(idx\)\}/);
  expect(purchases).toContain('onClick={savePurchase}');
});

test('Categorias agrupa registros por lista e torna filtro e ações alcançáveis sem hover', () => {
  expect(categories).toContain('aria-label="Totais de categorias"');
  expect(categories).toContain('aria-labelledby="category-records-heading"');
  expect(categories).toContain('aria-pressed={active}');
  expect(categories).toContain('onClick={() => setFilter(f.key)}');
  expect(categories).not.toMatch(/card-glow|group-hover:opacity|bg-gradient|<motion\./);
  expect(categories).toMatch(/aria-label=\{`Editar categoria: \$\{cat\.name\}`\}[\s\S]*?onClick=\{\(\) => openEdit\(cat\)\}/);
  expect(categories).toMatch(/aria-label=\{`Excluir categoria: \$\{cat\.name\}`\}[\s\S]*?onClick=\{\(\) => setShowDeleteDialog\(cat\.id\)\}/);
});

test('Categorias nomeia as escolhas e comunica o ícone e a cor selecionados', () => {
  expect(categories.match(/aria-pressed=\{selected\}/g)).toHaveLength(2);
  expect(categories).toContain('aria-label={c.label}');
  expect(categories).toContain('onClick={() => setForm({ ...form, icon: opt.value })}');
  expect(categories).toContain('onClick={() => setForm({ ...form, color: c.value })}');
  expect(categories).toContain('onClick={openNew}');
  expect(categories).toContain('onClick={save}');
});

test('os formulários de compra e categoria oferecem fechar com rótulo em pt-BR', () => {
  for (const source of [purchases, categories]) {
    expect(source).toMatch(/<DialogContent[^>]*showCloseButton=\{false\}/);
    expect(source).toMatch(/<DialogClose asChild>\s*<Button[^>]*aria-label="Fechar formulário"/);
  }
});

test('o expansor anuncia data, quantidade de itens, cartão, categoria e valor sem mudar seu nome', () => {
  expect(purchases).toMatch(/aria-label=\{`Itens da compra: \$\{purchase\.merchant\}`\}[\s\S]*?aria-describedby=\{`\$\{summaryId\} \$\{amountId\}`\}/);
  expect(purchases).toMatch(/<span id=\{summaryId\}[^>]*>[\s\S]*?dateFmt\(purchase\.date\)[\s\S]*?purchase\.items\.length[\s\S]*?purchase\.card\.name[\s\S]*?purchase\.category\.name[\s\S]*?<\/span>/);
  expect(purchases).toMatch(/<span id=\{amountId\}[^>]*>\{currencyFmt\(purchase\.totalAmount\)\}<\/span>/);
});

test.each([['Compras', purchases], ['Categorias', categories]])('%s não fecha a confirmação automaticamente e preserva o foco no cancelamento', (_name, source) => {
  const alert = source.slice(source.indexOf('<AlertDialog open') >= 0 ? source.indexOf('<AlertDialog open') : source.indexOf('<AlertDialog\n'));
  expect(alert).toContain('onCloseAutoFocus={restoreFocus}');
  expect(alert.match(/<AlertDialogCancel[^>]*>/)?.[0]).not.toContain('onClick');
  expect(alert).toMatch(/onClick=\{\(event\) => \{\s*event\.preventDefault\(\)/);
  expect(alert).not.toContain('onClickCapture={() => { dialogOrigin.current = newButton.current; }}');
});

test.each([['Compras', purchases], ['Categorias', categories]])('%s gera contraste destrutivo no CSS real e indica hover sem desbotar o fundo', async (_name, source) => {
  const action = source.match(/<AlertDialogAction\s[\s\S]*?<\/AlertDialogAction>/)?.[0];
  const classes = action?.match(/className=(?:"([^"\n]*)"|\{`([^`\n]*)`\})/);
  const candidates = (classes?.[1] ?? classes?.[2] ?? '').split(/\s+/);
  const globals = new URL('../../app/globals.css', import.meta.url);
  const compiler = await compile(readFileSync(globals, 'utf8'), {
    base: fileURLToPath(new URL('.', globals)),
    onDependency() {},
  });
  const css = compiler.build(candidates);
  expect(css).toMatch(/\.text-[^ {]+\s*\{\s*color: var\(--ds-destructive-fg\);/);
  expect(css).toMatch(/\.bg-destructive\s*\{\s*background-color: var\(--destructive\);/);
  expect(css).toMatch(/\.hover\\:bg-destructive\s*\{[^}]*background-color: var\(--destructive\);/);
  expect(css).toMatch(/\.hover\\:underline\s*\{[^}]*text-decoration-line: underline;/);
  expect(candidates.filter((candidate) => candidate.startsWith('hover:bg-'))).toEqual(['hover:bg-destructive']);
});

// Executa os handlers reais com fetch sintético; as asserções de composição acima
// cobrem a ligação dos controles, sem dependência de navegador ou banco.
const views = [
  ['Compras', purchases, 'savePurchase', 'deletePurchase', 'fetchPurchases', '/api/purchases'],
  ['Categorias', categories, 'save', 'deleteCat', 'fetchCategories', '/api/categories'],
] as const;
const methods = ['POST', 'PUT', 'DELETE'] as const;
type Method = typeof methods[number];
const purchaseForm = { merchant: 'Loja', cardId: '', categoryId: '', date: '2026-11-20', notes: '' };
const item = { name: 'Item', quantity: 2, unitPrice: 5, totalPrice: 10 };
const categoryForm = { name: 'Categoria', icon: 'tag', type: 'EXPENSE', color: '#64748b' };

async function exercise(view: typeof views[number], method: Method, fetch: (url: string, init?: RequestInit) => Promise<Response>) {
  const [name, source, saveName, deleteName, refreshName] = view;
  const declaration = (start: string, end: string) => {
    const from = source.indexOf(start);
    return source.slice(from, source.indexOf(end, from));
  };
  const refresh = declaration(`  const ${refreshName} = useCallback`, "  }, []);") + "  }, []);";
  const handlers = declaration(`  const ${saveName} = async`, name === 'Compras' ? '  const filtered = ' : '  /* ── computed values');
  const { transpile, ScriptTarget } = await import('typescript');
  const dialog = declaration('  const beginOpening =', '  const restoreFocus =') + declaration('  const restoreFocus =', '  };') + '  };';
  const js = transpile([dialog, refresh, handlers,
    `return { beginOpening, closeDialog, restoreFocus, save: ${saveName}, remove: ${deleteName}, refresh: ${refreshName} };`,
  ].join('\n'), { target: ScriptTarget.ES2022 });
  const messages: string[] = [];
  const toast = { success: (message: string) => messages.push(message), error: (message: string) => messages.push(message) };
  const focused: string[] = [];
  const button = (name: string) => ({ name, isConnected: true, focus: () => focused.push(name) });
  const originA = button('A');
  const originB = button('B');
  const activeOpening: { current: { origin: typeof originA } | null } = { current: null };
  const editing = method === 'PUT' ? { id: 'id' } : null;
  let open = true;
  let records: unknown[] = [{ id: 'antigo' }];
  let refreshFailed = false;
  const close = () => { open = false; };
  const model = {
    fetch, toast, form: name === 'Compras' ? purchaseForm : categoryForm, items: [item, { ...item, name: ' ' }], formTotal: 10,
    editingPurchase: editing, editing, setShowDialog: close, setShowDeleteDialog: close, activeOpening,
    newButton: { current: button('Novo') }, mutationPending: { current: false }, listRead: { current: 0 }, useCallback: (fn: unknown) => fn,
    setLoading: () => {}, setPurchases: (value: unknown[]) => { records = value; }, setCategories: (value: unknown[]) => { records = value; },
    setRefreshFailed: (value: boolean) => { refreshFailed = value; },
  };
  const { beginOpening, closeDialog, save, remove, refresh: reload, restoreFocus } = new Function(
    ...Object.keys(model),
    `let opening; const setOpening = (value) => { opening = value; }; ${js}`,
  )(...Object.values(model));
  const kind = method === 'DELETE' ? 'delete' : 'form';
  beginOpening(originA);
  return {
    submit: () => method === 'DELETE' ? remove('id') : save(),
    reopen: () => { closeDialog(kind); beginOpening(originB); open = true; },
    restoreFocus: () => { const event = new Event('close', { cancelable: true }); restoreFocus(event); return event.defaultPrevented; },
    reload, messages, focused, originB, get origin() { return activeOpening.current?.origin; }, get open() { return open; },
    get records() { return records; }, get refreshFailed() { return refreshFailed; },
  };
}

for (const view of views) {
  for (const method of methods) {
    test(`${view[0]} ${method}: falha HTTP preserva diálogo e payload`, async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const ui = await exercise(view, method, async (url, init) => {
        calls.push({ url, init });
        return new Response(null, { status: 503 });
      });
      await ui.submit();
      const form = view[0] === 'Compras' ? { ...purchaseForm, totalAmount: 10, items: [item] } : categoryForm;
      const body = method === 'DELETE' ? { id: 'id' } : method === 'PUT' ? { id: 'id', ...form } : form;
      expect(calls).toEqual([{ url: view[5], init: { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } }]);
      expect(ui.open).toBe(true);
      expect(ui.messages).toEqual([expect.stringMatching(/^Erro ao /)]);
    });

    test(`${view[0]} ${method}: 2xx tardio não fecha uma nova abertura do mesmo diálogo`, async () => {
      const pending = Promise.withResolvers<Response>();
      const ui = await exercise(view, method, async (_url, init) => init?.method ? pending.promise : Response.json([{ id: 'atual' }]));
      const submission = ui.submit();
      ui.reopen();
      pending.resolve(new Response(null, { status: 204 }));
      await submission;
      expect(ui.open).toBe(true);
      expect(ui.origin).toBe(ui.originB);
      expect(ui.restoreFocus()).toBe(true);
      expect(ui.focused).toEqual([]);
      expect(ui.records).toEqual([{ id: 'atual' }]);
    });

    test(`${view[0]} ${method}: GET 503 não invalida o 2xx e permite reler sem regravar`, async () => {
      const requests: string[] = [];
      const ui = await exercise(view, method, async (url, init) => {
        expect(url).toBe(view[5]);
        requests.push(init?.method ?? 'GET');
        if (init?.method) return new Response(null, { status: 204 });
        return requests.length === 2 ? new Response(null, { status: 503 }) : Response.json([{ id: 'atual' }]);
      });
      await ui.submit();
      expect(ui.open).toBe(false);
      expect(ui.restoreFocus()).toBe(true);
      expect(ui.focused).toEqual([method === 'DELETE' ? 'Novo' : 'A']);
      expect(ui.messages).toEqual([expect.stringMatching(/!$/)]);
      expect(ui.records).toEqual([{ id: 'antigo' }]);
      expect(ui.refreshFailed).toBe(true);
      await ui.reload();
      expect(ui.refreshFailed).toBe(false);
      expect(ui.records).toEqual([{ id: 'atual' }]);
      expect(requests).toEqual([method, 'GET', 'GET']);
    });
  }
}

test('Compras consome selectedPurchaseId, permite limpar seleção e trata falha em cartões/categorias', () => {
  expect(purchases).toContain('selectedPurchaseId');
  expect(purchases).toContain('setSelectedPurchaseId');
  expect(purchases).toContain('Nenhum cartão');
  expect(purchases).toContain('Nenhuma categoria');
  expect(purchases).toContain('Não foi possível carregar cartões ou categorias');
});

test('Categorias propaga mensagem específica da API em falha de salvamento', async () => {
  const apiMsg = 'Categoria já existe';
  const ui = await exercise(views[1], 'POST', async () => Response.json({ error: apiMsg }, { status: 400 }));
  await ui.submit();
  expect(ui.open).toBe(true);
  expect(ui.messages).toEqual([apiMsg]);
});
