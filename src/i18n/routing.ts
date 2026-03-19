import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['tr', 'en', 'ar', 'de', 'es', 'fr', 'ru', 'zh'],
  defaultLocale: 'tr',
  localePrefix: 'always'
});