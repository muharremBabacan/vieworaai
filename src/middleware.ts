import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Bu matcher, sistem dosyalarını (.js, .css) ve resimleri (favicon, png) 
  // dil yönlendirmesinden muaf tutar. Kilitlenmeyi bu önler.
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
    '/',
    '/(tr|en)/:path*'
  ]
};