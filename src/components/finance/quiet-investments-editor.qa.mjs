// Execute somente dentro do preflight de navegador de 0003. O executor prova
// a fronteira do SO, não este script. Disponibilize QUIET_QA_BASELINE_VIEW como
// arquivo somente leitura do commit abaixo e QUIET_QA_SCRATCH como tmpfs privado.
// Não monte .git, o checkout inteiro, HOME do host, .env ou banco.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const baselineRef = '25b44535c5068b99044afa03f7ecf318e7a9726f';
const baselineHash = '7ae824c5118d85f6e7a3406dc7aeb745fd12a3c58fe8a306137810a45ceeb6d1';
const source = fileURLToPath(import.meta.url);
const view = join(dirname(source), 'investments-view.tsx');
const root = fileURLToPath(new URL('../../../', import.meta.url));

function installFixture(InvestmentsView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, Toaster) {
  const records = ['a', 'b'].map((id) => ({
    id, name: `Investimento ${id.toUpperCase()}`, type: 'CDB', investedAmount: 1200, currentBalance: 1350, yieldRate: 0,
  }));
  const collection = '/api/investments';
  const history = `${collection}/transactions`;
  const qa = window.qa = { calls: [], pending: {}, unexpected: [], immediateRead: [] };
  const held = (label) => new Promise((resolve, reject) => { qa.pending[label] = { resolve, reject }; });
  const entry = (id, title) => ({ id: `hist-${id}`, description: title, type: 'APORTE', amount: 12, date: '2026-05-01' });
  let holdRefresh = false;
  let holdHistoryA = false;
  qa.holdHistoryA = () => { holdHistoryA = true; };
  qa.reply = (label, outcome) => {
    const { resolve, reject } = qa.pending[label];
    delete qa.pending[label];
    if (outcome === 'transport') return reject(new Error('Rejeição sintética'));
    if (outcome === 'http') return resolve(Response.json({ error: 'Indisponível' }, { status: 503 }));
    if (label === 'write') return resolve(new Response(null, { status: 204, headers: { 'X-QA-Refresh': outcome } }));
    if (label === 'history') return resolve(Response.json([entry('a', 'Histórico A atrasado')]));
    if (outcome === 'delete') return resolve(Response.json(records.slice(1)));
    return resolve(Response.json([{ ...records[0], name: 'Investimento A confirmado' }, records[1]]));
  };
  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url, ...(init?.body ? { body: JSON.parse(init.body) } : {}) });
    if (url === collection && ['PUT', 'POST', 'DELETE'].includes(method)) {
      const response = await held('write');
      if (response.ok) holdRefresh = response.headers.get('X-QA-Refresh');
      return response;
    }
    if (url === collection && method === 'GET') {
      if (holdRefresh === 'delete-quick') {
        const snapshot = (phase) => qa.immediateRead.push({ phase,
          alert: Boolean(document.querySelector('[role=alertdialog]')),
          rowA: Boolean(document.getElementById('investment-row-a')),
        });
        snapshot('GET iniciado');
        const response = Response.json(records.slice(1));
        const json = response.json.bind(response);
        response.json = async () => {
          const payload = await json();
          snapshot('corpo do GET decodificado');
          return payload;
        };
        return response;
      }
      return holdRefresh ? held('refresh') : Response.json(records);
    }
    if (url === '/api/accounts') return Response.json([{ id: 'qa-account', name: 'Conta sintética' }]);
    if (url === '/api/categories') return Response.json([{ id: 'qa-category', name: 'Categoria sintética' }]);
    if (url === history) return Response.json([]);
    if (url === `${history}?investmentId=a` && holdHistoryA) return held('history');
    if (url === `${history}?investmentId=a` || url === `${history}?investmentId=b`) {
      const id = url.at(-1);
      return Response.json([entry(id, `Histórico ${id.toUpperCase()}`)]);
    }
    qa.unexpected.push(`${method} ${url}`);
    throw new Error('Requisição inesperada na fixture');
  };
  qa.mount = (theme) => {
    document.documentElement.classList.add(theme);
    createRoot(document.getElementById('root')).render(
      createElement(
        AppIntlProvider,
        { locale: 'pt', messages: getMessagesForLocale('pt') },
        createElement('main', { className: 'min-h-screen bg-background p-3', id: 'fixture' },
          createElement(InvestmentsView), createElement(Toaster, { theme })),
      ),
    );
  };
}

