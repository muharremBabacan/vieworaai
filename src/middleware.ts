import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("session")?.value;

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
  if (host?.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.hostname = host.replace('www.', '');
    url.port = ''; 
    return NextResponse.redirect(url, 301);
  }

  // 3. 🔒 PROTECTED ROUTES DEFINITION
  const authPaths = ['/login', '/signup', '/verify-email'];
  const protectedPaths = ['/dashboard', '/admin', '/profile', '/onboarding', '/academy'];
  
  const isAuthPage = authPaths.some(p => pathname.includes(p));
  const isProtectedPage = protectedPaths.some(p => pathname.includes(p));

  // 🔓 DEV MODE: ALL DOORS OPEN
  // Redirect logic disabled to unblock development
  
  return intlMiddleware(request);
  
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Exclude API routes and static files, match everything else
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|icon-).*)'
  ]
};
