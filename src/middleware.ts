import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("session")?.value;

  // 🔒 CANONICAL DOMAIN REDIRECT (WWW -> NON-WWW)
  const host = request.headers.get('host');
  if (host?.startsWith('www.')) {
    const newHost = host.replace('www.', '');
    const url = request.nextUrl.clone();
    url.hostname = newHost;
    url.port = ''; 
    return NextResponse.redirect(url, 301);
  }

  // ⚡️ SKIP MIDDLEWARE FOR SERVER ACTIONS & STATIC ASSETS
  if (
    request.method === 'POST' && 
    (request.headers.has('next-action') || request.headers.get('content-type')?.includes('multipart/form-data'))
  ) {
    return NextResponse.next();
  }

  // 🛡️ PROTECTED ROUTES LOGIC
  const isAuthPage = (pathname.includes('/login') || pathname.includes('/signup')) && !pathname.includes('/auth/callback');
  const isProtectedPage = (pathname.includes('/dashboard') || 
                          pathname.includes('/admin') || 
                          pathname.includes('/profile') || 
                          pathname.includes('/onboarding') ||
                          pathname.includes('/academy')) && !pathname.includes('/auth/callback');

  // If on a protected page without a session -> Redirect to Login
  if (isProtectedPage && !session) {
    console.log(`[Middleware] 🔒 Protected path detected (${pathname}), no session found. Redirecting to login.`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If on an auth page WITH a session -> Redirect to Dashboard
  if (isAuthPage && session) {
    console.log(`[Middleware] ✅ Session found on auth page. Redirecting to dashboard.`);
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }
  
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /favicon.ico, /sitemap.xml, /robots.txt (static files)
  matcher: [
    '/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|manifest.json|manifest-new.json|icon-192.png|icon-512.png|.*\\..*).*)'
  ]
};
