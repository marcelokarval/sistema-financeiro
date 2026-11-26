import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, normalizeLocale, resolveAcceptLanguage } from './config';
import { getMessagesForLocale } from './messages';
import type { AppMessages } from './types';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale = cookieValue ? normalizeLocale(cookieValue) : undefined;
  if (!locale) {
    const headerStore = await headers();
    locale = resolveAcceptLanguage(headerStore.get('accept-language'));
  }

  return {
    locale,
    messages: getMessagesForLocale(locale) as AppMessages,
    timeZone: 'UTC',
  };
});
