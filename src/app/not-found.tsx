'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Camera, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="relative h-24 w-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-xl shadow-primary/5">
          <Camera size={48} className="animate-pulse" />
          <div className="absolute top-0 right-0 h-6 w-6 bg-destructive rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-background">
            404
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase">Odak Kayboldu</h1>
          <p className="text-muted-foreground font-medium max-w-xs mx-auto">
            Aradığınız kareyi bulamadık. Sayfa taşınmış veya silinmiş olabilir.
          </p>
        </div>

        <Button asChild className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" /> Ana Sayfaya Dön
          </Link>
        </Button>
      </div>
    </div>
  );
}
