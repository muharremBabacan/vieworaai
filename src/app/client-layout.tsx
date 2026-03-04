
'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  // Giriş, Onboarding ve yasal sayfalar navigasyon içermeyen bağımsız sayfalardır
  const isStandalonePage = pathname === '/' || pathname === '/onboarding' || pathname === '/terms' || pathname === '/privacy';
  
  // Sadece kullanıcı giriş yapmışsa ve bağımsız bir sayfada değilse navigasyonu göster
  const showNav = user && !isStandalonePage;

  // MECBURİ ANKET KONTROLÜ
  useEffect(() => {
    if (!isUserLoading && user && userProfile) {
      const onboarded = userProfile.onboarded ?? false;
      if (!onboarded && pathname !== '/onboarding' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/') {
        router.replace('/onboarding');
      }
    }
  }, [user, userProfile, isUserLoading, pathname, router]);

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
