import createMiddleware from 'next-intl/middleware';
 
export default createMiddleware({
  // A list of all locales that are supported
  locales: ['tr', 'en', 'de', 'fr', 'es', 'ar', 'ru', 'el', 'zh', 'ja'],
 
  // Used when no locale matches
  defaultLocale: 'tr'
});
 
export const config = {
  // By default, middleware is applied to all paths.
  // We need to exclude paths that shouldn't be internationalized.
  // This includes API routes, Next.js assets, and the Firebase auth handler.
  matcher: [
    // Skip all paths that should not be internationalized. This includes the
    // Firebase auth handler (`__/` paths).
    '/((?!api|_next/static|_next/image|favicon.ico|__/.*).*)'
  ]
};