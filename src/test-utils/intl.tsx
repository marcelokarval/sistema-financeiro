import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_LOCALE, normalizeLocale, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { AppIntlProvider } from '@/i18n/provider';
import type { AppMessages } from '@/i18n/types';

export interface IntlTestWrapperProps {
  locale?: CanonicalLocale | string;
  onRefresh?: () => void;
  children: ReactNode;
}

/** Explicit test wrapper providing AppIntlProvider for any canonical locale. */
export function IntlTestWrapper({
  locale = DEFAULT_LOCALE,
  onRefresh,
  children,
}: IntlTestWrapperProps) {
  const canonical = normalizeLocale(locale);
  const messages = getMessagesForLocale(canonical) as AppMessages;
  return (
    <AppIntlProvider locale={canonical} messages={messages} onRefresh={onRefresh}>
      {children}
    </AppIntlProvider>
  );
}

/** Renders a React element with AppIntlProvider for the target locale into static HTML. */
export function renderWithIntl(
  node: ReactElement,
  locale: CanonicalLocale | string = DEFAULT_LOCALE,
): string {
  return renderToStaticMarkup(
    <IntlTestWrapper locale={locale}>{node}</IntlTestWrapper>,
  );
}
