// Execute somente dentro do preflight de navegador de 0017. O executor prova
// a fronteira do SO, não este script. Disponibilize QUIET_QA_SCRATCH (tmpfs privado)
// e as 2 fontes RO do ref e59cad8e7c6ddd897b558c278abb6f46516681dc:
// QUIET_QA_BASELINE_GOALS e QUIET_QA_BASELINE_BUDGET.
// Não monte .git, o checkout inteiro, HOME do host, .env ou banco.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = 'e59cad8e7c6ddd897b558c278abb6f46516681dc';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_GOALS',
    file: 'budget-goals.tsx',
    hash: '815723cafbf4c74615875ccc7ce2e575401c036d702ab641a6a00cc2e6d7c5bb',
  },
  {
    env: 'QUIET_QA_BASELINE_BUDGET',
    file: 'monthly-budget-tracker.tsx',
    hash: '55c4a9e1352b165d5a59a83dcac5ad16109c8dc4bf4f86863d2f9ead13ecc045',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const goalsPath = join(financeDir, 'budget-goals.tsx');
const goalEditorPath = join(financeDir, 'budget-goal-editor.tsx');
const budgetPath = join(financeDir, 'monthly-budget-tracker.tsx');
const budgetEditorPath = join(financeDir, 'monthly-budget-editor.tsx');
const shellPath = join(root, 'src/components/shared/finance-dialog-shell.tsx');

function installFixture(BudgetGoalsWidget, MonthlyBudgetTracker, createElement, createRoot, ThemeProvider, Toaster) {
  const initialGoals = [
    {
      id: 'g-a',
      name: 'Meta A',
      description: 'Reserva inicial',
      targetAmount: 1000,
      currentAmount: 200,
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Moradia', color: '#8b5cf6' },
      startDate: '2026-01-01',
      endDate: null,
      isCompleted: false,
    },
    {
      id: 'g-b',
      name: 'Meta B',
      description: 'Viagem',
      targetAmount: 2000,
      currentAmount: 500,
      categoryId: null,
      category: null,
      startDate: '2026-01-01',
      endDate: null,
      isCompleted: false,
    },
  ];

  const initialBudgets = [
    {
      id: 'mb-a',
      categoryId: 'cat-1',
      categoryName: 'Moradia',
      categoryColor: '#8b5cf6',
      categoryIcon: 'home',
      amount: 1000,
      spent: 400,
      remaining: 600,
      percentage: 40,
      isOverBudget: false,
    },
    {
      id: 'mb-b',
      categoryId: 'cat-2',
      categoryName: 'Transporte',
      categoryColor: '#0ea5e9',
      categoryIcon: 'car',
      amount: 500,
      spent: 100,
      remaining: 400,
      percentage: 20,
      isOverBudget: false,
    },
  ];

  const categories = [
    { id: 'cat-1', name: 'Moradia', color: '#8b5cf6', icon: 'home', type: 'EXPENSE' },
    { id: 'cat-2', name: 'Transporte', color: '#0ea5e9', icon: 'car', type: 'EXPENSE' },
  ];

  const qa = window.qa = {
    calls: [],
    pending: {},
    unexpected: [],
    goalsReadMode: null,
    budgetReadMode: null,
    writeMode: null,
    goalsDeleted: false,
    budgetDeleted: false,
    readReleased: false,
    closePoint: null,
  };

  const held = (label) => new Promise((resolve, reject) => {
    qa.pending[label] = { resolve, reject };
  });

  const currentGoals = () => initialGoals.filter(({ id }) => !qa.goalsDeleted || id !== 'g-a');
  const currentBudgets = () => initialBudgets.filter(({ id }) => !qa.budgetDeleted || id !== 'mb-a');

  qa.reply = (label, outcome) => {
    const slot = qa.pending[label];
    if (!slot) throw new Error(`Sem resposta pendente: ${label}`);
    delete qa.pending[label];
    if (outcome === 'transport') return slot.reject(new Error('Rejeição sintética'));
    if (outcome === 'http-json') return slot.resolve(Response.json({ error: 'Falha HTTP sintética' }, { status: 503 }));
    if (label === 'write-goal-delete') {
      qa.goalsDeleted = true;
      return slot.resolve(Response.json({ success: true }, { status: 200 }));
    }
    if (label === 'write-budget-delete') {
      qa.budgetDeleted = true;
      return slot.resolve(Response.json({ success: true }, { status: 200 }));
    }
    if (label === 'read-goals') {
      qa.readReleased = true;
      return slot.resolve(Response.json(currentGoals()));
    }
    if (label === 'read-budget') {
      qa.readReleased = true;
      return slot.resolve(Response.json({ budgets: currentBudgets() }));
    }
    throw new Error(`Reply não tratado: ${label}`);
  };

  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({
      method,
      url,
      ...(init?.body ? { rawBody: init.body, body: JSON.parse(init.body) } : {}),
    });

    if (url === '/api/categories' && method === 'GET') {
      return Response.json(categories);
    }

    if (url === '/api/budgets' && method === 'GET') {
      if (qa.goalsReadMode === 'fail-once') {
        qa.goalsReadMode = null;
        return new Response(null, { status: 503 });
      }
      if (qa.goalsReadMode === 'hold') {
        return held('read-goals');
      }
      if (qa.goalsDeleted) qa.readReleased = true;
      return Response.json(currentGoals());
    }

    if (url.startsWith('/api/monthly-budgets') && method === 'GET') {
      if (qa.budgetReadMode === 'fail-once') {
        qa.budgetReadMode = null;
        return new Response(null, { status: 503 });
      }
      if (qa.budgetReadMode === 'hold') {
        return held('read-budget');
      }
      if (qa.budgetDeleted) qa.readReleased = true;
      return Response.json({ budgets: currentBudgets() });
    }

    if ((url === '/api/budgets' || url.startsWith('/api/monthly-budgets')) && ['POST', 'PUT', 'DELETE'].includes(method)) {
      if (qa.writeMode === 'http-json') {
        return Response.json({ error: 'Falha HTTP sintética' }, { status: 503 });
      }
      if (qa.writeMode === 'invalid-json') {
        return new Response('não JSON', { status: 503 });
      }
      if (qa.writeMode === 'transport') {
        throw new Error('Falha sintética de transporte');
      }
      if (qa.writeMode === 'hold' && method === 'DELETE') {
        return held(url === '/api/budgets' ? 'write-goal-delete' : 'write-budget-delete');
      }
      if (method === 'DELETE') {
        if (url === '/api/budgets') qa.goalsDeleted = true;
        else qa.budgetDeleted = true;
      }
      return Response.json({ success: true }, { status: method === 'POST' ? 201 : 200 });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Requisição inesperada na fixture: ${method} ${url}`);
  };

  qa.mount = (domain, theme, options = {}) => {
    qa.calls = [];
    qa.pending = {};
    qa.unexpected = [];
    qa.goalsReadMode = options.goalsReadMode ?? null;
    qa.budgetReadMode = options.budgetReadMode ?? null;
    qa.writeMode = options.writeMode ?? null;
    qa.goalsDeleted = false;
    qa.budgetDeleted = false;
    qa.readReleased = false;
    qa.closePoint = null;

    const Widget = domain === 'goals' ? BudgetGoalsWidget : MonthlyBudgetTracker;
    createRoot(document.getElementById('root')).render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          'main',
          { className: 'min-h-screen bg-background p-3', id: 'fixture' },
          createElement(Widget),
          domain === 'goals'
            ? createElement('button', { type: 'button', id: 'qa-surviving-control', className: 'mt-2 text-xs' }, 'Controle sobrevivente')
            : null,
          createElement(Toaster, { theme }),
        ),
      ),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button'
      : /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName.toLowerCase() ?? null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

// Serializado pelo CLI no sandbox. Não depende de globals Node na VM.
async function runCases(page, html, width, theme, phase, variant = 'candidate') {
  const url = 'https://finance-qa.invalid/';
  const rejected = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    if (req.url() === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    rejected.push(req.url());
    return route.abort();
  };

  await page.route('**/*', routeAll);
  page.on('pageerror', onError);

  try {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    page.setDefaultTimeout(4000);

    const results = [];
    const require = (value, message) => { if (!value) throw new Error(message); };
    const same = (value, want, message) => require(JSON.stringify(value) === JSON.stringify(want), `${message}: ${JSON.stringify(value)}`);
    const btn = (rootNode, name) => rootNode.getByRole('button', { name, exact: true });
    const frame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const calls = () => page.evaluate(() => window.qa.calls);
    const sameFocus = (want, got) => want.role === got.role && want.name === got.name && got.connected && got.focused;

    const geometry = (selector) => page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Superfície ausente: ${sel}`);
      const box = el.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        left: box.left,
        right: box.right,
        width: el.clientWidth,
        content: el.scrollWidth,
      };
    }, selector);

    const assertReflow = async (selector) => {
      const box = await geometry(selector);
      require(
        box.viewport === width && box.page <= width && box.left >= -1 && box.right <= width + 1 && box.content <= box.width + 1,
        `overflow: ${selector} ${JSON.stringify(box)}`,
      );
    };

    const focused = async (locator) => await locator.count() === 1 && locator.evaluate((node) => node === document.activeElement);
    const visibleFocus = (locator) => locator.evaluate((node) => {
      const style = getComputedStyle(node);
      return node.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    });

    const tabFromStartTo = async (target) => {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Tab');
        if (await focused(target)) {
          require(await visibleFocus(target), 'Acionador alcançado por Tab sem foco visível');
          return;
        }
      }
      throw new Error('Tab não alcançou o acionador');
    };

    async function attachUnmountWatch(dialog) {
      await dialog.evaluate((portal) => {
        window.qa.closePoint = null;
        portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
          window.qa.closePoint = {
            focus: window.qa.focus(),
            portalConnected: portal.isConnected,
            readReleased: window.qa.readReleased,
            pendingRead: !!(window.qa.pending['read-goals'] || window.qa.pending['read-budget']),
            goalAVisible: Array.from(document.querySelectorAll('h3')).some((el) => el.textContent?.trim() === 'Meta A'),
            goalBVisible: Array.from(document.querySelectorAll('h3')).some((el) => el.textContent?.trim() === 'Meta B'),
            budgetAVisible: Array.from(document.querySelectorAll('p')).some((el) => el.textContent?.trim() === 'Moradia'),
            budgetBVisible: Array.from(document.querySelectorAll('p')).some((el) => el.textContent?.trim() === 'Transporte'),
            budgetLoading: Array.from(document.querySelectorAll('[role=status]')).some((el) => el.textContent?.includes('Carregando orçamento')),
          };
        }), { once: true });
      });
    }

    async function closed(dialog) {
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => window.qa.closePoint !== null);
      await frame();
      const point = await page.evaluate(() => window.qa.closePoint);
      require(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
      return point;
    }

    async function scenario(name, domain, options, run) {
      try {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate(([d, t, opts]) => window.qa.mount(d, t, opts), [domain, theme, options]);
        if (options.goalsReadMode === 'fail-once' || options.budgetReadMode === 'fail-once') {
          await btn(page, 'Tentar novamente').waitFor();
        } else if (domain === 'goals') {
          await btn(page, 'Mais ações de Meta A').waitFor();
          await btn(page, 'Mais ações de Meta B').waitFor();
        } else {
          await btn(page, 'Ações do limite de Moradia').waitFor();
          await btn(page, 'Ações do limite de Transporte').waitFor();
        }
        const observation = await run();
        same(await page.evaluate(() => window.qa.unexpected), [], 'requisições inesperadas');
        same(errors, [], 'erros no DOM');
        same(rejected, [], 'rede não autorizada');
        results.push({ name, ...observation });
      } catch (error) {
        throw new Error(`${width}/${theme} ${name}: ${error.message}`);
      }
    }

    if (phase === 'core') {
      // 1. Testemunha do tema e viewport
      await scenario('testemunha do tema e viewport', 'goals', {}, async () => {
        await assertReflow('#fixture');
        const witness = await page.evaluate((selected) => {
          const outer = document.getElementById('fixture');
          const rendered = getComputedStyle(outer).backgroundColor;
          const tokenProbe = document.createElement('i');
          tokenProbe.style.backgroundColor = 'var(--background)';
          outer.appendChild(tokenProbe);
          const expected = getComputedStyle(tokenProbe).backgroundColor;
          tokenProbe.remove();
          if (!document.documentElement.classList.contains(selected) || rendered !== expected || ['transparent', 'rgba(0, 0, 0, 0)'].includes(rendered)) {
            throw new Error('CSS real de tema não aplicado');
          }
          return {
            width: window.innerWidth,
            theme: selected,
            background: rendered,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        }, theme);
        return { witness, violations: [] };
      });

      // 2. Metas: Tab -> Enter, Escape/Cancelar com retorno explícito + Retry por teclado
      await scenario('metas/Tab-Enter-Escape-Cancelar', 'goals', {}, async () => {
        const observations = [];
        const createTrigger = btn(page, 'Nova Meta');
        for (const how of ['Escape', 'Cancelar']) {
          await tabFromStartTo(createTrigger);
          const before = await createTrigger.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Nova Meta de Orçamento', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          observations.push({ origin: 'Nova Meta', how, matched: sameFocus(before, point.focus), focus: point.focus });
        }

        const menuTrigger = btn(page, 'Mais ações de Meta A');
        for (const how of ['Escape', 'Cancelar']) {
          await tabFromStartTo(menuTrigger);
          const before = await menuTrigger.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const editItem = page.getByRole('menuitem', { name: 'Editar', exact: true });
          await editItem.waitFor();
          await editItem.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Editar Meta', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          observations.push({ origin: 'Mais ações de Meta A', how, matched: sameFocus(before, point.focus), focus: point.focus });
        }

        same((await calls()).filter((c) => c.method !== 'GET'), [], 'Escape/Cancelar em Metas gravou');
        return {
          observations,
          violations: observations.some((o) => !o.matched) ? ['Metas não retornou foco à origem'] : [],
        };
      });

      await scenario('metas/retry-teclado', 'goals', { goalsReadMode: 'fail-once' }, async () => {
        const retryBtn = btn(page, 'Tentar novamente');
        await tabFromStartTo(retryBtn);
        await page.keyboard.press('Enter');
        await btn(page, 'Mais ações de Meta A').waitFor();
        const gets = (await calls()).filter((c) => c.method === 'GET' && c.url === '/api/budgets').length;
        same(gets, 2, 'retry de Metas não disparou segundo GET');
        return { gets, violations: [] };
      });

      // 3. Orçamento mensal: Tab -> Enter, Escape/Cancelar (paridade activeElement) + Retry por teclado
      await scenario('orcamento/Tab-Enter-Escape-Cancelar', 'budget', {}, async () => {
        const observations = [];
        const createTrigger = btn(page, 'Novo limite');
        for (const how of ['Escape', 'Cancelar']) {
          await tabFromStartTo(createTrigger);
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Novo Orçamento', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          observations.push({ origin: 'Novo limite', how, focus: point.focus });
        }

        const menuTrigger = btn(page, 'Ações do limite de Moradia');
        for (const how of ['Escape', 'Cancelar']) {
          await tabFromStartTo(menuTrigger);
          await page.keyboard.press('Enter');
          const editItem = page.getByRole('menuitem', { name: 'Editar', exact: true });
          await editItem.waitFor();
          await editItem.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Editar Orçamento', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          const validReturn = point.focus.connected && point.focus.focused && (
            point.focus.role === 'body'
            || (point.focus.role === 'button' && point.focus.name === 'Ações do limite de Moradia')
          );
          require(validReturn, `Orçamento ${how}: retorno de foco inesperado ${JSON.stringify(point.focus)}`);
          // Abertura via MenuItem em DropdownMenu fecha o menu em setTimeout(0) enquanto Dialog monta em useEffect.
          // Ambos baseline e candidate aceitam body ou o botão de origem conectado após fechar o diálogo.
          observations.push({ origin: 'Ações do limite de Moradia', how, validReturn });
        }

        same((await calls()).filter((c) => c.method !== 'GET'), [], 'Escape/Cancelar em Orçamento gravou');
        return { observations, violations: [] };
      });

      await scenario('orcamento/retry-teclado', 'budget', { budgetReadMode: 'fail-once' }, async () => {
        const retryBtn = btn(page, 'Tentar novamente');
        await tabFromStartTo(retryBtn);
        await page.keyboard.press('Enter');
        await btn(page, 'Ações do limite de Moradia').waitFor();
        const gets = (await calls()).filter((c) => c.method === 'GET' && c.url.startsWith('/api/monthly-budgets')).length;
        same(gets, 2, 'retry de Orçamento não disparou segundo GET');
        return { gets, violations: [] };
      });
    }

    if (phase === 'goals-writes') {
      // 4. Metas: 6 cenários de gravação (POST/PUT × http-json, transport, invalid-json)
      for (const method of ['POST', 'PUT']) {
        for (const failureMode of ['http-json', 'transport', 'invalid-json']) {
          await scenario(`metas/gravacao/${method}/${failureMode}`, 'goals', { writeMode: failureMode }, async () => {
            const isEdit = method === 'PUT';
            const opener = isEdit ? btn(page, 'Mais ações de Meta A') : btn(page, 'Nova Meta');
            await opener.focus();
            const beforeOpener = await opener.evaluate((node) => window.qa.focus(node));

            if (isEdit) {
              await opener.click();
              await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
            } else {
              await opener.click();
            }

            const dialog = page.getByRole('dialog', { name: isEdit ? 'Editar Meta' : 'Nova Meta de Orçamento', exact: true });
            await dialog.waitFor();
            await dialog.getByLabel('Nome da meta *', { exact: true }).fill('Rascunho Meta QA');
            await dialog.getByLabel('Valor alvo (R$) *', { exact: true }).fill('2500');

            const beforeCalls = (await calls()).length;
            await btn(dialog, isEdit ? 'Salvar Alterações' : 'Criar Meta').click();
            const expectedToast = failureMode === 'http-json' ? 'Falha HTTP sintética' : 'Erro de conexão';
            await page.locator('[data-sonner-toast][data-type=error]').filter({ hasText: expectedToast }).waitFor({ state: 'attached' });
            await frame();

            const openAfter = await dialog.isVisible();
            const draftName = await dialog.getByLabel('Nome da meta *', { exact: true }).inputValue();
            const draftTarget = await dialog.getByLabel('Valor alvo (R$) *', { exact: true }).inputValue();
            const trace = (await calls()).slice(beforeCalls).map((c) => [c.method, c.url]);

            require(openAfter, `Metas ${method}/${failureMode}: fechou diálogo`);
            same(draftName, 'Rascunho Meta QA', `Metas ${method}/${failureMode}: perdeu nome`);
            same(draftTarget, '2500', `Metas ${method}/${failureMode}: perdeu alvo`);
            same(trace, [[method, '/api/budgets']], `Metas ${method}/${failureMode}: disparou GET ou mais de um envio`);

            const focusOnError = await page.evaluate(() => window.qa.focus());
            await attachUnmountWatch(dialog);
            await btn(dialog, 'Cancelar').click();
            const closePoint = await closed(dialog);

            return {
              openAfter,
              draftName,
              draftTarget,
              trace,
              focusOnError,
              closeFocus: closePoint.focus,
              violations: sameFocus(beforeOpener, closePoint.focus) ? [] : ['Metas: Cancelar após erro não retornou à origem'],
            };
          });
        }
      }
    }

    if (phase === 'budget-writes') {
      // 5. Orçamento mensal: 6 cenários de gravação (POST/PUT × http-json, transport, invalid-json)
      for (const method of ['POST', 'PUT']) {
        for (const failureMode of ['http-json', 'transport', 'invalid-json']) {
          await scenario(`orcamento/gravacao/${method}/${failureMode}`, 'budget', { writeMode: failureMode }, async () => {
            const isEdit = method === 'PUT';
            const opener = isEdit ? btn(page, 'Ações do limite de Moradia') : btn(page, 'Novo limite');
            await opener.focus();

            if (isEdit) {
              await opener.click();
              await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
            } else {
              await opener.click();
            }

            const dialog = page.getByRole('dialog', { name: isEdit ? 'Editar Orçamento' : 'Novo Orçamento', exact: true });
            await dialog.waitFor();

            if (!isEdit) {
              await dialog.getByLabel('Categoria', { exact: true }).click();
              await page.getByRole('option', { name: 'Moradia', exact: true }).click();
            }
            await dialog.getByLabel('Valor do Limite (R$)', { exact: true }).fill('777');

            const beforeCalls = (await calls()).length;
            if (failureMode === 'http-json' && variant === 'baseline') {
              await attachUnmountWatch(dialog);
              await page.evaluate(() => { window.qa.budgetReadMode = 'hold'; });
            }

            await btn(dialog, isEdit ? 'Atualizar' : 'Criar').click();
            const expectedToast = failureMode === 'http-json'
              ? 'Falha HTTP sintética'
              : failureMode === 'invalid-json' && variant === 'candidate'
                ? (isEdit ? 'Erro ao atualizar' : 'Erro ao criar')
                : 'Erro de conexão';
            await page.locator('[data-sonner-toast][data-type=error]').filter({ hasText: expectedToast }).waitFor({ state: 'attached' });

            if (failureMode === 'http-json' && variant === 'baseline') {
              const closePoint = await closed(dialog);
              await page.waitForFunction(() => Boolean(window.qa.pending['read-budget']));
              const focusDuringPendingGet = await page.evaluate(() => window.qa.focus());
              await page.evaluate(() => window.qa.reply('read-budget', 'ok'));
              await btn(page, 'Ações do limite de Moradia').waitFor();
              await frame();
              const focusAfterGet = await page.evaluate(() => window.qa.focus());
              const trace = (await calls()).slice(beforeCalls).map((c) => [c.method, c.url.split('?')[0]]);
              same(trace, [[method, '/api/monthly-budgets'], ['GET', '/api/monthly-budgets']], `Orçamento ${method}/http-json: sequência esperada`);
              return {
                closedOnHttpJson: true,
                closeFocus: closePoint.focus,
                focusDuringPendingGet,
                focusAfterGet,
                trace,
                violations: [],
              };
            }

            await frame();
            const openAfter = await dialog.isVisible();
            const draftAmount = await dialog.getByLabel('Valor do Limite (R$)', { exact: true }).inputValue();
            const trace = (await calls()).slice(beforeCalls).map((c) => [c.method, c.url.split('?')[0]]);
            require(openAfter, `Orçamento ${method}/${failureMode}: fechou diálogo na falha`);
            same(draftAmount, '777', `Orçamento ${method}/${failureMode}: perdeu rascunho`);
            same(trace, [[method, '/api/monthly-budgets']], `Orçamento ${method}/${failureMode}: disparou GET na falha`);

            return {
              openAfter,
              draftAmount,
              trace,
              focusOnError: await page.evaluate(() => window.qa.focus()),
              violations: [],
            };
          });
        }
      }
    }

    if (phase === 'deletes') {
      // 6a. Metas DELETE fallback para Nova Meta quando activeElement cai em body após remoção
      await scenario('metas/exclusao/fallback', 'goals', { writeMode: 'hold' }, async () => {
        const menuTrigger = btn(page, 'Mais ações de Meta A');
        await menuTrigger.click();
        const beforeCalls = (await calls()).length;
        await page.evaluate(() => { window.qa.goalsReadMode = 'hold'; });
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        await page.waitForFunction(() => Boolean(window.qa.pending['write-goal-delete']));
        await page.evaluate(() => window.qa.reply('write-goal-delete', 'ok'));
        await page.waitForFunction(() => Boolean(window.qa.pending['read-goals']));
        const focusBeforeGet = await page.evaluate(() => window.qa.focus());
        await page.evaluate(() => window.qa.reply('read-goals', 'ok'));
        await btn(page, 'Mais ações de Meta A').waitFor({ state: 'detached' });
        await frame();
        const afterReadFocus = await page.evaluate(() => window.qa.focus());
        const trace = (await calls()).slice(beforeCalls).map((c) => [c.method, c.url]);
        same(trace, [['DELETE', '/api/budgets'], ['GET', '/api/budgets'], ['GET', '/api/categories']], 'Metas DELETE sequência');
        const violations = afterReadFocus.name === 'Nova Meta' && afterReadFocus.focused && afterReadFocus.connected
          ? []
          : ['Metas DELETE não restaurou fallback Nova Meta'];
        return { focusBeforeGet, afterReadFocus, trace, violations };
      });

      // 6b. Metas DELETE não rouba foco de outro controle sobrevivente
      await scenario('metas/exclusao/foco-sobrevivente', 'goals', { writeMode: 'hold' }, async () => {
        const menuTrigger = btn(page, 'Mais ações de Meta A');
        await menuTrigger.click();
        await page.evaluate(() => { window.qa.goalsReadMode = 'hold'; });
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        await page.waitForFunction(() => Boolean(window.qa.pending['write-goal-delete']));
        await page.evaluate(() => window.qa.reply('write-goal-delete', 'ok'));
        await page.waitForFunction(() => Boolean(window.qa.pending['read-goals']));

        const surviving = btn(page, 'Controle sobrevivente');
        await surviving.focus();
        const beforeSurviving = await surviving.evaluate((node) => window.qa.focus(node));
        await page.evaluate(() => window.qa.reply('read-goals', 'ok'));
        await btn(page, 'Mais ações de Meta B').waitFor();
        await btn(page, 'Mais ações de Meta A').waitFor({ state: 'detached' });
        await frame();
        const afterSurviving = await page.evaluate(() => window.qa.focus());

        const violations = sameFocus(beforeSurviving, afterSurviving)
          ? []
          : ['Metas DELETE roubou foco de controle sobrevivente'];
        return { beforeSurviving, afterSurviving, violations };
      });

      // 6c. Orçamento mensal DELETE: AlertDialog fecha após DELETE OK, troca query para loading antes de GET remover A
      await scenario('orcamento/exclusao/fechamento-e-releitura', 'budget', { writeMode: 'hold' }, async () => {
        const menuTrigger = btn(page, 'Ações do limite de Moradia');
        await menuTrigger.click();
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        const alertDialog = page.getByRole('alertdialog', { name: 'Excluir orçamento?', exact: true });
        await alertDialog.waitFor();
        await attachUnmountWatch(alertDialog);

        const beforeCalls = (await calls()).length;
        await page.evaluate(() => { window.qa.budgetReadMode = 'hold'; });
        await btn(alertDialog, 'Excluir').click();
        await page.waitForFunction(() => Boolean(window.qa.pending['write-budget-delete']));
        require(await alertDialog.isVisible(), 'DELETE pendente fechou confirmação do Orçamento');
        require(await btn(alertDialog, 'Excluir').isDisabled(), 'Excluir não ficou desabilitado durante DELETE');
        const pendingFocus = await page.evaluate(() => window.qa.focus());

        await page.evaluate(() => window.qa.reply('write-budget-delete', 'ok'));
        const closePoint = await closed(alertDialog);
        await page.waitForFunction(() => Boolean(window.qa.pending['read-budget']));
        require(closePoint.budgetLoading && !closePoint.budgetAVisible, `Query não trocou para loading no fechamento: ${JSON.stringify(closePoint)}`);
        const focusWhileLoading = await page.evaluate(() => window.qa.focus());

        await page.evaluate(() => window.qa.reply('read-budget', 'ok'));
        await btn(page, 'Ações do limite de Transporte').waitFor();
        await frame();
        const focusAfterRead = await page.evaluate(() => window.qa.focus());
        require(await btn(page, 'Ações do limite de Moradia').count() === 0, 'Moradia ainda presente após GET');
        const trace = (await calls()).slice(beforeCalls).map((c) => [c.method, c.url.split('?')[0]]);
        same(trace, [['DELETE', '/api/monthly-budgets'], ['GET', '/api/monthly-budgets']], 'Orçamento DELETE sequência');

        return {
          pendingFocus,
          closePoint,
          focusWhileLoading,
          focusAfterRead,
          trace,
          violations: [],
        };
      });
    }

    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1',
  'Forneça scratch privado e CI=1 no sandbox aprovado; não execute no host.');
