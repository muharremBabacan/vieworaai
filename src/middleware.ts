import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // Buradaki diller, [locale] klasörünün kabul edeceği dillerdir
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always'
});

export const config = {
  // Statik dosyaları ve api'leri middleware dışında tutar
  matcher: ['/', '/(tr|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};