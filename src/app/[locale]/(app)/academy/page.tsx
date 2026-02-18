'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, BookOpen, Layers, Trophy, Lock } from 'lucide-react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Helper function to determine if a user has access to a certain academy level
const hasLevelAccess = (targetLevel: 'Temel' | 'Orta' | 'İleri', userLevelName: string | undefined): boolean => {
  if (targetLevel === 'Temel') return true;
  if (!userLevelName) return false;

  const userLevelIndex = gamificationLevels.findIndex(l => l.name === userLevelName);
  if (userLevelIndex === -1) return false;

  const requiredLevelIndices = {
    'Orta': 1, // Requires 'Viewner' (index 1) or higher
    'İleri': 2, // Requires 'Sytner' (index 2) or higher
  };

  return userLevelIndex >= (requiredLevelIndices[targetLevel] || 99);
};


export default function AcademyHubPage() {
  const t = useTranslations('AcademyPage');
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  const levels = [
    {
      title: t('level_basic_title'),
      slug: 'temel',
      description: t('level_basic_description'),
      icon: BookOpen,
      levelName: 'Temel' as const,
    },
    {
      title: t('level_intermediate_title'),
      slug: 'orta',
      description: t('level_intermediate_description'),
      icon: Layers,
      levelName: 'Orta' as const,
    },
    {
      title: t('level_advanced_title'),
      slug: 'ileri',
      description: t('level_advanced_description'),
      icon: Trophy,
      levelName: 'İleri' as const,
    },
  ];

  if (isLoading) {
      return (
          <div className="container mx-auto">
              <div className="text-center mb-12">
                  <h1 className="font-sans text-3xl font-bold tracking-tight">{t('main_title')}</h1>
                  <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('main_description')}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  {Array.from({length: 3}).map((_, i) => (
                      <Card key={i} className="h-full">
                          <CardHeader className="p-6">
                            <div className="flex items-center gap-4 mb-2">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-6 w-3/4" />
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 pt-0">
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-4 w-5/6" />
                          </CardContent>
                          <div className="p-6 pt-0">
                            <Skeleton className="h-5 w-24" />
                          </div>
                      </Card>
                  ))}
              </div>
          </div>
      )
  }

  return (
    <div className="container mx-auto">
       <div className="text-center mb-12">
        <h1 className="font-sans text-3xl font-bold tracking-tight">{t('main_title')}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('main_description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {levels.map((level) => {
            const isUnlocked = hasLevelAccess(level.levelName, userProfile?.level_name);
            
            const cardContent = (
                <Card className={cn("h-full overflow-hidden transition-all duration-300 flex flex-col", isUnlocked ? "group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-1" : "bg-muted/50 border-dashed opacity-70")}>
                    <CardHeader className="p-6">
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-4">
                               <level.icon className={cn("h-8 w-8", isUnlocked ? "text-primary" : "text-muted-foreground")} />
                               <CardTitle className="font-sans text-xl">{level.title}</CardTitle>
                            </div>
                            {!isUnlocked && <Lock className="h-5 w-5 text-muted-foreground" />}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 flex-grow">
                        <CardDescription>{level.description}</CardDescription>
                    </CardContent>
                    {isUnlocked && (
                       <div className="p-6 pt-0 flex items-center font-semibold text-primary text-sm">
                           {t('button_view_lessons')}
                           <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </div>
                    )}
                </Card>
            );

            if (isUnlocked) {
                return (
                    <Link href={`/academy/${level.slug}`} key={level.title} className="group block">
                        {cardContent}
                    </Link>
                )
            }
            
            return (
                <div key={level.title} className="cursor-not-allowed">
                    {cardContent}
                </div>
            )
        })}
      </div>
    </div>
  );
}
