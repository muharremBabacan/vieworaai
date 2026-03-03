
export const dynamic = 'force-dynamic';
import { ClientProviders } from '@/components/ClientProviders';
import { Metadata } from 'next';
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
      <body className="antialiased bg-background text-foreground">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
