export const dynamic = 'force-dynamic';

import { ClientProviders } from '@/components/ClientProviders';
import Script from 'next/script';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Metadata, Viewport } from 'next';
import { AuthService } from '@/lib/auth/auth-service';

export const metadata: Metadata = {
  title: 'Viewora | Global AI Photography Platform',
  description: 'Analyze, learn, and showcase your photography with AI-powered coaching.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params
}: LayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();
  const sessionUser = await AuthService.getUserFromSession(); // 🕵️ Server-side auth check

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18013553802"
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18013553802');
        `}
      </Script>

      <NextIntlClientProvider messages={messages} locale={locale}>
        <ClientProviders sessionUser={sessionUser}>
          {children}
          <InstallPrompt />
        </ClientProviders>
      </NextIntlClientProvider>
    </>
  );
}