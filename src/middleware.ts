import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale, localePrefix } from './navigation';

export default createMiddleware({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'never'
});

export const config = {
  // Dil yönlendirmesinden muaf tutulacak yollar
  matcher: [
    // Skip all internal paths (_next, api, etc.) and static files
    '/((?!api|_next|.*\\..*|__/.*).*)'
  ]
};
