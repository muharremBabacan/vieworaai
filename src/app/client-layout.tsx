'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { useUser } from '@/lib/firebase';
import { usePathname } from 'next/navigation';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  
  // Giriş ve Onboarding sayfaları navigasyon içermeyen bağımsız sayfalardır
  const isStandalonePage = pathname === '/' || pathname === '/onboarding' || pathname === '/terms' || pathname === '/privacy';
  
  // Sadece kullanıcı giriş yapmışsa ve bağımsız bir sayfada değilse navigasyonu göster
  const showNav = user && !isStandalonePage;

  return (
    <div className="relative flex min-h-screen flex-col">
      {showNav && <AppHeader />}
      <main className={`flex-1 ${showNav ? 'py-8 pb-24' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
