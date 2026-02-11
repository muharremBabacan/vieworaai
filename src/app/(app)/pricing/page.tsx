'use client';
import { packages } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Gem, Star } from 'lucide-react';
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
    // 5. Backend, Firestore'daki kullanıcının token sayısını güvenli bir şekilde günceller.
    
    // Şimdilik, ödeme akışını SİMÜLE EDİYORUZ.
    toast({
      title: 'Ödeme Sağlayıcıya Yönlendiriliyor...',
      description: `Bu bir simülasyondur. Gerçek uygulamada iyzico'ya yönlendirileceksiniz.`,
    });

    // Simülasyon: 2 saniye sonra token ekle ve işlem kaydı oluştur
    setTimeout(() => {
        // 1. Token bakiyesini güncelle
        updateDocumentNonBlocking(userDocRef, {
          tokenBalance: userProfile.tokenBalance + pkg.tokens,
        });

        // 2. İşlem kaydı oluştur (simülasyon)
        const transactionsCollectionRef = collection(firestore, 'users', authUser.uid, 'transactions');
        const transactionData = {
          userId: authUser.uid,
          amount: pkg.tokens,
          type: 'Purchase',
          status: 'Completed',
          transactionDate: new Date().toISOString(),
        };
        addDocumentNonBlocking(transactionsCollectionRef, transactionData);

        // 3. Kullanıcıyı bilgilendir
        toast({
          title: 'Satın Alma Başarılı!',
          description: `${pkg.tokens} token hesabınıza eklendi.`,
        });
    }, 2000);
  };

  return (
    <div className="container mx-auto">
      <div className="text-center mb-12">
        <h2 className="font-sans text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">Size Uygun Planı Bulun</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Fotoğraflarınız hakkında yapay zeka destekli geri bildirimler almak ve bir fotoğrafçı olarak gelişiminizi hızlandırmak için token satın alın.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {packages.map((pkg) => (
          <Card key={pkg.id} className={`flex flex-col ${pkg.isBestValue ? 'border-primary ring-2 ring-primary' : ''}`}>
            {pkg.isBestValue && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Star className="mr-2 h-4 w-4" /> En İyi Teklif
              </Badge>
            )}
            <CardHeader className="text-center">
              <CardTitle className="font-sans text-3xl flex items-center justify-center gap-2">
                <Gem className="h-7 w-7 text-primary" /> {pkg.tokens} Token
              </CardTitle>
              <CardDescription className="text-4xl font-bold pt-4">
                {pkg.price} <span className="text-lg font-normal text-muted-foreground">{pkg.currency}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {/* You can add more details about each package here */}
              <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" />Detaylı YZ Analizi</li>
                  <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" />Uygulanabilir Geri Bildirim</li>
                  <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" />Sanat Galerisine Erişim</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
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
