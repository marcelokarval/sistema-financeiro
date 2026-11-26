// Só execute (inclusive bundle/help/version/cleanup) dentro do preflight aprovado de 0004.
// O supervisor prova isolamento do SO da árvore inteira e descarte do perfil.
// QUIET_QA_BASELINE_VIEW: arquivo RO do commit abaixo; QUIET_QA_SCRATCH: tmpfs privado.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '25b44535c5068b99044afa03f7ecf318e7a9726f';
const baseHash = '4319219789363574a83d96e270b22ab60f184851489831421c684466a0d319b8';
const source = fileURLToPath(import.meta.url);
const view = join(dirname(source), 'consortiums-view.tsx');
const root = fileURLToPath(new URL('../../../', import.meta.url));

function installFixture(ConsortiumsView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, ThemeProvider, Toaster, toast) {
  const collection = '/api/consortiums';
  const records = ['a', 'b'].map((id) => ({
    id, description: `Cota ${id.toUpperCase()}`, group: '9', quota: id, administrator: 'Administradora sintética',
    totalAmount: 900, fundedAmount: 300, monthlyPayment: 300, installmentCount: 3, paidInstallments: 1,
    startDate: '2026-01-01', nextAssemblyDate: '2026-05-15T00:00:00.000Z', assembliesAttended: 1,
    status: 'CONTEMPLATED', categoryId: null, category: null, accountId: null, isActive: true,
  }));
  const qa = window.qa = { calls: [], unexpected: [], mode: null, pending: {}, readReleased: false, closePoint: null, rootInstance: null };
  let deleted = false;
  let updated = false;
  qa.refreshStatus = null;
  const readRows = () => records.filter(({ id }) => !deleted || id !== 'a');
  const hold = (key) => new Promise((resolve) => { qa.pending[key] = resolve; });
  qa.release = (key) => {
    const resolve = qa.pending[key];
    if (!resolve) throw new Error(`Sem resposta pendente: ${key}`);
    delete qa.pending[key];
    if (key === 'write') {
      deleted = true;
      resolve(new Response(null, { status: 204 }));
    } else {
      qa.readReleased = true;
      resolve(Response.json(readRows()));
    }
  };
  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url, body: init?.body ?? null });
    if (method === 'GET') {
      if (url === collection) {
        if (updated) {
          qa.refreshStatus = 503;
          return new Response(null, { status: qa.refreshStatus });
        }
        if (deleted && qa.mode === 'late') return hold('read');
        if (deleted && qa.mode === 'early') {
          qa.readReleased = true;
          const rows = readRows();
          // Entrega o JSON no mesmo turno do DELETE, sem a tarefa de leitura do stream.
          return { ok: true, json: () => {
            qa.earlyJsonWhilePortalConnected = qa.deletePortal?.isConnected === true;
            return Promise.resolve(rows);
          } };
        }
        return Response.json(readRows());
      }
      if (url === '/api/categories' || url === '/api/accounts' || url === `${collection}/installments?consortiumId=a`) {
        return Response.json([]);
      }
    }
    if (url === collection && method === 'DELETE' && ['early', 'late'].includes(qa.mode)) return hold('write');
    if (url === collection && method === 'PUT') {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'invalid-json') return new Response('não JSON', { status: 503 });
      if (qa.mode === 'transport') throw new Error('Falha sintética de transporte');
      if (qa.mode === 'retry') {
        updated = true;
        return new Response(null, { status: 204 });
      }
    }
    qa.unexpected.push(`${method} ${url}`);
    throw new Error('Fetch fora da fixture de Consórcios');
  };
  qa.mount = (theme) => {
    toast.dismiss();
    if (qa.rootInstance) qa.rootInstance.unmount();
    deleted = false;
    updated = false;
    qa.calls = [];
    qa.unexpected = [];
    qa.mode = null;
    qa.pending = {};
    qa.readReleased = false;
    qa.closePoint = null;
    qa.refreshStatus = null;
    qa.earlyJsonWhilePortalConnected = null;
    qa.deletePortal = null;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    qa.rootInstance = createRoot(document.getElementById('root'));
    qa.rootInstance.render(createElement(ThemeProvider,
      { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
      createElement(AppIntlProvider, { locale: 'pt', messages: getMessagesForLocale('pt') },
        createElement(ConsortiumsView), createElement(Toaster))));
  };
  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button' :
      /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName.toLowerCase() ?? null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

// Serializado para a VM do CLI. As leituras DOM correm dentro da página.
async function runCases(page, html, width, theme) {
  const url = 'https://finance-qa.invalid/';
  const collection = '/api/consortiums';
  const results = [];
  const errors = [];
  const blocked = [];
  const pageError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    if (req.url() === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    blocked.push(req.url());
    return route.abort();
  };
  const invariant = (ok, message) => { if (!ok) throw new Error(message); };
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  const openA = () => button(page, 'Abrir consórcio Cota A');
  const openB = () => button(page, 'Abrir consórcio Cota B');
  const create = () => button(page, 'Novo consórcio');
  const dialogFor = (action) => page.getByRole(action === 'Editar' ? 'dialog' : 'alertdialog', { name: `${action} Consórcio`, exact: true });
  const listState = () => page.evaluate(() => ({
    readReleased: window.qa.readReleased,
    pendingRead: !!window.qa.pending.read,
    listMounted: !!document.getElementById('consortium-list-title'),
    aInList: !!document.getElementById('consortium-open-a'),
    detailMounted: !!document.getElementById('consortium-detail-title'),
  }));
  const requests = () => page.evaluate(() => ({
    writes: window.qa.calls.filter(({ method }) => method !== 'GET'),
    reads: window.qa.calls.filter(({ method, url }) => method === 'GET' && url === '/api/consortiums').length,
    unexpected: window.qa.unexpected,
  }));
  async function witnessTheme() {
    return page.evaluate(() => ({ width: innerWidth, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      background: getComputedStyle(document.body).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth }));
  }
  async function reset(origin, action, retainOrigin = true) {
    if (results.length) await checkFixture();
    await page.evaluate((name) => window.qa.mount(name), theme);
    await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0);
    await openA().waitFor();
    await openB().waitFor();
    if (origin === 'detail') {
      await openA().click();
      await heading('Cota A').waitFor();
      await page.waitForFunction(() => document.activeElement?.id === 'consortium-detail-title');
    }
    const trigger = button(page, origin === 'list' ? `${action} consórcio Cota A` : action);
    await trigger.focus();
    const before = await trigger.evaluate((node) => window.qa.focus(node));
    invariant(before.focused && before.connected && before.role === 'button', `Origem inválida: ${JSON.stringify(before)}`);
    // Após abrir, Radix oculta a origem na árvore acessível; guarde o nó antes do clique.
    const originHandle = retainOrigin ? await trigger.elementHandle() : undefined;
    await trigger.click();
    const dialog = dialogFor(action);
    await dialog.waitFor();
    // O timer do FocusScope roda após o desmonte. A microtask lê depois dos handlers de foco.
    await dialog.evaluate((portal, isDelete) => {
      if (isDelete) window.qa.deletePortal = portal;
      portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
        window.qa.closePoint = {
          focus: window.qa.focus(), portalConnected: portal.isConnected,
          aInList: !!document.getElementById('consortium-open-a'),
          listMounted: !!document.getElementById('consortium-list-title'),
          bInList: !!document.getElementById('consortium-open-b'),
          readReleased: window.qa.readReleased, pendingRead: !!window.qa.pending.read,
          earlyJsonWhilePortalConnected: window.qa.earlyJsonWhilePortalConnected ?? null,
        };
      }), { once: true });
    }, action === 'Excluir');
    return { dialog, originHandle, before };
  }
  async function closed(dialog) {
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.qa.closePoint !== null);
    const point = await page.evaluate(() => window.qa.closePoint);
    invariant(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
    return point;
  }
  async function checkFixture() {
    const { unexpected } = await requests();
    invariant(errors.length === 0 && blocked.length === 0 && unexpected.length === 0, JSON.stringify({ errors, blocked, unexpected }));
  }
  function sameFocus(want, got) {
    return want.role === got.role && want.name === got.name && got.connected && got.focused;
  }

  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  page.on('pageerror', pageError);
  await page.route('**/*', routeAll);
  try {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.qa));
    for (const origin of ['list', 'detail']) {
      for (const action of ['Editar', 'Excluir']) {
        for (const how of ['Escape', 'Cancelar']) {
          const { dialog, originHandle, before } = await reset(origin, action);
          try {
            if (how === 'Escape') await page.keyboard.press('Escape');
            else await button(dialog, 'Cancelar').click();
            const point = await closed(dialog);
            const originFocus = await originHandle.evaluate((node) => window.qa.focus(node));
            const readback = await requests();
            const violations = [];
            if (!sameFocus(before, point.focus) || !originFocus.focused || !originFocus.connected) violations.push('cancelamento não voltou à origem');
            invariant(readback.writes.length === 0 && readback.reads === 1, 'Cancelar enviou gravação ou releitura');
            results.push({ name: `${origin}/${action}/${how}`, before, point, originFocus, violations });
          } finally {
            await originHandle.dispose();
          }
        }
      }
      for (const order of ['early', 'late']) {
        const { dialog, originHandle, before } = await reset(origin, 'Excluir');
        try {
          await page.evaluate((mode) => { window.qa.mode = mode; }, order);
          await button(dialog, 'Excluir').click();
          await page.waitForFunction(() => !!window.qa.pending.write);
          invariant(await dialog.isVisible() && await button(dialog, 'Excluir').isDisabled(), 'Alerta não guardou a exclusão em voo');
          await page.evaluate(() => window.qa.release('write'));
          const point = await closed(dialog);
          const originAtClose = await originHandle.evaluate((node) => window.qa.focus(node));
          invariant(point.listMounted && point.bInList, `${origin}/${order}: lista com B ausente no fechamento`);
          if (order === 'early') {
            invariant(point.earlyJsonWhilePortalConnected && point.readReleased && !point.pendingRead && !point.aInList,
              `${origin}/${order}: entrega do JSON/remoção de A antes do retorno de foco não comprovadas: ${JSON.stringify(point)}`);
          } else {
            invariant(point.pendingRead && !point.readReleased && point.aInList,
              `${origin}/${order}: GET não retido no retorno de foco: ${JSON.stringify(point)}`);
            await page.evaluate(() => window.qa.release('read'));
          }
          await openA().waitFor({ state: 'detached' });
          await openB().waitFor();
          const afterRead = await listState();
          invariant(afterRead.listMounted && !afterRead.aInList && !afterRead.detailMounted && afterRead.readReleased && !afterRead.pendingRead,
            `GET não removeu somente A: ${JSON.stringify(afterRead)}`);
          const afterFocus = await page.evaluate(() => window.qa.focus());
          const originAfterRead = await originHandle.evaluate((node) => window.qa.focus(node));
          const createFocus = await create().evaluate((node) => window.qa.focus(node));
          const { reads, writes } = await requests();
          invariant(reads === 2 && writes.length === 1 && writes[0].method === 'DELETE' && writes[0].url === collection &&
            writes[0].body === '{"id":"a"}', `DELETE incorreto: ${JSON.stringify({ writes, reads })}`);
          const violations = [];
          if (!sameFocus(createFocus, point.focus)) {
            violations.push('fechamento sem origem conectada não restaurou o fallback de criação');
          }
          // Um acionador conectado durante o GET retido não prova foco sobrevivente.
          if (!afterFocus.connected || !afterFocus.focused || afterFocus.role === 'body') violations.push('foco não sobreviveu à remoção da linha');
          results.push({ name: `${origin}/Excluir/${order}`, before, point, originAtClose, afterRead, afterFocus, originAfterRead, createFocus, violations });
        } finally {
          await originHandle.dispose();
        }
      }
      for (const mode of ['http', 'invalid-json', 'transport']) {
        const { dialog, before } = await reset(origin, 'Editar', false);
        const date = dialog.getByLabel('Próxima Data de Assembleia', { exact: true });
        const count = dialog.getByRole('spinbutton', { name: 'Assembleias Assistidas', exact: true });
        invariant(await date.inputValue() === '2026-05-15' && await count.inputValue() === '1', 'Rascunho inicial diferente');
        await date.fill('2027-01-02');
        await count.fill('0');
        await page.evaluate((failure) => { window.qa.mode = failure; }, mode);
        await button(dialog, 'Salvar').click();
        await page.getByText(mode === 'http' ? 'Falha sintética' : 'Erro ao atualizar consórcio', { exact: true }).waitFor({ state: 'attached' });
        const draft = { date: await date.inputValue(), count: await count.inputValue() };
        const afterFailure = await requests();
        const failureFocus = await page.evaluate(() => window.qa.focus());
        invariant(afterFailure.reads === 1 && afterFailure.writes.length === 1 && draft.date === '2027-01-02' && draft.count === '0', 'A falha não preservou rascunho/abertura');
        await page.evaluate(() => { window.qa.mode = 'retry'; });
        await button(dialog, 'Salvar').click();
        const point = await closed(dialog);
        await page.getByText('Consórcio atualizado!', { exact: true }).waitFor({ state: 'attached' });
        await page.waitForFunction(() => window.qa.refreshStatus === 503);
        if (origin === 'list') {
          // Com dados carregados, 503 não remove a lista nem exibe o retry de lista vazia.
          await openA().waitFor();
          await openB().waitFor();
        } else await heading('Cota A').waitFor();
        const afterRetry = await requests();
        const expected = '{"id":"a","nextAssemblyDate":"2027-01-02","assembliesAttended":0}';
        invariant(afterRetry.reads === 2 && afterRetry.writes.length === 2 &&
          afterRetry.writes.every(({ method, url, body }) => method === 'PUT' && url === collection && body === expected), 'PUT ou releitura incorretos');
        results.push({ name: `${origin}/Editar/${mode}+retry`, before, draft, failureFocus, point,
          refreshStatus: await page.evaluate(() => window.qa.refreshStatus),
          afterRetryFocus: await page.evaluate(() => window.qa.focus()), violations: [] });
      }
    }
    const witness = await witnessTheme();
    invariant(witness.width === width && witness.theme === theme && witness.background !== 'rgba(0, 0, 0, 0)', 'Viewport/tema não aplicado');
    await checkFixture();
    return { results, witness };
  } finally {
    page.off('pageerror', pageError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_BASELINE_VIEW, QUIET_QA_SCRATCH, CI } = process.env;
assert(isAbsolute(QUIET_QA_BASELINE_VIEW ?? '') && isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1',
  'Somente dentro da fronteira autorizada com baseline RO, scratch e CI=1');
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  assert(process.env[key] && (await realpath(process.env[key])).startsWith(`${scratch}/`), `${key} fora do scratch`);
}
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' });
assert(!('DATABASE_URL' in process.env));
const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baseline = await readFile(QUIET_QA_BASELINE_VIEW, 'utf8');
assert.equal(digest(baseline), baseHash);

