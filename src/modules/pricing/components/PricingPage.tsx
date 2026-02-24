'use client';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { packages } from '@/lib/data';
import { useToast } from '@/shared/hooks/use-toast';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { Package } from '@/types';

function PackageCard({
  pkg,
  onPurchase,
  isProcessing,
}: {
  pkg: Package;
  onPurchase: (pkg: Package) => void;
  isProcessing: boolean;
}) {
  const t = useTranslations('PricingPage');
  return (
    <Card className={`flex flex-col ${pkg.isBestValue ? 'border-primary ring-2 ring-primary shadow-lg' : ''}`}>
      <CardHeader className="relative">
        {pkg.isBestValue && (
          <Badge className="absolute top-4 right-4">{t('best_value_badge')}</Badge>
        )}
        <CardTitle>{pkg.name}</CardTitle>
        <CardDescription>{pkg.slogan}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tighter">{pkg.price}{pkg.currency}</span>
        </div>
        <p className="text-2xl font-bold text-primary my-4">{pkg.auro} {t('auro_unit')}</p>
        <div className="flex-grow" />
        <Button onClick={() => onPurchase(pkg)} disabled={isProcessing} className="w-full mt-6">
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isProcessing ? t('button_processing') : t('button_buy_now')}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PricingPage() {
  const t = useTranslations('PricingPage');
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = (pkg: Package) => {
    setIsProcessing(true);
    toast({
      title: t('toast_redirecting_title'),
      description: t('toast_redirecting_description'),
    });

    // Simulate API call and response
    setTimeout(() => {
      toast({
        title: t('toast_purchase_success_title'),
        description: t('toast_purchase_success_description', { auro: pkg.auro }),
      });
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="container mx-auto max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">{t('page_title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('page_description')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onPurchase={handlePurchase} isProcessing={isProcessing} />
        ))}
      </div>
    </div>
  );
}
