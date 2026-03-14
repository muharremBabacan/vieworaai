'use client';

import { useState } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, addDoc, collection } from 'firebase/firestore';
import { packages } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gem, ExternalLink, Loader2 } from 'lucide-react';
import { useAppConfig } from '@/components/AppConfigProvider';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import type { User } from '@/types';

export default function PricingPage() {
  // 🪝 ALL HOOKS MUST BE AT THE TOP
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  const handlePurchaseClick = async (pkg: any) => {
    if (!user || !firestore || !userProfile) {
      toast({ variant: 'destructive', title: "Giriş Gerekli" });
      return;
    }

    const links: Record<string, string> = {
      'starter': 'https://iyzi.link/AKg9LA',
      'creator': 'https://iyzi.link/AKg9OQ',
      'pro': 'https://iyzi.link/AKg9Og'
    };

    const paymentLink = links[pkg.id] || '#';
    setIsProcessingId(pkg.id);
    
    try {
      const purchaseRef = await addDoc(collection(firestore, 'pix_purchases'), {
        user_id: user.uid,
        user_name: userProfile.name || "Sanatçı",
        package_id: pkg.id,
        package_name: pkg.name,
        pix_amount: pkg.auro,
        price: pkg.price,
        payment_provider: "iyzico_link",
        payment_link: paymentLink,
        status: "pending",
        created_at: new Date().toISOString()
      });

      const sep = paymentLink.includes('?') ? '&' : '?';
      window.open(`${paymentLink}${sep}merchantOrderId=${purchaseRef.id}`, '_blank');
      toast({ title: "Ödeme Sayfasına Yönlendiriliyorsunuz" });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "İşlem Başlatılamadı" });
    } finally {
      setIsProcessingId(null);
    }
  };

  if (isProfileLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 animate-in fade-in duration-700">
      <header className="text-center mb-16 space-y-4">
        <h1 className="text-6xl font-black tracking-tighter uppercase">{currencyName} Paketleri</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">Vizyonunu geliştirmek için sana en uygun paketi seç.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {packages.map((pkg) => (
          <Card key={pkg.id} className={cn("relative flex flex-col rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl", pkg.isBestValue && "border-primary/30 ring-1 ring-primary/10")}>
            <CardHeader className="p-8">
              <CardTitle className="text-2xl font-black uppercase">{pkg.name}</CardTitle>
              {pkg.isBestValue && <Badge className="w-fit bg-primary text-white text-[9px] font-black uppercase h-5 rounded-full px-2 mt-2">Popüler</Badge>}
            </CardHeader>
            <CardContent className="p-8 pt-0 flex-grow space-y-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter">{pkg.price}</span>
                  <span className="text-lg font-bold text-primary uppercase">{pkg.currency}</span>
                </div>
                <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Gem size={14} /> {pkg.auro} {currencyName} YÜKLEMESİ
                </p>
              </div>
              <p className="text-sm font-medium text-foreground/70 leading-relaxed">{pkg.slogan}</p>
            </CardContent>
            <CardFooter className="p-8 pt-0">
              <Button onClick={() => handlePurchaseClick(pkg)} disabled={isProcessingId === pkg.id} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl">
                {isProcessingId === pkg.id ? <Loader2 className="animate-spin h-5 w-5" /> : <>Hemen Satın Al <ExternalLink className="ml-2 h-4 w-4" /></>}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
