import { AppHeader } from '@/core/components/app-header';
import { BottomNav } from '@/core/components/bottom-nav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 py-8 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
