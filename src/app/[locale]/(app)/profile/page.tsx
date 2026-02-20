'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from '@/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Gem, Award, CheckCircle, Copy, Check } from 'lucide-react';
import { getLevelFromXp, levels as allLevels } from '@/lib/gamification';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AdminTools } from './admin-tools'; // Admin Tools import edildi

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
        <CardContent className="p-6 pt-0">
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}


export default function ProfilePage() {
  const { user: authUser, isUserLoading } = useUser();
  const firestore = useFirestore();
  const t = useTranslations('ProfilePage');
  const tNav = useTranslations('AppLayout');
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);


  const handleCopy = () => {
    if (!authUser?.uid) return;
    navigator.clipboard.writeText(authUser.uid);
    setIsCopied(true);
    toast({ title: "Kopyalandı!", description: "Kullanıcı ID panoya kopyalandı." });
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const isLoading = isUserLoading || isProfileLoading;
  
  if (isLoading || !userProfile || !authUser) {
    return (
      <div className="container mx-auto max-w-2xl">
        <ProfileSkeleton />
      </div>
    );
  }

  const {
    name,
    email,
    auro_balance = 0,
    current_xp = 0,
    level_name = 'Neuner',
  } = userProfile;
  
  const fallbackChar = name?.charAt(0) || email?.charAt(0) || 'P';
  const currentLevel = getLevelFromXp(current_xp);
  const currentLevelIndex = allLevels.findIndex(l => l.name === currentLevel.name);
  const nextLevel = currentLevelIndex < allLevels.length - 1 ? allLevels[currentLevelIndex + 1] : null;

  const xpForCurrentLevel = currentLevel.minXp;
  const xpForNextLevel = nextLevel ? nextLevel.minXp : current_xp;
  const progress = nextLevel ? Math.max(0, Math.min(100, ((current_xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)) : 100;
  
  const auroBalance = Number.isFinite(auro_balance) ? auro_balance : 0;
  const isAdmin = userProfile.email === 'admin@viewora.ai';

  return (
    <div className="container mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-8 text-primary">
            {tNav('title_profile')}
        </h1>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-6">
            <Avatar className="h-16 w-16">
              {authUser.photoURL && <AvatarImage src={authUser.photoURL} alt={name || ''} />}
              <AvatarFallback className="text-xl">{fallbackChar.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold">{name}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </CardHeader>
           <CardContent className="p-6 pt-0">
              <div className="flex items-center space-x-2">
                  <Input value={authUser.uid} readOnly className="font-mono text-xs bg-background/50" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                      {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
              </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                   <Award className="h-5 w-5 text-primary" />
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
            <CardTitle className="flex items-center gap-3 text-lg">
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

        {isAdmin && <AdminTools />}
      </div>
    </div>
  );
}
