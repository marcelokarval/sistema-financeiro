// Execute somente dentro do preflight de navegador de 0008. O executor prova
// a fronteira do SO, não este script. Disponibilize QUIET_QA_SCRATCH (tmpfs privado)
// e as 4 fontes RO do ref 558aac561e5e4c18c0297698c82700ec6796db0c:
// QUIET_QA_BASELINE_INV_EDITOR, QUIET_QA_BASELINE_INV_DELETE,
// QUIET_QA_BASELINE_CON_EDITOR, QUIET_QA_BASELINE_CON_DELETE.
// Não monte .git, o checkout inteiro, HOME do host, .env ou banco.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '558aac561e5e4c18c0297698c82700ec6796db0c';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_INV_EDITOR',
    file: 'investment-editor.tsx',
    hash: 'f853a49fdf2c86af638a4decf75f7ac233766b3ea4aecab9401b7162acf120df',
  },
  {
    env: 'QUIET_QA_BASELINE_INV_DELETE',
    file: 'investment-delete-confirmation.tsx',
    hash: 'd8aaa9602299d521fa0ea50bd735bb7159c44f696e76fbc03c589ecfe58fdef8',
  },
  {
    env: 'QUIET_QA_BASELINE_CON_EDITOR',
    file: 'consortium-editor.tsx',
    hash: '277d6fc008c46cbd410debc908b8418059b8b1a404af43e772741659c98be483',
  },
  {
    env: 'QUIET_QA_BASELINE_CON_DELETE',
    file: 'consortium-delete-confirmation.tsx',
    hash: '7e1e35ca763276e169a7f19682e9fb2821d2b995235131ed62086dfd5ad6de99',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const investmentsViewPath = join(financeDir, 'investments-view.tsx');
const consortiumsViewPath = join(financeDir, 'consortiums-view.tsx');
const sharedShellPath = join(root, 'src/components/shared/finance-dialog-shell.tsx');

function installFixture(InvestmentsView, ConsortiumsView, createElement, createRoot, ThemeProvider, Toaster) {
  const invCollection = '/api/investments';
  const invHistory = `${invCollection}/transactions`;
  const invRecords = ['a', 'b'].map((id) => ({
    id, name: `Investimento ${id.toUpperCase()}`, type: 'CDB', investedAmount: 1200, currentBalance: 1350, yieldRate: 0,
  }));

  const conCollection = '/api/consortiums';
  const conRecords = ['a', 'b'].map((id) => ({
    id, description: `Cota ${id.toUpperCase()}`, group: '9', quota: id, administrator: 'Administradora sintética',
    totalAmount: 900, fundedAmount: 300, monthlyPayment: 300, installmentCount: 3, paidInstallments: 1,
    startDate: '2026-01-01', nextAssemblyDate: '2026-05-15T00:00:00.000Z', assembliesAttended: 1,
    status: 'CONTEMPLATED', categoryId: null, category: null, accountId: null, isActive: true,
  }));

  const qa = window.qa = {
    calls: [],
    pending: {},
    unexpected: [],
    immediateRead: [],
    conMode: null,
    readReleased: false,
    closePoint: null,
    refreshStatus: null,
  };

  let invHoldRefresh = false;
  let invHoldHistoryA = false;
  let conDeleted = false;
  let conUpdated = false;

  const held = (label) => new Promise((resolve, reject) => { qa.pending[label] = { resolve, reject }; });
  const invEntry = (id, title) => ({ id: `hist-${id}`, description: title, type: 'APORTE', amount: 12, date: '2026-05-01' });
  const readConRows = () => conRecords.filter(({ id }) => !conDeleted || id !== 'a');

  qa.holdHistoryA = () => { invHoldHistoryA = true; };
  qa.reply = (label, outcome) => {
    const { resolve, reject } = qa.pending[label];
    delete qa.pending[label];
    if (outcome === 'transport') return reject(new Error('Rejeição sintética'));
    if (outcome === 'http') return resolve(Response.json({ error: 'Indisponível' }, { status: 503 }));
    if (label === 'write') return resolve(new Response(null, { status: 204, headers: { 'X-QA-Refresh': outcome } }));
    if (label === 'history') return resolve(Response.json([invEntry('a', 'Histórico A atrasado')]));
    if (outcome === 'delete') return resolve(Response.json(invRecords.slice(1)));
    return resolve(Response.json([{ ...invRecords[0], name: 'Investimento A confirmado' }, invRecords[1]]));
  };
  qa.releaseCon = (key) => {
    const resolve = qa.pending[key];
    if (!resolve) throw new Error(`Sem resposta pendente: ${key}`);
    delete qa.pending[key];
    if (key === 'write') {
      conDeleted = true;
      resolve(new Response(null, { status: 204 }));
    } else {
      qa.readReleased = true;
      resolve(Response.json(readConRows()));
    }
  };

  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({
      method,
      url,
      ...(init?.body ? { rawBody: init.body, body: JSON.parse(init.body) } : {}),
    });

    if (url === '/api/accounts') return Response.json([{ id: 'qa-account', name: 'Conta sintética' }]);
    if (url === '/api/categories') return Response.json([{ id: 'qa-category', name: 'Categoria sintética' }]);

    // Investimentos
    if (url === invCollection && ['PUT', 'POST', 'DELETE'].includes(method)) {
      const response = await held('write');
      if (response.ok) invHoldRefresh = response.headers.get('X-QA-Refresh');
      return response;
    }
    if (url === invCollection && method === 'GET') {
      if (invHoldRefresh === 'delete-quick') {
        const snapshot = (phase) => qa.immediateRead.push({
          phase,
          alert: Boolean(document.querySelector('[role=alertdialog]')),
          rowA: Boolean(document.getElementById('investment-row-a')),
        });
        snapshot('GET iniciado');
        const response = Response.json(invRecords.slice(1));
        const json = response.json.bind(response);
        response.json = async () => {
          const payload = await json();
          snapshot('corpo do GET decodificado');
          return payload;
        };
        return response;
      }
      return invHoldRefresh ? held('refresh') : Response.json(invRecords);
    }
    if (url === invHistory) return Response.json([]);
    if (url === `${invHistory}?investmentId=a` && invHoldHistoryA) return held('history');
    if (url === `${invHistory}?investmentId=a` || url === `${invHistory}?investmentId=b`) {
      const id = url.at(-1);
      return Response.json([invEntry(id, `Histórico ${id.toUpperCase()}`)]);
    }

    // Consórcios
    if (url === conCollection && method === 'GET') {
      if (conUpdated) {
        qa.refreshStatus = 503;
        return new Response(null, { status: qa.refreshStatus });
      }
      if (conDeleted && qa.conMode === 'late') {
        return new Promise((resolve) => { qa.pending.read = resolve; });
      }
      if (conDeleted && qa.conMode === 'early') {
        qa.readReleased = true;
        const rows = readConRows();
        return {
          ok: true,
          json: () => {
            qa.earlyJsonWhilePortalConnected = qa.deletePortal?.isConnected === true;
            return Promise.resolve(rows);
          },
        };
      }
      return Response.json(readConRows());
    }
    if (url === `${conCollection}/installments?consortiumId=a` && method === 'GET') {
      return Response.json([]);
    }
    if (url === conCollection && method === 'DELETE' && ['early', 'late'].includes(qa.conMode)) {
      return new Promise((resolve) => { qa.pending.write = resolve; });
    }
    if (url === conCollection && method === 'PUT') {
      if (qa.conMode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.conMode === 'invalid-json') return new Response('não JSON', { status: 503 });
      if (qa.conMode === 'transport') throw new Error('Falha sintética de transporte');
      if (qa.conMode === 'retry') {
        conUpdated = true;
        return new Response(null, { status: 204 });
      }
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Requisição inesperada na fixture: ${method} ${url}`);
  };

  qa.mount = (domain, theme) => {
    const View = domain === 'investments' ? InvestmentsView : ConsortiumsView;
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
      for (let step = 0; step < 6; step++) {
        await page.keyboard.press('Tab');
        if (await focused(target)) {
          require(await visibleFocus(target), 'Ação alcançada por Tab sem foco visível');
          return;
        }
      }
      throw new Error('Tab não alcançou a ação');
    };

    const checkFixture = async () => {
      same(await page.evaluate(() => window.qa.unexpected), [], 'requisições inesperadas');
      same(errors, [], 'erros no DOM');
      same(rejected, [], 'rede não autorizada');
    };

    const activeInv = () => page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        role: el?.getAttribute('role'),
        slot: el?.getAttribute('data-slot'),
        id: el?.id?.startsWith('investment-') || el?.id === 'investments-title' ? el.id : null,
        name: (el?.getAttribute('aria-label') || (el?.tagName !== 'BODY' ? el?.textContent?.trim() : '')) ?? '',
        connected: el?.isConnected,
      };
    });
    const watchInv = async (locator, phase) => ({ phase, matches: await focused(locator), active: await activeInv() });

    async function scenario(name, domain, run) {
      try {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate(([selectedDomain, selectedTheme]) => window.qa.mount(selectedDomain, selectedTheme), [domain, theme]);
        if (domain === 'investments') {
          await btn(page, 'Abrir investimento: Investimento A').waitFor();
          await btn(page, 'Abrir investimento: Investimento B').waitFor();
        } else {
          await btn(page, 'Abrir consórcio Cota A').waitFor();
          await btn(page, 'Abrir consórcio Cota B').waitFor();
        }
        const observation = await run();
        await checkFixture();
        results.push({ name, ...observation });
      } catch (error) {
        throw new Error(`${width}/${theme} ${name}: ${error.message}`);
      }
    }

    // Helper Investimentos
    const invRow = (id) => btn(page, `Abrir investimento: Investimento ${id}`);
    const invBack = () => btn(page, 'Voltar aos investimentos');
    const invEdit = (origin, id = 'A') => btn(page, origin === 'detalhe' ? 'Editar investimento' : `Editar investimento: Investimento ${id}`);
    const invRemove = (origin) => btn(page, origin === 'detalhe' ? 'Excluir investimento' : 'Excluir investimento: Investimento A');
    const invDialog = (role = 'dialog') => page.getByRole(role);
    const invAction = (name, role) => btn(invDialog(role), name);
    const invNameField = () => invDialog().getByRole('textbox', { name: 'Nome', exact: true });
    const invCollection = '/api/investments';
    const invHistoryUrl = (id) => `${invCollection}/transactions?investmentId=${id}`;
    const invPortfolioTitle = () => heading('Investimentos');
    const invPending = (label) => page.waitForFunction((key) => Boolean(window.qa.pending[key]), label);
    const invReply = (label, outcome) => page.evaluate(([key, result]) => window.qa.reply(key, result), [label, outcome]);
    const invFeedback = (kind, text) => page.locator(`[data-sonner-toast][data-type=${kind}]`).filter({ hasText: text }).waitFor();
    const invReady = (text) => page.getByText(text, { exact: true }).waitFor();
    const invCloses = async (role) => {
      await page.locator(`[role=${role ?? 'dialog'}]`).waitFor({ state: 'detached' });
      await frame();
    };
    const invEnter = async (origin, id = 'A', historyReady = true) => {
      if (origin !== 'detalhe') return;
      await invRow(id).click();
      await heading(`Investimento ${id}`).waitFor();
      if (historyReady) await invReady(`Histórico ${id}`);
    };
    const invCheckMutation = (all, method, body) => {
      const writes = all.filter((call) => call.method !== 'GET').map(({ method: m, url: u, body: b }) => ({ method: m, url: u, body: b }));
      same(writes, [{ method, url: invCollection, body }], 'método/destino/payload');
    };

    // Helper Consórcios
    const conCollection = '/api/consortiums';
    const conOpenA = () => btn(page, 'Abrir consórcio Cota A');
    const conOpenB = () => btn(page, 'Abrir consórcio Cota B');
    const conCreate = () => btn(page, 'Novo consórcio');
    const conDialogFor = (action) => page.getByRole(action === 'Editar' ? 'dialog' : 'alertdialog', { name: `${action} Consórcio`, exact: true });
    const conListState = () => page.evaluate(() => ({
      readReleased: window.qa.readReleased,
      pendingRead: !!window.qa.pending.read,
      listMounted: !!document.getElementById('consortium-list-title'),
      aInList: !!document.getElementById('consortium-open-a'),
      detailMounted: !!document.getElementById('consortium-detail-title'),
    }));
    const conRequests = () => page.evaluate(() => ({
      writes: window.qa.calls.filter(({ method }) => method !== 'GET').map(({ method, url: u, rawBody }) => ({ method, url: u, body: rawBody ?? null })),
      reads: window.qa.calls.filter(({ method, url: u }) => method === 'GET' && u === '/api/consortiums').length,
      unexpected: window.qa.unexpected,
    }));
    const sameFocus = (want, got) => want.role === got.role && want.name === got.name && got.connected && got.focused;

    async function conAttachUnmountWatch(dialog, isDelete) {
      await dialog.evaluate((portal, del) => {
        if (del) window.qa.deletePortal = portal;
        portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
          window.qa.closePoint = {
            focus: window.qa.focus(),
            portalConnected: portal.isConnected,
            aInList: !!document.getElementById('consortium-open-a'),
            listMounted: !!document.getElementById('consortium-list-title'),
            bInList: !!document.getElementById('consortium-open-b'),
            readReleased: window.qa.readReleased,
            pendingRead: !!window.qa.pending.read,
            earlyJsonWhilePortalConnected: window.qa.earlyJsonWhilePortalConnected ?? null,
          };
        }), { once: true });
      }, isDelete);
    }

    async function conClosed(dialog) {
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => window.qa.closePoint !== null);
      const point = await page.evaluate(() => window.qa.closePoint);
      require(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
      return point;
    }

    async function conEnterDetail() {
      await conOpenA().click();
      await heading('Cota A').waitFor();
      await page.waitForFunction(() => document.activeElement?.id === 'consortium-detail-title');
    }

    if (phase === 'core') {
      // 1. Testemunha do tema e viewport (todas as células)
      await scenario('testemunha do tema e viewport', 'investments', async () => {
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

      // 2. Investimentos: Tab / Escape / Cancelar + preservação de papel (todas as células)
      for (const origin of ['carteira', 'detalhe']) {
        await scenario(`investimentos/${origin}/Tab-Escape-Cancelar`, 'investments', async () => {
          await invEnter(origin);
          const points = [];
          for (const [label, opener, role, oppositeRole] of [
            ['edição', invEdit, 'dialog', 'alertdialog'],
            ['exclusão', invRemove, 'alertdialog', 'dialog'],
          ]) {
            const target = opener(origin);
            const previous = origin === 'detalhe'
              ? (label === 'edição' ? invBack() : invEdit(origin))
              : (label === 'edição' ? invRow('A') : invEdit(origin));
            for (const how of ['Escape', 'Cancelar']) {
              await tabTo(previous, target);
              await page.keyboard.press('Enter');
              await invDialog(role).waitFor();
              same(await page.locator(`[role=${oppositeRole}]`).count(), 0, `papel incorreto aberto (${oppositeRole})`);
              if (role === 'dialog') {
                same(await invDialog(role).getByRole('button', { name: 'Fechar formulário', exact: true }).count(), 1, 'saída superior nomeada ausente');
              }
              await assertReflow(`[role=${role}]`);
              await page.keyboard.press('Tab');
              require(await invDialog(role).evaluate((node) => node.contains(document.activeElement)), 'Tab escapou da casca modal');
              if (how === 'Escape') await page.keyboard.press('Escape');
              else await invAction(how, role).click();
              await invCloses(role);
              points.push({ label, ...(await watchInv(target, how)) });
            }
          }
          require((await calls()).every((call) => call.method === 'GET'), 'Escape/Cancelar não deve gravar');
          return { points, violations: points.some((p) => !p.matches) ? ['foco não retornou à origem'] : [] };
        });
      }

      // 3. Consórcios: Tab / Escape / Cancelar + preservação de papel (todas as células)
      for (const origin of ['list', 'detail']) {
        await scenario(`consorcios/${origin}/Tab-Escape-Cancelar`, 'consortiums', async () => {
          if (origin === 'detail') await conEnterDetail();
          const points = [];
          for (const [action, role, oppositeRole] of [
            ['Editar', 'dialog', 'alertdialog'],
            ['Excluir', 'alertdialog', 'dialog'],
          ]) {
            const target = btn(page, origin === 'list' ? `${action} consórcio Cota A` : action);
            const previous = origin === 'list'
              ? (action === 'Editar' ? conOpenA() : btn(page, 'Editar consórcio Cota A'))
              : (action === 'Editar' ? btn(page, 'Voltar aos consórcios') : btn(page, 'Editar'));
            for (const how of ['Escape', 'Cancelar']) {
              await page.evaluate(() => { window.qa.closePoint = null; });
              await tabTo(previous, target);
              const before = await target.evaluate((node) => window.qa.focus(node));
              const originHandle = await target.elementHandle();
              try {
                await page.keyboard.press('Enter');
                const dialog = conDialogFor(action);
                await dialog.waitFor();
                same(await page.locator(`[role=${oppositeRole}]`).count(), 0, `papel incorreto aberto (${oppositeRole})`);
                await assertReflow(`[role=${role}]`);
                await page.keyboard.press('Tab');
                require(await dialog.evaluate((node) => node.contains(document.activeElement)), 'Tab escapou da casca modal');
                await conAttachUnmountWatch(dialog, action === 'Excluir');
                if (how === 'Escape') await page.keyboard.press('Escape');
                else await btn(dialog, 'Cancelar').click();
                const point = await conClosed(dialog);
                const originFocus = await originHandle.evaluate((node) => window.qa.focus(node));
                const readback = await conRequests();
                require(readback.writes.length === 0 && readback.reads === 1, 'Cancelar enviou gravação ou releitura');
                points.push({ action, how, before, point, originFocus });
              } finally {
                await originHandle.dispose();
              }
            }
          }
          const violations = points.some((p) => !sameFocus(p.before, p.point.focus) || !p.originFocus.focused || !p.originFocus.connected)
            ? ['cancelamento não voltou à origem']
            : [];
          return { points, violations };
        });
      }
    }

    if (phase === 'inv-writes') {
    // 5. Investimentos: falhas (http, transport, http após OK)
    for (const origin of ['criação', 'carteira', 'detalhe']) {
      const create = origin === 'criação';
      const opener = () => create ? btn(page, 'Novo investimento') : invEdit(origin);
      for (const result of ['http', 'transport', 'http após OK']) {
        await scenario(`investimentos/${origin}/gravação/${result}`, 'investments', async () => {
          await invEnter(origin);
          await opener().click();
          const submit = invAction(create ? 'Criar' : 'Salvar');
          const before = (await calls()).length;
          await invNameField().fill('  ');
          await submit.click();
          await invFeedback('error', 'Informe o nome do investimento');
          same((await calls()).length, before, 'nome inválido enviou mutação');
          await invNameField().fill('  Rascunho sintético  ');
          await submit.click();
          await invPending('write');
          require(await invAction('Salvando…').isDisabled(), 'envio pendente não desabilita ação');
          invCheckMutation(await calls(), create ? 'POST' : 'PUT', {
            ...(create ? {} : { id: 'a' }),
            name: 'Rascunho sintético',
            type: create ? 'STOCK' : 'CDB',
            investedAmount: create ? 0 : 1200,
            yieldRate: 0,
          });
          const points = [await activeInv()];
          const success = result === 'http após OK';
          await invReply('write', success ? 'ok' : result);
          if (success) {
            await invPending('refresh');
            await invFeedback('success', create ? 'Investimento criado!' : 'Investimento atualizado!');
            await invCloses();
            points.push(await watchInv(opener(), 'OK com GET pendente'));
            await invReply('refresh', 'http');
            if (origin !== 'detalhe') await invReady('Não foi possível carregar os investimentos.');
            await frame();
            require(!(await invDialog().count()), 'GET 503 reabriu o editor');
            points.push(await watchInv(opener(), 'após GET 503'));
            same(
              (await calls()).slice(before + 1).map((call) => call.url),
              [invCollection, ...(origin === 'detalhe' ? [invHistoryUrl('a')] : [])],
              'GET após OK',
            );
          } else {
            await invFeedback('error', 'Erro ao salvar investimento');
            require(await invDialog().isVisible(), 'erro fechou editor');
            same(await invNameField().inputValue(), '  Rascunho sintético  ', 'rascunho perdido');
            same((await calls()).length, before + 1, 'erro disparou GET');
            points.push(await activeInv());
            await invAction('Cancelar').click();
            await invCloses();
            points.push(await watchInv(opener(), 'Cancelar após erro'));
          }
          return { points, violations: points.slice(1).some((p) => 'matches' in p && !p.matches) ? ['foco perdido após gravação'] : [] };
        });
      }
    }
    }

    if (phase === 'inv-interleaving') {
    // 6. Investimentos: exclusão com foco sobrevivente + A/B no editor
    for (const origin of ['carteira', 'detalhe']) {
      for (const interleaving of ['GET imediato', 'GET retido']) {
        await scenario(`investimentos/${origin}/exclusão/${interleaving}`, 'investments', async () => {
          await invEnter(origin);
          await invRemove(origin).click();
          await invDialog('alertdialog').waitFor();
          const before = (await calls()).length;
          for (const result of ['http', 'ok']) {
            await invAction('Excluir', 'alertdialog').click();
            await invPending('write');
            require(await invAction('Excluir', 'alertdialog').isDisabled(), 'Excluir habilitado sob pendência');
            await page.keyboard.press('Escape');
            require(await invDialog('alertdialog').isVisible(), 'Escape dispensou confirmação pendente');
            await invReply('write', result === 'ok' && interleaving === 'GET imediato' ? 'delete-quick' : result);
            if (result === 'http') {
              await invFeedback('error', 'Erro ao excluir investimento');
              require(await invDialog('alertdialog').isVisible(), 'falha fechou a confirmação');
              same(
                (await calls()).slice(before).map(({ method: m, url: u, body: b }) => ({ method: m, url: u, body: b })),
                [{ method: 'DELETE', url: invCollection, body: { id: 'a' } }],
                'DELETE falho',
              );
            }
          }
          if (interleaving === 'GET retido') await invPending('refresh');
          await invCloses('alertdialog');
          const points = [await watchInv(invPortfolioTitle(), 'fechamento')];
          points[0].rowA = await invRow('A').count() === 1;
          if (interleaving === 'GET retido') {
            require(points[0].rowA, 'registro removido antes de permitir GET');
            await invReply('refresh', 'delete');
          }
          await invRow('A').waitFor({ state: 'detached' });
          await invRow('B').waitFor();
          points.push(await watchInv(invPortfolioTitle(), 'após GET e remoção da linha'));
          if (interleaving === 'GET imediato') {
            const timing = await page.evaluate(() => window.qa.immediateRead);
            same(timing.map(({ phase }) => phase), ['GET iniciado', 'corpo do GET decodificado'], 'GET imediato não observado');
            points.unshift(...timing);
          }
          same(
            (await calls()).slice(before).map(({ method: m, url: u, body: b }) => ({ method: m, url: u, ...(b ? { body: b } : {}) })),
            [
              { method: 'DELETE', url: invCollection, body: { id: 'a' } },
              { method: 'DELETE', url: invCollection, body: { id: 'a' } },
              { method: 'GET', url: invCollection },
            ],
            'sequência de exclusão',
          );
          const violations = points.filter((p) => 'matches' in p && !p.matches).length ? ['foco não sobreviveu'] : [];
          return { points, violations };
        });
      }

      await scenario(`investimentos/${origin}/editor-A-B`, 'investments', async () => {
        if (origin === 'detalhe') await page.evaluate(() => window.qa.holdHistoryA());
        await invEnter(origin, 'A', false);
        if (origin === 'detalhe') await invPending('history');
        await invEdit(origin).click();
        await invNameField().fill('Rascunho A');
        await invAction('Salvar').click();
        await invPending('write');
        await invAction('Cancelar').click();
        await invCloses();
        const points = [await watchInv(invEdit(origin), 'Cancelar A')];
        if (origin === 'detalhe') {
          await invBack().click();
          await invEnter(origin, 'B');
        }
        await invEdit(origin, 'B').click();
        await invNameField().fill('Rascunho B');
        require(await invAction('Salvando…').isDisabled(), 'B tenta salvar durante PUT A');
        const before = (await calls()).length;
        await invReply('write', 'ok');
        await invPending('refresh');
        await invFeedback('success', 'Investimento atualizado!');
        await invCloses();
        points.push(await watchInv(invEdit(origin, 'B'), 'OK de A fecha B'));
        await invReply('refresh', 'ok');
        if (origin === 'carteira') await invRow('A').waitFor({ state: 'detached' });
        else {
          await invReply('history', 'ok');
          await frame();
          await invReady('Histórico B');
          require(!(await page.getByText('Histórico A atrasado', { exact: true }).count()), 'histórico A publicado em B');
          await heading('Investimento B').waitFor();
        }
        points.push(await watchInv(invEdit(origin, 'B'), 'após releitura'));
        invCheckMutation(await calls(), 'PUT', { id: 'a', name: 'Rascunho A', type: 'CDB', investedAmount: 1200, yieldRate: 0 });
        same((await calls()).slice(before).map(({ method, url: u }) => ({ method, url: u })), [{ method: 'GET', url: invCollection }], 'releitura obsoleta em B');
        return { points, violations: points.some((p) => !p.matches) ? ['foco A/B divergiu'] : [] };
      });
    }
    }

    if (phase === 'con-detail') {
      // 4. Consórcios: exclusão em lista e detalhe nas ordens early e late
      for (const origin of ['list', 'detail']) {
        for (const order of ['early', 'late']) {
          await scenario(`consorcios/${origin}/Excluir/${order}`, 'consortiums', async () => {
            if (origin === 'detail') await conEnterDetail();
            const trigger = btn(page, origin === 'list' ? 'Excluir consórcio Cota A' : 'Excluir');
            await trigger.focus();
            const before = await trigger.evaluate((node) => window.qa.focus(node));
            require(before.focused && before.connected && before.role === 'button', `Origem inválida: ${JSON.stringify(before)}`);
            const originHandle = await trigger.elementHandle();
            try {
              await trigger.click();
              const dialog = conDialogFor('Excluir');
              await dialog.waitFor();
              await conAttachUnmountWatch(dialog, true);
              await page.evaluate((mode) => { window.qa.conMode = mode; }, order);
              await btn(dialog, 'Excluir').click();
              await page.waitForFunction(() => !!window.qa.pending.write);
              require(await dialog.isVisible() && await btn(dialog, 'Excluir').isDisabled(), 'Alerta não guardou a exclusão em voo');
              await page.evaluate(() => window.qa.releaseCon('write'));
              const point = await conClosed(dialog);
              const originAtClose = await originHandle.evaluate((node) => window.qa.focus(node));
              require(point.listMounted && point.bInList, `${origin}/${order}: lista com B ausente no fechamento`);
              if (order === 'early') {
                require(
                  point.earlyJsonWhilePortalConnected && point.readReleased && !point.pendingRead && !point.aInList,
                  `${origin}/${order}: entrega do JSON/remoção de A antes do retorno de foco não comprovadas: ${JSON.stringify(point)}`,
                );
              } else {
                require(
                  point.pendingRead && !point.readReleased && point.aInList,
                  `${origin}/${order}: GET não retido no retorno de foco: ${JSON.stringify(point)}`,
                );
                await page.evaluate(() => window.qa.releaseCon('read'));
              }
              await conOpenA().waitFor({ state: 'detached' });
              await conOpenB().waitFor();
              const afterRead = await conListState();
              require(
                afterRead.listMounted && !afterRead.aInList && !afterRead.detailMounted && afterRead.readReleased && !afterRead.pendingRead,
                `GET não removeu somente A: ${JSON.stringify(afterRead)}`,
              );
              const afterFocus = await page.evaluate(() => window.qa.focus());
              const originAfterRead = await originHandle.evaluate((node) => window.qa.focus(node));
              const createFocus = await conCreate().evaluate((node) => window.qa.focus(node));
              const { reads, writes } = await conRequests();
              require(
                reads === 2 && writes.length === 1 && writes[0].method === 'DELETE' && writes[0].url === conCollection && writes[0].body === '{"id":"a"}',
                `DELETE incorreto: ${JSON.stringify({ writes, reads })}`,
              );
              const violations = [];
              if (origin === 'list' && order === 'late') {
                if (!sameFocus(before, point.focus) || !originAtClose.connected || !originAtClose.focused) {
                  violations.push('fechamento com GET retido não restaurou a origem conectada');
                }
              } else if (!sameFocus(createFocus, point.focus)) {
                violations.push('fechamento sem origem conectada não restaurou o fallback de criação');
              }
              if (!afterFocus.connected || !afterFocus.focused || afterFocus.role === 'body') {
                violations.push('foco não sobreviveu à remoção da linha');
              }
              return { before, point, originAtClose, afterRead, afterFocus, originAfterRead, createFocus, violations };
            } finally {
              await originHandle.dispose();
            }
          });
        }
      }

      // 7. Consórcios: falhas (http, invalid-json, transport) + retry (http após OK)
    for (const origin of ['list', 'detail']) {
      for (const mode of ['http', 'invalid-json', 'transport']) {
        await scenario(`consorcios/${origin}/Editar/${mode}+retry`, 'consortiums', async () => {
          if (origin === 'detail') await conEnterDetail();
          const trigger = btn(page, origin === 'list' ? 'Editar consórcio Cota A' : 'Editar');
          await trigger.focus();
          const before = await trigger.evaluate((node) => window.qa.focus(node));
          await trigger.click();
          const dialog = conDialogFor('Editar');
          await dialog.waitFor();
          await conAttachUnmountWatch(dialog, false);
          const date = dialog.getByLabel('Próxima Data de Assembleia', { exact: true });
          const count = dialog.getByRole('spinbutton', { name: 'Assembleias Assistidas', exact: true });
          require(await date.inputValue() === '2026-05-15' && await count.inputValue() === '1', 'Rascunho inicial diferente');
          await date.fill('2027-01-02');
          await count.fill('0');
          await page.evaluate((failure) => { window.qa.conMode = failure; }, mode);
          await btn(dialog, 'Salvar').click();
          await page.getByText(mode === 'http' ? 'Falha sintética' : 'Erro ao atualizar consórcio', { exact: true }).waitFor({ state: 'attached' });
          const draft = { date: await date.inputValue(), count: await count.inputValue() };
          const afterFailure = await conRequests();
          const failureFocus = await page.evaluate(() => window.qa.focus());
          require(afterFailure.reads === 1 && afterFailure.writes.length === 1 && draft.date === '2027-01-02' && draft.count === '0', 'A falha não preservou rascunho/abertura');
          await page.evaluate(() => { window.qa.conMode = 'retry'; });
          await btn(dialog, 'Salvar').click();
          const point = await conClosed(dialog);
          await page.getByText('Consórcio atualizado!', { exact: true }).waitFor({ state: 'attached' });
          await page.waitForFunction(() => window.qa.refreshStatus === 503);
          if (origin === 'list') {
            await conOpenA().waitFor();
            await conOpenB().waitFor();
          } else {
            await heading('Cota A').waitFor();
          }
          const afterRetry = await conRequests();
          const expected = '{"id":"a","nextAssemblyDate":"2027-01-02","assembliesAttended":0}';
          require(
            afterRetry.reads === 2 && afterRetry.writes.length === 2
              && afterRetry.writes.every(({ method, url: u, body }) => method === 'PUT' && u === conCollection && body === expected),
            'PUT ou releitura incorretos',
          );
          return {
            before,
            draft,
            failureFocus,
            point,
            refreshStatus: await page.evaluate(() => window.qa.refreshStatus),
            afterRetryFocus: await page.evaluate(() => window.qa.focus()),
            violations: [],
          };
        });
      }
    }
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

const dir = await mkdtemp(join(scratch, 'quiet-dialog-shell-'));
const session = `quiet-dialog-shell-${randomUUID()}`;
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

  const entry = `import { InvestmentsView } from ${JSON.stringify(investmentsViewPath)};
    import { ConsortiumsView } from ${JSON.stringify(consortiumsViewPath)};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    (${installFixture.toString()})(InvestmentsView, ConsortiumsView, createElement, createRoot, ThemeProvider, Toaster);`;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-finance-dialog-shell',
        setup(build) {
          build.onLoad({ filter: /quiet-finance-dialog-shell\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad(
              { filter: /\/(investment-editor|investment-delete-confirmation|consortium-editor|consortium-delete-confirmation)\.tsx$/ },
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
      assert.equal(intercepted.size, baselineSpecs.length, `Baseline não interceptou todos os 4 módulos (${intercepted.size}/${baselineSpecs.length})`);
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
    'finance-dialog-shell.tsx': digest(await readFile(sharedShellPath)),
  };
  for (const spec of baselineSpecs) {
    candidateHashes[spec.file] = digest(await readFile(join(financeDir, spec.file)));
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

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const detailed = width === 390 && theme === 'light';
      const phases = detailed ? ['core', 'inv-writes', 'inv-interleaving', 'con-detail'] : ['core'];
      const expectedCount = detailed ? 30 : 5;
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
          const isPreexistingListLateFocus =
            entryResult.name === 'consorcios/list/Excluir/late'
            && violation === 'foco não sobreviveu à remoção da linha'
            && baseEntry?.violations.includes(violation);
          if (isPreexistingListLateFocus) {
            preexistingQuietDivergences.push({
              cell: `${width}/${theme}`,
              scenario: 'list/Excluir/late',
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
      warning: 'AVISO: divergência Quiet preexistente aberta (NÃO constitui conformidade Quiet; ver Decisão 6, task-0004 e task-0008).',
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

if (failures.length) throw new AggregateError(failures, 'QA de FinanceDialogShell não concluído');
