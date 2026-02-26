'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GraduationCap, Compass, Users, Sparkles, LayoutGrid, User, BrainCircuit } from 'lucide-react';

const orderedNavItems = [
    { href: '/academy', label: 'Akademi', icon: GraduationCap },
    { href: '/explore', label: 'Keşfet', icon: Compass },
    { href: '/groups', label: 'Gruplar', icon: Users },
    { href: '/luma', label: 'Luma', icon: BrainCircuit },
    { href: '/dashboard', label: 'Koç', icon: Sparkles },
    { href: '/gallery', label: 'Galerim', icon: LayoutGrid },
    { href: '/profile', label: 'Profilim', icon: User },
];


export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-full max-w-2xl items-center justify-around px-2">
        {orderedNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors hover:text-primary min-w-[50px]"
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
                  {item.label}
                </span>
              </Link>
            );
        })}
      </nav>
    </div>
  );
}
