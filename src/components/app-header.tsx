'use client';

import { UserNav } from '@/components/user-nav';
import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const navItems = [
    { href: '/academy', label: 'nav_academy' },
    { href: '/explore', label: 'nav_explore' },
    { href: '/groups', label: 'nav_groups' },
    { href: '/dashboard', label: 'nav_coach' },
    { href: '/gallery', label: 'nav_gallery' },
];

function HeaderLogo() {
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.firebasestorage.app/o/user-uploads%2Fviewora_logok01.png?alt=media&token=a6e7a558-eaf1-46dd-946e-a61e47d080cc";
    return (
        <Link href="/dashboard" className="flex items-center gap-2 mr-6">
            <div className="relative h-8 w-8">
                <Image
                    src={logoUrl}
                    alt="Viewora Logo"
                    fill
                    className="object-contain"
                    priority
                    unoptimized
                />
            </div>
            <div className="flex items-baseline">
              <span className="font-sans text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                Viewora
              </span>
              <sup className="font-bold text-sm text-purple-600">®</sup>
            </div>
        </Link>
    )
}

export function AppHeader() {
  const t = useTranslations('AppLayout');
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center">
        <HeaderLogo />
        
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "transition-colors hover:text-foreground/80",
                    pathname.startsWith(item.href) ? "text-foreground" : "text-foreground/60"
                )}
              >
                {t(item.label)}
              </Link>
            ))}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