// Serializado pelo CLI no sandbox. Não depende de globals Node na VM.
async function runCases(page, html, width, theme, detailed) {
  const url = 'https://finance-qa.invalid/';
  const rejected = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => route.request().url() === url && route.request().isNavigationRequest()
    ? route.fulfill({ path: html, contentType: 'text/html' })
    : (rejected.push(route.request().url()), route.abort());
  await page.route('**/*', routeAll);
  page.on('pageerror', onError);
  try {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(3500);
    const results = {};
    const button = (name) => page.getByRole('button', { name, exact: true });
    const heading = (name) => page.getByRole('heading', { name, exact: true });
    const row = (id) => button(`Abrir investimento: Investimento ${id}`);
    const back = () => button('Voltar aos investimentos');
    const edit = (origin, id = 'A') => button(origin === 'detalhe' ? 'Editar investimento' : `Editar investimento: Investimento ${id}`);
    const remove = (origin) => button(origin === 'detalhe' ? 'Excluir investimento' : 'Excluir investimento: Investimento A');
    const dialog = (role = 'dialog') => page.getByRole(role);
    const action = (name, role) => dialog(role).getByRole('button', { name, exact: true });
    const nameField = () => dialog().getByRole('textbox', { name: 'Nome', exact: true });
    const collection = '/api/investments';
    const historyUrl = (id) => `${collection}/transactions?investmentId=${id}`;
    const portfolioTitle = () => heading('Investimentos');
    const require = (value, message) => { if (!value) throw new Error(message); };
    const same = (value, want, message) => require(JSON.stringify(value) === JSON.stringify(want), `${message}: ${JSON.stringify(value)}`);
    const calls = () => page.evaluate(() => window.qa.calls);
    const reply = (label, outcome) => page.evaluate(([key, result]) => window.qa.reply(key, result), [label, outcome]);
    const pending = (label) => page.waitForFunction((key) => Boolean(window.qa.pending[key]), label);
    const ready = (text) => page.getByText(text, { exact: true }).waitFor();
    const feedback = (kind, text) => page.locator(`[data-sonner-toast][data-type=${kind}]`).filter({ hasText: text }).waitFor();
    const frame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const closes = async (role) => {
      await page.locator(`[role=${role ?? 'dialog'}]`).waitFor({ state: 'detached' });
      await frame(); // Radix restaura foco no cleanup do portal, após o fechamento.
    };
    const active = () => page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName, role: el?.getAttribute('role'), slot: el?.getAttribute('data-slot'),
        id: el?.id?.startsWith('investment-') || el?.id === 'investments-title' ? el.id : null,
        name: (el?.getAttribute('aria-label') || (el?.tagName !== 'BODY' ? el?.textContent?.trim() : '')) ?? '',
        connected: el?.isConnected,
      };
    });
    const focused = async (locator) => await locator.count() === 1 && locator.evaluate((node) => node === document.activeElement);
    const watch = async (locator, phase) => ({ phase, matches: await focused(locator), active: await active() });
    const visibleFocus = (locator) => locator.evaluate((node) => {
      const style = getComputedStyle(node);
      return node.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    });
    const tabTo = async (origin, target) => {
      await origin.focus();
      for (let step = 0; step < 5; step++) {
        await page.keyboard.press('Tab');
        if (await focused(target)) {
          require(await visibleFocus(target), 'Ação alcançada por Tab sem foco visível');
          return;
        }
      }
      throw new Error('Tab não alcançou a ação');
    };
    const checkMutation = (all, method, body) => {
      const writes = all.filter((call) => call.method !== 'GET');
      same(writes, [{ method, url: collection, body }], 'método/destino/payload');
    };
    const portfolio = async () => {
      await row('A').waitFor();
      await row('B').waitFor();
    };
    const enter = async (origin, id = 'A', historyReady = true) => {
      if (origin !== 'detalhe') return;
      await row(id).click();
      await heading(`Investimento ${id}`).waitFor();
      if (historyReady) await ready(`Histórico ${id}`);
    };
    const geometry = (selector) => page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Superfície ausente: ${sel}`);
      const box = el.getBoundingClientRect();
      return { viewport: window.innerWidth, page: document.documentElement.scrollWidth,
        left: box.left, right: box.right, width: el.clientWidth, content: el.scrollWidth };
    }, selector);
    const assertReflow = async (selector) => {
      const box = await geometry(selector);
      require(box.viewport === width && box.page <= width && box.left >= -1 && box.right <= width + 1 && box.content <= box.width + 1,
        `overflow: ${selector} ${JSON.stringify(box)}`);
    };
    async function scenario(title, run) {
      try {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate((selected) => window.qa.mount(selected), theme);
        await portfolio();
        const observations = await run();
        same(await page.evaluate(() => window.qa.unexpected), [], 'requisições inesperadas');
        same(errors, [], 'erros no DOM');
        same(rejected, [], 'rede não autorizada');
        results[title] = observations;
      } catch (error) {
        throw new Error(`${width}/${theme} ${title}: ${error.message}`);
      }
    }

    await scenario('testemunha do tema e viewport', async () => {
      await assertReflow('#fixture');
      return page.evaluate((selected) => {
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
        return { width: window.innerWidth, theme: selected, background: rendered };
      }, theme);
    });

    for (const origin of ['carteira', 'detalhe']) {
      for (const [label, opener, role] of [['edição', edit, 'dialog'], ['exclusão', remove, 'alertdialog']]) {
        await scenario(`${origin}: ${label} por teclado, Escape e Cancelar`, async () => {
          await enter(origin);
          const target = opener(origin);
          const previous = origin === 'detalhe' ? (label === 'edição' ? back() : edit(origin))
            : (label === 'edição' ? row('A') : edit(origin));
          const observations = [];
          for (const key of ['Escape', 'Cancelar']) {
            await tabTo(previous, target);
            await page.keyboard.press('Enter');
            await dialog(role).waitFor();
            await assertReflow(`[role=${role}]`);
            if (key === 'Escape') await page.keyboard.press('Escape');
            else await action(key, role).click();
            await closes(role);
            observations.push(await watch(target, key));
          }
          require((await calls()).every((call) => call.method === 'GET'), 'Escape/Cancelar não deve gravar');
          return observations;
        });
      }
    }

    if (!detailed) return results;
    for (const origin of ['criação', 'carteira', 'detalhe']) {
      const create = origin === 'criação';
      const opener = () => create ? button('Novo investimento') : edit(origin);
      for (const result of ['http', 'transport', 'http após OK']) {
        await scenario(`${origin}: gravação ${result}`, async () => {
          await enter(origin);
          await opener().click();
          const submit = action(create ? 'Criar' : 'Salvar');
          const before = (await calls()).length;
          await nameField().fill('  ');
          await submit.click();
          await feedback('error', 'Informe o nome do investimento');
          same((await calls()).length, before, 'nome inválido enviou mutação');
          await nameField().fill('  Rascunho sintético  ');
          await submit.click();
          await pending('write');
          require(await action('Salvando…').isDisabled(), 'envio pendente não desabilita ação');
          checkMutation(await calls(), create ? 'POST' : 'PUT', {
            ...(create ? {} : { id: 'a' }), name: 'Rascunho sintético', type: create ? 'STOCK' : 'CDB',
            investedAmount: create ? 0 : 1200, yieldRate: 0,
          });
          const points = [await active()];
          const success = result === 'http após OK';
          await reply('write', success ? 'ok' : result);
          if (success) {
            await pending('refresh');
            await feedback('success', create ? 'Investimento criado!' : 'Investimento atualizado!');
            await closes();
            points.push(await watch(opener(), 'OK com GET pendente'));
            await reply('refresh', 'http');
            if (origin !== 'detalhe') await ready('Não foi possível carregar os investimentos.');
            await frame();
            require(!(await dialog().count()), 'GET 503 reabriu o editor');
            points.push(await watch(opener(), 'após GET 503'));
            same((await calls()).slice(before + 1).map((call) => call.url),
              [collection, ...(origin === 'detalhe' ? [historyUrl('a')] : [])], 'GET após OK');
          } else {
            await feedback('error', 'Erro ao salvar investimento');
            require(await dialog().isVisible(), 'erro fechou editor');
            same(await nameField().inputValue(), '  Rascunho sintético  ', 'rascunho perdido');
            same((await calls()).length, before + 1, 'erro disparou GET');
            points.push(await active());
            await action('Cancelar').click();
            await closes();
            points.push(await watch(opener(), 'Cancelar após erro'));
          }
          return points;
        });
      }
    }

    for (const origin of ['carteira', 'detalhe']) {
      for (const interleaving of ['GET imediato', 'GET retido']) {
        await scenario(`${origin}: exclusão ${interleaving}`, async () => {
          await enter(origin);
          await remove(origin).click();
          await dialog('alertdialog').waitFor();
          const before = (await calls()).length;
          for (const result of ['http', 'ok']) {
            await action('Excluir', 'alertdialog').click();
            await pending('write');
            require(await action('Excluir', 'alertdialog').isDisabled(), 'Excluir habilitado sob pendência');
            await page.keyboard.press('Escape');
            require(await dialog('alertdialog').isVisible(), 'Escape dispensou confirmação pendente');
            await reply('write', result === 'ok' && interleaving === 'GET imediato' ? 'delete-quick' : result);
            if (result === 'http') {
              await feedback('error', 'Erro ao excluir investimento');
              require(await dialog('alertdialog').isVisible(), 'falha fechou a confirmação');
              same((await calls()).slice(before), [{ method: 'DELETE', url: collection, body: { id: 'a' } }], 'DELETE falho');
            }
          }
          if (interleaving === 'GET retido') await pending('refresh');
          await closes('alertdialog');
          const points = [await watch(portfolioTitle(), 'fechamento')];
          points[0].rowA = await row('A').count() === 1;
          if (interleaving === 'GET retido') {
            require(points[0].rowA, 'registro removido antes de permitir GET');
            await reply('refresh', 'delete');
          }
          await row('A').waitFor({ state: 'detached' });
          await row('B').waitFor();
          points.push(await watch(portfolioTitle(), 'após GET e remoção da linha'));
          if (interleaving === 'GET imediato') {
            const timing = await page.evaluate(() => window.qa.immediateRead);
            same(timing.map(({ phase }) => phase), ['GET iniciado', 'corpo do GET decodificado'], 'GET imediato não observado');
            points.unshift(...timing);
          }
          same((await calls()).slice(before), [
            { method: 'DELETE', url: collection, body: { id: 'a' } },
            { method: 'DELETE', url: collection, body: { id: 'a' } },
            { method: 'GET', url: collection },
          ], 'sequência de exclusão');
          return points;
        });
      }

      await scenario(`${origin}: A pendente, cancela A, reabre B e recebe OK de A`, async () => {
        if (origin === 'detalhe') await page.evaluate(() => window.qa.holdHistoryA());
        await enter(origin, 'A', false);
        if (origin === 'detalhe') await pending('history');
        await edit(origin).click();
        await nameField().fill('Rascunho A');
        await action('Salvar').click();
        await pending('write');
        await action('Cancelar').click();
        await closes();
        const points = [await watch(edit(origin), 'Cancelar A')];
        if (origin === 'detalhe') { await back().click(); await enter(origin, 'B'); }
        await edit(origin, 'B').click();
        await nameField().fill('Rascunho B');
        require(await action('Salvando…').isDisabled(), 'B tenta salvar durante PUT A');
        const before = (await calls()).length;
        await reply('write', 'ok');
        await pending('refresh');
        await feedback('success', 'Investimento atualizado!');
        await closes(); // Caracterização do booleano no baseline, não exigência de produto.
        points.push(await watch(edit(origin, 'B'), 'OK de A fecha B'));
        await reply('refresh', 'ok');
        if (origin === 'carteira') await row('A').waitFor({ state: 'detached' });
        else {
          await reply('history', 'ok');
          await frame();
          await ready('Histórico B');
          require(!(await page.getByText('Histórico A atrasado', { exact: true }).count()), 'histórico A publicado em B');
          await heading('Investimento B').waitFor();
        }
        points.push(await watch(edit(origin, 'B'), 'após releitura'));
        checkMutation(await calls(), 'PUT', { id: 'a', name: 'Rascunho A', type: 'CDB', investedAmount: 1200, yieldRate: 0 });
        same((await calls()).slice(before), [{ method: 'GET', url: collection }], 'releitura obsoleta em B');
        return points;
      });
    }
    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, QUIET_QA_BASELINE_VIEW, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && isAbsolute(QUIET_QA_BASELINE_VIEW ?? '') && CI === '1',
  'Forneça scratch privado e baseline fixado no sandbox aprovado; não execute no host.');
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const name of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  const path = process.env[name];
  assert(path && (await realpath(path)).startsWith(`${scratch}/`), `${name} deve ficar sob o scratch privado`);
}
assert(HOME !== TMPDIR);
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' }, `${forbidden} não deve ser montado`);
}
assert(!('DATABASE_URL' in process.env), 'Fixture não usa banco');
const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baseline = await readFile(QUIET_QA_BASELINE_VIEW, 'utf8');
assert.equal(digest(baseline), baselineHash, 'Fonte do baseline não corresponde ao commit fixado');

const dir = await mkdtemp(join(scratch, 'quiet-investments-'));
const session = `quiet-investments-${randomUUID()}`;
let attemptedOpen = false;
let daemonPid;
const failures = [];
async function cli(...args) {
  const proc = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 90000,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  assert(exit === 0 && !/^### Error/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  const version = JSON.parse(await cli('--version', '--json')).version;
  assert.equal(version, '0.1.22', 'Confirmar capacidades desta versão dentro da fronteira antes de usar');
  assert.match(await cli('open', '--help'), /--idle-timeout/);
  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwindcss({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'), 'CSS compilado sem tokens/utilitários');

  const entry = `import { InvestmentsView } from ${JSON.stringify(view)};
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { createElement } from 'react'; import { createRoot } from 'react-dom/client'; import { Toaster } from 'sonner';
    (${installFixture.toString()})(InvestmentsView, AppIntlProvider, getMessagesForLocale, createElement, createRoot, Toaster);`;
  async function htmlFor(label, original) {
    const bundle = await Bun.build({
      entrypoints: [source], target: 'browser', format: 'iife', minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'fixture isolada', setup(build) {
        build.onLoad({ filter: /quiet-investments-editor\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
        if (original) build.onLoad({ filter: /\/investments-view\.tsx$/ }, () => ({ contents: original, loader: 'tsx' }));
      } }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    const html = join(dir, `${label}.html`);
    await writeFile(html, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body><div id="root"></div><script>${script}</script></body></html>`);
    return html;
  }

  const html = { baseline: await htmlFor('baseline', baseline), candidate: await htmlFor('candidate') };
  console.log(JSON.stringify({ session, baselineRef, baselineHash, candidateViewHash: digest(await readFile(view)) }));
  attemptedOpen = true;
  const launched = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(launched.session, session);
  assert(Number.isInteger(launched.pid) && launched.pid > 1, 'Daemon sem PID verificável');
  daemonPid = launched.pid;
  await cli('snapshot');
  const parity = [];
  const focusDeviations = [];
  let count = 0;
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const detailed = width === 390 && theme === 'light';
      const observed = {};
      for (const label of ['baseline', 'candidate']) {
        const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, '${theme}', ${detailed})`);
        const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: ausência de resultado do DOM`);
        observed[label] = JSON.parse(result);
        assert.equal(Object.keys(observed[label]).length, detailed ? 20 : 5, `${label}: cenário incompleto`);
      }
      count += Object.keys(observed.candidate).length;
      console.log(JSON.stringify({ session, baselineRef, width, theme, ...observed }));
      if (!Bun.deepEquals(observed.baseline, observed.candidate)) parity.push(`${width}/${theme}`);
      for (const [scenario, points] of Object.entries(observed.candidate)) {
        if (Array.isArray(points) && points.some((point) => point.matches === false)) focusDeviations.push(`${width}/${theme}: ${scenario}`);
      }
      backgrounds.push(observed.candidate['testemunha do tema e viewport'].background);
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `Temas idênticos em ${width}px`);
  }
  assert.deepEqual(parity, [], 'Divergências DOM entre baseline e candidato');
  assert.deepEqual(focusDeviations, [], 'Foco fora do alvo esperado (inclusive se já ocorria no baseline)');
  console.log(`${count} cenários pareados, sem casos pulados.`);
} catch (error) {
  failures.push(error);
} finally {
  const cleanup = async (label, check) => {
    try { await check(); } catch (error) { failures.push(new Error(`${label}: ${error.message}`, { cause: error })); }
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
if (failures.length) throw new AggregateError(failures, 'QA de Investimentos não concluído');
