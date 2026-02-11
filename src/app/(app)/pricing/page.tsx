'use client';
import { packages } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { User as UserProfile, Package } from '@/types';

export default function PricingPage() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const handlePurchase = (pkg: Package) => {
    if (!userDocRef || !userProfile || !authUser) return;
    
    // --- GERÇEK UYGULAMA İÇİN NOT ---
    // Bu kısım, gerçek bir ödeme entegrasyonu için bir başlangıç noktasıdır.
    // 1. Bu fonksiyon, sizin oluşturacağınız bir backend API'sine istek göndermelidir. (Örn: /api/create-payment)
    // 2. Backend, iyzico API'si ile güvenli bir şekilde konuşarak bir ödeme linki oluşturmalıdır.
    // 3. Backend'den dönen ödeme linkine kullanıcı yönlendirilir.
    // 4. Ödeme başarılı olduğunda, iyzico'dan gelen bir webhook ile backend'iniz tetiklenir ve işlem kaydı oluşturulur.
    // 5. Backend, Firestore'daki kullanıcının Auro bakiyesini güvenli bir şekilde günceller.
    
    // Şimdilik, ödeme akışını SİMÜLE EDİYORUZ.
    toast({
      title: 'Ödeme Sağlayıcıya Yönlendiriliyor...',
      description: `Bu bir simülasyondur. Gerçek uygulamada iyzico'ya yönlendirileceksiniz.`,
    });

    // Simülasyon: 2 saniye sonra Auro ekle ve işlem kaydı oluştur
    setTimeout(() => {
        // 1. Auro bakiyesini güncelle
        updateDocumentNonBlocking(userDocRef, {
          auro_balance: userProfile.auro_balance + pkg.auro,
        });

        // 2. İşlem kaydı oluştur (simülasyon)
        const transactionsCollectionRef = collection(firestore, 'users', authUser.uid, 'transactions');
        const transactionData = {
          userId: authUser.uid,
          amount: pkg.auro,
          type: 'Purchase',
          status: 'Completed',
          transactionDate: new Date().toISOString(),
        };
        addDocumentNonBlocking(transactionsCollectionRef, transactionData);

        // 3. Kullanıcıyı bilgilendir
        toast({
          title: 'Satın Alma Başarılı!',
          description: `${pkg.auro} Auro hesabınıza eklendi.`,
        });
    }, 2000);
  };

  return (
    <div className="container mx-auto">
      <div className="text-center mb-12">
        <h2 className="font-sans text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">Auro Paketleri</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Yeteneklerinizi bir üst seviyeye taşımak ve sanatsal vizyonunuzun kilidini açmak için Auro satın alın.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
        {packages.map((pkg) => (
          <Card key={pkg.id} className={`flex flex-col ${pkg.isBestValue ? 'border-primary ring-2 ring-primary' : ''}`}>
            {pkg.isBestValue && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <Star className="mr-2 h-4 w-4" /> En İyi Teklif
              </Badge>
            )}
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-sans text-2xl">{pkg.name}</CardTitle>
              <CardDescription className="text-primary font-semibold">{pkg.target}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center text-center justify-between">
                <div className="flex items-baseline justify-center my-6">
                    <span className="text-5xl font-extrabold tracking-tight">{pkg.auro}</span>
                    <span className="ml-2 text-xl font-medium text-muted-foreground flex items-center gap-1">
                        <Gem className="h-5 w-5 text-cyan-400"/>
                        Auro
                    </span>
                </div>
                <p className="text-muted-foreground italic mb-6">"{pkg.slogan}"</p>
                <div className="text-4xl font-bold">
                    {pkg.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-lg font-normal text-muted-foreground ml-1">{pkg.currency}</span>
                </div>
            </CardContent>
            <CardFooter className="p-6">
              <Button 
                className="w-full" 
                size="lg"
                variant={pkg.isBestValue ? 'default' : 'outline'}
                onClick={() => handlePurchase(pkg)}
                disabled={!userProfile}
              >
                Hemen Satın Al
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
