'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';

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

const skillLevels: {id: User['planLevel'], name: string, description: string, xp: number, levelName: string}[] = [
    { id: 'Temel', name: 'Yeni Başlıyorum', description: 'Fotoğrafçılığın temellerini öğrenmek istiyorum.', xp: 0, levelName: 'Meraklı Göz'},
    { id: 'Orta', name: 'Deneyimliyim', description: 'Becerilerimi geliştirmek ve yeni teknikler keşfetmek istiyorum.', xp: 100, levelName: 'Gelişen Kadraj' },
    { id: 'Pro', name: 'Profesyonelim', description: 'İş akışımı hızlandırmak ve sanatsal vizyonumu zorlamak istiyorum.', xp: 250, levelName: 'Yetkin Vizör' },
]


export default function OnboardingPage() {
  const [selectedLevel, setSelectedLevel] = useState<User['planLevel'] | null>(null);
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

  const handleContinue = async () => {
    if (!userDocRef) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.',
      });
      router.push('/login');
      return;
    }
     if (!selectedLevel) {
      toast({
        variant: 'destructive',
        title: 'Lütfen deneyim seviyenizi seçin.',
      });
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
    
    const skill = skillLevels.find(l => l.id === selectedLevel);
    if (!skill) {
      // This should not happen if a level is selected
      setIsUpdating(false);
      return;
    }
    
    try {
      await updateDoc(userDocRef, {
        planLevel: selectedLevel,
        level: skill.levelName,
        xp: skill.xp,
        interests: selectedInterests,
        onboarded: true,
      });
      router.replace('/profile');
    } catch (error) {
      console.error("Onboarding update failed:", error);
      toast({
        variant: 'destructive',
        title: 'Güncelleme Başarısız',
        description: 'Bilgileriniz kaydedilemedi. Lütfen tekrar deneyin.',
      });
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader className="text-center">
            <Logo className="mx-auto mb-4 justify-center" />
            <CardTitle className="font-sans text-2xl">Viewora'ya Hoş Geldiniz!</CardTitle>
            <CardDescription>
              Size en uygun deneyimi sunabilmemiz için birkaç sorumuz olacak.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
                <h3 className="mb-4 text-center text-lg font-medium">Deneyim seviyeniz nedir?</h3>
                <RadioGroup 
                    onValueChange={(value: User['planLevel']) => setSelectedLevel(value)}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {skillLevels.map((level) => (
                        <Label 
                            key={level.id} 
                            htmlFor={level.id}
                            className={cn(
                                "flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                                selectedLevel === level.id && "border-primary bg-accent"
                            )}
                        >
                            <RadioGroupItem value={level.id} id={level.id} className="sr-only" />
                            <span className="font-bold text-base mb-2">{level.name}</span>
                            <span className="text-xs text-center text-muted-foreground">{level.description}</span>
                        </Label>
                    ))}
                </RadioGroup>
            </div>
            
            <div>
                 <h3 className="mb-4 text-center text-lg font-medium">Fotoğrafçılık ilgi alanlarınız neler?</h3>
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
