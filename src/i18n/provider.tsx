'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  NextIntlClientProvider,
  createTranslator,
  type NamespaceKeys,
  type NestedKeyOf,
} from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale, type CanonicalLocale } from './config';
import { MESSAGES_BY_LOCALE, getMessagesForLocale } from './messages';
import type { AppMessages } from './types';

export interface AppIntlBridgeValue {
  locale: CanonicalLocale;
  messages: AppMessages;
}

export const AppIntlBridgeContext = createContext<AppIntlBridgeValue | null>(null);
export const AppRefreshContext = createContext<(() => void) | null>(null);

export type SafeAppNamespace = NamespaceKeys<AppMessages, NestedKeyOf<AppMessages>>;

export interface AppIntlProviderProps {
  locale?: string | null;
  messages?: AppMessages;
  onRefresh?: () => void;
  children: ReactNode;
}

/** Provides NextIntlClientProvider along with a safe bridge context for isolated tests. */
export function AppIntlProvider({
  locale = DEFAULT_LOCALE,
  messages,
  onRefresh,
  children,
}: AppIntlProviderProps) {
  const normalizedLocale = normalizeLocale(locale);
  const resolvedMessages = useMemo(
    () => (messages ?? getMessagesForLocale(normalizedLocale)) as AppMessages,
    [messages, normalizedLocale],
  );
  const bridgeValue = useMemo<AppIntlBridgeValue>(
    () => ({ locale: normalizedLocale, messages: resolvedMessages }),
    [normalizedLocale, resolvedMessages],
  );
  const inheritedRefresh = useContext(AppRefreshContext);
  const effectiveRefresh = onRefresh ?? inheritedRefresh;

  return (
    <AppRefreshContext.Provider value={effectiveRefresh}>
      <AppIntlBridgeContext.Provider value={bridgeValue}>
        <NextIntlClientProvider
          locale={normalizedLocale}
          messages={resolvedMessages}
          timeZone="UTC"
        >
          {children}
        </NextIntlClientProvider>
      </AppIntlBridgeContext.Provider>
    </AppRefreshContext.Provider>
  );
}

/** Connects Next.js App Router refresh to AppRefreshContext when mounted under RootLayout. */
export function NextRouterRefreshBridge({ children }: { children: ReactNode }) {
  const router = useRouter();
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);
  return <AppRefreshContext.Provider value={refresh}>{children}</AppRefreshContext.Provider>;
}

/** Returns the active canonical locale, falling back safely to Portuguese outside a provider. */
export function useSafeLocale(): CanonicalLocale {
  const ctx = useContext(AppIntlBridgeContext);
  return ctx?.locale ?? DEFAULT_LOCALE;
}

export type SafeTranslator<N extends SafeAppNamespace | (string & {})> =
  N extends SafeAppNamespace
    ? ReturnType<typeof createTranslator<AppMessages, N>>
    : ReturnType<typeof createTranslator<Record<string, any>>>;

/** Returns a next-intl translator with safe fallback to Portuguese outside AppIntlProvider. */
export function useSafeTranslations<N extends SafeAppNamespace | (string & {})>(
  namespace: N,
): SafeTranslator<N> {
  const ctx = useContext(AppIntlBridgeContext);
  const locale = ctx?.locale ?? DEFAULT_LOCALE;
  const messages = ctx?.messages ?? MESSAGES_BY_LOCALE[DEFAULT_LOCALE];

  return useMemo(
    () =>
      createTranslator({
        locale,
        messages: messages as Record<string, any>,
        namespace,
      }) as SafeTranslator<N>,
    [locale, messages, namespace],
  );
}

/** Returns a safe refresh callback using Next router when mounted or full reload in browser. */
export function useAppRefresh(): () => void {
  const ctxRefresh = useContext(AppRefreshContext);
  return useCallback(() => {
    if (ctxRefresh) {
      ctxRefresh();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [ctxRefresh]);
}
