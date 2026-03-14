'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GraduationCap, Compass, Plus, LayoutGrid, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function BottomNav() {
  const t = useTranslations('AppLayout');
  const pathname = usePathname();

  const navItems = [
    { href: '/academy', label: t('nav_academy') || 'Akademi', icon: GraduationCap },
    { href: '/explore', label: t('nav_explore') || 'Keşfet', icon: Compass },
    { href: '/dashboard', label: t('title_dashboard') || 'Yükle', icon: Plus, isAction: true },
    { href: '/gallery', label: t('nav_gallery') || 'Galeri', icon: LayoutGrid },
    { href: '/luma', label: t('nav_coach') || 'Luma', icon: Sparkles },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t bg-background/95 backdrop-blur-md pb-safe">
      <nav className="mx-auto flex h-full max-w-2xl items-center justify-around px-4">
        {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            if (item.isAction) {
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="relative -top-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
                    >
                        <item.icon className="h-8 w-8" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col items-center justify-center gap-1 min-w-[64px] transition-colors"
              >
                <item.icon
                  className={cn(
                    'h-6 w-6 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
        })}
      </nav>
    </div>
  );
}
