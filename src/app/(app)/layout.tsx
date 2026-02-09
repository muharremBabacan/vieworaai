
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Camera,
  GalleryVertical,
  GraduationCap,
  Sparkles,
  Menu,
  Coins,
} from 'lucide-react';
import Logo from '@/components/logo';
import { UserNav } from '@/components/user-nav';
import { useIsMobile } from '@/hooks/use-mobile';


const navItems = [
  {
    href: '/dashboard',
    icon: Sparkles,
    label: 'AI Coach',
  },
  {
    href: '/gallery',
    icon: GalleryVertical,
    label: 'Art Gallery',
  },
  {
    href: '/academy',
    icon: GraduationCap,
    label: 'Viewora Academy',
  },
  {
    href: '/pricing',
    icon: Coins,
    label: 'Get Tokens',
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  
  const [open, setOpen] = React.useState(isMobile ? false : true);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <Sidebar>
        <SidebarHeader>
          <Logo className="text-sidebar-foreground" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{
                    children: item.label,
                    className: 'font-body'
                  }}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setOpen(!open)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          <div className="w-full flex-1">
            <h1 className="font-headline text-xl font-semibold">
              {navItems.find(item => item.href === pathname)?.label}
            </h1>
          </div>
          <UserNav />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
