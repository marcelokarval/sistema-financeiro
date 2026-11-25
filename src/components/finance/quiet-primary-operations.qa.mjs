// Execute somente dentro do preflight único de navegador de 0013.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git ou banco.
// Variáveis RO do ref 528e83f6a233fa9553fe0ec6570180bcb948e2cc:
// QUIET_QA_BASELINE_INV (investments-view.tsx),
// QUIET_QA_BASELINE_CON (consortiums-view.tsx),
// QUIET_QA_BASELINE_ACC (accounts-view.tsx).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '528e83f6a233fa9553fe0ec6570180bcb948e2cc';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_INV',
    pathSuffix: 'src/components/finance/investments-view.tsx',
    hash: 'a0eb2fc93b169df47c45ea81a04414453cf1a1e3d5b75cd434f33d565849569d',
  },
  {
    env: 'QUIET_QA_BASELINE_CON',
    pathSuffix: 'src/components/finance/consortiums-view.tsx',
    hash: 'ace2ebe2b348104e967a32e0d8cedf13f1e6075ed014bc78439eabb1f710fdc6',
  },
  {
    env: 'QUIET_QA_BASELINE_ACC',
    pathSuffix: 'src/components/finance/accounts-view.tsx',
    hash: '1b4889dcd2a1fd78a7627c73a4479b77ea3e3645e845089eb867ccdcf4fc8540',
  },
];

const source = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pagePath = join(root, 'src/app/page.tsx');

