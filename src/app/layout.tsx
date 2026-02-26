'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { FirebaseClientProvider } from '@/lib/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { useUser } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import './globals.css';

/**
 * Uygulamanın ana içeriğini ve navigasyonunu yöneten iç bileşen.
 * useUser hook'u FirebaseClientProvider içinde olmalıdır.
 */
function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  
  // Giriş ve Onboarding sayfaları navigasyon içermeyen bağımsız sayfalardır
  const isStandalonePage = pathname === '/' || pathname === '/onboarding';
  
  // Sadece kullanıcı giriş yapmışsa ve bağımsız bir sayfada değilse navigasyonu göster
  const showNav = user && !isStandalonePage;

  return (
    <div className="relative flex min-h-screen flex-col">
      {showNav && <AppHeader />}
      <main className={`flex-1 ${showNav ? 'py-8 pb-20' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}

// rebuild trigger b
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased">
        <FirebaseClientProvider>
          <AppLayoutInner>{children}</AppLayoutInner>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
