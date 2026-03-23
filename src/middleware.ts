import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - /favicon.ico, /sitemap.xml, /robots.txt (static files)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
