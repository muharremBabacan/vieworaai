import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 🛡️ FAST PATH: Skip for static assets & internal APIs
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. 🌍 CANONICAL DOMAIN REDIRECT (WWW -> NON-WWW)
  const host = request.headers.get('host');
  if (host?.startsWith('www.viewora.ai')) {
    const url = request.nextUrl.clone();
    url.hostname = 'viewora.ai';
    url.port = ''; 
    return NextResponse.redirect(url, 301);
  }

  // 3. 🔒 INTL MIDDLEWARE ONLY (Auth blocking temporarily disabled)
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Exclude API routes and static files, match everything else
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|icon-).*)'
  ]
};
