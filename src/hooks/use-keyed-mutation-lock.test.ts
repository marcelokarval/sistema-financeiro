/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { useKeyedMutationLock } from './use-keyed-mutation-lock';

type LockApi = {
  pending: ReadonlySet<string>;
  tryAcquire(key: string): boolean;
  release(key: string): void;
};

function mountLockHook() {
  const react = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const dispatcher = react.H;
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    left !== undefined && right !== undefined && left.length === right.length && left.every((dep, i) => Object.is(dep, right[i]));

  function useLockHarness(): LockApi {
    return useKeyedMutationLock();
  }

  function render(): LockApi {
    let s = 0;
    let r = 0;
    let c = 0;
    react.H = {
      useState(initial: unknown) {
        const i = s++;
        if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], (next: unknown) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[r++] ??= { current }),
      useCallback(fn: unknown, deps: readonly unknown[]) {
        const i = c++;
        if (!sameDeps(callbacks[i]?.deps, deps)) callbacks[i] = { fn, deps };
        return callbacks[i].fn;
      },
      useMemo: (factory: () => unknown) => factory(),
      useDebugValue: () => {},
      useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
      useEffect: () => {},
    };
    const invoke = useLockHarness;
    try {
      return invoke();
    } finally {
      react.H = dispatcher;
    }
  }

  return { render };
}

test('expõe a interface exata { pending, tryAcquire, release } sem estado compartilhado entre instâncias', () => {
  const first = mountLockHook();
  const second = mountLockHook();

  const api: LockApi = first.render();
  const other = second.render();

  expect(Object.keys(api).sort()).toEqual(['pending', 'release', 'tryAcquire']);
  expect(api.pending).toBeInstanceOf(Set);
  expect(api.pending.size).toBe(0);
  expect(typeof api.tryAcquire).toBe('function');
  expect(typeof api.release).toBe('function');

  expect(api.tryAcquire('chave-isolada')).toBe(true);
  expect(other.tryAcquire('chave-isolada')).toBe(true);
});

test('duas ativações síncronas antes de re-renderizar com a mesma chave retornam true depois false e disparam 1 operação', () => {
  const { render } = mountLockHook();
  const initial = render();
  let operations = 0;

  const activate = () => {
    if (!initial.tryAcquire('arbitrary:token/123')) return false;
    operations += 1;
    return true;
  };

  expect(activate()).toBe(true);
  expect(activate()).toBe(false);
  expect(operations).toBe(1);
  // Snapshot anterior não deve vazar mutação interna por referência.
  expect(initial.pending.has('arbitrary:token/123')).toBe(false);

  const rerendered = render();
  expect(rerendered.pending.has('arbitrary:token/123')).toBe(true);
  expect(rerendered.pending.size).toBe(1);
  expect(rerendered.tryAcquire('arbitrary:token/123')).toBe(false);
});

test('chaves distintas progridem independentemente', () => {
  const { render } = mountLockHook();
  const hook = render();

  expect(hook.tryAcquire('alpha')).toBe(true);
  expect(hook.tryAcquire('beta')).toBe(true);
  expect(hook.tryAcquire('alpha')).toBe(false);
  expect(hook.tryAcquire('beta')).toBe(false);

  const pendingBoth = render();
  expect(pendingBoth.pending.has('alpha')).toBe(true);
  expect(pendingBoth.pending.has('beta')).toBe(true);
  expect(pendingBoth.pending.size).toBe(2);

  pendingBoth.release('alpha');
  const afterAlpha = render();
  expect(afterAlpha.pending.has('alpha')).toBe(false);
  expect(afterAlpha.pending.has('beta')).toBe(true);
  expect(afterAlpha.tryAcquire('alpha')).toBe(true);
  expect(afterAlpha.tryAcquire('beta')).toBe(false);
});

test('release libera após sucesso e após erro em finally, mantendo pending observável para reabertura e novo envio', async () => {
  const { render } = mountLockHook();

  async function runWithLock(key: string, task: () => Promise<void>) {
    const current = render();
    if (!current.tryAcquire(key)) return 'blocked';
    try {
      await task();
      return 'ok';
    } finally {
      current.release(key);
    }
  }

  await expect(runWithLock('op:fail', async () => {
    expect(render().pending.has('op:fail')).toBe(true);
    throw new Error('falha controlada');
  })).rejects.toThrow('falha controlada');

  const afterFailure = render();
  expect(afterFailure.pending.has('op:fail')).toBe(false);
  expect(afterFailure.pending.size).toBe(0);

  // Chave pode ser readquirida depois do erro e liberada no sucesso.
  await expect(runWithLock('op:fail', async () => {
    expect(render().pending.has('op:fail')).toBe(true);
  })).resolves.toBe('ok');

  const afterSuccess = render();
  expect(afterSuccess.pending.has('op:fail')).toBe(false);

  // Liberar chave inexistente é no-op seguro.
  afterSuccess.release('nao-existe');
  expect(render().pending.size).toBe(0);
});

test('hook permanece neutro sem política de entidade, payload, alvo ou token de abertura', async () => {
  const { render } = mountLockHook();
  const hook = render();

  for (const key of ['', 'a', 'delete:1', 'create', 'qualquer/chave:arbitrária']) {
    expect(hook.tryAcquire(key)).toBe(true);
  }
  expect(render().pending.size).toBe(5);

  const source = await Bun.file(new URL('./use-keyed-mutation-lock.ts', import.meta.url)).text();
  expect(source).not.toMatch(/accounts|cards|transactions|fetch|toast|opening|payload|entity/i);
});
