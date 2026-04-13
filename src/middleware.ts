import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // ⚡️ Skip next-intl for Server Actions (POST + Next-Action header)
  // to avoid multipart stream disruption and "Unexpected end of form"
  if (request.method === 'POST' && request.headers.has('next-action')) {
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
