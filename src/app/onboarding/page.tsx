'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const photographyInterests = [
  'Ürün & E-ticaret',
  'Hobi & Gezi',
  'Yemek Fotoğrafçılığı',
  'Düğün & Etkinlik',
  'Stüdyo & Portre',
  'Manzara & Doğa',
  'Su Altı',
  'Astrofotoğrafçılık',
  'Sokak Fotoğrafçılığı',
  'Mimari',
];

export default function OnboardingPage() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleContinue = () => {
    if (!userDocRef) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.',
      });
      router.push('/login');
      return;
    }
    if (selectedInterests.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lütfen en az bir ilgi alanı seçin.',
      });
      return;
    }

    setIsUpdating(true);
    
    updateDoc(userDocRef, {
      interests: selectedInterests,
      onboarded: true,
    }).then(() => {
      router.replace('/academy');
    }).catch((error) => {
      console.error("Onboarding update failed:", error);
      toast({
        variant: 'destructive',
        title: 'Güncelleme Başarısız',
        description: 'Bilgileriniz kaydedilemedi. Lütfen tekrar deneyin.',
      });
      setIsUpdating(false);
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <Logo className="mx-auto mb-4 justify-center" />
            <CardTitle className="font-sans text-2xl">Viewora'ya Hoş Geldiniz!</CardTitle>
            <CardDescription>
              Size daha iyi yardımcı olabilmemiz için fotoğrafçılıkla ilgili ilgi alanlarınızı seçin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-2">
              {photographyInterests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-full border transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {isSelected && <Check className="mr-2 inline-block h-4 w-4" />}
                    {interest}
                  </button>
                );
              })}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleContinue} disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Devam Et'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

    