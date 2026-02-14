'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
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
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleContinue = async () => {
    if (!userDocRef) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.',
      });
      router.push('/');
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
    
    updateDocumentNonBlocking(userDocRef, {
      interests: selectedInterests,
      onboarded: true,
    });
    // Non-blocking, so we can navigate away immediately
    router.replace('/profile');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader className="text-center">
            <Logo className="mx-auto mb-4 justify-center" />
            <CardTitle className="font-sans text-2xl">Viewora'ya Hoş Geldiniz!</CardTitle>
            <CardDescription>
              Size en uygun deneyimi sunabilmemiz için fotoğrafçılık ilgi alanlarınızı seçin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 py-6">
            <div>
                 <h3 className="mb-4 text-center text-lg font-medium">İlgi alanlarınız nelerdir?</h3>
                 <CardDescription className="text-center mb-4 -mt-2">İstediğiniz kadar seçebilirsiniz.</CardDescription>
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