function installFixture(Page, ThemeProvider, Toaster, createElement, createRoot, useAppStore) {
  const accounts = [
    { id: 'a', name: 'Conta A', type: 'BANK', balance: 1500, color: '#22c55e', icon: 'wallet', isActive: true },
    { id: 'b', name: 'Conta B', type: 'BANK', balance: 800, color: '#3b82f6', icon: 'wallet', isActive: true },
  ];
  const investments = [
    { id: 'a', name: 'Investimento A', type: 'CDB', investedAmount: 1200, currentBalance: 1350, yieldRate: 5 },
    { id: 'b', name: 'Investimento B', type: 'STOCK', investedAmount: 2000, currentBalance: 2200, yieldRate: 10 },
  ];
  const consortiums = [
    {
      id: 'c1', description: 'Cota A', group: '10', quota: '01', administrator: 'Adm A',
      totalAmount: 1000, fundedAmount: 250, monthlyPayment: 125, installmentCount: 8, paidInstallments: 2,
      startDate: '2026-01-01', endDate: null, nextAssemblyDate: '2026-06-15T00:00:00.000Z', assembliesAttended: 1,
      status: 'ACTIVE', categoryId: null, category: null, accountId: null, isActive: true,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    {
      id: 'c2', description: 'Cota B', group: '20', quota: '02', administrator: 'Adm B',
      totalAmount: 2000, fundedAmount: 500, monthlyPayment: 250, installmentCount: 8, paidInstallments: 2,
      startDate: '2026-01-01', endDate: null, nextAssemblyDate: '2026-07-15T00:00:00.000Z', assembliesAttended: 2,
      status: 'ACTIVE', categoryId: null, category: null, accountId: null, isActive: true,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
  ];
  const instA = {
    id: 'inst-a-1', number: 1, amount: 125, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: 'c1',
  };
  const instB = {
    id: 'inst-b-1', number: 10, amount: 250, dueDate: '2026-05-01', paidDate: null,
    status: 'PENDING', notes: '', assemblyDate: null, assemblyResult: '', consortiumId: 'c2',
  };
  const invTxsInitial = [
    { id: 'hist-a', type: 'APORTE', amount: 120, date: '2026-05-01', description: 'Aporte inicial A' },
  ];

  const qa = window.qa = {
    calls: [],
    unexpected: [],
    pending: {},
    store: useAppStore,
    rootInstance: null,
    holdTransfer: false,
    holdInvTxPost: false,
    holdInvTxDelete: false,
    holdInvTxGet: false,
    invTxDeleted: false,
    holdConPayPost: false,
    conPaid: false,
  };

  const held = (label) => new Promise((resolve, reject) => { qa.pending[label] = { resolve, reject }; });
  qa.reply = (label, outcome, payload) => {
    const slot = qa.pending[label];
    if (!slot) throw new Error(`Pending ausente para ${label}`);
    delete qa.pending[label];
    if (outcome === 'transport') return slot.reject(new Error('Rejeição sintética'));
    if (outcome === 'http503') return slot.resolve(Response.json({ error: 'Falha sintética' }, { status: 503 }));
    if (payload !== undefined) return slot.resolve(Response.json(payload));
    return slot.resolve(Response.json({ ok: true }));
  };

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    qa.calls.push({ method, url, ...(body !== undefined ? { body } : {}) });

    if (method === 'GET') {
      if (url === '/api/accounts') return Response.json(accounts);
      if (url === '/api/categories') return Response.json([]);
      if (url === '/api/transactions?accountId=a' || url === '/api/transactions?accountId=b' || url.startsWith('/api/transactions?from=')) {
        return Response.json([]);
      }
      if (url === '/api/investments') return Response.json(investments);
      if (url === '/api/investments/transactions') return Response.json([]);
      if (url === '/api/investments/transactions?investmentId=a') {
        const list = qa.invTxDeleted ? [] : invTxsInitial;
        if (qa.holdInvTxGet) {
          qa.holdInvTxGet = false;
          return held('invTxGet');
        }
        return Response.json(list);
      }
      if (url === '/api/investments/transactions?investmentId=b') {
        return Response.json([{ id: 'hist-b', type: 'APORTE', amount: 200, date: '2026-05-02', description: 'Aporte inicial B' }]);
      }
      if (url === '/api/consortiums') {
        return Response.json(
          qa.conPaid
            ? [{ ...consortiums[0], paidInstallments: 3, fundedAmount: 375 }, consortiums[1]]
            : consortiums,
        );
      }
      if (url === '/api/consortiums/installments?consortiumId=c1') {
        return Response.json([qa.conPaid ? { ...instA, status: 'PAID', paidDate: '2026-05-10' } : instA]);
      }
      if (url === '/api/consortiums/installments?consortiumId=c2') {
        return Response.json([instB]);
      }
    }

    if (method === 'POST' && url === '/api/transfer') {
      if (qa.holdTransfer) return held('transfer');
      return Response.json({ ok: true });
    }
    if (method === 'POST' && url === '/api/investments/transactions') {
      if (qa.holdInvTxPost) return held('invTxPost');
      return Response.json({ ok: true }, { status: 201 });
    }
    if (method === 'DELETE' && url.startsWith('/api/investments/transactions?id=')) {
      if (qa.holdInvTxDelete) return held('invTxDelete');
      qa.invTxDeleted = true;
      return Response.json({ success: true });
    }
    if (method === 'POST' && url === '/api/consortiums/installments') {
      if (qa.holdConPayPost) return held('conPayPost');
      qa.conPaid = true;
      return Response.json({ ok: true });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture: ${method} ${url}`);
  };

  qa.mount = (theme, view) => {
    qa.calls = [];
    qa.unexpected = [];
    qa.pending = {};
    qa.holdTransfer = false;
    qa.holdInvTxPost = false;
    qa.holdInvTxDelete = false;
    qa.holdInvTxGet = false;
    qa.invTxDeleted = false;
    qa.holdConPayPost = false;
    qa.conPaid = false;
    useAppStore.setState({
      currentView: view,
      selectedAccountId: null,
      selectedCardId: null,
      selectedPurchaseId: null,
      selectedInvestmentId: null,
      selectedInstallmentPlanId: null,
      selectedConsortiumId: null,
      sidebarOpen: false,
      aiAssistantVisible: false,
      newTransactionRequested: false,
      newGoalRequested: false,
    });
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    qa.rootInstance = createRoot(host);
    qa.rootInstance.render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(Page),
        createElement(Toaster, { theme }),
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
    const request = route.request();
    if (request.url() === url && request.method() === 'GET' && request.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    blocked.push(request.url());
    return route.abort();
  };

  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const btn = (name, within = page) => within.getByRole('button', { name, exact: true });
  const heading = (level, name) => page.getByRole('heading', { level, name, exact: true });
  const dialog = (role = 'dialog') => page.getByRole(role);
  const action = (name, role = 'dialog') => dialog(role).getByRole('button', { name, exact: true });
  const calls = () => page.evaluate(() => window.qa.calls);
  const pending = (label) => page.waitForFunction((key) => Boolean(window.qa.pending[key]), label);
  const reply = (label, outcome, payload) =>
    page.evaluate(([k, o, p]) => window.qa.reply(k, o, p), [label, outcome, payload]);
  const feedback = (kind, text) => page.locator(`[data-sonner-toast][data-type=${kind}]`).filter({ hasText: text }).waitFor();
  const frame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const closes = async (role = 'dialog') => {
    await page.locator(`[role=${role}]`).waitFor({ state: 'detached' });
    await frame();
  };

  const activeInfo = () => page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName ?? null,
      role: el?.getAttribute('role') ?? null,
      id: el?.id || null,
      name: (el?.getAttribute('aria-label') || (el?.tagName !== 'BODY' ? el?.textContent?.trim() : '')) ?? '',
      connected: Boolean(el?.isConnected),
    };
  });

  const focused = async (locator) =>
    await locator.count() === 1 && locator.evaluate((node) => node === document.activeElement);

  const visibleFocus = (locator) => locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return node.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  });

  const tabTo = async (origin, target, maxSteps = 8) => {
    await origin.focus();
    for (let step = 0; step < maxSteps; step++) {
      await page.keyboard.press('Tab');
      if (await focused(target)) {
        require(await visibleFocus(target), 'Ação alcançada por Tab sem foco visível');
        return;
      }
    }
    throw new Error(`Tab não alcançou alvo em ${maxSteps} passos`);
  };

  const assertDialogGeometry = async (role = 'dialog') => {
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
    require(
      box.viewport === width
      && box.pageScroll <= width + 1
      && box.left >= -1
      && box.right <= width + 1
      && box.scrollWidth <= box.clientWidth + 1,
      `Overflow em ${role}: ${JSON.stringify(box)}`,
    );
  };

  async function mountView(view) {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.qa));
    await page.evaluate(([skin, v]) => window.qa.mount(skin, v), [theme, view]);
    await page.waitForFunction((skin) => document.documentElement.classList.contains(skin), theme);
    const witness = await page.evaluate(() => {
      const mobileNav = document.querySelector('nav[aria-label="Navegação móvel"]');
      const bg = getComputedStyle(document.body).backgroundColor;
      return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        themeClass: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        background: bg,
        mobileNavDisplay: mobileNav ? getComputedStyle(mobileNav).display : null,
      };
    });
    require(witness.width === width, `Largura inesperada: ${witness.width} vs ${width}`);
    require(witness.scrollWidth <= width + 1, `Overflow horizontal: ${witness.scrollWidth} > ${width}`);
    require(witness.themeClass === theme, `Tema não aplicado: ${witness.themeClass}`);
    require(witness.background && witness.background !== 'rgba(0, 0, 0, 0)', 'Fundo transparente');
    if (width < 768) require(witness.mobileNavDisplay && witness.mobileNavDisplay !== 'none', 'MobileNav oculta em viewport móvel');
    else require(witness.mobileNavDisplay === 'none', 'MobileNav visível em desktop');
    return witness;
  }

  async function runScenario(name, view, fn) {
    try {
      const witness = await mountView(view);
      const observations = await fn(witness);
      const unexpected = await page.evaluate(() => window.qa.unexpected);
      require(unexpected.length === 0, `Requisições inesperadas: ${JSON.stringify(unexpected)}`);
      require(errors.length === 0, `Erros DOM: ${JSON.stringify(errors)}`);
      require(blocked.length === 0, `Rede não autorizada: ${JSON.stringify(blocked)}`);
      results.push({ name, observations });
    } catch (error) {
      throw new Error(`${width}/${theme} [${name}]: ${error.message}`);
    }
  }

  await page.setViewportSize({ width, height: 820 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(4000);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);

  try {
    if (phase === 'accounts') {
      await runScenario('testemunha-e-teclado-seletor-transferencia', 'accounts', async (witness) => {
        await btn('Transferir').waitFor();
        const closeObservations = [];

        // Tab chega ao seletor (Novo lançamento) e retorno de foco após Escape/Cancelar
        const pickerBtn = btn('Novo lançamento');
        for (const how of ['Escape', 'Cancelar']) {
          await tabTo(btn('Notificações'), pickerBtn, 6);
          await page.keyboard.press('Enter');
          await dialog().waitFor();
          await dialog().getByText('Novo lançamento', { exact: true }).waitFor();
          await assertDialogGeometry();
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await action('Cancelar').click();
          await closes();
          require(await focused(pickerBtn), `Foco não retornou ao seletor após ${how}`);
          closeObservations.push({ target: 'seletor', how, focus: await activeInfo() });
        }

        // Tab chega a Transferir e retorno de foco após Escape/Cancelar/Close
        const transferBtn = btn('Transferir');
        for (const how of ['Escape', 'Cancelar', 'Close']) {
          await tabTo(pickerBtn, transferBtn, 6);
          await page.keyboard.press('Enter');
          await dialog().waitFor();
          await dialog().getByText('Transferir entre Contas', { exact: true }).waitFor();
          await assertDialogGeometry();
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await action(how).click();
          await closes();
          require(await focused(transferBtn), `Foco não retornou a Transferir após ${how}`);
          closeObservations.push({ target: 'transferencia', how, focus: await activeInfo() });
        }

        require((await calls()).every((c) => c.method === 'GET'), 'Escape/Cancelar não pode gravar');
        return { witness, closeObservations };
      });

      await runScenario('seletor-alvo-conta-b', 'accounts', async () => {
        await btn('Novo lançamento').click();
        await dialog().waitFor();
        await action('Conta B').click();
        await dialog().getByText('Registrar nova transação em Conta B', { exact: true }).waitFor();
        await action('Cancelar').click();
        await closes();
        require(await focused(btn('Novo lançamento')), 'Foco pós-lançamento não voltou ao botão de lançamento');
        require((await calls()).every((c) => c.method === 'GET'), 'Seletor + Cancelar não pode gravar');
        return { focusAfterCancel: await activeInfo() };
      });

      await runScenario('transferencia-rascunho-trava-erro-e-sucesso', 'accounts', async () => {
        await btn('Transferir').waitFor();
        await btn('Transferir').click();
        await dialog().waitFor();
        await dialog().locator('#transfer-from').click();
        await page.getByRole('option', { name: /Conta A/ }).click();
        await dialog().locator('#transfer-to').click();
        await page.getByRole('option', { name: /Conta B/ }).click();
        await dialog().getByLabel('Valor (R$)', { exact: true }).fill('50');

        // Cancelar preserva rascunho no controlador
        await action('Cancelar').click();
        await closes();
        await btn('Transferir').click();
        await dialog().waitFor();
        require(await dialog().getByLabel('Valor (R$)', { exact: true }).inputValue() === '50', 'Rascunho perdido ao cancelar');

        // Submeter com trava pendente -> clique duplo emite 1 POST; HTTP 503 mantém diálogo/rascunho e libera trava
        await page.evaluate(() => { window.qa.holdTransfer = true; });
        const before = (await calls()).length;
        const submit = action('Transferir');
        await submit.click();
        await pending('transfer');
        require((await submit.getAttribute('aria-disabled')) === 'true', 'Transferir sem aria-disabled sob pendência');
        await submit.evaluate((el) => el.click());
        await reply('transfer', 'http503');
        await feedback('error', 'Falha sintética');
        require(await dialog().isVisible(), 'Erro 503 fechou transferência');
        require((await submit.getAttribute('aria-disabled')) === 'false', 'Trava não liberou no finally após 503');
        require(await dialog().getByLabel('Valor (R$)', { exact: true }).inputValue() === '50', 'Rascunho apagado no 503');

        // Retry OK fecha diálogo, limpa rascunho e relê contas
        await submit.click();
        await pending('transfer');
        await reply('transfer', 'ok');
        await feedback('success', 'Transferência realizada com sucesso!');
        await closes();
        require(await focused(btn('Transferir')), 'Foco não retornou a Transferir após sucesso');

        const writes = (await calls()).slice(before).filter((c) => c.method !== 'GET');
        require(writes.length === 2, `Esperados 2 POST /api/transfer, vistos ${writes.length}`);
        require(writes[0].body.fromAccountId === 'a' && writes[0].body.toAccountId === 'b' && writes[0].body.amount === 50, 'Payload de transferência incorreto');
        return { writesCount: writes.length, focusAfterOk: await activeInfo() };
      });
    }

    if (phase === 'inv-con') {
      await runScenario('investimentos-movimentacao-teclado-foco-e-gravacao', 'investments', async () => {
        await btn('Abrir investimento: Investimento A').click();
        await heading(2, 'Investimento A').waitFor();
        await page.getByText('Aporte inicial A', { exact: true }).waitFor();

        const newTxBtn = btn('Nova transação');
        const closeObservations = [];
        for (const how of ['Escape', 'Cancelar', 'Fechar formulário']) {
          await tabTo(btn('Excluir investimento'), newTxBtn, 4);
          await page.keyboard.press('Enter');
          await dialog().waitFor();
          await dialog().getByText('Nova Transação', { exact: true }).waitFor();
          await assertDialogGeometry();
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await action(how).click();
          await closes();
          require(await focused(newTxBtn), `Foco não retornou a Nova transação após ${how}`);
          closeObservations.push({ how, focus: await activeInfo() });
        }

        // Validação sem envio + HTTP 503 preserva rascunho + 201 OK fecha e relê
        await newTxBtn.click();
        await dialog().waitFor();
        await page.evaluate(() => { window.qa.holdInvTxPost = true; });
        const before = (await calls()).length;
        await dialog().getByLabel('Valor (R$)', { exact: true }).fill('0');
        await action('Registrar').click();
        await feedback('error', 'Informe um valor maior que zero');
        require((await calls()).length === before, 'Validação enviou POST');

        await dialog().getByLabel('Valor (R$)', { exact: true }).fill('150');
        await action('Registrar').click();
        await pending('invTxPost');
        require(await action('Salvando…').isDisabled(), 'Botão não desabilitado durante POST');
        await reply('invTxPost', 'http503');
        await feedback('error', 'Erro ao registrar transação');
        require(await dialog().isVisible(), 'Erro 503 fechou editor de movimentação');
        require(await dialog().getByLabel('Valor (R$)', { exact: true }).inputValue() === '150', 'Rascunho perdido no 503');

        await action('Registrar').click();
        await pending('invTxPost');
        await reply('invTxPost', 'ok');
        await feedback('success', 'Transação registrada!');
        await closes();
        await page.getByText('Aporte inicial A', { exact: true }).waitFor();
        await frame();
        const focusAfterOk = await activeInfo();
        // Ao concluir POST, fetchTransactions desmonta InvestmentEntries para carregar o histórico;
        // restoreDialogFocus aplica o fallback conectado do controlador (#investment-detail-title).
        require(focusAfterOk.connected && focusAfterOk.id === 'investment-detail-title', `Fallback de foco inesperado após OK: ${JSON.stringify(focusAfterOk)}`);
        return { closeObservations, focusAfterOk };
      });

      await runScenario('investimentos-exclusao-movimentacao-matriz-temporal', 'investments', async () => {
        await btn('Abrir investimento: Investimento A').click();
        await heading(2, 'Investimento A').waitFor();
        await page.getByText('Aporte inicial A', { exact: true }).waitFor();

        const delTrigger = btn('Excluir transação: Aporte inicial A');
        await delTrigger.click();
        await dialog('alertdialog').waitFor();
        await assertDialogGeometry('alertdialog');
        await action('Cancelar', 'alertdialog').click();
        await closes('alertdialog');
        require(await focused(delTrigger), 'Cancelar exclusão não devolveu foco ao acionador');

        await delTrigger.click();
        await dialog('alertdialog').waitFor();
        await page.evaluate(() => {
          window.qa.holdInvTxDelete = true;
          window.qa.holdInvTxGet = true;
        });
        await action('Excluir', 'alertdialog').click();
        await pending('invTxDelete');
        require(await action('Excluir', 'alertdialog').isDisabled(), 'Excluir habilitado durante DELETE');

        await page.evaluate(() => { window.qa.invTxDeleted = true; });
        await reply('invTxDelete', 'ok', { success: true });
        await pending('invTxGet');
        await closes('alertdialog');
        const atClose = await activeInfo();

        await reply('invTxGet', 'ok', []);
        await page.getByText('Nenhuma transação registrada neste investimento.', { exact: true }).waitFor();
        await frame();
        const afterGet = await activeInfo();
        require(atClose.connected && afterGet.connected, `Foco desconectado na exclusão de movimentação: ${JSON.stringify({ atClose, afterGet })}`);
        return { atClose, afterGet };
      });

      await runScenario('consorcios-baixa-teclado-e-a-b-antes-post', 'consortiums', async () => {
        await btn('Abrir consórcio Cota A').click();
        await heading(2, 'Cota A').waitFor();
        const payBtnA = btn('Marcar parcela 1 como paga');
        await payBtnA.waitFor();

        const closeObservations = [];
        for (const how of ['Escape', 'Cancelar', 'Close']) {
          await tabTo(btn('Excluir'), payBtnA, 4);
          await page.keyboard.press('Enter');
          await dialog().waitFor();
          await dialog().getByText('Marcar Parcela como Paga', { exact: true }).waitFor();
          await assertDialogGeometry();
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await action(how).click();
          await closes();
          require(await focused(payBtnA), `Foco não retornou à parcela após ${how}`);
          closeObservations.push({ how, focus: await activeInfo() });
        }

        // Caso (a): abrir confirmação de A e trocar para B antes de confirmar -> zero POST
        await payBtnA.click();
        await dialog().waitFor();
        await dialog().getByText(/Parcela 1 — R\$\s*125,00/).waitFor();
        const beforeSwitch = (await calls()).length;
        await page.evaluate(() => window.qa.store.getState().setSelectedConsortiumId('c2'));
        await heading(2, 'Cota B').waitFor();
        await btn('Marcar parcela 10 como paga').waitFor();
        await closes();
        require(await page.getByText(/Parcela 1 — R\$\s*125,00/).count() === 0, 'Parcela de A permaneceu visível/acionável em B');
        const writesAfterSwitch = (await calls()).slice(beforeSwitch).filter((c) => c.method !== 'GET');
        require(writesAfterSwitch.length === 0, 'Troca A→B antes de confirmar emitiu POST');
        return { closeObservations, switchedToB: true };
      });

      await runScenario('consorcios-baixa-a-b-durante-post-e-finally-503', 'consortiums', async () => {
        // Caso (b): confirmar em A e trocar para B durante POST -> A atualiza lista sem repovoar B com parcelas de A
        await btn('Abrir consórcio Cota A').click();
        await heading(2, 'Cota A').waitFor();
        await btn('Marcar parcela 1 como paga').click();
        await dialog().waitFor();
        await page.evaluate(() => { window.qa.holdConPayPost = true; });
        const beforePost = (await calls()).length;
        await action('Confirmar Pagamento').click();
        await pending('conPayPost');
        require(await action('Confirmar Pagamento').isDisabled(), 'Confirmar Pagamento habilitado durante POST');

        await page.evaluate(() => window.qa.store.getState().setSelectedConsortiumId('c2'));
        await heading(2, 'Cota B').waitFor();
        await btn('Marcar parcela 10 como paga').waitFor();
        await closes();

        await page.evaluate(() => { window.qa.conPaid = true; });
        await reply('conPayPost', 'ok');
        await page.waitForFunction(
          (n) => window.qa.calls.slice(n).some((c) => c.method === 'GET' && c.url === '/api/consortiums'),
          beforePost,
        );
        await frame();
        const afterAB = (await calls()).slice(beforePost);
        const postCalls = afterAB.filter((c) => c.method === 'POST' && c.url === '/api/consortiums/installments');
        const staleReadsA = afterAB.filter((c) => c.url === '/api/consortiums/installments?consortiumId=c1');
        const listRefreshA = afterAB.filter((c) => c.method === 'GET' && c.url === '/api/consortiums');
        require(postCalls.length === 1, `Esperado 1 POST, vistos ${postCalls.length}`);
        require(staleReadsA.length === 0, 'Releitura de A disparada enquanto B estava ativo');
        require(listRefreshA.length >= 1, 'Lista de consórcios não foi atualizada após baixa de A');
        require(await btn('Marcar parcela 10 como paga').isVisible(), 'Detalhe B perdeu parcela 10');

        // Reconciliação finally em HTTP 503 na seleção vigente A (nova montagem limpa paidInSession)
        await mountView('consortiums');
        await btn('Abrir consórcio Cota A').click();
        await heading(2, 'Cota A').waitFor();
        await btn('Marcar parcela 1 como paga').click();
        await dialog().waitFor();
        await page.evaluate(() => { window.qa.holdConPayPost = true; });
        const before503 = (await calls()).length;
        await action('Confirmar Pagamento').click();
        await pending('conPayPost');
        await reply('conPayPost', 'http503');
        await feedback('error', 'Falha sintética');
        await closes();
        await btn('Marcar parcela 1 como paga').waitFor();
        const after503 = (await calls()).slice(before503).map((c) => [c.method, c.url]);
        require(after503.filter(([m, u]) => m === 'POST' && u === '/api/consortiums/installments').length === 1, '503 repetiu POST');
        require(after503.some(([m, u]) => m === 'GET' && u === '/api/consortiums/installments?consortiumId=c1'), 'finally não reconciliou parcelas');
        return { postCountAB: postCalls.length, staleReadsA: staleReadsA.length, reconcileAfter503: after503 };
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
  'Requer QUIET_QA_SCRATCH absoluto e CI=1 no sandbox aprovado; não execute no host.');
for (const { env } of baselineSpecs) {
  assert(isAbsolute(process.env[env] ?? ''), `Forneça ${env} absoluto com a fonte RO do ref ${baseRef}`);
}
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  const val = process.env[key];
  assert(val && (await realpath(val)).startsWith(`${scratch}/`), `${key} deve ficar sob o scratch privado`);
}
assert(HOME !== TMPDIR);
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' }, `${forbidden} não deve ser montado`);
}
assert(!('DATABASE_URL' in process.env), 'Fixture não usa banco');

const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baselineByPath = new Map();
for (const spec of baselineSpecs) {
  const contents = await readFile(process.env[spec.env], 'utf8');
  assert.equal(digest(contents), spec.hash, `SHA-256 inválido em ${spec.env} (${spec.pathSuffix})`);
  baselineByPath.set(join(root, spec.pathSuffix), contents);
}

const dir = await mkdtemp(join(scratch, 'quiet-primary-ops-'));
const session = `quiet-primary-ops-${randomUUID()}`;
const failures = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 420_000;

async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(120_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do runner encerrado');
  const proc = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
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

  const emptyModules = new Map(Object.entries({
    'dashboard-view': 'DashboardView',
    'quick-stats-overview': 'QuickStatsOverview',
    'smart-insights': 'SmartInsights',
    'cash-flow-forecast': 'CashFlowForecast',
    'spending-timeline': 'SpendingTimeline',
    'savings-challenge': 'SavingsChallenge',
    'expense-breakdown': 'ExpenseBreakdown',
    'balance-projection': 'BalanceProjection',
    'financial-calendar': 'FinancialCalendar',
    'networth-evolution': 'NetworthEvolution',
    'debt-overview': 'DebtOverview',
    'transaction-analytics': 'TransactionAnalytics',
    'goals-dashboard': 'GoalsDashboard',
    'receipt-generator': 'ReceiptGenerator',
    'achievement-badges': 'AchievementBadges',
    'cards-view': 'CardsView',
    'purchases-view': 'PurchasesView',
    'categories-view': 'CategoriesView',
    'installments-view': 'InstallmentsView',
    'savings-view': 'SavingsView',
  }));

  const entry = `import Page from ${JSON.stringify(pagePath)};
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useAppStore } from ${JSON.stringify(join(root, 'src/lib/store.ts'))};
    (${installFixture.toString()})(Page, ThemeProvider, Toaster, createElement, createRoot, useAppStore);`;

  const realtime = `export function useRealtime() { return { isConnected: true, refreshCounter: 0, reconnect: () => {} }; }`;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-primary-operations',
        setup(build) {
          build.onLoad({ filter: /quiet-primary-operations\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          build.onLoad({ filter: /\/use-realtime\.ts$/ }, () => ({ contents: realtime, loader: 'ts' }));
          build.onLoad({ filter: /\/src\/components\/finance\/[\w-]+\.tsx$/ }, (args) => {
            if (useBaseline && baselineByPath.has(args.path)) {
              intercepted.add(args.path);
              return { contents: baselineByPath.get(args.path), loader: 'tsx' };
            }
            const name = args.path.split('/').at(-1).slice(0, -4);
            const component = emptyModules.get(name);
            if (component) return { contents: `export function ${component}() { return null; }`, loader: 'ts' };
          });
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) {
      assert.equal(intercepted.size, baselineSpecs.length, `Baseline não interceptou todas as 3 fontes (${intercepted.size}/${baselineSpecs.length})`);
    }
    const html = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      html,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return html;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {};
  for (const rel of [
    'src/components/finance/investments-view.tsx',
    'src/components/finance/investment-entry-editor.tsx',
    'src/components/finance/consortiums-view.tsx',
    'src/components/finance/consortium-installment-payment.tsx',
    'src/components/finance/accounts-view.tsx',
    'src/components/finance/account-transfer-dialog.tsx',
    'src/components/finance/account-picker.tsx',
  ]) {
    candidateHashes[rel] = digest(await readFile(join(root, rel)));
  }
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  let count = 0;
  const phases = ['accounts', 'inv-con'];

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = { baseline: [], candidate: [] };
      for (const phase of phases) {
        for (const label of ['baseline', 'candidate']) {
          const outcome = await cli(
            'run-code',
            `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(phase)})`,
          );
          const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
          assert(result, `${label}/${phase}: resultado DOM ausente`);
          observed[label].push(...JSON.parse(result));
        }
      }
      assert.equal(observed.baseline.length, 7, `baseline: cenários incompletos (${observed.baseline.length}/7)`);
      assert.equal(observed.candidate.length, 7, `candidate: cenários incompletos (${observed.candidate.length}/7)`);
      count += observed.candidate.length;

      const cellParity = Bun.deepEquals(observed.baseline, observed.candidate);
      if (!cellParity) gaps.push(`${width}/${theme}: divergência de paridade`);

      const witness = observed.candidate.find(({ name }) => name === 'testemunha-e-teclado-seletor-transferencia')?.observations?.witness;
      assert(witness, `Testemunha ausente em ${width}/${theme}`);
      backgrounds.push(witness.background);

      console.log(JSON.stringify({ session, baseRef, width, theme, scenarios: observed.candidate.length, cellParity, witness }));
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `Fundos claro/escuro iguais em ${width}px`);
  }

  assert.deepEqual(gaps, [], 'Divergências de paridade nas operacionais prioritárias');
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
      assert.equal(closed.status, 'closed');
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

if (failures.length) throw new AggregateError(failures, 'QA de paridade das operacionais prioritárias não concluído');
