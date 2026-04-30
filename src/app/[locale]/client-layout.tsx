'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/lib/firebase/client-provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const { user, authReady, profile, isProfileLoading, firestore, uid } = useUser();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // 🏗️ MASTER AUTH GATE
  useEffect(() => {
    if (!authReady || isProfileLoading || !hasMounted) return;

    const isPrivateRoute = ['/dashboard', '/profile', '/academy', '/admin'].some(p => pathname.includes(p));
    const isAuthPage = ['/login', '/signup'].some(p => pathname.includes(p));
    const isOnboardingPage = pathname.includes('/onboarding');

    // 1. GUEST MODE (Not Logged In)
    if (!user) {
      const isGuestMode = localStorage.getItem('viewora_guest_mode') === 'true';
      
      if (isGuestMode) {
        // Guests can see Dashboard, Gallery, Competitions, etc.
        // But NOT Profile or Admin or Academy (unless you want them to see Academy intro)
        const isRestrictedForGuest = ['/profile', '/admin', '/academy'].some(p => pathname.includes(p));
        if (isRestrictedForGuest) {
          console.log("🛡️ [AuthGate] Guest on restricted route. Redirecting to /login");
          router.replace('/login');
        }
        return;
      }

      if (isPrivateRoute || isOnboardingPage) {
        console.log("🛡️ [AuthGate] Guest on private route. Redirecting to /login");
        router.replace('/login');
      }
      return;
    }

    // 2. LOGGED IN BUT NO PROFILE DOC YET
    if (!profile && uid) {
      const userRef = doc(firestore, 'users', uid);
      getDoc(userRef).then(async (snap) => {
        if (!snap.exists()) {
          // If no profile, we just wait for AuthService to create it.
          // Don't auto-create here to avoid race conditions with AuthService.
        }
      });
      return;
    }

    // 3. NAVIGATION LOGIC (Logged In & Profile Loaded)
    const isOnboarded = profile?.onboarded === true;

    if (!isOnboarded) {
      // User needs onboarding
      if (!isOnboardingPage) {
        console.log("🛡️ [AuthGate] Not onboarded. Forcing /onboarding");
        router.replace('/onboarding');
      }
    } else {
      // User is fully onboarded
      if (isOnboardingPage || isAuthPage) {
        console.log("🛡️ [AuthGate] Already onboarded. Redirecting to /dashboard");
        router.replace('/dashboard');
      }
    }
    
  }, [authReady, isProfileLoading, hasMounted, user, profile, pathname, router, firestore, uid]);

  // 🏗️ RENDER STATE CONTROL
  if (!hasMounted || !authReady) {
    return <FullscreenLoader label="Sistem Hazırlanıyor..." />;
  }

  // If logged in, wait for profile to decide
  if (user && !profile) {
    return <FullscreenLoader label="Profil Senkronize Ediliyor..." />;
  }

  // Final rendering logic
  const isLanding = pathname === '/' || pathname === '/tr' || pathname === '/en';
  const isEssentialAuthPage = ['/login', '/signup', '/onboarding'].some(p => pathname.includes(p));
  
  if (isEssentialAuthPage) {
    // If onboarded user tries to hit auth/onboarding pages, block the flicker while redirecting
    if (profile?.onboarded === true) {
      return <FullscreenLoader label="Dashboard'a Aktarılıyorsunuz..." />;
    }
    return <div className="fixed inset-0 bg-background overflow-y-auto">{children}</div>;
  }

  const showHeader = !isLanding;
  const showBottomNav = !isLanding;

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

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B]">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
        {label}
      </p>
    </div>
  );
}
