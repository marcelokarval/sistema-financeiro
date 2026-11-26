import type { CanonicalLocale } from './config';
import type { MESSAGES_BY_LOCALE } from './messages';

export type AppMessages = typeof MESSAGES_BY_LOCALE.pt;
export type Messages = AppMessages;

declare module 'next-intl' {
  interface AppConfig {
    Locale: CanonicalLocale;
    Messages: AppMessages;
  }
}
