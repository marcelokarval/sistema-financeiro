// Execute somente dentro do preflight de navegador de 0015. O executor prova
// a fronteira do SO, não este script. Disponibilize QUIET_QA_SCRATCH (tmpfs privado)
// e as 2 fontes RO do ref 0e457d178fb83b9b472eb34e0a56eb55facb4c04:
// QUIET_QA_BASELINE_INSTALLMENTS e QUIET_QA_BASELINE_SAVINGS.
// Não monte .git, o checkout inteiro, HOME do host, .env ou banco.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '0e457d178fb83b9b472eb34e0a56eb55facb4c04';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_INSTALLMENTS',
    file: 'installments-view.tsx',
    hash: 'cf2260034a138edc1ee7a16dc0bb9cedaeac38dcfe0a51efb93146f13036243e',
  },
  {
    env: 'QUIET_QA_BASELINE_SAVINGS',
    file: 'savings-view.tsx',
    hash: '5815571e6651ff31d0d9458eafcde99d87449eb65f2243050b349bef31e90e66',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const installmentsViewPath = join(financeDir, 'installments-view.tsx');
const savingsViewPath = join(financeDir, 'savings-view.tsx');

function installFixture(InstallmentsView, SavingsView, createElement, createRoot, ThemeProvider, Toaster) {
  const initialPlans = ['a', 'b'].map((id) => ({
    id,
    description: `Plano ${id.toUpperCase()}`,
    type: 'FINANCING',
    totalAmount: 1000,
    installmentCount: 2,
    monthlyValue: 500,
    paidInstallments: 0,
    interestRate: 0,
    startDate: '2026-05-01T12:00:00.000Z',
    status: 'ACTIVE',
    cardId: null,
    categoryId: null,
    card: null,
    category: null,
    installments: [
      {
        id: `${id}-1`,
        installmentPlanId: id,
        number: 1,
        amount: 500,
        status: 'PENDING',
        dueDate: '2026-05-01T12:00:00.000Z',
        paidDate: null,
      },
      {
        id: `${id}-2`,
        installmentPlanId: id,
        number: 2,
        amount: 500,
        status: 'PENDING',
        dueDate: '2026-06-01T12:00:00.000Z',
        paidDate: null,
      },
    ],
  }));

  const initialGoals = ['a', 'b'].map((id) => ({
    id,
    name: `Meta ${id.toUpperCase()}`,
    type: 'EMERGENCY_FUND',
    description: `Descrição ${id.toUpperCase()}`,
    targetAmount: 1000,
    currentAmount: id === 'a' ? 200 : 400,
    monthlyContribution: 50,
    yieldRate: 2.5,
    targetDate: '2027-03-05T00:00:00.000Z',
    accountId: 'acc-1',
    color: '#10b981',
    isCompleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    account: { id: 'acc-1', name: 'Conta sintética' },
  }));

  const qa = window.qa = {
    calls: [],
    pending: {},
    unexpected: [],
    closePoint: null,
    mode: null,
    readReleased: false,
    writeSettled: false,
  };

  let planDeleted = false;
  let planDetailReads = 0;
  let plansCreated = [];
  let goalDeleted = false;
  let goalUpdated = false;
  let goalDeposited = false;

  const held = (label) => new Promise((resolve, reject) => { qa.pending[label] = { resolve, reject }; });
  const currentPlans = () => [
    ...plansCreated,
    ...initialPlans.filter(({ id }) => !planDeleted || id !== 'a').map(({ installments: _inst, ...summary }) => ({
      ...summary,
      _count: { installments: 2 },
    })),
  ];
  const currentGoals = () => initialGoals
    .filter(({ id }) => !goalDeleted || id !== 'a')
    .map((g) => {
      if (g.id !== 'a') return g;
      return {
        ...g,
        ...(goalUpdated ? { name: 'Meta A editada', description: '' } : {}),
        ...(goalDeposited ? { currentAmount: 250 } : {}),
      };
    });

  qa.reply = (label, outcome) => {
    const slot = qa.pending[label];
    if (!slot) throw new Error(`Sem resposta pendente: ${label}`);
    delete qa.pending[label];
    if (outcome === 'transport') return slot.reject(new Error('Rejeição sintética'));
    if (outcome === 'http') return slot.resolve(Response.json({ error: 'Falha sintética' }, { status: 503 }));
    if (label === 'write') {
      qa.writeSettled = true;
      if (qa.mode?.startsWith('delete-goal')) goalDeleted = true;
      if (qa.mode?.startsWith('delete-plan')) planDeleted = true;
      return slot.resolve(Response.json({ success: true }, { status: 200 }));
    }
    if (label === 'detail') {
      return slot.resolve(Response.json(initialPlans[0]));
    }
    if (label === 'read-plans') {
      qa.readReleased = true;
      return slot.resolve(Response.json(currentPlans()));
    }
    if (label === 'read-goals') {
      qa.readReleased = true;
      return slot.resolve(Response.json(currentGoals()));
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

    if (url === '/api/cards') return Response.json([]);
    if (url === '/api/categories') return Response.json([]);
    if (url === '/api/accounts') return Response.json([{ id: 'acc-1', name: 'Conta sintética' }]);

    // Parcelas
    if (url === '/api/installments' && method === 'GET') {
      if (planDeleted && qa.mode === 'delete-plan-late') return held('read-plans');
      if (planDeleted) qa.readReleased = true;
      return Response.json(currentPlans());
    }
    if (url === '/api/installments?id=a' && method === 'GET') {
      planDetailReads++;
      if (planDetailReads > 1 && qa.mode === 'hold-detail-refresh') {
        return held('detail');
      }
      return Response.json(initialPlans[0]);
    }
    if (url === '/api/installments/pay' && method === 'POST') {
      return Response.json({ ok: true });
    }
    if (url === '/api/installments' && method === 'POST') {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'transport') throw new Error('Rejeição sintética');
      const created = {
        id: 'c',
        description: 'Plano C',
        type: 'FINANCING',
        totalAmount: 600,
        installmentCount: 2,
        monthlyValue: 300,
        paidInstallments: 0,
        interestRate: 0,
        startDate: '2026-05-01T12:00:00.000Z',
        status: 'ACTIVE',
        cardId: null,
        categoryId: null,
        _count: { installments: 2 },
      };
      plansCreated = [created];
      return Response.json(created, { status: 201 });
    }
    if (url === '/api/installments' && method === 'DELETE') {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'delete-plan-late') return held('write');
      planDeleted = true;
      qa.writeSettled = true;
      return Response.json({ success: true });
    }

    // Caixinhas
    if (url === '/api/savings' && method === 'GET') {
      if (goalDeleted && qa.mode === 'delete-goal-late') return held('read-goals');
      if (goalDeleted) qa.readReleased = true;
      return Response.json(currentGoals());
    }
    if (url === '/api/savings' && ['POST', 'PUT'].includes(method)) {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'transport') throw new Error('Rejeição sintética');
      goalUpdated = true;
      return Response.json({ ...initialGoals[0], name: 'Meta A editada', description: '' });
    }
    if (url === '/api/savings/deposit' && method === 'POST') {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'transport') throw new Error('Rejeição sintética');
      goalDeposited = true;
      return Response.json({ ...initialGoals[0], currentAmount: 250 });
    }
    if (url === '/api/savings' && method === 'DELETE') {
      if (qa.mode === 'delete-goal-hold') return held('write');
      if (qa.mode === 'delete-goal-late') return held('write');
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      goalDeleted = true;
      qa.writeSettled = true;
      return Response.json({ success: true });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Requisição inesperada na fixture: ${method} ${url}`);
  };

  qa.mount = (domain, theme) => {
    planDeleted = false;
    planDetailReads = 0;
    plansCreated = [];
    goalDeleted = false;
    goalUpdated = false;
    goalDeposited = false;
    qa.calls = [];
    qa.pending = {};
    qa.unexpected = [];
    qa.closePoint = null;
    qa.mode = null;
    qa.readReleased = false;
    qa.writeSettled = false;

    const View = domain === 'installments' ? InstallmentsView : SavingsView;
    createRoot(document.getElementById('root')).render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          'main',
          { className: 'min-h-screen bg-background p-3', id: 'fixture' },
          createElement(View),
          createElement(Toaster, { theme }),
        ),
      ),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button'
      : /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName.toLowerCase() ?? null),
    id: node?.id || null,
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

// Serializado pelo CLI no sandbox. Não depende de globals Node na VM.
async function runCases(page, html, width, theme, phase) {
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
    const heading = (name) => page.getByRole('heading', { name, exact: true });
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
    const tabTo = async (origin, target) => {
      await origin.focus();
      for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Tab');
        if (await focused(target)) {
          require(await visibleFocus(target), 'Ação alcançada por Tab sem foco visível');
          return;
        }
      }
      throw new Error('Tab não alcançou a ação');
    };

    async function attachUnmountWatch(dialog, extraEval) {
      await dialog.evaluate((portal) => {
        window.qa.closePoint = null;
        portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
          window.qa.closePoint = {
            focus: window.qa.focus(),
            portalConnected: portal.isConnected,
            readReleased: window.qa.readReleased,
            writeSettled: window.qa.writeSettled,
            pendingWrite: !!window.qa.pending.write,
            pendingRead: !!(window.qa.pending['read-goals'] || window.qa.pending['read-plans']),
            aGoalInList: !!Array.from(document.querySelectorAll('h4')).find((el) => el.textContent?.trim() === 'Meta A'),
            bGoalInList: !!Array.from(document.querySelectorAll('h4')).find((el) => el.textContent?.trim() === 'Meta B'),
            aPlanInList: !!document.getElementById('plan-row-a'),
            bPlanInList: !!document.getElementById('plan-row-b'),
          };
        }), { once: true });
      });
      if (extraEval) await extraEval();
    }

    async function closed(dialog) {
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => window.qa.closePoint !== null);
      await frame();
      const point = await page.evaluate(() => window.qa.closePoint);
      require(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
      return point;
    }

    async function scenario(name, domain, run) {
      try {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate(([selectedDomain, selectedTheme]) => window.qa.mount(selectedDomain, selectedTheme), [domain, theme]);
        if (domain === 'installments') {
          await btn(page, 'Abrir plano: Plano A').waitFor();
          await btn(page, 'Abrir plano: Plano B').waitFor();
        } else {
          await btn(page, 'Depositar em Meta A').waitFor();
          await btn(page, 'Depositar em Meta B').waitFor();
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

    if (phase === 'parcelas') {
      // 1. Testemunha do tema e viewport
      await scenario('testemunha do tema e viewport', 'installments', async () => {
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

      // 2. Parcelas criação: Tab / Escape / Cancelar + falhas HTTP/transporte + sucesso
      await scenario('parcelas/criacao/cancelamento-falhas-sucesso', 'installments', async () => {
        const opener = btn(page, 'Novo plano');
        const points = [];
        for (const how of ['Escape', 'Cancelar']) {
          await opener.focus();
          const before = await opener.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Novo Plano de Parcelas', exact: true });
          await dialog.waitFor();
          same(await page.locator('[role=alertdialog]').count(), 0, 'papel incorreto');
          same(await dialog.getByRole('button', { name: 'Fechar formulário', exact: true }).count(), 1, 'saída superior nomeada ausente');
          await assertReflow('[role=dialog]');
          await page.keyboard.press('Tab');
          require(await dialog.evaluate((node) => node.contains(document.activeElement)), 'Tab escapou da casca modal');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          points.push({ how, matched: sameFocus(before, point.focus), focus: point.focus });
        }
        same((await calls()).filter((c) => c.method !== 'GET'), [], 'Escape/Cancelar gravou');

        // Falha HTTP e transporte preservam diálogo aberto e rascunho sem GET de sucesso
        await opener.click();
        const dialog = page.getByRole('dialog', { name: 'Novo Plano de Parcelas', exact: true });
        await dialog.waitFor();
        await dialog.getByLabel('Descrição', { exact: true }).fill('Plano C');
        await dialog.getByLabel('Valor Total (R$)', { exact: true }).fill('600');
        await dialog.getByLabel('Nº de Parcelas', { exact: true }).fill('2');
        for (const mode of ['http', 'transport']) {
          const beforeWrites = (await calls()).length;
          await page.evaluate((m) => { window.qa.mode = m; }, mode);
          await btn(dialog, 'Criar Plano').click();
          await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
          require(await dialog.isVisible(), `POST ${mode}: fechou diálogo`);
          same(await dialog.getByLabel('Descrição', { exact: true }).inputValue(), 'Plano C', `POST ${mode}: perdeu rascunho`);
          same((await calls()).slice(beforeWrites).map((c) => [c.method, c.url]), [['POST', '/api/installments']], `POST ${mode}: disparou GET`);
        }

        // Sucesso fecha diálogo e retorna foco ao acionador
        await page.evaluate(() => { window.qa.mode = null; });
        await attachUnmountWatch(dialog);
        await btn(dialog, 'Criar Plano').click();
        const okClose = await closed(dialog);
        await btn(page, 'Abrir plano: Plano C').waitFor();
        const afterRead = await page.evaluate(() => window.qa.focus());
        const openerFocus = await opener.evaluate((node) => window.qa.focus(node));
        const violations = (points.some((p) => !p.matched) || !sameFocus(openerFocus, okClose.focus) || !sameFocus(openerFocus, afterRead))
          ? ['foco não retornou ao acionador Novo plano']
          : [];
        return { points, okClose, afterRead, violations };
      });

      // 3. Parcelas: plano confirmado mantém Excluir focável (Tab) e bloqueado (aria-disabled, Enter não abre/muta) durante releitura e erro
      await scenario('parcelas/detalhe/confirmed-refresh-error', 'installments', async () => {
        await btn(page, 'Abrir plano: Plano A').click();
        await heading('Plano A').waitFor();
        await btn(page, 'Excluir plano').waitFor();
        await btn(page, 'Pagar parcela 1 de 2').waitFor();

        // Iniciar pagamento com refresh do detalhe retido
        await page.evaluate(() => { window.qa.mode = 'hold-detail-refresh'; });
        await btn(page, 'Pagar parcela 1 de 2').click();
        await page.waitForFunction(() => Boolean(window.qa.pending.detail));

        const backBtn = btn(page, 'Voltar aos planos');
        const deleteBtn = btn(page, 'Excluir plano');
        await tabTo(backBtn, deleteBtn);
        same(await deleteBtn.getAttribute('aria-disabled'), 'true', 'Excluir não ficou aria-disabled durante releitura');
        same(await page.locator('[aria-labelledby="plan-entries-title"]').count(), 0, 'detalhe antigo visível durante releitura');
        const callsBeforeEnter = (await calls()).length;
        await page.keyboard.press('Enter');
        await frame();
        same(await page.locator('[role=alertdialog]').count(), 0, 'Enter abriu confirmação durante releitura');
        same((await calls()).length, callsBeforeEnter, 'Enter disparou mutação durante releitura');

        // Liberar refresh do detalhe com erro 503
        await page.evaluate(() => window.qa.reply('detail', 'http'));
        await page.getByText('Não foi possível carregar os detalhes do plano.', { exact: true }).waitFor();
        await tabTo(backBtn, deleteBtn);
        same(await deleteBtn.getAttribute('aria-disabled'), 'true', 'Excluir não ficou aria-disabled após erro');
        same(await page.locator('[aria-labelledby="plan-entries-title"]').count(), 0, 'detalhe antigo visível após erro');
        const callsBeforeErrorEnter = (await calls()).length;
        await page.keyboard.press('Enter');
        await frame();
        same(await page.locator('[role=alertdialog]').count(), 0, 'Enter abriu confirmação após erro');
        same((await calls()).length, callsBeforeErrorEnter, 'Enter disparou mutação após erro');
        return { ariaDisabled: 'true', violations: [] };
      });

      // 4. Parcelas: exclusão no detalhe (Cancelar/Escape, 503, sucesso com GET retido)
      await scenario('parcelas/detalhe/exclusao', 'installments', async () => {
        await btn(page, 'Abrir plano: Plano A').click();
        await heading('Plano A').waitFor();
        const opener = btn(page, 'Excluir plano');
        const cancelPoints = [];
        for (const how of ['Escape', 'Cancelar']) {
          await opener.focus();
          const before = await opener.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('alertdialog', { name: 'Excluir plano', exact: true });
          await dialog.waitFor();
          same(await page.locator('[role=dialog]').count(), 0, 'papel incorreto');
          await assertReflow('[role=alertdialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          cancelPoints.push({ how, matched: sameFocus(before, point.focus), focus: point.focus });
        }

        // Falha 503 mantém alerta aberto sem GET
        await opener.click();
        const dialog = page.getByRole('alertdialog', { name: 'Excluir plano', exact: true });
        await dialog.waitFor();
        const beforeHttp = (await calls()).length;
        await page.evaluate(() => { window.qa.mode = 'http'; });
        await btn(dialog, 'Excluir').click();
        await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
        require(await dialog.isVisible(), 'DELETE 503 fechou alerta');
        same((await calls()).slice(beforeHttp).map((c) => [c.method, c.url]), [['DELETE', '/api/installments']], 'DELETE 503 disparou GET');

        // Sucesso com DELETE + GET retido -> fecha e foca #installments-title antes e depois do GET
        await page.evaluate(() => { window.qa.mode = 'delete-plan-late'; });
        await attachUnmountWatch(dialog);
        await btn(dialog, 'Excluir').click();
        await page.waitForFunction(() => Boolean(window.qa.pending.write));
        require(await dialog.isVisible(), 'DELETE pendente fechou alerta antes do servidor');
        await page.evaluate(() => window.qa.reply('write', 'ok'));
        const closePoint = await closed(dialog);
        await page.waitForFunction(() => Boolean(window.qa.pending['read-plans']));
        const focusBeforeGet = await page.evaluate(() => window.qa.focus());
        await page.evaluate(() => window.qa.reply('read-plans', 'ok'));
        await btn(page, 'Abrir plano: Plano A').waitFor({ state: 'detached' });
        await btn(page, 'Abrir plano: Plano B').waitFor();
        await frame();
        const focusAfterGet = await page.evaluate(() => window.qa.focus());
        const violations = [];
        if (cancelPoints.some((p) => !p.matched)) violations.push('cancelamento de exclusão não retornou à origem');
        if (closePoint.focus.id !== 'installments-title' || focusBeforeGet.id !== 'installments-title' || focusAfterGet.id !== 'installments-title') {
          violations.push('foco pós-exclusão não permaneceu em #installments-title');
        }
        return { cancelPoints, closeFocus: closePoint.focus, focusBeforeGet, focusAfterGet, violations };
      });
    }

    if (phase === 'caixinhas-dialogs') {
      // 5. Caixinhas: Cancelar / Escape de edição, aporte, criação e alerta de exclusão sem gravação + retorno
      await scenario('caixinhas/Cancel-Escape', 'savings', async () => {
        const points = [];
        // Criação (#savings-create)
        const createBtn = btn(page, 'Nova meta');
        for (const how of ['Escape', 'Cancelar']) {
          await createBtn.focus();
          const before = await createBtn.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Nova Meta de Poupança', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          points.push({ action: 'Criar', how, matched: sameFocus(before, point.focus), focus: point.focus });
        }

        // Aporte direto (Depositar em Meta A)
        const depositBtn = btn(page, 'Depositar em Meta A');
        for (const how of ['Escape', 'Cancelar']) {
          await depositBtn.focus();
          const before = await depositBtn.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Depositar', exact: true });
          await dialog.waitFor();
          await assertReflow('[role=dialog]');
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          points.push({ action: 'Depositar', how, matched: sameFocus(before, point.focus), focus: point.focus });
        }

        // Edição e Exclusão pelo menu (Mais ações de Meta A)
        const menuBtn = btn(page, 'Mais ações de Meta A');
        for (const [item, role, title] of [
          ['Editar', 'dialog', 'Editar Meta'],
          ['Excluir', 'alertdialog', 'Excluir meta de poupança?'],
        ]) {
          for (const how of ['Escape', 'Cancelar']) {
            await menuBtn.focus();
            const before = await menuBtn.evaluate((node) => window.qa.focus(node));
            await page.keyboard.press('Enter');
            await page.getByRole('menuitem', { name: item, exact: true }).click();
            const dialog = page.getByRole(role, { name: title, exact: true });
            await dialog.waitFor();
            await assertReflow(`[role=${role}]`);
            await attachUnmountWatch(dialog);
            if (how === 'Escape') await page.keyboard.press('Escape');
            else await btn(dialog, 'Cancelar').click();
            const point = await closed(dialog);
            points.push({ action: item, how, matched: sameFocus(before, point.focus), focus: point.focus });
          }
        }
        same((await calls()).filter((c) => c.method !== 'GET'), [], 'Escape/Cancelar em Caixinhas gravou');
        return { points, violations: points.some((p) => !p.matched) ? ['cancelamento não retornou à origem'] : [] };
      });

      // 6. Caixinhas: editores (PUT edição e POST aporte) em HTTP não OK/transporte e sucesso
      await scenario('caixinhas/editores-falhas-e-sucesso', 'savings', async () => {
        const menuBtn = btn(page, 'Mais ações de Meta A');
        await menuBtn.click();
        await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
        const editDialog = page.getByRole('dialog', { name: 'Editar Meta', exact: true });
        await editDialog.waitFor();
        await editDialog.getByLabel('Nome da meta *', { exact: true }).fill('Meta A editada');
        await editDialog.getByLabel('Descrição', { exact: true }).fill('   ');

        for (const mode of ['http', 'transport']) {
          const before = (await calls()).length;
          await page.evaluate((m) => { window.qa.mode = m; }, mode);
          await btn(editDialog, 'Salvar Alterações').click();
          await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
          require(await editDialog.isVisible(), `PUT ${mode}: fechou editor`);
          same(await editDialog.getByLabel('Nome da meta *', { exact: true }).inputValue(), 'Meta A editada', `PUT ${mode}: perdeu rascunho`);
          same((await calls()).slice(before).map((c) => [c.method, c.url]), [['PUT', '/api/savings']], `PUT ${mode}: disparou GET`);
        }

        await page.evaluate(() => { window.qa.mode = null; });
        await attachUnmountWatch(editDialog);
        await btn(editDialog, 'Salvar Alterações').click();
        const editClose = await closed(editDialog);
        await page.getByRole('heading', { name: 'Meta A editada', exact: true }).waitFor();

        // Aporte com falha HTTP e sucesso
        const depositBtn = btn(page, 'Depositar em Meta A editada');
        await depositBtn.click();
        const depositDialog = page.getByRole('dialog', { name: 'Depositar', exact: true });
        await depositDialog.waitFor();
        await depositDialog.getByLabel('Valor do depósito (R$) *', { exact: true }).fill('50');
        const beforeDeposit = (await calls()).length;
        await page.evaluate(() => { window.qa.mode = 'http'; });
        await btn(depositDialog, 'Depositar').click();
        await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
        require(await depositDialog.isVisible(), 'Depositar HTTP 503 fechou diálogo');
        same(await depositDialog.getByLabel('Valor do depósito (R$) *', { exact: true }).inputValue(), '50', 'Depositar HTTP 503 perdeu valor');
        same((await calls()).slice(beforeDeposit).map((c) => [c.method, c.url]), [['POST', '/api/savings/deposit']], 'Depositar HTTP 503 disparou GET');

        await page.evaluate(() => { window.qa.mode = null; });
        await attachUnmountWatch(depositDialog);
        await btn(depositDialog, 'Depositar').click();
        const depositClose = await closed(depositDialog);
        const violations = (editClose.focus.name !== 'Mais ações de Meta A editada' && editClose.focus.name !== 'Mais ações de Meta A')
          || !depositClose.focus.connected
          ? ['foco não retornou à origem nos editores de Caixinhas']
          : [];
        return { editClose: editClose.focus, depositClose: depositClose.focus, violations };
      });
    }

    if (phase === 'caixinhas-exclusao') {
      // 7. Caixinhas exclusão: DELETE pendente -> Action fecha alerta -> DELETE OK com GET pendente -> GET sem A
      await scenario('caixinhas/exclusao/late', 'savings', async () => {
        const menuBtn = btn(page, 'Mais ações de Meta A');
        await menuBtn.focus();
        const before = await menuBtn.evaluate((node) => window.qa.focus(node));
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        const dialog = page.getByRole('alertdialog', { name: 'Excluir meta de poupança?', exact: true });
        await dialog.waitFor();
        await attachUnmountWatch(dialog);
        await page.evaluate(() => { window.qa.mode = 'delete-goal-late'; });

        const offset = (await calls()).length;
        await btn(dialog, 'Excluir').click();
        // Radix Action fecha o alerta imediatamente mesmo com DELETE pendente!
        const closePoint = await closed(dialog);
        await page.waitForFunction(() => Boolean(window.qa.pending.write));
        require(closePoint.pendingWrite && !closePoint.writeSettled && closePoint.aGoalInList, `Fechamento não ocorreu com DELETE pendente: ${JSON.stringify(closePoint)}`);

        // Liberar DELETE OK mantendo GET pendente
        await page.evaluate(() => window.qa.reply('write', 'ok'));
        await page.waitForFunction(() => Boolean(window.qa.pending['read-goals']));
        const whileReadPending = await page.evaluate(() => ({
          focus: window.qa.focus(),
          aGoalInList: !!Array.from(document.querySelectorAll('h4')).find((el) => el.textContent?.trim() === 'Meta A'),
        }));
        require(whileReadPending.aGoalInList, 'A foi removida antes de liberar GET');

        // Liberar GET sem A e capturar foco novamente
        await page.evaluate(() => window.qa.reply('read-goals', 'ok'));
        await btn(page, 'Depositar em Meta A').waitFor({ state: 'detached' });
        await btn(page, 'Depositar em Meta B').waitFor();
        await frame();
        const afterReadFocus = await page.evaluate(() => window.qa.focus());
        const trace = (await calls()).slice(offset).map(({ method, url: u, body }) => ({ method, url: u, ...(body ? { body } : {}) }));
        same(trace, [{ method: 'DELETE', url: '/api/savings', body: { id: 'a' } }, { method: 'GET', url: '/api/savings' }], 'sequência DELETE+GET');

        const violations = [];
        if (!sameFocus(before, closePoint.focus)) violations.push('fechamento sem origem conectada');
        if (!afterReadFocus.connected || !afterReadFocus.focused || afterReadFocus.role === 'body') {
          violations.push('foco não sobreviveu à remoção da linha');
        }
        return { before, closePoint: closePoint.focus, whileReadPending, afterReadFocus, violations };
      });

      // 8. Caixinhas exclusão: falha de DELETE (alerta fecha via Action, exibe erro, sem GET por aquele envio)
      await scenario('caixinhas/exclusao/falha-delete', 'savings', async () => {
        const menuBtn = btn(page, 'Mais ações de Meta A');
        await menuBtn.focus();
        const before = await menuBtn.evaluate((node) => window.qa.focus(node));
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        const dialog = page.getByRole('alertdialog', { name: 'Excluir meta de poupança?', exact: true });
        await dialog.waitFor();
        await attachUnmountWatch(dialog);
        await page.evaluate(() => { window.qa.mode = 'delete-goal-hold'; });

        const offset = (await calls()).length;
        await btn(dialog, 'Excluir').click();
        const closePoint = await closed(dialog);
        await page.waitForFunction(() => Boolean(window.qa.pending.write));
        await page.evaluate(() => window.qa.reply('write', 'http'));
        await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
        await frame();
        const afterErrorFocus = await page.evaluate(() => window.qa.focus());
        const trace = (await calls()).slice(offset).map(({ method, url: u, body }) => ({ method, url: u, ...(body ? { body } : {}) }));
        same(trace, [{ method: 'DELETE', url: '/api/savings', body: { id: 'a' } }], 'falha DELETE disparou GET');
        const violations = !sameFocus(before, closePoint.focus) || !sameFocus(before, afterErrorFocus)
          ? ['foco não preservado após falha de DELETE']
          : [];
        return { closePoint: closePoint.focus, afterErrorFocus, violations };
      });

      // 9. Caixinhas exclusão: GET rápido
      await scenario('caixinhas/exclusao/early', 'savings', async () => {
        const menuBtn = btn(page, 'Mais ações de Meta A');
        await menuBtn.focus();
        const before = await menuBtn.evaluate((node) => window.qa.focus(node));
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
        const dialog = page.getByRole('alertdialog', { name: 'Excluir meta de poupança?', exact: true });
        await dialog.waitFor();
        await attachUnmountWatch(dialog);
        await page.evaluate(() => { window.qa.mode = null; });

        const offset = (await calls()).length;
        await btn(dialog, 'Excluir').click();
        const closePoint = await closed(dialog);
        await btn(page, 'Depositar em Meta A').waitFor({ state: 'detached' });
        await btn(page, 'Depositar em Meta B').waitFor();
        await frame();
        const afterReadFocus = await page.evaluate(() => window.qa.focus());
        const fallbackFocus = await btn(page, 'Nova meta').evaluate((node) => window.qa.focus(node));
        const trace = (await calls()).slice(offset).map(({ method, url: u, body }) => ({ method, url: u, ...(body ? { body } : {}) }));
        same(trace, [{ method: 'DELETE', url: '/api/savings', body: { id: 'a' } }, { method: 'GET', url: '/api/savings' }], 'sequência DELETE+GET rápido');

        const violations = [];
        if (closePoint.aGoalInList) {
          if (!sameFocus(before, closePoint.focus)) violations.push('fechamento rápido com origem conectada não retornou à origem');
        } else if (!sameFocus(fallbackFocus, closePoint.focus) || closePoint.focus.id !== 'savings-create') {
          violations.push('fechamento rápido sem origem conectada não retornou ao fallback #savings-create');
        }
        if (!afterReadFocus.connected || !afterReadFocus.focused || afterReadFocus.role === 'body') {
          violations.push('foco não sobreviveu à remoção da linha');
        }
        return { aGoalInListAtClose: closePoint.aGoalInList, closePoint: closePoint.focus, afterReadFocus, violations };
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

const dir = await mkdtemp(join(scratch, 'quiet-installments-savings-'));
const session = `quiet-installments-savings-${randomUUID()}`;
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

  const entry = `import { InstallmentsView } from ${JSON.stringify(installmentsViewPath)};
    import { SavingsView } from ${JSON.stringify(savingsViewPath)};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    (${installFixture.toString()})(InstallmentsView, SavingsView, createElement, createRoot, ThemeProvider, Toaster);`;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-installments-savings-dialogs',
        setup(build) {
          build.onLoad({ filter: /quiet-installments-savings-dialogs\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad(
              { filter: /\/(installments-view|savings-view)\.tsx$/ },
              (args) => {
                const contents = baselineFiles.get(args.path);
                if (!contents) return undefined;
                intercepted.add(args.path);
                return { contents, loader: 'tsx' };
              },
            );
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) {
      assert.equal(intercepted.size, baselineSpecs.length, `Baseline não interceptou todos os 2 módulos (${intercepted.size}/${baselineSpecs.length})`);
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
  const candidateHashes = {};
  for (const file of [
    'installments-view.tsx',
    'installment-plan-editor.tsx',
    'installment-delete-confirmation.tsx',
    'savings-view.tsx',
    'savings-goal-editor.tsx',
    'savings-contribution-dialog.tsx',
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
  const preexistingQuietDivergences = [];
  let count = 0;
  const phases = ['parcelas', 'caixinhas-dialogs', 'caixinhas-exclusao'];
  const expectedCount = 9;

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = { baseline: [], candidate: [] };
      for (const phase of phases) {
        for (const label of ['baseline', 'candidate']) {
          const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(phase)})`);
          const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
          assert(result, `${label}/${phase}: ausência de resultado do DOM`);
          observed[label].push(...JSON.parse(result));
        }
      }
      assert.equal(observed.baseline.length, expectedCount, `baseline: cenário incompleto (${observed.baseline.length} vs ${expectedCount})`);
      assert.equal(observed.candidate.length, expectedCount, `candidate: cenário incompleto (${observed.candidate.length} vs ${expectedCount})`);

      count += observed.candidate.length;
      console.log(JSON.stringify({ session, baseRef, width, theme, scenarios: observed.candidate.length }));

      const cellParity = Bun.deepEquals(observed.baseline, observed.candidate);
      if (!cellParity) gaps.push(`${width}/${theme}: divergência de paridade`);

      for (const entryResult of observed.candidate) {
        const baseEntry = observed.baseline.find(({ name }) => name === entryResult.name);
        for (const violation of entryResult.violations) {
          const isPreexistingSavingsRemoval =
            entryResult.name.startsWith('caixinhas/exclusao/')
            && violation === 'foco não sobreviveu à remoção da linha'
            && baseEntry?.violations.includes(violation);
          if (isPreexistingSavingsRemoval) {
            preexistingQuietDivergences.push({
              cell: `${width}/${theme}`,
              scenario: entryResult.name,
              violation,
              parityConfirmed: cellParity,
            });
          } else {
            gaps.push(`${width}/${theme} ${entryResult.name}: ${baseEntry?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
          }
        }
      }

      const witness = observed.candidate.find(({ name }) => name === 'testemunha do tema e viewport')?.witness;
      assert(witness && witness.width === width && witness.theme === theme && !witness.overflow, `Testemunha inválida em ${width}/${theme}`);
      backgrounds.push(witness.background);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  if (preexistingQuietDivergences.length) {
    console.log(JSON.stringify({
      warning: 'AVISO: divergência Quiet preexistente aberta (NÃO constitui conformidade Quiet; ver Decisão 6 e task-0015).',
      quietCompliant: false,
      preexistingQuietDivergences,
    }));
  }

  assert.deepEqual(gaps, [], 'Falha no contrato Quiet/paridade');
  console.log(`${count} cenários pareados; 0 skips.${preexistingQuietDivergences.length ? ` Divergências Quiet preexistentes abertas: ${preexistingQuietDivergences.length} (não conformidade Quiet).` : ''}`);
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

if (failures.length) throw new AggregateError(failures, 'QA de diálogos de Parcelas e Caixinhas não concluído');
