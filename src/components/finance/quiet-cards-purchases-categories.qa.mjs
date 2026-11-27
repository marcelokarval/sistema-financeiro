// Execute somente dentro do preflight único de navegador de 0014.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git ou banco.
// Variáveis RO do ref 5ec4d9980eb87ee8609324ab66105bd7e7af939f:
// QUIET_QA_BASELINE_CARDS (cards-view.tsx),
// QUIET_QA_BASELINE_PURCHASES (purchases-view.tsx),
// QUIET_QA_BASELINE_CATEGORIES (categories-view.tsx).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '5ec4d9980eb87ee8609324ab66105bd7e7af939f';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_CARDS',
    file: 'cards-view.tsx',
    hash: 'af6dc78739fa8d4ff8b6092a53497a12e5f38fb5cb95b6eb20e2c3060ac9c6f4',
  },
  {
    env: 'QUIET_QA_BASELINE_PURCHASES',
    file: 'purchases-view.tsx',
    hash: '2d960a6505faf6e9c0e5ac57859fa052b01bfb42b3b2088b92a56082c4f2b7f6',
  },
  {
    env: 'QUIET_QA_BASELINE_CATEGORIES',
    file: 'categories-view.tsx',
    hash: '5db30bbcaf26b73c12ffdd3da027ad87715801376668b7e966fe107a5dfb31ed',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const cardsViewPath = join(financeDir, 'cards-view.tsx');
const purchasesViewPath = join(financeDir, 'purchases-view.tsx');
const categoriesViewPath = join(financeDir, 'categories-view.tsx');

function installFixture(CardsView, PurchasesView, CategoriesView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, ThemeProvider, Toaster, toast) {
  const initialCards = [
    {
      id: 'a', name: 'Cartão A', type: 'CREDIT', brand: 'VISA', lastFourDigits: '1111',
      creditLimit: 1000, currentBalance: 100, closingDay: 1, dueDay: 10, color: '#8b5cf6', flag: '',
    },
    {
      id: 'b', name: 'Cartão B', type: 'CREDIT', brand: 'MASTERCARD', lastFourDigits: '2222',
      creditLimit: 2000, currentBalance: 250, closingDay: 5, dueDay: 15, color: '#3b82f6', flag: '',
    },
  ];
  const initialCategories = [
    { id: 'cat-a', name: 'Categoria A', icon: 'shopping-bag', type: 'EXPENSE', color: '#22c55e', _count: { transactions: 1, purchases: 1 } },
    { id: 'cat-b', name: 'Categoria B', icon: 'banknote', type: 'INCOME', color: '#3b82f6', _count: { transactions: 2, purchases: 0 } },
  ];
  const initialPurchases = [
    {
      id: 'pur-a', merchant: 'Compra A', totalAmount: 25, date: '2026-11-19T00:00:00.000Z',
      cardId: 'a', card: { id: 'a', name: 'Cartão A', lastFourDigits: '1111', color: '#8b5cf6' },
      categoryId: 'cat-a', category: initialCategories[0], notes: '',
      items: [{ id: 'item-a', name: 'Item A', quantity: 1, unitPrice: 25, totalPrice: 25 }],
    },
    {
      id: 'pur-b', merchant: 'Compra B', totalAmount: 40, date: '2026-11-19T00:00:00.000Z',
      cardId: 'b', card: { id: 'b', name: 'Cartão B', lastFourDigits: '2222', color: '#3b82f6' },
      categoryId: 'cat-b', category: initialCategories[1], notes: '',
      items: [{ id: 'item-b', name: 'Item B', quantity: 2, unitPrice: 20, totalPrice: 40 }],
    },
  ];

  const qa = window.qa = {
    calls: [],
    unexpected: [],
    pending: {},
    mode: {},
    removed: { cards: false, purchases: false, categories: false },
    rootInstance: null,
  };

  const held = (label) => new Promise((resolve, reject) => { qa.pending[label] = { resolve, reject }; });
  qa.reply = (label, outcome, payload) => {
    const slot = qa.pending[label];
    if (!slot) throw new Error(`Sem promessa pendente para ${label}`);
    delete qa.pending[label];
    if (outcome === 'transport') return slot.reject(new Error('Rejeição sintética'));
    if (outcome === 'http503') return slot.resolve(new Response(JSON.stringify({ error: 'Falha sintética' }), { status: 503 }));
    return slot.resolve(payload !== undefined ? Response.json(payload) : new Response(null, { status: 204 }));
  };

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    qa.calls.push({ method, url, ...(body !== undefined ? { body } : {}) });

    if (method === 'GET') {
      if (url === '/api/cards') {
        const rows = qa.removed.cards ? initialCards.filter((c) => c.id !== 'a') : initialCards;
        if (qa.mode.cardsGet === 'hold') {
          qa.mode.cardsGet = null;
          return held('cardsGet');
        }
        return Response.json(rows);
      }
      if (url.startsWith('/api/purchases?cardId=')) {
        const cardId = url.split('=')[1];
        if (qa.mode.cardPurchasesHold) {
          return held(`cardPurchases:${cardId}`);
        }
        return Response.json([]);
      }
      if (url === '/api/purchases') {
        if (qa.mode.purchasesGet === 'hold') {
          qa.mode.purchasesGet = null;
          return held('purchasesGet');
        }
        if (qa.mode.purchasesGet === '503') {
          qa.mode.purchasesGet = null;
          return new Response(null, { status: 503 });
        }
        const rows = qa.removed.purchases ? initialPurchases.filter((p) => p.id !== 'pur-a') : initialPurchases;
        return Response.json(rows);
      }
      if (url === '/api/categories') {
        if (qa.mode.categoriesGet === 'hold') {
          qa.mode.categoriesGet = null;
          return held('categoriesGet');
        }
        if (qa.mode.categoriesGet === '503') {
          qa.mode.categoriesGet = null;
          return new Response(null, { status: 503 });
        }
        const rows = qa.removed.categories ? initialCategories.filter((c) => c.id !== 'cat-a') : initialCategories;
        return Response.json(rows);
      }
    }

    if (url === '/api/cards' && ['POST', 'PUT', 'DELETE'].includes(method)) {
      if (qa.mode.cardsWrite === 'hold') {
        return held(`cardsWrite:${method}:${qa.calls.length}`);
      }
      return Response.json({});
    }
    if (url === '/api/purchases' && method === 'DELETE') {
      if (qa.mode.purchasesDelete === 'hold') {
        return held(`purchasesDelete:${qa.calls.length}`);
      }
      qa.removed.purchases = true;
      return Response.json({ success: true });
    }
    if (url === '/api/categories' && method === 'DELETE') {
      if (qa.mode.categoriesDelete === 'hold') {
        return held(`categoriesDelete:${qa.calls.length}`);
      }
      qa.removed.categories = true;
      return Response.json({ success: true });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture: ${method} ${url}`);
  };

  qa.mount = (theme, kind) => {
    toast.dismiss();
    qa.calls = [];
    qa.unexpected = [];
    qa.pending = {};
    qa.mode = {};
    qa.removed = { cards: false, purchases: false, categories: false };
    const Comp = kind === 'cards' ? CardsView : kind === 'purchases' ? PurchasesView : CategoriesView;
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    qa.rootInstance = createRoot(host);
    qa.rootInstance.render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          AppIntlProvider,
          { locale: 'pt', messages: getMessagesForLocale('pt') },
          createElement('main', { className: 'p-4' }, createElement(Comp)),
          createElement(Toaster, { theme }),
        ),
      ),
    );
  };
}

// Função serializada para a VM do Playwright CLI: não depende de globals Node.
async function runCases(page, html, width, theme, phase) {
  const url = 'https://finance-qa.invalid/';
  const results = [];
  const errors = [];
  const blocked = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    if (req.url() === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    blocked.push(req.url());
    return route.abort();
  };

  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  const btn = (name, within = page) => within.getByRole('button', { name, exact: true });
  const dialog = (role = 'dialog') => page.getByRole(role);
  const calls = () => page.evaluate(() => window.qa.calls);
  const writes = async () => (await calls()).filter(({ method }) => method !== 'GET');
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const waitPending = (prefix) => page.waitForFunction(
    (p) => Object.keys(window.qa.pending).find((k) => k.startsWith(p)) ?? null,
    prefix,
  ).then((h) => h.jsonValue());

  const focusInfo = () => page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName ?? null,
      role: el?.getAttribute('role') || (el?.tagName === 'BUTTON' ? 'button' : el?.tagName === 'BODY' ? 'body' : null),
      name: el === document.body ? '' : (el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? ''),
      connected: Boolean(el?.isConnected),
    };
  });

  const assertGeometry = async (role = 'dialog') => {
    const box = await dialog(role).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        pageScroll: document.documentElement.scrollWidth,
        left: rect.left,
        right: rect.right,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      };
    });
    ensure(
      box.viewport === width
      && box.pageScroll <= width + 1
      && box.left >= -1
      && box.right <= width + 1
      && box.scrollWidth <= box.clientWidth + 1,
      `Overflow em ${role}: ${JSON.stringify(box)}`,
    );
  };

  const closePortalAndWait = async (role, triggerLocator) => {
    const portalNode = await dialog(role).elementHandle();
    ensure(portalNode, `Portal ${role} não encontrado`);
    try {
      await triggerLocator();
      await page.waitForFunction(
        (node) => !node.isConnected && !document.querySelector('[data-slot="dialog-content"][data-state="closed"], [data-slot="alert-dialog-content"][data-state="closed"]'),
        portalNode,
      );
      await frame();
    } finally {
      await portalNode.dispose();
    }
  };

  const openByKeyboard = async (locator, role = 'dialog', title) => {
    await locator.focus();
    await page.keyboard.press('Enter');
    await page.getByRole(role, { name: title, exact: true }).waitFor();
    await assertGeometry(role);
  };

  async function mountView(kind) {
    await page.evaluate(([skin, k]) => window.qa.mount(skin, k), [theme, kind]);
    await page.waitForFunction(
      (skin) => document.documentElement.classList.contains(skin)
        && document.querySelectorAll('[data-sonner-toast]').length === 0,
      theme,
    );
    const witness = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      background: getComputedStyle(document.body).backgroundColor,
    }));
    ensure(witness.width === width && witness.theme === theme && witness.background !== 'rgba(0, 0, 0, 0)', `Testemunha inválida: ${JSON.stringify(witness)}`);
    ensure(witness.scrollWidth <= width + 1, `Overflow horizontal inicial: ${witness.scrollWidth} > ${width}`);
    return witness;
  }

  async function scenario(name, run) {
    const violations = [];
    const data = await run(violations);
    const unexpected = await page.evaluate(() => window.qa.unexpected);
    if (unexpected.length) violations.push(`unexpected: ${JSON.stringify(unexpected)}`);
    results.push({ name, violations, ...(data ?? {}) });
  }

  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(4000);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);

  try {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.qa));
    const runAll = phase === 'all';
    if (runAll || phase === 'cartoes') {
      const witness = await mountView('cards');
      await btn('Novo cartão').waitFor();
      results.push({ name: 'testemunha do tema e viewport', violations: [], witness });

      for (const how of ['Escape', 'Cancelar']) {
        await scenario(`cartoes/novo/${how}`, async (violations) => {
          await mountView('cards');
          await btn('Novo cartão').waitFor();
          await openByKeyboard(btn('Novo cartão'), 'dialog', 'Novo Cartão');
          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Novo cartão') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          if ((await writes()).length !== 0) violations.push('mutação inesperada ao cancelar');
          return { focus: f };
        });

        await scenario(`cartoes/editar/${how}`, async (violations) => {
          await mountView('cards');
          await btn('Editar cartão Cartão A').waitFor();
          await openByKeyboard(btn('Editar cartão Cartão A'), 'dialog', 'Editar Cartão');
          const colorGroup = dialog('dialog').getByRole('group', { name: 'Cor' });
          await colorGroup.waitFor();
          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Editar cartão Cartão A') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          if ((await writes()).length !== 0) violations.push('mutação inesperada ao cancelar');
          return { focus: f };
        });
      }

      await scenario('cartoes/lock-sincrono-e-tardio', async (violations) => {
        await mountView('cards');
        await btn('Novo cartão').waitFor();
        await page.evaluate(() => { window.qa.mode.cardsWrite = 'hold'; });
        await openByKeyboard(btn('Novo cartão'), 'dialog', 'Novo Cartão');
        await page.locator('#card-name').fill('Cartão Lock');
        await page.locator('#card-digits').fill('1234');
        await btn('Adicionar', dialog('dialog')).evaluate((el) => { el.click(); el.click(); });
        const key = await waitPending('cardsWrite:POST:');
        const w = await writes();
        if (w.length !== 1) violations.push(`envios duplicados: ${w.length}`);
        const disabled = await btn('Adicionar', dialog('dialog')).getAttribute('aria-disabled');
        if (disabled !== 'true') violations.push(`aria-disabled esperado true, veio ${disabled}`);
        await closePortalAndWait('dialog', () => btn('Cancelar', dialog('dialog')).click());
        await openByKeyboard(btn('Editar cartão Cartão A'), 'dialog', 'Editar Cartão');
        await page.evaluate((k) => window.qa.reply(k, 'ok'), key);
        await frame();
        if (!(await dialog('dialog').isVisible())) violations.push('resposta tardia fechou abertura B');
        await closePortalAndWait('dialog', () => page.keyboard.press('Escape'));
      });

      await scenario('cartoes/exclusao-matriz-temporal', async (violations) => {
        await mountView('cards');
        await btn('Excluir cartão Cartão A').waitFor();
        await openByKeyboard(btn('Excluir cartão Cartão A'), 'alertdialog', 'Excluir cartão?');
        await closePortalAndWait('alertdialog', () => page.keyboard.press('Escape'));
        const afterCancel = await focusInfo();
        if (!afterCancel.connected || afterCancel.name !== 'Excluir cartão Cartão A') violations.push(`foco após Escape: ${JSON.stringify(afterCancel)}`);

        await page.evaluate(() => { window.qa.mode.cardsWrite = 'hold'; window.qa.mode.cardsGet = 'hold'; });
        await openByKeyboard(btn('Excluir cartão Cartão A'), 'alertdialog', 'Excluir cartão?');
        await btn('Excluir', dialog('alertdialog')).evaluate((el) => { el.click(); el.click(); });
        const delKey = await waitPending('cardsWrite:DELETE:');
        if ((await writes()).length !== 1) violations.push('DELETE duplicado');
        await closePortalAndWait('alertdialog', async () => {
          await page.evaluate(() => { window.qa.removed.cards = true; });
          await page.evaluate((k) => window.qa.reply(k, 'ok'), delKey);
        });
        const atClose = await focusInfo();
        if (!atClose.connected || atClose.role === 'body' || atClose.name !== 'Novo cartão') {
          violations.push(`foco no fechamento pós-DELETE: ${JSON.stringify(atClose)}`);
        }
        const getKey = await waitPending('cardsGet');
        await page.evaluate((k) => window.qa.reply(k, 'ok'), getKey);
        await frame();
        const afterGet = await focusInfo();
        if (!afterGet.connected || afterGet.role === 'body' || afterGet.name !== 'Novo cartão') {
          violations.push('foco não sobreviveu à remoção da linha');
        }
        return { atClose, afterGet };
      });

      await scenario('cartoes/troca-detalhe-em-voo', async (violations) => {
        await mountView('cards');
        await btn('Abrir cartão Cartão A').waitFor();
        await page.evaluate(() => { window.qa.mode.cardPurchasesHold = true; });
        await btn('Abrir cartão Cartão A').click();
        const keyA = await waitPending('cardPurchases:a');
        await btn('Voltar para cartões').click();
        await btn('Abrir cartão Cartão B').click();
        const keyB = await waitPending('cardPurchases:b');
        await page.evaluate((k) => window.qa.reply(k, 'ok', [{ id: 'pb', merchant: 'Compra B Vigente', totalAmount: 50, date: '2026-11-19', items: [] }]), keyB);
        await page.getByText('Compra B Vigente', { exact: true }).waitFor();
        await page.evaluate((k) => window.qa.reply(k, 'http503'), keyA);
        await frame();
        if (!(await page.getByText('Compra B Vigente', { exact: true }).isVisible())) violations.push('erro tardio de A afetou B');
      });
    }

    if (runAll || phase === 'compras') {

      for (const how of ['Escape', 'Cancelar']) {
        await scenario(`compras/novo/${how}`, async (violations) => {
          await mountView('purchases');
          await btn('Nova compra').waitFor();
          await openByKeyboard(btn('Nova compra'), 'dialog', 'Nova compra');
          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Nova compra') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          if ((await writes()).length !== 0) violations.push('mutação inesperada');
          return { focus: f };
        });

        await scenario(`compras/editar/${how}`, async (violations) => {
          await mountView('purchases');
          await btn('Editar compra: Compra A').waitFor();
          await openByKeyboard(btn('Editar compra: Compra A'), 'dialog', 'Editar compra');
          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Editar compra: Compra A') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          if ((await writes()).length !== 0) violations.push('mutação inesperada');
          return { focus: f };
        });
      }

      await scenario('compras/delete-releitura-pendente-erro-e-fallback', async (violations) => {
        await mountView('purchases');
        await btn('Excluir compra: Compra A').waitFor();
        await openByKeyboard(btn('Excluir compra: Compra A'), 'alertdialog', 'Excluir compra?');
        await closePortalAndWait('alertdialog', () => page.keyboard.press('Escape'));
        const afterCancel = await focusInfo();
        if (!afterCancel.connected || afterCancel.name !== 'Excluir compra: Compra A') violations.push(`foco Escape: ${JSON.stringify(afterCancel)}`);

        // Releitura pendente -> alerta permanece aberto; erro 503 -> fecha só após tentativa de GET e permite retry só de leitura
        await page.evaluate(() => { window.qa.mode.purchasesDelete = 'hold'; window.qa.mode.purchasesGet = 'hold'; });
        await openByKeyboard(btn('Excluir compra: Compra A'), 'alertdialog', 'Excluir compra?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey1 = await waitPending('purchasesDelete:');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey1);
        const getKey1 = await waitPending('purchasesGet');
        await frame();
        if (!(await dialog('alertdialog').isVisible())) violations.push('fechou antes da releitura concluir');
        await closePortalAndWait('alertdialog', () => page.evaluate((k) => window.qa.reply(k, 'http503'), getKey1));
        await btn('Tentar atualizar lista').waitFor();
        const afterRetryPrompt = await focusInfo();
        if (!afterRetryPrompt.connected || afterRetryPrompt.name !== 'Nova compra') violations.push(`foco pós-GET 503: ${JSON.stringify(afterRetryPrompt)}`);
        const writesBeforeRetry = (await writes()).length;
        await page.evaluate(() => { window.qa.removed.purchases = true; });
        await btn('Tentar atualizar lista').click();
        await btn('Excluir compra: Compra A').waitFor({ state: 'detached' });
        if ((await writes()).length !== writesBeforeRetry) violations.push('retry repetiu mutação');

        // Releitura OK removendo Compra B -> fecha somente após GET e foca botão Nova compra
        await page.evaluate(() => {
          window.qa.mode.purchasesDelete = 'hold';
          window.qa.mode.purchasesGet = 'hold';
        });
        await openByKeyboard(btn('Excluir compra: Compra B'), 'alertdialog', 'Excluir compra?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey2 = await waitPending('purchasesDelete:');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey2);
        const getKey2 = await waitPending('purchasesGet');
        if (!(await dialog('alertdialog').isVisible())) violations.push('fechou antes da releitura 2');
        await closePortalAndWait('alertdialog', () => page.evaluate((k) => window.qa.reply(k, 'ok', []), getKey2));
        const afterRemove = await focusInfo();
        if (!afterRemove.connected || afterRemove.name !== 'Nova compra') violations.push(`fallback esperado Nova compra, veio: ${JSON.stringify(afterRemove)}`);
        return { afterRetryPrompt, afterRemove };
      });

      await scenario('compras/delete-abertura-B', async (violations) => {
        await mountView('purchases');
        await btn('Excluir compra: Compra A').waitFor();
        await page.evaluate(() => { window.qa.mode.purchasesDelete = 'hold'; });
        await openByKeyboard(btn('Excluir compra: Compra A'), 'alertdialog', 'Excluir compra?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey = await waitPending('purchasesDelete:');
        await closePortalAndWait('alertdialog', () => btn('Cancelar', dialog('alertdialog')).click());
        await openByKeyboard(btn('Excluir compra: Compra B'), 'alertdialog', 'Excluir compra?');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey);
        await frame();
        if (!(await dialog('alertdialog').isVisible())) violations.push('DELETE A fechou abertura B');
        await closePortalAndWait('alertdialog', () => page.keyboard.press('Escape'));
      });
    }

    if (runAll || phase === 'categorias') {

      for (const how of ['Escape', 'Cancelar']) {
        await scenario(`categorias/seletor-e-editor/${how}`, async (violations) => {
          await mountView('categories');
          await btn('Nova categoria').waitFor();
          await openByKeyboard(btn('Nova categoria'), 'dialog', 'Nova categoria');
          const iconGroup = dialog('dialog').getByRole('group', { name: 'Ícone' });
          const colorGroup = dialog('dialog').getByRole('group', { name: 'Cor' });
          await iconGroup.waitFor();
          await colorGroup.waitFor();

          const travelBtn = iconGroup.getByRole('button', { name: 'Viagem', exact: true });
          await travelBtn.focus();
          await page.keyboard.press('Enter');
          if ((await travelBtn.getAttribute('aria-pressed')) !== 'true') violations.push('ícone não ativado por teclado');

          const greenBtn = colorGroup.getByRole('button', { name: 'Verde', exact: true });
          await greenBtn.focus();
          await page.keyboard.press('Space');
          if ((await greenBtn.getAttribute('aria-pressed')) !== 'true') violations.push('cor não ativada por teclado');
          await dialog('dialog').getByText('DespesaVerde', { exact: false }).waitFor();

          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Nova categoria') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          if ((await writes()).length !== 0) violations.push('mutação inesperada');
          return { focus: f };
        });

        await scenario(`categorias/editar/${how}`, async (violations) => {
          await mountView('categories');
          await btn('Editar categoria: Categoria A').waitFor();
          await openByKeyboard(btn('Editar categoria: Categoria A'), 'dialog', 'Editar categoria');
          await closePortalAndWait('dialog', () =>
            how === 'Escape' ? page.keyboard.press('Escape') : btn('Cancelar', dialog('dialog')).click());
          const f = await focusInfo();
          if (!f.connected || f.name !== 'Editar categoria: Categoria A') violations.push(`foco incorreto: ${JSON.stringify(f)}`);
          return { focus: f };
        });
      }

      await scenario('categorias/delete-releitura-pendente-erro-e-fallback', async (violations) => {
        await mountView('categories');
        await btn('Excluir categoria: Categoria A').waitFor();
        await openByKeyboard(btn('Excluir categoria: Categoria A'), 'alertdialog', 'Excluir categoria?');
        await closePortalAndWait('alertdialog', () => page.keyboard.press('Escape'));
        const afterCancel = await focusInfo();
        if (!afterCancel.connected || afterCancel.name !== 'Excluir categoria: Categoria A') violations.push(`foco Escape: ${JSON.stringify(afterCancel)}`);

        await page.evaluate(() => { window.qa.mode.categoriesDelete = 'hold'; window.qa.mode.categoriesGet = 'hold'; });
        await openByKeyboard(btn('Excluir categoria: Categoria A'), 'alertdialog', 'Excluir categoria?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey1 = await waitPending('categoriesDelete:');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey1);
        const getKey1 = await waitPending('categoriesGet');
        await frame();
        if (!(await dialog('alertdialog').isVisible())) violations.push('fechou antes da releitura');
        await closePortalAndWait('alertdialog', () => page.evaluate((k) => window.qa.reply(k, 'http503'), getKey1));
        await btn('Tentar atualizar lista').waitFor();
        const afterRetryPrompt = await focusInfo();
        if (!afterRetryPrompt.connected || afterRetryPrompt.name !== 'Nova categoria') violations.push(`foco pós-GET 503: ${JSON.stringify(afterRetryPrompt)}`);
        const writesBeforeRetry = (await writes()).length;
        await page.evaluate(() => { window.qa.removed.categories = true; });
        await btn('Tentar atualizar lista').click();
        await page.getByRole('heading', { level: 4, name: 'Categoria A', exact: true }).waitFor({ state: 'detached' });
        if ((await writes()).length !== writesBeforeRetry) violations.push('retry repetiu mutação');

        await page.evaluate(() => {
          window.qa.mode.categoriesDelete = 'hold';
          window.qa.mode.categoriesGet = 'hold';
        });
        await openByKeyboard(btn('Excluir categoria: Categoria B'), 'alertdialog', 'Excluir categoria?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey2 = await waitPending('categoriesDelete:');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey2);
        const getKey2 = await waitPending('categoriesGet');
        if (!(await dialog('alertdialog').isVisible())) violations.push('fechou antes da releitura 2');
        await closePortalAndWait('alertdialog', () => page.evaluate((k) => window.qa.reply(k, 'ok', []), getKey2));
        const afterRemove = await focusInfo();
        if (!afterRemove.connected || afterRemove.name !== 'Nova categoria') violations.push(`fallback esperado Nova categoria, veio: ${JSON.stringify(afterRemove)}`);
        return { afterRetryPrompt, afterRemove };
      });

      await scenario('categorias/delete-abertura-B', async (violations) => {
        await mountView('categories');
        await btn('Excluir categoria: Categoria A').waitFor();
        await page.evaluate(() => { window.qa.mode.categoriesDelete = 'hold'; });
        await openByKeyboard(btn('Excluir categoria: Categoria A'), 'alertdialog', 'Excluir categoria?');
        await btn('Excluir', dialog('alertdialog')).click();
        const delKey = await waitPending('categoriesDelete:');
        await closePortalAndWait('alertdialog', () => btn('Cancelar', dialog('alertdialog')).click());
        await openByKeyboard(btn('Excluir categoria: Categoria B'), 'alertdialog', 'Excluir categoria?');
        await page.evaluate((k) => window.qa.reply(k, 'ok', { success: true }), delKey);
        await frame();
        if (!(await dialog('alertdialog').isVisible())) violations.push('DELETE A fechou abertura B');
        await closePortalAndWait('alertdialog', () => page.keyboard.press('Escape'));
      });
    }

    ensure(errors.length === 0 && blocked.length === 0, JSON.stringify({ errors, blocked }));
    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1', 'Forneça QUIET_QA_SCRATCH absoluto e CI=1 no sandbox aprovado; não execute no host.');
for (const { env } of baselineSpecs) {
  assert(isAbsolute(process.env[env] ?? ''), `Forneça ${env} absoluto com a fonte RO do ref ${baseRef}`);
}
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  const val = process.env[key];
  assert(val && (await realpath(val)).startsWith(`${scratch}/`), `${key} fora do scratch privado`);
}
assert(HOME !== TMPDIR);
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' }, `${forbidden} não deve ser montado`);
}
assert(!('DATABASE_URL' in process.env), 'Fixture não usa banco');

const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baselineFiles = new Map();
for (const spec of baselineSpecs) {
  const contents = await readFile(process.env[spec.env], 'utf8');
  assert.equal(digest(contents), spec.hash, `SHA-256 inválido em ${spec.env} (${spec.file})`);
  baselineFiles.set(join(financeDir, spec.file), contents);
}

const dir = await mkdtemp(join(scratch, 'quiet-cards-purchases-categories-'));
const session = `quiet-cards-purchases-categories-${randomUUID()}`;
const failures = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 450_000;

async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(120_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do controlador encerrado');
  const cmd = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(cmd.stdout).text(), new Response(cmd.stderr).text(), cmd.exited,
  ]);
  assert(exit === 0 && !/^### Error\b/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  assert.equal(JSON.parse(await cli('--version', '--json')).version, '0.1.22', 'Versão do CLI exige revisão de capacidades');
  assert.match(await cli('open', '--help'), /--idle-timeout/);

  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwindcss({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'), 'CSS compilado sem tokens/utilitários');

  const entry = `import { CardsView } from ${JSON.stringify(cardsViewPath)};
    import { PurchasesView } from ${JSON.stringify(purchasesViewPath)};
    import { CategoriesView } from ${JSON.stringify(categoriesViewPath)};
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster, toast } from 'sonner';
    (${installFixture.toString()})(CardsView, PurchasesView, CategoriesView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, ThemeProvider, Toaster, toast);`;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-cards-purchases-categories',
        setup(build) {
          build.onLoad({ filter: /quiet-cards-purchases-categories\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad({ filter: /\/(cards-view|purchases-view|categories-view)\.tsx$/ }, (args) => {
              const contents = baselineFiles.get(args.path);
              if (!contents) return undefined;
              intercepted.add(args.path);
              return { contents, loader: 'tsx' };
            });
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) assert.equal(intercepted.size, baselineSpecs.length, 'Baseline não interceptou todos os 3 módulos');
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      file,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return file;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {};
  for (const file of [
    'cards-view.tsx', 'card-editor.tsx',
    'purchases-view.tsx', 'purchase-editor.tsx', 'purchase-items-editor.tsx',
    'categories-view.tsx', 'category-editor.tsx', 'category-icon-color-picker.tsx',
  ]) {
    candidateHashes[file] = digest(await readFile(join(financeDir, file)));
  }
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  const remediatedScenarios = new Set(['cartoes/exclusao-matriz-temporal']);
  const withoutRemediated = (entries) => entries.filter(({ name }) => !remediatedScenarios.has(name));
  let count = 0;
  const expectedCount = 20;

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = { baseline: [], candidate: [] };
      for (const label of ['baseline', 'candidate']) {
        const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, 'all')`);
        const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: ausência de resultado do DOM`);
        observed[label].push(...JSON.parse(result));
      }
      assert.equal(observed.baseline.length, expectedCount, `baseline: cenário incompleto (${observed.baseline.length} vs ${expectedCount})`);
      assert.equal(observed.candidate.length, expectedCount, `candidate: cenário incompleto (${observed.candidate.length} vs ${expectedCount})`);
      count += observed.candidate.length;
      console.log(JSON.stringify({ session, baseRef, width, theme, scenarios: observed.candidate.length }));

      const cellParity = Bun.deepEquals(withoutRemediated(observed.baseline), withoutRemediated(observed.candidate));
      if (!cellParity) gaps.push(`${width}/${theme}: divergência de paridade nos cenários não remediados`);

      for (const entryResult of observed.candidate) {
        const baseEntry = observed.baseline.find(({ name }) => name === entryResult.name);
        for (const violation of entryResult.violations) {
          const isRemediated = remediatedScenarios.has(entryResult.name);
          gaps.push(`${width}/${theme} ${entryResult.name}: ${!isRemediated && baseEntry?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
        }
      }

      const witness = observed.candidate.find(({ name }) => name === 'testemunha do tema e viewport')?.witness;
      assert(witness && witness.width === width && witness.theme === theme, `Testemunha inválida em ${width}/${theme}`);
      backgrounds.push(witness.background);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  assert.deepEqual(gaps, [], 'Falha no contrato Quiet/paridade');
  console.log(`${count} cenários verificados; 0 skips; 0 divergências Quiet abertas.`);
} catch (error) {
  failures.push(error);
} finally {
  const cleanup = async (label, action) => {
    try { await action(); } catch (error) { failures.push(new Error(`${label}: ${error.message}`, { cause: error })); }
  };
  if (attemptedOpen) {
    const before = errorsBefore();
    function errorsBefore() { return failures.length; }
    await cleanup('close', async () => {
      const closed = JSON.parse(await cli('close', '--json'));
      assert.equal(closed.session, session);
      assert.equal(closed.status, 'closed');
    });
    await cleanup('list', async () => {
      const { browsers } = JSON.parse(await cli('list', '--json'));
      assert(Array.isArray(browsers) && !browsers.some(({ name }) => name === session));
    });
    await cleanup('daemon', async () => {
      assert(Number.isInteger(daemonPid), 'PID não observado à abertura');
      for (let attempt = 0; attempt < 20; attempt++) {
        try { await access(`/proc/${daemonPid}`); } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        await delay(50);
      }
      throw new Error('Daemon ainda presente');
    });
    if (failures.length === before) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}
if (failures.length) throw new AggregateError(failures, 'QA de Cartões, Compras e Categorias não concluído');
