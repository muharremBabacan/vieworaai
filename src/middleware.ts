import createMiddleware from 'next-intl/middleware';
// DÜZELTME: Yolun başına /i18n/ ekledik
import { routing } from './i18n/routing'; 

export default createMiddleware(routing);

export const config = {
  // Statik dosyaları ve api yollarını dışarıda bırakır
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/', '/(tr|en)/:path*']
};