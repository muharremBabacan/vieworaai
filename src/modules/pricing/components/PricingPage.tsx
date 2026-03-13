'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, where, orderBy, addDoc, doc } from 'firebase/firestore';
import type { PixPackage, User, PixPurchase } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, ExternalLink, Loader2, CreditCard, Gem } from 'lucide-react';
import { useAppConfig } from '@/components/AppConfigProvider';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';

export default function PricingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();
  
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userRef);

  const packagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'pix_packages'),
      where('active', '==', true),
      orderBy('order', 'asc')
    );
  }, [firestore]);

  const { data: dbPackages, isLoading } = useCollection<PixPackage>(packagesQuery);

  const activePackages = useMemo(() => {
    if (!dbPackages || dbPackages.length === 0) {
      return [
        {
          id: 'starter',
          name: 'Starter Paket',
          price: 99,
          pix_amount: 20,
          description: 'Hızlı başlangıç için temel paket.',
          payment_link: 'https://iyzi.link/AKg9LA',
          active: true,
          order: 1
        },
        {
          id: 'creator',
          name: 'Creator Paket',
          price: 199,
          pix_amount: 60,
          description: 'Gelişmiş analizler ve tam erişim.',
          payment_link: 'https://iyzi.link/AKg9OQ',
          active: true,
          order: 2
        },
        {
          id: 'pro',
          name: 'Pro Paket',
          price: 349,
          pix_amount: 150,
          description: 'Profesyonel araçlar ve mentorluk.',
          payment_link: 'https://iyzi.link/AKg9Og',
          active: true,
          order: 3
        }
      ];
    }
    return dbPackages;
  }, [dbPackages]);

  const handlePurchaseClick = async (pkg: any) => {
    if (!user || !firestore || !userProfile) {
      toast({ variant: 'destructive', title: "Giriş Gerekli", description: "Satın alma işlemi için lütfen giriş yapın." });
      return;
    }

    if (!pkg.payment_link || pkg.payment_link === '#') {
      toast({ variant: 'destructive', title: "Bağlantı Hazırlanıyor", description: "Bu paket için ödeme linki henüz tanımlanmamış." });
      return;
    }

    setIsProcessingId(pkg.id);
    
    try {
      await addDoc(collection(firestore, 'pix_purchases'), {
        user_id: user.uid,
        user_name: userProfile.name || "İsimsiz Vizyoner",
        package_id: pkg.id,
        package_name: pkg.name,
        pix_amount: pkg.pix_amount || 0,
        price: pkg.price,
        payment_provider: "iyzico_link",
        payment_link: pkg.payment_link,
        status: "pending",
        created_at: new Date().toISOString(),
        approved_at: null,
        approved_by: null
      });

      window.open(pkg.payment_link, '_blank');
      
      toast({ 
        title: "Yönlendiriliyorsunuz", 
        description: "Ödeme sayfasını yeni sekmede açtık. Ödeme sonrası bakiyeniz onaylandığında yüklenecektir." 
      });
    } catch (e) {
      console.error("Purchase error:", e);
      toast({ variant: 'destructive', title: "İşlem Başlatılamadı" });
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-in fade-in duration-700">
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
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tighter">{pkg.price}</span>
                    <span className="text-lg font-bold text-primary uppercase">TL</span>
                  </div>
                  <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Gem size={14} /> {pkg.pix_amount || 0} {currencyName} YÜKLEMESİ
                  </p>
                </div>

                <div className="pt-4 border-t border-border/20">
                  <p className="text-sm font-medium text-foreground/70 leading-relaxed">
                    {pkg.description}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                <Button 
                  onClick={() => handlePurchaseClick(pkg)}
                  disabled={isProcessingId === pkg.id}
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/10 transition-transform active:scale-95"
                >
                  {isProcessingId === pkg.id ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      Hemen Satın Al <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-20 text-center flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground bg-secondary/30 px-6 py-3 rounded-full border border-border/40">
          <CreditCard size={16} className="text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest">Tüm ödemeleriniz iyzico SSL güvencesiyle korunur.</p>
        </div>
      </div>
    </div>
  );
}