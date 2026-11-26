import ptCommon from '../messages/pt/common.json';
import ptShell from '../messages/pt/shell.json';
import esCommon from '../messages/es/common.json';
import esShell from '../messages/es/shell.json';
import enCommon from '../messages/en/common.json';
import enShell from '../messages/en/shell.json';
import { type CanonicalLocale, normalizeLocale } from './config';

export const MESSAGES_BY_LOCALE = {
  pt: {
    ...ptCommon,
    shell: ptShell,
  },
  es: {
    ...esCommon,
    shell: esShell,
  },
  en: {
    ...enCommon,
    shell: enShell,
  },
} as const;

export type LocaleMessages = (typeof MESSAGES_BY_LOCALE)[CanonicalLocale];

/** Returns the static message bundle for any canonical or regional locale input. */
export function getMessagesForLocale(locale?: string | null): LocaleMessages {
  return MESSAGES_BY_LOCALE[normalizeLocale(locale)];
}
