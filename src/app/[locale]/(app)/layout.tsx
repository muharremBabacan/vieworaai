'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  GalleryVertical,
  GraduationCap,
  Sparkles,
  Compass,
  Settings,
  Users,
} from 'lucide-react';
import Logo from '@/components/logo';
import { UserNav } from '@/components/user-nav';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('AppLayout');
  const tAcademy = useTranslations('AcademyPage');
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const navItems = [
    {
      href: '/academy',
      icon: GraduationCap,
      label: t('nav_academy'),
      shortLabel: t('nav_academy'),
    },
    {
      href: '/explore',
      icon: Compass,
      label: t('nav_explore'),
      shortLabel: t('nav_explore'),
    },
    {
      href: '/groups',
      icon: Users,
      label: t('nav_groups'),
      shortLabel: t('nav_groups'),
    },
    {
      href: '/dashboard',
      icon: Sparkles,
      label: t('nav_coach'),
      shortLabel: t('nav_coach'),
    },
    {
      href: '/gallery',
      icon: GalleryVertical,
      label: t('nav_gallery'),
      shortLabel: t('nav_gallery'),
    },
    {
      href: '/profile',
      icon: Settings,
      label: t('nav_settings'),
      shortLabel: t('nav_settings'),
    },
  ];

  const pageTitleMap: Record<string, string> = {
    '/academy': t('title_academy'),
    '/explore': t('title_explore'),
    '/dashboard': t('title_dashboard'),
    '/competitions': t('title_competitions'),
    '/gallery': t('title_gallery'),
    '/groups': t('title_groups'),
    '/profile': t('title_profile'),
    '/pricing': t('title_pricing'),
  };

  const levelSlugTitleMap: Record<string, string> = {
    temel: tAcademy('level_basic_title'),
    orta: tAcademy('level_intermediate_title'),
    ileri: tAcademy('level_advanced_title'),
  };

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // Firebase Storage'dan aldığın güncel ve izinli URL
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.firebasestorage.app/o/user-uploads%2Fviewora_logok01.png?alt=media&token=a6e7a558-eaf1-46dd-946e-a61e47d080cc";

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    if (userProfile && !userProfile.onboarded) {
      router.replace('/onboarding');
    }
  }, [userProfile, router]);

  if (isUserLoading || !user || isProfileLoading || (userProfile && !userProfile.onboarded)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="relative h-16 w-16 animate-pulse">
            <Image
              src={logoUrl}
              alt={t('loading')}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <span className="animate-pulse">{t('loading')}</span>
        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments[0] === 'academy' && pathSegments[1] && levelSlugTitleMap[pathSegments[1]]) {
      return levelSlugTitleMap[pathSegments[1]];
    }
    const staticTitle = pageTitleMap[pathname];
    if (staticTitle) return staticTitle;
    const navItem = navItems.find(item => pathname.startsWith(item.href));
    return navItem?.label ?? t('title_default');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-card/70 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/academy" className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <Image
                src={logoUrl}
                alt="Viewora Logo"
                fill
                className="object-contain"
                priority
                unoptimized={true}
              />
            </div>
            <span className="font-sans text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
              Viewora
            </span>
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
        <div className="mx-auto grid h-16 max-w-md grid-cols-6">
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
