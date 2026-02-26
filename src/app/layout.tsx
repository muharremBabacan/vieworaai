import { FirebaseClientProvider } from '@/lib/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { ClientLayout } from './client-layout';
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
      <body className="antialiased">
        <FirebaseClientProvider>
          <ClientLayout>{children}</ClientLayout>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
