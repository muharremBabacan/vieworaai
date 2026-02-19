'use client';
import React, { useMemo, useState } from 'react';
import { Link, useRouter } from '@/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Gem, Award, Users, Trophy, ChevronRight, CheckCircle, BrainCircuit, BarChart3, Bot } from 'lucide-react';
import { getLevelFromXp, levels as allLevels } from '@/lib/gamification';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Loader2 } from 'lucide-react';

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

const curriculumMap = {
    'Temel': ["Fotoğrafçılığa Giriş", "Pozlama Temelleri", "Netlik ve Odaklama", "Temel Kompozisyon", "Işık Bilgisi"],
    'Orta': ["Tür Bazlı Çekim Teknikleri", "İleri Pozlama Teknikleri", "Işık Yönetimi", "Görsel Hikâye Anlatımı", "Post-Prodüksiyon Temelleri"],
    'İleri': ["Uzmanlık Alanı Derinleşme", "Profesyonel Işık Kurulumu", "Gelişmiş Teknikler", "Sanatsal Kimlik ve Stil", "Ticari ve Marka Konumlandırma"]
};

function AdminTools({ userProfile }: { userProfile: UserProfile }) {
    const t = useTranslations('ProfilePage');
    const tCurriculum = useTranslations('Curriculum');
    const { toast } = useToast();
    const firestore = useFirestore();
    const locale = useLocale();
    const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri' | ''>('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const categories = useMemo(() => {
        if (!selectedLevel) return [];
        return curriculumMap[selectedLevel];
    }, [selectedLevel]);

    const handleGenerate = async () => {
        if (!selectedLevel || !selectedCategory) {
             toast({
                variant: "destructive",
                title: t('admin_toast_missing_selection_title'),
                description: t('admin_toast_missing_selection_description'),
            });
            return;
        }

        setIsGenerating(true);
        toast({
            title: t('admin_toast_generating_title'),
            description: t('admin_toast_generating_description', { level: tCurriculum(`level_${selectedLevel.toLowerCase()}`), category: tCurriculum(`cat_${selectedCategory.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')}`) }),
            duration: 10000,
        });

        try {
            const generatedLessons = await generateDailyLessons({
                level: selectedLevel,
                category: tCurriculum(`cat_${selectedCategory.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')}`),
                language: locale,
            });

            if (!generatedLessons || generatedLessons.length === 0) {
                throw new Error("No lessons were generated.");
            }

            const lessonsCollectionRef = collection(firestore, "academyLessons");
            let savedCount = 0;
            for (const lesson of generatedLessons) {
                // Find a random placeholder image
                const randomImage = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)];
                
                const newLesson = {
                    ...lesson,
                    imageUrl: randomImage.imageUrl, // Use placeholder
                    imageHint: randomImage.imageHint, // Use hint from placeholder
                    createdAt: new Date().toISOString(),
                };
                await addDocumentNonBlocking(lessonsCollectionRef, newLesson);
                savedCount++;
            }
            
            toast({
                title: t('admin_toast_generate_success_title'),
                description: t('admin_toast_generate_success_description', { count: savedCount, category: tCurriculum(`cat_${selectedCategory.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')}`) }),
            });

        } catch (error) {
            console.error("Failed to generate or save lessons:", error);
            toast({
                variant: "destructive",
                title: t('admin_toast_generate_error_title'),
                description: t('admin_toast_generate_error_description'),
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (userProfile.email !== 'admin@viewora.ai') return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin_tools_title')}</CardTitle>
                <CardDescription>{t('admin_tools_description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg space-y-4">
                     <h4 className="font-semibold">{t('admin_generate_lessons_title')}</h4>
                     <p className="text-sm text-muted-foreground">{t('admin_generate_lessons_description')}</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select onValueChange={(value) => setSelectedLevel(value as any)} value={selectedLevel}>
                            <SelectTrigger><SelectValue placeholder={t('admin_select_level')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Temel">{tCurriculum('level_basic')}</SelectItem>
                                <SelectItem value="Orta">{tCurriculum('level_intermediate')}</SelectItem>
                                <SelectItem value="İleri">{tCurriculum('level_advanced')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedCategory} value={selectedCategory} disabled={!selectedLevel}>
                            <SelectTrigger><SelectValue placeholder={t('admin_select_category')} /></SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>
                                        {tCurriculum(`cat_${cat.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                     </div>
                     <Button onClick={handleGenerate} disabled={isGenerating || !selectedLevel || !selectedCategory}>
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('admin_button_generate')}
                     </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export default function ProfilePage() {
  const { user: authUser, isUserLoading } = useUser();
  const firestore = useFirestore();
  const t = useTranslations('ProfilePage');

  const userDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  if (isUserLoading || isProfileLoading || !userProfile || !authUser) {
    return (
      <div className="container mx-auto max-w-2xl">
        <ProfileSkeleton />
      </div>
    );
  }

  const {
    name,
    email,
    auro_balance,
    current_xp,
    level_name,
  } = userProfile;
  
  const fallbackChar = name?.charAt(0) || email?.charAt(0) || 'P';
  const currentLevel = getLevelFromXp(current_xp);
  const currentLevelIndex = allLevels.findIndex(l => l.name === currentLevel.name);
  const nextLevel = currentLevelIndex < allLevels.length - 1 ? allLevels[currentLevelIndex + 1] : null;

  const xpForCurrentLevel = currentLevel.minXp;
  const xpForNextLevel = nextLevel ? nextLevel.minXp : current_xp;
  const progress = nextLevel ? Math.max(0, Math.min(100, ((current_xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)) : 100;
  
  const auroBalance = Number.isFinite(auro_balance) ? auro_balance : 0;

  return (
    <div className="container mx-auto max-w-2xl">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-6">
            <Avatar className="h-16 w-16">
              {authUser.photoURL && <AvatarImage src={authUser.photoURL} alt={name || ''} />}
              <AvatarFallback className="text-xl">{fallbackChar.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <CardTitle className="font-sans text-2xl">{name}</CardTitle>
              <CardDescription>{email}</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                   <Award className="h-6 w-6 text-primary" />
                   {t('level_title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-semibold text-base text-card-foreground">{level_name}</span>
                    {nextLevel ? (
                        <span>{t('next_level', {level: nextLevel.name})}</span>
                    ) : (
                         <span className="flex items-center gap-1 font-semibold text-green-400"><CheckCircle className="h-4 w-4"/> {t('max_level')}</span>
                    )}
                </div>
                <Progress value={progress} />
                 <p className="text-right text-sm text-muted-foreground">
                    {current_xp.toLocaleString()} / {nextLevel ? nextLevel.minXp.toLocaleString() : ''} XP
                </p>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Gem className="h-6 w-6 text-cyan-400" />
              {t('auro_balance_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                <span className="font-medium text-muted-foreground">{t('current_balance')}</span>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{auroBalance.toLocaleString()}</span>
                    <span className="font-semibold text-cyan-400">{t('auro_unit')}</span>
                </div>
            </div>
          </CardContent>
        </Card>
        
        <AdminTools userProfile={userProfile} />

      </div>
    </div>
  );
}
