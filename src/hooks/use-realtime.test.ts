/// <reference types="bun-types" />

import { afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import React from 'react';

type Listener = (...args: unknown[]) => void;

class FakeEmitter {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (!listener) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  trigger(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      listener(...args);
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

class FakeManager extends FakeEmitter {}

class FakeSocket extends FakeEmitter {
  readonly io = new FakeManager();
  id: string | undefined = 'fake-socket-id';
  disconnected = false;
  disconnectCalls = 0;
  outboundEmits: Array<{ event: string; args: unknown[] }> = [];

  emit(event: string, ...args: unknown[]) {
    this.outboundEmits.push({ event, args });
    return this;
  }

  disconnect() {
    this.disconnected = true;
    this.disconnectCalls += 1;
    return this;
  }
}

const ioCalls: Array<{ url: string; options: Record<string, unknown> | undefined }> = [];
const createdSockets: FakeSocket[] = [];

type UseRealtimeModule = typeof import('./use-realtime') & {
  MAX_RECONNECTION_ATTEMPTS?: number;
  REALTIME_SOCKET_OPTIONS?: Record<string, unknown>;
};

let mod: UseRealtimeModule;

function mountRealtimeHook(options?: Parameters<UseRealtimeModule['useRealtime']>[0]) {
  const reactInternals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  const refs: { current: unknown }[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const effects: { deps: readonly unknown[] | undefined; cleanup?: (() => void) | void }[] = [];
  const pendingEffects: Array<() => void> = [];
  let subscribed = false;
  let unsubscribeStore: (() => void) | undefined;

  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((dep, i) => Object.is(dep, right[i]));

  function render() {
    const previousDispatcher = reactInternals.H;
    let r = 0;
    let c = 0;
    let e = 0;

    reactInternals.H = {
      useRef: (current: unknown) => (refs[r++] ??= { current }),
      useCallback(fn: unknown, deps: readonly unknown[]) {
        const idx = c++;
        if (!sameDeps(callbacks[idx]?.deps, deps)) {
          callbacks[idx] = { fn, deps };
        }
        return callbacks[idx].fn;
      },
      useEffect(effect: () => (() => void) | void, deps?: readonly unknown[]) {
        const idx = e++;
        const prev = effects[idx];
        const shouldRun = !prev || deps === undefined || !sameDeps(prev.deps, deps);
        if (shouldRun) {
          pendingEffects.push(() => {
            if (typeof prev?.cleanup === 'function') {
              prev.cleanup();
            }
            const cleanup = effect();
            effects[idx] = { deps, cleanup };
          });
        }
      },
      useSyncExternalStore(
        subscribe: (onStoreChange: () => void) => () => void,
        getSnapshot: () => unknown,
      ) {
        if (!subscribed) {
          subscribed = true;
          unsubscribeStore = subscribe(() => {});
        }
        return getSnapshot();
      },
    };

    try {
      return mod.useRealtime(options);
    } finally {
      reactInternals.H = previousDispatcher;
      while (pendingEffects.length > 0) {
        pendingEffects.shift()?.();
      }
    }
  }

  function unmount() {
    unsubscribeStore?.();
    unsubscribeStore = undefined;
    for (const entry of effects) {
      if (typeof entry?.cleanup === 'function') {
        entry.cleanup();
      }
    }
  }

  return { render, unmount };
}

describe('useRealtime — reconexão finita com backoff exponencial', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  const activeMounts: Array<{ unmount: () => void }> = [];

  beforeAll(async () => {
    mock.module('socket.io-client', () => ({
      io: (url: string, opts?: Record<string, unknown>) => {
        ioCalls.push({ url, options: opts });
        const socket = new FakeSocket();
        createdSockets.push(socket);
        return socket;
      },
    }));

    mod = (await import('./use-realtime')) as UseRealtimeModule;
  });

  beforeEach(() => {
    ioCalls.length = 0;
    createdSockets.length = 0;
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    while (activeMounts.length > 0) {
      activeMounts.pop()?.unmount();
    }
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('exporta MAX_RECONNECTION_ATTEMPTS = 3 e REALTIME_SOCKET_OPTIONS com backoff exponencial', () => {
    expect(mod.MAX_RECONNECTION_ATTEMPTS).toBe(3);
    expect(mod.REALTIME_SOCKET_OPTIONS).toEqual({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });
  });

  test('passa REALTIME_SOCKET_OPTIONS finitas ao criar o socket no mount', () => {
    const hook = mountRealtimeHook();
    activeMounts.push(hook);

    const state = hook.render();
    expect(state.isConnected).toBe(false);
    expect(ioCalls).toHaveLength(1);
    expect(ioCalls[0]?.url).toBe('/?XTransformPort=3004');
    expect(ioCalls[0]?.options?.reconnectionAttempts).toBe(3);
    expect(ioCalls[0]?.options?.reconnectionAttempts).not.toBe(Infinity);
    expect(ioCalls[0]?.options).toEqual(mod.REALTIME_SOCKET_OPTIONS);
  });

  test('getServerSnapshot retorna a mesma referência em chamadas consecutivas', () => {
    const first = mod.getServerSnapshot();
    const second = mod.getServerSnapshot();
    expect(first).toBe(second);
    expect(first).toEqual({
      isConnected: false,
      refreshCounter: 0,
      lastEvent: null,
    });
  });

  test('trata connect_error silenciosamente sem console.error ou exceção não tratada', () => {
    const hook = mountRealtimeHook();
    activeMounts.push(hook);

    hook.render();
    const socket = createdSockets[0]!;
    expect(socket.listenerCount('connect_error')).toBe(1);

    // Simula conexão prévia seguida de erro de transporte antes de exaurir tentativas
    socket.trigger('connect');
    expect(hook.render().isConnected).toBe(true);

    expect(() => {
      socket.trigger('connect_error', new Error('ECONNREFUSED 127.0.0.1:3004'));
    }).not.toThrow();

    expect(hook.render().isConnected).toBe(false);
    expect(socket.disconnectCalls).toBe(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('desconecta o socket silenciosamente em reconnect_failed após exaurir tentativas', () => {
    const hook = mountRealtimeHook();
    activeMounts.push(hook);

    hook.render();
    const socket = createdSockets[0]!;
    expect(socket.io.listenerCount('reconnect_failed')).toBe(1);

    expect(() => {
      socket.io.trigger('reconnect_failed');
    }).not.toThrow();

    expect(socket.disconnectCalls).toBeGreaterThanOrEqual(1);
    expect(socket.disconnected).toBe(true);
    expect(hook.render().isConnected).toBe(false);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('remove listeners de connect_error e reconnect_failed no cleanup de unmount', () => {
    const hook = mountRealtimeHook();
    hook.render();

    const socket = createdSockets[0]!;
    expect(socket.listenerCount('connect_error')).toBe(1);
    expect(socket.io.listenerCount('reconnect_failed')).toBe(1);

    hook.unmount();

    expect(socket.listenerCount('connect')).toBe(0);
    expect(socket.listenerCount('disconnect')).toBe(0);
    expect(socket.listenerCount('joined')).toBe(0);
    expect(socket.listenerCount('connect_error')).toBe(0);
    expect(socket.io.listenerCount('reconnect_failed')).toBe(0);
    expect(socket.disconnectCalls).toBe(1);
  });

  test('reconnect() manual abre nova conexão com orçamento renovado após reconnect_failed', async () => {
    const hook = mountRealtimeHook();
    activeMounts.push(hook);

    const initial = hook.render();
    const firstSocket = createdSockets[0]!;
    const beforeRefresh = initial.refreshCounter;

    firstSocket.io.trigger('reconnect_failed');
    expect(firstSocket.disconnected).toBe(true);
    expect(hook.render().isConnected).toBe(false);

    initial.reconnect();
    await new Promise((resolve) => setTimeout(resolve, 140));

    expect(createdSockets).toHaveLength(2);
    expect(ioCalls[1]?.options?.reconnectionAttempts).toBe(3);

    const secondSocket = createdSockets[1]!;
    secondSocket.trigger('connect');
    secondSocket.trigger('dashboard:updated', { ok: true });

    const recovered = hook.render();
    expect(recovered.isConnected).toBe(true);
    expect(recovered.refreshCounter).toBe(beforeRefresh + 1);
    expect(recovered.lastEvent?.type).toBe('dashboard:updated');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
