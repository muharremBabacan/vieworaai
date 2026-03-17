export const dynamic = 'force-dynamic';
import { ClientProviders } from '@/components/ClientProviders';
import { Metadata } from 'next';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Viewora',
  description: 'Global Fotoğrafçılık Eğitimi ve Koçluğu Platformu',
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <head>
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
      </head>
      <body className="antialiased bg-background text-foreground">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
