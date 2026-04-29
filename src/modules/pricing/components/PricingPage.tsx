
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { packages } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Gem, Loader2, Sparkles, Info, Lock } from 'lucide-react';
import { useAppConfig } from '@/components/AppConfigProvider';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

export default function PricingPage() {
  const { user, uid } = useUser();
  const firestore = useFirestore();
  const { currencyName } = useAppConfig();
  
  const userRef = useMemoFirebase(() => (uid && firestore) ? doc(firestore, 'users', uid) : null, [uid, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  if (isProfileLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 animate-in fade-in duration-700">
      <header className="max-w-4xl mx-auto text-center mb-16 space-y-8">
        <Alert className="rounded-[32px] border-primary/30 bg-primary/5 p-8 border-2 shadow-2xl shadow-primary/5 animate-in slide-in-from-top-10 duration-1000">
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Sparkles size={28} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <AlertTitle className="text-3xl font-black tracking-tighter uppercase text-primary">Viewora Beta</AlertTitle>
              <AlertDescription className="text-lg font-bold text-foreground/90 max-w-2xl">
                Viewora şu anda erişim (beta) aşamasındadır. <br />
                <span className="text-primary">Tüm analiz özelliklerini şu anda ücretsiz kullanabilirsiniz.</span>
              </AlertDescription>
            </div>
          </div>
        </Alert>

        <div className="pt-8">
          <h1 className="text-6xl font-black tracking-tighter uppercase">{currencyName} Paketleri</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium mt-4">Yakında eklenecek olan Pix paketlerimizi inceleyin.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {packages.map((pkg) => (
          <Card key={pkg.id} className={cn(
            "relative flex flex-col rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl grayscale-[0.5] opacity-80",
            pkg.isBestValue && "border-primary/20 ring-1 ring-primary/5"
          )}>
            <div className="absolute top-6 right-6 z-10">
               <Lock className="text-muted-foreground/40 h-5 w-5" />
            </div>
            
            <CardHeader className="p-8">
              <CardTitle className="text-2xl font-black uppercase">{pkg.name}</CardTitle>
              {pkg.isBestValue && <Badge className="w-fit bg-primary/20 text-primary text-[9px] font-black uppercase h-5 rounded-full px-2 mt-2 border-primary/20">Popüler</Badge>}
            </CardHeader>
            <CardContent className="p-8 pt-0 flex-grow space-y-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-muted-foreground">{pkg.price}</span>
                  <span className="text-lg font-bold text-muted-foreground/60 uppercase">TL</span>
                </div>
                <p className="text-xs font-black text-cyan-400/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Gem size={14} /> {pkg.pix} {currencyName} YÜKLEMESİ
                </p>
              </div>
              <p className="text-sm font-medium text-foreground/50 leading-relaxed">{pkg.slogan}</p>
            </CardContent>
            <CardFooter className="p-8 pt-0">
              <Button disabled className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-secondary text-muted-foreground border border-border/40">
                Beta'da Ücretsiz
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-20 max-w-2xl mx-auto p-8 rounded-[32px] border border-border/40 bg-muted/5 text-center space-y-4">
        <Info className="mx-auto text-primary/40" size={32} />
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          Beta süreci boyunca hesabınıza otomatik olarak tanımlanan Pix'leri kullanabilirsiniz. 
          Gerçek ödeme altyapısı lansman ile birlikte aktif edilecektir.
        </p>
      </div>
    </div>
  );
}
