import createMiddleware from 'next-intl/middleware';
 
export default createMiddleware({
  // A list of all locales that are supported
  locales: ['ar', 'de', 'el', 'en', 'es', 'fr', 'ja', 'ru', 'tr', 'zh'],
 
  // Used when no locale matches
  defaultLocale: 'tr'
});
 
export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Skip all paths that should not be internationalized. This includes the
    // Firebase auth handler (`__/` paths) and all assets.
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|__/.*).*)'
  ]
};