for (const spec of baselineSpecs) {
  assert(isAbsolute(process.env[spec.env] ?? ''),
    `Forneça ${spec.env} absoluto com a fonte RO do ref ${baseRef}`);
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
const baselineContents = {};
for (const spec of baselineSpecs) {
  const contents = await readFile(process.env[spec.env], 'utf8');
  assert.equal(digest(contents), spec.hash, `SHA-256 inválido em ${spec.env} (${spec.file})`);
  baselineContents[spec.file] = contents;
}

const dir = await mkdtemp(join(scratch, 'quiet-goals-widgets-'));
const session = `quiet-goals-widgets-${randomUUID()}`;
const failures = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 420_000;

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

  const entry = `import { BudgetGoalsWidget } from ${JSON.stringify(goalsPath)};
    import { MonthlyBudgetTracker } from ${JSON.stringify(budgetPath)};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    (${installFixture.toString()})(BudgetGoalsWidget, MonthlyBudgetTracker, createElement, createRoot, ThemeProvider, Toaster);`;

  async function htmlFor(label, useBaseline) {
    let interceptedGoals = false;
    let interceptedBudget = false;
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-goals-widgets',
        setup(build) {
          build.onLoad({ filter: /quiet-goals-widgets\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad({ filter: /\/budget-goals\.tsx$/ }, (args) => {
              if (args.path !== goalsPath) return undefined;
              interceptedGoals = true;
              return { contents: baselineContents['budget-goals.tsx'], loader: 'tsx' };
            });
            build.onLoad({ filter: /\/monthly-budget-tracker\.tsx$/ }, (args) => {
              if (args.path !== budgetPath) return undefined;
              interceptedBudget = true;
              return { contents: baselineContents['monthly-budget-tracker.tsx'], loader: 'tsx' };
            });
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) {
      assert(interceptedGoals, 'Baseline não interceptou budget-goals.tsx');
      assert(interceptedBudget, 'Baseline não interceptou monthly-budget-tracker.tsx');
    }
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      file,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return file;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {
    'budget-goals.tsx': digest(await readFile(goalsPath)),
    'budget-goal-editor.tsx': digest(await readFile(goalEditorPath)),
    'monthly-budget-tracker.tsx': digest(await readFile(budgetPath)),
    'monthly-budget-editor.tsx': digest(await readFile(budgetEditorPath)),
    'finance-dialog-shell.tsx': digest(await readFile(shellPath)),
  };
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  let count = 0;

  async function runPhase(width, theme, phase, expectedCount) {
    const observed = {};
    for (const label of ['baseline', 'candidate']) {
      const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(phase)}, ${JSON.stringify(label)})`);
      const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
      assert(result, `${label}/${phase}: ausência de resultado do DOM`);
      observed[label] = JSON.parse(result);
      assert.equal(observed[label].length, expectedCount, `${label}/${phase}: cenário incompleto (${observed[label].length} vs ${expectedCount})`);
    }

    count += observed.candidate.length;
    console.log(JSON.stringify({ session, baseRef, width, theme, phase, scenarios: observed.candidate.length }));

    const isLegacyBudgetHttpDefect = (entry) =>
      phase === 'budget-writes' && /^orcamento\/gravacao\/(POST|PUT)\/http-json$/.test(entry?.name ?? '');
    const parityBaseline = observed.baseline.filter((entry) => !isLegacyBudgetHttpDefect(entry));
    const parityCandidate = observed.candidate.filter((entry) => !isLegacyBudgetHttpDefect(entry));
    if (!Bun.deepEquals(parityBaseline, parityCandidate)) {
      const mismatched = parityCandidate
        .filter((entry, idx) => !Bun.deepEquals(parityBaseline[idx], entry))
        .map((entry) => entry?.name ?? '?');
      gaps.push(`${width}/${theme}/${phase}: divergência de paridade (${mismatched.join(', ')})`);
    }

    for (const entryResult of observed.candidate) {
      const baseEntry = observed.baseline.find(({ name }) => name === entryResult.name);
      for (const violation of entryResult.violations) {
        gaps.push(`${width}/${theme} ${entryResult.name}: ${baseEntry?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
      }
    }

    return observed;
  }

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = await runPhase(width, theme, 'core', 5);
      const witness = observed.candidate.find(({ name }) => name === 'testemunha do tema e viewport')?.witness;
      assert(witness && witness.width === width && witness.theme === theme && !witness.overflow, `Testemunha inválida em ${width}/${theme}`);
      backgrounds.push(witness.background);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  for (const [width, theme] of [[390, 'light'], [1440, 'dark']]) {
    await runPhase(width, theme, 'goals-writes', 6);
    await runPhase(width, theme, 'budget-writes', 6);
    await runPhase(width, theme, 'deletes', 3);
  }

  assert.deepEqual(gaps, [], 'Falha no contrato Quiet/paridade');
  console.log(`${count} cenários pareados; 0 skips.`);
} catch (error) {
  failures.push(error);
} finally {
  const cleanup = async (label, action) => {
    try { await action(); } catch (error) { failures.push(new Error(`${label}: ${error.message}`, { cause: error })); }
  };
  if (attemptedOpen) {
    const beforeCleanup = failures.length;
    await cleanup('close', async () => {
      const closed = JSON.parse(await cli('close', '--json'));
      assert.equal(closed.session, session);
      assert.equal(closed.status, 'closed', 'Fechamento da sessão não comprovado');
    });
    await cleanup('list', async () => {
      const { browsers } = JSON.parse(await cli('list', '--json'));
      assert(Array.isArray(browsers) && !browsers.some(({ name }) => name === session), 'Sessão ainda ativa');
    });
    await cleanup('daemon', async () => {
      assert(Number.isInteger(daemonPid), 'PID não observado ao abrir');
      for (let attempt = 0; attempt < 20; attempt++) {
        try { await access(`/proc/${daemonPid}`); } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        await delay(50);
      }
      throw new Error('Daemon ainda presente');
    });
    if (failures.length === beforeCleanup) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}

if (failures.length) throw new AggregateError(failures, 'QA de Metas e Orçamento não concluído');
