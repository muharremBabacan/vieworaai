'use client';

import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { BookOpen, GalleryHorizontal, Users, Bot, LayoutGrid } from 'lucide-react';

const orderedNavItems = [
    { href: '/academy', label: 'nav_academy', icon: BookOpen },
    { href: '/explore', label: 'nav_explore', icon: GalleryHorizontal },
    { href: '/dashboard', label: 'nav_coach', icon: Bot },
    { href: '/groups', label: 'nav_groups', icon: Users },
    { href: '/gallery', label: 'nav_gallery', icon: LayoutGrid },
];


export function BottomNav() {
  const t = useTranslations('AppLayout');
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto grid h-full max-w-lg grid-cols-5 items-center">
        {orderedNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            // The center item should be larger and more prominent
            if (item.href === '/dashboard') {
                 return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="relative flex h-full flex-col items-center justify-start pt-2"
                    >
                       <div className={cn(
                           "absolute -top-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg transition-transform duration-300 hover:scale-110",
                           isActive && "ring-4 ring-primary/50"
                       )}>
                           <item.icon className="h-8 w-8" />
                       </div>
                       <span className={cn(
                           "mt-auto pb-2 text-xs font-medium transition-colors",
                           isActive ? "text-primary" : "text-muted-foreground"
                       )}>{t(item.label)}</span>
                    </Link>
                );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors hover:text-primary"
              >
                <item.icon
                  className={cn(
                    'h-6 w-6',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <span
                  className={cn(
                    'font-medium',
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
