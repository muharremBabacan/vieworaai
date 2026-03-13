
'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PixPackage } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Check, Info, ExternalLink } from 'lucide-react';
import { useAppConfig } from '@/components/AppConfigProvider';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const { currencyName } = useAppConfig();
  const firestore = useFirestore();

  // 1. All hooks at the top
  const packagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'pix_packages'),
      where('active', '==', true),
      orderBy('order', 'asc')
    );
  }, [firestore]);

  const { data: dbPackages, isLoading } = useCollection<PixPackage>(packagesQuery);

  // 2. Logic processing after hooks
  const activePackages = useMemo(() => {
    // Fallback if DB is empty
    if (!dbPackages || dbPackages.length === 0) {
      return [{
        id: 'starter',
        name: 'Starter Paket',
        price: 99,
        description: 'Hızlı başlangıç için temel paket.',
        payment_link: 'https://iyzi.link/AKg9LA',
        active: true,
        order: 1
      }];
    }
    return dbPackages;
  }, [dbPackages]);

  return (
    <div className="container mx-auto px-4 py-12 animate-in fade-in duration-700">
      {/* Ücretsiz Kullanım Mesajı (Beta Revizyonu) */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="bg-primary/10 border border-primary/20 rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left shadow-2xl shadow-primary/5">
          <div className="h-16 w-16 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
            <Sparkles size={32} />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-2xl font-black tracking-tight uppercase text-primary">Viewora Beta</h2>
            <p className="text-foreground/90 font-bold text-lg leading-tight">
              Viewora şu anda erişim (beta) aşamasındadır.
            </p>
            <p className="text-muted-foreground font-medium text-base">
              Tüm analiz özelliklerini şu anda <b>ücretsiz</b> kullanabilirsiniz.
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground font-black px-6 h-10 rounded-full text-xs tracking-widest uppercase border-none animate-pulse">
            BETA AKTİF
          </Badge>
        </div>
      </div>

      <header className="text-center mb-16 space-y-4">
        <h1 className="text-6xl font-black tracking-tighter uppercase">{currencyName} Paketleri</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">Sanatsal vizyonunu geliştirmek için sana en uygun paketi seç.</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 rounded-[40px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {activePackages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={cn(
                "relative flex flex-col rounded-[40px] border-border/40 bg-card/50 overflow-hidden transition-all duration-500 hover:border-primary/20 group shadow-xl",
                pkg.order === 2 && "border-primary/30 ring-1 ring-primary/10"
              )}
            >
              {pkg.order === 2 && (
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-primary" />
              )}
              
              <CardHeader className="p-8 pb-6">
                <CardTitle className="text-2xl font-black tracking-tight mb-2 uppercase">{pkg.name}</CardTitle>
                {pkg.order === 2 && (
                  <Badge className="w-fit bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest h-5 rounded-full px-2 border-none mb-2">
                    Popüler
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-8 pt-0 flex-grow space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter">{pkg.price}</span>
                  <span className="text-lg font-bold text-primary uppercase">TL</span>
                </div>

                <div className="pt-4 border-t border-border/20">
                  <p className="text-sm font-medium text-foreground/70 leading-relaxed">
                    {pkg.description}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                <Button 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/10 transition-transform active:scale-95"
                  asChild
                >
                  <a href={pkg.payment_link} target="_blank" rel="noopener noreferrer">
                    Satın Al <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-20 text-center flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground bg-secondary/30 px-6 py-3 rounded-full border border-border/40">
          <Info size={16} className="text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest">Tüm ödemeleriniz iyzico SSL güvencesiyle korunur.</p>
        </div>
      </div>
    </div>
  );
}
