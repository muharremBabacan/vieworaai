'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GalleryVertical,
  GraduationCap,
  Sparkles,
  Compass,
  Trophy,
} from 'lucide-react';
import Logo from '@/components/logo';
import { UserNav } from '@/components/user-nav';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';

const navItems = [
  {
    href: '/academy',
    icon: GraduationCap,
    label: 'Akademi',
    shortLabel: 'Akademi'
  },
  {
    href: '/explore',
    icon: Compass,
    label: 'Keşfet',
    shortLabel: 'Keşfet'
  },
  {
    href: '/dashboard',
    icon: Sparkles,
    label: 'Yapay Zeka Koçu',
    shortLabel: 'Koç'
  },
  {
    href: '/competitions',
    icon: Trophy,
    label: 'Yarışmalar',
    shortLabel: 'Yarışma'
  },
  {
    href: '/gallery',
    icon: GalleryVertical,
    label: 'Fotoğraflarım',
    shortLabel: 'Galerim'
  },
];

const categorySlugToTitle: Record<string, string> = {
    'teknik': 'Teknik',
    'kompozisyon': 'Kompozisyon',
    'isik': 'Işık'
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    // Redirect if profile is loaded and user is not onboarded.
    // This covers new users (onboarded: false) and old users (onboarded: undefined).
    if (userProfile && !userProfile.onboarded) {
      router.replace('/onboarding');
    }
  }, [userProfile, router]);
  
  // Show loader while auth state is loading, or user profile is loading,
  // or while we are about to redirect to onboarding.
  if (isUserLoading || !user || isProfileLoading || (userProfile && !userProfile.onboarded)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Logo />
          <span>Yükleniyor...</span>
        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    const pathSegments = pathname.split('/').filter(Boolean);
    
    if (pathSegments[0] === 'academy' && pathSegments[1] === 'temel-egitim' && pathSegments[2]) {
        return categorySlugToTitle[pathSegments[2]] || 'Temel Eğitim';
    }

    if (pathname.startsWith('/academy/temel-egitim')) return 'Temel Fotoğraf Eğitimi';
    if (pathname.startsWith('/academy/fotografcilik-turleri')) return 'Fotoğrafçılık Türleri';
    
    const navItem = navItems.find(item => pathname.startsWith(item.href));
    return navItem?.label;
  };
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-card/70 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-4">
              <Link href="/academy">
                <Logo />
              </Link>
          </div>
          <div className="flex items-center gap-4">
              <UserNav />
          </div>
      </header>

      <main className="flex-1 p-4 pb-24 sm:p-6 lg:p-8">
          <div className="mb-6">
              <h1 className="font-sans text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                  {getPageTitle()}
              </h1>
          </div>
          {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/90 backdrop-blur-sm">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                pathname.startsWith(item.href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.shortLabel}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
