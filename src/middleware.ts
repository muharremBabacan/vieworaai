import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // ⚡️ SKIP MIDDLEWARE FOR SERVER ACTIONS
  // This is critical to prevent "Unexpected end of form" errors.
  // Next.js Server Actions use POST and have specific headers.
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