const dir = await mkdtemp(join(scratch, 'quiet-consortiums-'));
const session = `quiet-consortiums-${randomUUID()}`;
const errors = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 450_000; // Não substitui o deadline/teardown do supervisor.
async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(120_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do controlador encerrado');
  const cmd = Bun.spawn(['playwright-cli', `-s=${session}`, ...args],
    { cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(cmd.stdout).text(), new Response(cmd.stderr).text(), cmd.exited,
  ]);
  assert(exit === 0 && !/^### Error\b/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  const { default: postcss } = await import('postcss');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwind({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'));
  const entry = `import { ConsortiumsView } from ${JSON.stringify(view)};
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { createElement } from 'react'; import { createRoot } from 'react-dom/client';
    import { Toaster, toast } from 'sonner'; import { ThemeProvider } from 'next-themes';
    (${installFixture.toString()})(ConsortiumsView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, ThemeProvider, Toaster, toast);`;
  async function htmlFor(label, original) {
    const bundle = await Bun.build({ entrypoints: [source], target: 'browser', format: 'iife', minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'fixture sintética de Consórcios', setup(build) {
        build.onLoad({ filter: /quiet-consortiums-editor\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
        if (original) build.onLoad({ filter: /\/consortiums-view\.tsx$/ }, (args) => {
          assert.equal(args.path, view);
          return { contents: original, loader: 'tsx' };
        });
      } }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(file, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`);
    return file;
  }
  const html = { baseline: await htmlFor('baseline', baseline), candidate: await htmlFor('candidate') };
  const candidate = {};
  for (const file of ['consortiums-view.tsx', 'consortium-editor.tsx', 'consortium-delete-confirmation.tsx', 'quiet-consortiums-editor.qa.mjs']) {
    candidate[file] = digest(await readFile(join(dirname(source), file)));
  }
  console.log(JSON.stringify({ session, baseRef, baseHash, candidate }));
  assert.equal(JSON.parse(await cli('--version', '--json')).version, '0.1.22', 'Versão do CLI exige revisão de capacidades');
  assert.match(await cli('open', '--help'), /--idle-timeout/);
  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');
  const gaps = [];
  let total = 0;
  const withoutRemediatedListLate = (report) => ({
    ...report,
    results: report.results.filter(({ name }) => name !== 'list/Excluir/late'),
  });
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = {};
      for (const label of ['baseline', 'candidate']) {
        const report = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)})`);
        const result = report.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: resultado DOM ausente`);
        observed[label] = JSON.parse(result);
        assert.equal(observed[label].results.length, 18, `${label}: cenário não executado`);
      }
      total += observed.candidate.results.length;
      backgrounds.push(observed.candidate.witness.background);
      console.log(JSON.stringify({ width, theme, ...observed }));
      if (!Bun.deepEquals(withoutRemediatedListLate(observed.baseline), withoutRemediatedListLate(observed.candidate))) {
        gaps.push(`${width}/${theme}: divergência de paridade`);
      }
      for (const result of observed.candidate.results) {
        const base = observed.baseline.results.find(({ name }) => name === result.name);
        for (const violation of result.violations) {
          gaps.push(`${width}/${theme} ${result.name}: ${base?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
        }
      }
      if (observed.candidate.witness.overflow) gaps.push(`${width}/${theme}: rolagem horizontal`);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }
  assert.deepEqual(gaps, [], 'Falha no contrato Quiet; paridade não isenta divergência preexistente');
  console.log(`${total} cenários pareados; 0 skips.`);
} catch (error) {
  errors.push(error);
} finally {
  async function cleanup(label, action) {
    try { await action(); } catch (error) { errors.push(new Error(`${label}: ${error.message}`, { cause: error })); }
  }
  if (attemptedOpen) {
    const before = errors.length;
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
    if (errors.length === before) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}
if (errors.length) throw new AggregateError(errors, 'QA de Consórcios não concluído');
