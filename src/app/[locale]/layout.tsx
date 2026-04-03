export const dynamic = 'force-dynamic';

import { ClientProviders } from '@/components/ClientProviders';
import Script from 'next/script';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

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
        <ClientProviders>
          {children}
          <InstallPrompt />
        </ClientProviders>
      </NextIntlClientProvider>
    </>
  );
}