'use client';
import { packages } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Gem, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { user } from '@/lib/data';

export default function PricingPage() {
  const { toast } = useToast();

  const handlePurchase = (tokens: number) => {
    // In a real app, this would trigger a payment flow with Stripe/Iyzico.
    // Here, we just simulate a successful purchase.
    user.tokenBalance += tokens;
    toast({
      title: 'Satın Alma Başarılı!',
      description: `${tokens} token hesabınıza eklendi.`,
    });
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
                onClick={() => handlePurchase(pkg.tokens)}
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
