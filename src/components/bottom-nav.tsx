'use client';

import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { BookOpen, Compass, Users, Sparkles, LayoutGrid, User } from 'lucide-react';

const orderedNavItems = [
    { href: '/academy', label: 'nav_academy', icon: BookOpen },
    { href: '/explore', label: 'nav_explore', icon: Compass },
    { href: '/groups', label: 'nav_groups', icon: Users },
    { href: '/dashboard', label: 'nav_coach', icon: Sparkles },
    { href: '/gallery', label: 'nav_gallery', icon: LayoutGrid },
    { href: '/profile', label: 'nav_profile', icon: User },
];


export function BottomNav() {
  const t = useTranslations('AppLayout');
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto grid h-full max-w-lg grid-cols-6 items-center">
        {orderedNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors hover:text-primary"
              >
                <item.icon
                  className={cn(
                    'h-5 w-5',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                >
                  {t(item.label)}
                </span>
              </Link>
            );
        })}
      </nav>
    </div>
  );
}
