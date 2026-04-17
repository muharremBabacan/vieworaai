import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // 🔒 CANONICAL DOMAIN REDIRECT (WWW -> NON-WWW)
  const host = request.headers.get('host');
  if (host?.startsWith('www.')) {
    const newHost = host.replace('www.', '');
    const url = request.nextUrl.clone();
    url.hostname = newHost;
    url.port = ''; // Clear port just in case (e.g. localhost testing if someone used www)
    return NextResponse.redirect(url, 301);
  }

  // ⚡️ SKIP MIDDLEWARE FOR SERVER ACTIONS
  if (
    request.method === 'POST' && 
    (request.headers.has('next-action') || request.headers.get('content-type')?.includes('multipart/form-data'))
  ) {
    return NextResponse.next();
  }
  
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - /favicon.ico, /sitemap.xml, /robots.txt (static files)
  matcher: [
    '/((?!api|_next|_vercel|favicon.ico|robots.txt|sitemap.xml|manifest.json|manifest-new.json|icon-192.png|icon-512.png|.*\\..*).*)'
  ]
};
