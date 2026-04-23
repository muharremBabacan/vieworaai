'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  // Determine if it's a public page where guests are allowed
  const isPublicPage = [
    '/explore',
    '/competitions',
    '/dashboard',
    '/academy',
    '/luma',
    '/test-ai',
    '/public'
  ].some(p => pathname.startsWith(p) || pathname === p);

  const isStandalonePage = [
    '/', 
    '/login',
    '/signup', 
    '/verify-email', 
    '/terms', 
    '/privacy',
    '/onboarding',
    '/dashboard', // Add dashboard here to prevent immediate redirect while settling
    ... (isPublicPage ? [pathname] : [])
  ].includes(pathname);
  
  // 🚀 GUEST TRACKING & PUBLIC ACCESS (İyileştirilmiş: Navigation döngüsünden ayrıldı)
  useEffect(() => {
    if (user || !firestore) return;

    const handleGuestTracking = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get('ref');
      
      let guestId = localStorage.getItem('guest_id');
      if (!guestId) {
        guestId = `GUEST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        localStorage.setItem('guest_id', guestId);
        
        // 🎁 GUEST TRIAL: Initialize with 3 Pix
        localStorage.setItem('guest_pix', '3');
        
        try {
          await setDoc(doc(firestore, 'guest_sessions', guestId), {
            guestId,
            source: ref || 'direct',
            firstSeen: new Date().toISOString(),
            userAgent: navigator.userAgent,
            isConverted: false,
            initialBonus: 3
          });
          console.debug('[ClientLayout] New guest session tracked with bonus:', guestId);
        } catch (e) {
          console.error("Guest tracking error:", e);
        }
      } else {
        // Ensure existing guests who don't have pix yet get their one-time bonus
        if (!localStorage.getItem('guest_pix') && !localStorage.getItem('guest_last_analysis_at')) {
          localStorage.setItem('guest_pix', '3');
        }
      }
    };

    handleGuestTracking();
  }, [user, firestore]);

  // 🛡️ Auth Patience Logic for PWAs (Safe v3.8.7)
  const [isSettling, setIsSettling] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || typeof window === 'undefined') return;

    try {
      const hasPendingLogin = localStorage.getItem('pending_login') === 'true';
      const userAgent = navigator.userAgent || '';
      const isInAppBrowser = /GSA\/|Instagram|FBAN|FBIOS|Line|MicroMessenger|Messenger/i.test(userAgent);
      
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone ||
        (/iPhone|iPad|iPod/.test(userAgent) && (window as any).navigator.standalone === true) ||
        isInAppBrowser;

      // 🛡️ Trigger patience on ANY page in restricted environment during initial mount
      // or if we explicitly have a pending login flag.
      if (hasPendingLogin || isStandalone) {
        console.log(`🛡️ [ClientLayout] Aggressive Auth Patience (5s) for ${pathname}.`);
        setIsSettling(true);
        const timer = setTimeout(() => {
          setIsSettling(false);
          // Safety: remove pending flag after patience expires
          localStorage.removeItem('pending_login');
        }, 5000);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.warn("[ClientLayout] Auth patience check failed safely:", error);
    }
  }, [pathname, hasMounted]);

  // Navigation Logic
  useEffect(() => {
    if (!hasMounted || isUserLoading || (user && isProfileLoading) || isSettling) return;

    if (user) {
      try {
        localStorage.removeItem('pending_login');
      } catch (e) {}
      
      if (!user.emailVerified) {
        if (pathname !== '/verify-email' && pathname !== '/login' && pathname !== '/signup') {
          router.replace('/verify-email');
        }
        return;
      }

      const onboarded = userProfile?.onboarded ?? false;
      
      if (!onboarded) {
        if (pathname !== '/onboarding' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/verify-email' && pathname !== '/test-ai') {
          router.replace('/onboarding');
        }
      } else {
        if (pathname === '/' || pathname === '/login' || pathname === '/onboarding' || pathname === '/signup' || pathname === '/verify-email') {
          router.replace('/dashboard');
        }
      }
    } else {
      if (!isStandalonePage && !isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, pathname, router, isStandalonePage, isPublicPage, isSettling]);

  // Global Loader for critical states
  if (isUserLoading || (user && isProfileLoading && !userProfile) || isSettling) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {isSettling && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
            Oturum Doğrulanıyor...
          </p>
        )}
      </div>
    );
  }

  const showHeader = (user || isPublicPage) && !['/', '/login', '/signup'].includes(pathname);
  const showBottomNav = (user || isPublicPage) && !['/', '/login', '/signup', '/onboarding'].includes(pathname);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {showHeader && <AppHeader />}
      <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide",
          showHeader ? "pt-0" : ""
      )}>
        <div className={cn(
            "container mx-auto px-4 py-8 pb-32",
            !showHeader && "pt-12"
        )}>
            {children}
        </div>
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
