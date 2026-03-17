import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // DÜZELTME: src/i18n'den src/messages'a gidiş yolu
    messages: (await import(`../messages/${locale}.json`)).default
  };
});