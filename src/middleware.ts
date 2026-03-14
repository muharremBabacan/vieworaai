import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';

export default createMiddleware({
  // A list of all locales that are supported
  locales,
  // Used when no locale matches
  defaultLocale: 'tr',
  localePrefix
});

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Skip all paths that should not be internationalized.
    '/((?!api|_next|.*\\..*|__/.*).*)'
  ]
};
