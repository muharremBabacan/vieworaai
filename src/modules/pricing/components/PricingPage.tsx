'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, Check, Info } from 'lucide-react';
import { useAppConfig } from '@/components/AppConfigProvider';
import { cn } from '@/lib/utils';

const packages = [
  {
    id: '1',
    name: 'Starter',
    pix: 20,
    price: '99',
    isBestValue: false,
    features: ['Temel Teknik Analiz', 'Hızlı Başlangıç'],
  },
  {
    id: '2',
    name: '⭐ Creator',
    pix: 50,
    price: '199',
    isBestValue: true,
    features: ['Stratejik Mentorluk', 'Tüm Metrikler Açık'],
  },
  {
    id: '3',
    name: 'Pro',
    pix: 100,
    price: '349',
    isBestValue: false,
    features: ['Gelişmiş Stil Analizi', 'Öncelikli İşleme'],
  },
  {
    id: '4',
    name: '🔥 Elite',
    pix: 300,
    price: '799',
    isBestValue: false,
    features: ['Usta Seviye Mentorluk', 'Görsel İşaretleme'],
  },
];

export default function PricingPage() {
  const { currencyName } = useAppConfig();

  return (
    <div className="container mx-auto px-4 py-12 animate-in fade-in duration-700">
      {/* Ücretsiz Kullanım Mesajı */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="bg-primary/10 border border-primary/20 rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left shadow-2xl shadow-primary/5">
          <div className="h-16 w-16 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
            <Sparkles size={32} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black tracking-tight mb-2 uppercase">Luma Erken Erişim Dönemi</h2>
            <p className="text-muted-foreground font-medium text-lg leading-relaxed">
              Tüm analiz özelliklerini şu anda <b>ücretsiz</b> kullanabilirsiniz. Paket satışlarımız yakında başlayacaktır.
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground font-black px-6 h-10 rounded-full text-xs tracking-widest uppercase border-none animate-pulse">
            ŞU AN AKTİF
          </Badge>
        </div>
      </div>

      <header className="text-center mb-16 space-y-4">
        <h1 className="text-6xl font-black tracking-tighter uppercase">{currencyName} Paketleri</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">Sanatsal vizyonunu geliştirmek için sana en uygun paketi seç.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {packages.map((pkg) => (
          <Card 
            key={pkg.id} 
            className={cn(
              "relative flex flex-col rounded-[40px] border-border/40 bg-card/50 overflow-hidden grayscale opacity-60 transition-all duration-500 hover:grayscale-0 hover:opacity-80 group",
              pkg.isBestValue && "border-primary/20"
            )}
          >
            {pkg.isBestValue && (
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-primary" />
            )}
            
            <CardHeader className="p-8 pb-6">
              <CardTitle className="text-2xl font-black tracking-tight mb-2 uppercase">{pkg.name}</CardTitle>
              {pkg.isBestValue && (
                <Badge className="w-fit bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest h-5 rounded-full px-2 border-none mb-2">
                  Popüler
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-8 pt-0 flex-grow space-y-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter">{pkg.pix}</span>
                <span className="text-lg font-bold text-primary uppercase">{currencyName}</span>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/20">
                {pkg.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-foreground/70">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-0 flex flex-col gap-4">
              <div className="text-center w-full mb-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">PAKET FİYATI</p>
                <p className="text-2xl font-black tracking-tight">{pkg.price} TL</p>
              </div>
              <Button disabled className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-secondary text-muted-foreground">
                <Lock className="mr-2 h-4 w-4" /> Çok Yakında
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-20 text-center flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground bg-secondary/30 px-6 py-3 rounded-full border border-border/40">
          <Info size={16} className="text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest">Tüm ödemeleriniz SSL güvencesiyle korunur.</p>
        </div>
      </div>
    </div>
  );
}
