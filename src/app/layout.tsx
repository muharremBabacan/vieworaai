export const dynamic = 'force-dynamic';
import { ClientProviders } from '@/components/ClientProviders';
import { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viewora',
  description: 'Global Fotoğrafçılık Eğitimi ve Koçluğu Platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <head>
        {/* Google Ads Tag */}
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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
