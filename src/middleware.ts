import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale, localePrefix } from './navigation';

export default createMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localePrefix
});

export const config = {
  // Dil yönlendirmesinden muaf tutulacak yollar (statik dosyalar ve api)
  matcher: [
    // Skip all internal paths (_next, api, etc.) and static files
    '/((?!api|_next|.*\\..*|__/.*).*)'
  ]
};
