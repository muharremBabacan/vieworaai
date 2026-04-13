'use client';

import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';

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
    '/luma'
  ].some(p => pathname.startsWith(p));

  const isStandalonePage = [
    '/', 
    '/login',
    '/signup', 
    '/verify-email', 
    '/terms', 
    '/privacy',
    ... (isPublicPage ? [pathname] : [])
  ].includes(pathname);
  
  // Navigation Logic
  useEffect(() => {
    if (isUserLoading || (user && isProfileLoading)) return;

    if (user) {
      if (!user.emailVerified) {
        if (pathname !== '/verify-email' && pathname !== '/login' && pathname !== '/signup') {
          router.replace('/verify-email');
        }
        return;
      }

      const onboarded = userProfile?.onboarded ?? false;
      
      if (!onboarded) {
        if (pathname !== '/onboarding' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/verify-email') {
          router.replace('/onboarding');
        }
      } else {
        if (pathname === '/' || pathname === '/login' || pathname === '/onboarding' || pathname === '/signup' || pathname === '/verify-email') {
          router.replace('/dashboard');
        }
      }
    } else {
      // 🚀 GUEST TRACKING & PUBLIC ACCESS
      const handleGuestTracking = async () => {
        const searchParams = new URLSearchParams(window.location.search);
        const ref = searchParams.get('ref');
        
        let guestId = localStorage.getItem('guest_id');
        if (!guestId) {
          guestId = `GUEST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          localStorage.setItem('guest_id', guestId);
          
          if (firestore) {
            try {
              await setDoc(doc(firestore, 'guest_sessions', guestId), {
                guestId,
                source: ref || 'direct',
                firstSeen: new Date().toISOString(),
                userAgent: navigator.userAgent,
                isConverted: false
              });
            } catch (e) {
              console.error("Guest tracking error:", e);
            }
          }
        }
      };

      handleGuestTracking();

      if (!isStandalonePage && !isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, pathname, router, isStandalonePage, isPublicPage, firestore]);

  // Global Loader for critical states
  if (isUserLoading || (user && isProfileLoading && !userProfile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const showHeader = (user || isPublicPage) && !['/', '/login', '/signup'].includes(pathname);
  const showBottomNav = (user || isPublicPage) && !['/', '/login', '/signup', '/onboarding'].includes(pathname);

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
