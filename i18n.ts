import {defineRouting} from 'next-intl/routing';
import {getRequestConfig} from 'next-intl/server';

import {mergeMessagesWithFallback, type MessageTree} from './lib/i18n-messages';

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: 'never'
});

export type AppLocale = (typeof routing.locales)[number];

export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;
  const requestedLocale =
    locale && routing.locales.includes(locale as AppLocale)
      ? (locale as AppLocale)
      : routing.defaultLocale;

  const fallbackMessages = (await import('./messages/en.json')).default as MessageTree;
  const localeMessages =
    requestedLocale === routing.defaultLocale
      ? fallbackMessages
      : ((await import(`./messages/${requestedLocale}.json`)).default as MessageTree);

  return {
    locale: requestedLocale,
    messages: mergeMessagesWithFallback(fallbackMessages, localeMessages)
  };
});
