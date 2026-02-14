'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Logo />
          <span>Yönlendiriliyor...</span>
        </div>
      </div>
  );
}
