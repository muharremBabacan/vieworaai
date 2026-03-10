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
  const isStandalonePage = [
    '/', 
    '/signup', 
    '/verify-email', 
    '/terms', 
    '/privacy'
  ].includes(pathname);
  
  // Yönlendirme Mantığı (Merkezi Kontrol)
  useEffect(() => {
    // Veriler veya oturum yüklenirken işlem yapma
    if (isUserLoading || (user && isProfileLoading)) return;

    if (user) {
      // KULLANICI GİRİŞ YAPMIŞ
      
      // E-posta doğrulama kontrolü (Email ile giriş yapanlar için)
      // Google ile girenlerin emailVerified değeri zaten true gelir.
      if (!user.emailVerified) {
        if (pathname !== '/verify-email' && pathname !== '/' && pathname !== '/signup') {
          router.replace('/verify-email');
        }
        return;
      }

      const onboarded = userProfile?.onboarded ?? false;
      
      if (!onboarded) {
        // Anketi doldurmamış -> Sadece onboarding, terms, privacy sayfalarına izin ver
        if (pathname !== '/onboarding' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/verify-email') {
          router.replace('/onboarding');
        }
      } else {
        // Anketi doldurmuş -> Eğer giriş veya onboarding sayfasındaysa dashboard'a gönder
        if (pathname === '/' || pathname === '/onboarding' || pathname === '/signup' || pathname === '/verify-email') {
          router.replace('/dashboard');
        }
      }
    } else {
      // KULLANICI GİRİŞ YAPMAMIŞ
      // Sadece giriş, kayıt, doğrulama, şartlar ve gizlilik sayfalarına izin ver
      if (!isStandalonePage) {
        router.replace('/');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, pathname, router, isStandalonePage]);

  // Kritik veriler yüklenirken global bir loader göster
  if (isUserLoading || (user && isProfileLoading && !userProfile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const showHeader = user && !isStandalonePage;
  const showBottomNav = user && !isStandalonePage && pathname !== '/onboarding';

  return (
    <div className="relative flex min-h-screen flex-col">
      {showHeader && <AppHeader />}
      <main className={`flex-1 ${showHeader ? 'py-8 pb-24' : ''}`}>
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
