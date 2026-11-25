'use client';

import { useCallback, useRef, useState } from 'react';

export interface KeyedMutationLock {
  pending: ReadonlySet<string>;
  tryAcquire(key: string): boolean;
  release(key: string): void;
}

/**
 * Maintains a synchronous per-controller keyed lock via ref while exposing
 * an immutable pending Set in React state for UI disabled/busy indicators.
 */
export function useKeyedMutationLock(): KeyedMutationLock {
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const tryAcquire = useCallback((key: string): boolean => {
    if (locks.current.has(key)) return false;
    locks.current.add(key);
    setPending(new Set(locks.current));
    return true;
  }, []);

  const release = useCallback((key: string): void => {
    if (!locks.current.delete(key)) return;
    setPending(new Set(locks.current));
  }, []);

  return { pending, tryAcquire, release };
}
