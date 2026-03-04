'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  // Bağımsız sayfalar (Navigasyon barındırmazlar)
  // Onboarding sayfasında bildirimleri görmesi için Header'ı göstermeliyiz, bu yüzden buradan çıkardık.
  const isStandalonePage = pathname === '/' || pathname === '/terms' || pathname === '/privacy';
  
  // Yönlendirme Mantığı (Enforcement)
  useEffect(() => {
    // Veriler yüklenene kadar bekle
    if (isUserLoading || (user && isProfileLoading)) return;

    if (user) {
      // KULLANICI GİRİŞ YAPMIŞ
      const onboarded = userProfile?.onboarded ?? false;
      
      if (!onboarded) {
        // Anketi doldurmamış -> Sadece onboarding ve yasal sayfalara izin ver
        if (pathname !== '/onboarding' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/') {
          router.replace('/onboarding');
        }
      } else {
        // Anketi doldurmuş -> Eğer giriş veya onboarding sayfasındaysa dashboard'a gönder
        if (pathname === '/' || pathname === '/onboarding') {
          router.replace('/dashboard');
        }
      }
    } else {
      // KULLANICI GİRİŞ YAPMAMIŞ
      // Sadece giriş, şartlar ve gizlilik sayfalarına izin ver
      if (pathname !== '/' && pathname !== '/terms' && pathname !== '/privacy') {
        router.replace('/');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, pathname, router]);

  // Kritik veriler yüklenirken global bir loader göster
  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Navigasyonu sadece giriş yapmış ve anket sayfasında olmayan kullanıcıya göster
  const showNav = user && !isStandalonePage;

  return (
    <div className="relative flex min-h-screen flex-col">
      {showNav && <AppHeader />}
      <main className={`flex-1 ${showNav ? 'py-8 pb-24' : ''}`}>
        {children}
      </main>
      {showNav && pathname !== '/onboarding' && <BottomNav />}
    </div>
  );
}
