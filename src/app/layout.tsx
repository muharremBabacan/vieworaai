'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { FirebaseClientProvider } from '@/lib/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased">
        <FirebaseClientProvider>
          <div className="relative flex min-h-screen flex-col">
            <AppHeader />
            <main className="flex-1 py-8 pb-20">{children}</main>
            <BottomNav />
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
