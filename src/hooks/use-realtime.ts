'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';

type RealtimeEventType =
  | 'transaction:created'
  | 'transaction:updated'
  | 'transaction:deleted'
  | 'purchase:created'
  | 'purchase:updated'
  | 'purchase:deleted'
  | 'account:updated'
  | 'card:updated'
  | 'dashboard:updated'
  | 'dashboard:refresh'
  | 'notification';

interface RealtimeEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

interface UseRealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void;
}

interface UseRealtimeReturn {
  isConnected: boolean;
  refreshCounter: number;
  lastEvent: RealtimeEvent | null;
  reconnect: () => void;
}

const SOCKET_URL = '/?XTransformPort=3004';

const ALL_EVENTS: RealtimeEventType[] = [
  'transaction:created',
  'transaction:updated',
  'transaction:deleted',
  'purchase:created',
  'purchase:updated',
  'purchase:deleted',
  'account:updated',
  'card:updated',
  'dashboard:updated',
  'dashboard:refresh',
  'notification',
];

function createSocket(): Socket {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
}

// Singleton external store for realtime state, shared across all hook instances
let realtimeState = {
  isConnected: false,
  refreshCounter: 0,
  lastEvent: null as RealtimeEvent | null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeRealtime(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_SNAPSHOT = {
  isConnected: false,
  refreshCounter: 0,
  lastEvent: null as RealtimeEvent | null,
};

function getSnapshot() {
  return realtimeState;
}

export function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function useRealtime(options?: UseRealtimeOptions): UseRealtimeReturn {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  // Read state via useSyncExternalStore (no cascading render issues)
  const state = useSyncExternalStore(
    subscribeRealtime,
    getSnapshot,
    getServerSnapshot,
  );

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      ALL_EVENTS.forEach((event) => {
        socketRef.current?.off(event);
      });
      socketRef.current.off('connect');
      socketRef.current.off('disconnect');
      socketRef.current.off('joined');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    realtimeState = { ...realtimeState, isConnected: false };
    emitChange();
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useRealtime] Socket connected:', socket.id);
      realtimeState = { ...realtimeState, isConnected: true };
      emitChange();
      socket.emit('join');
    });

    socket.on('joined', (data) => {
      console.log('[useRealtime] Joined room:', data.room);
    });

    socket.on('disconnect', (reason) => {
      console.log('[useRealtime] Socket disconnected:', reason);
      realtimeState = { ...realtimeState, isConnected: false };
      emitChange();
    });

    ALL_EVENTS.forEach((event) => {
      socket.on(event, (data: unknown) => {
        console.log('[useRealtime] Event received:', event, data);
        const eventObj: RealtimeEvent = {
          type: event,
          data,
          timestamp: new Date().toISOString(),
        };
        realtimeState = {
          ...realtimeState,
          lastEvent: eventObj,
          refreshCounter: realtimeState.refreshCounter + 1,
        };
        emitChange();

        // Fire callback for side effects (toast, etc.)
        optionsRef.current?.onEvent?.(eventObj);
      });
    });
  }, [cleanup]);

  const reconnect = useCallback(() => {
    console.log('[useRealtime] Manual reconnect requested');
    cleanup();
    setTimeout(() => connect(), 100);
  }, [cleanup, connect]);

  useEffect(() => {
    connect();
    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    isConnected: state.isConnected,
    refreshCounter: state.refreshCounter,
    lastEvent: state.lastEvent,
    reconnect,
  };
}
