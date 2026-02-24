'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';
import { useTranslations } from 'next-intl';
import { getLevelFromXp, levels } from '@/lib/gamification';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Gem, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase';
import { useRouter } from '@/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import AdminPanel from '@/modules/admin/components/admin-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

// This component is defined inside to easily access translations and other hooks
const UserInfoCard = ({ user, userProfile }: { user: any; userProfile: User }) => {
  const { toast } = useToast();
  const displayName = userProfile.name || 'Kullanıcı';
  const displayEmail = userProfile.email || 'email@example.com';
  const fallbackChar = displayName?.charAt(0).toUpperCase() || 'U';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Kopyalandı', description: "Kullanıcı ID'si panoya kopyalandı." });
    });
  };

  return (
    <Card>
      <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.photoURL} alt={displayName} />
          <AvatarFallback className="text-3xl">{fallbackChar}</AvatarFallback>
        </Avatar>
        <div className="flex-1 w-full text-center sm:text-left">
          <h2 className="text-2xl font-bold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">{displayEmail}</p>
          <div className="mt-4 flex items-center">
            <Input
              readOnly
              value={user.uid}
              className="bg-secondary border-secondary text-muted-foreground font-mono text-xs flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(user.uid)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// This component is defined inside to easily access translations
const LevelProgress = ({ userProfile, t }: { userProfile: User, t: any }) => {
    const currentLevel = getLevelFromXp(userProfile.current_xp);
    const nextLevelIndex = levels.findIndex(l => l.name === currentLevel.name) + 1;
    const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    const progress = nextLevel
      ? ((userProfile.current_xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
      : 100;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
              <Award className="h-6 w-6 text-amber-400" />
              {t('level_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold">
              <span>{currentLevel.name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {nextLevel ? (
                <span>{t('next_level', { level: nextLevel.name })}</span>
              ) : (
                <span className="font-semibold">{t('max_level')}</span>
              )}
            </div>
          </div>
          <Progress value={progress} className="w-full h-2" />
          <p className="text-right text-xs text-muted-foreground mt-1">
            {userProfile.current_xp} XP {nextLevel ? `/ ${nextLevel.minXp} XP` : ''}
          </p>
        </CardContent>
      </Card>
    );
}

// This component is defined inside to easily access translations and router
const AuroBalance = ({ userProfile, t, router }: { userProfile: User, t: any, router: any }) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
              <Gem className="h-6 w-6 text-cyan-400" />
              {t('auro_balance_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold">{userProfile.auro_balance}</p>
            <Button onClick={() => router.push('/pricing')}>{t('button_buy_auro')}</Button>
          </div>
        </CardContent>
      </Card>
    );
}

export default function ProfilePage() {
  const t = useTranslations('ProfilePage');
  const tNav = useTranslations('AppLayout');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
  
  const isAdmin = userProfile?.email === 'admin@viewora.ai';

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!userProfile || !user) {
    return <div className="container text-center">Kullanıcı bulunamadı.</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{tNav('title_profile')}</h1>
      
      <UserInfoCard user={user} userProfile={userProfile} />
      <LevelProgress userProfile={userProfile} t={t} />
      <AuroBalance userProfile={userProfile} t={t} router={router}/>

      {isAdmin && <AdminPanel />}
    </div>
  );
}
