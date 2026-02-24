'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, getCountFromServer, collection } from 'firebase/firestore';
import type { User } from '@/types';
import { useTranslations } from 'next-intl';
import { getLevelFromXp, levels } from '@/lib/gamification';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Gem, LogOut, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/lib/firebase';
import { useRouter } from '@/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import AdminPanel from '@/modules/admin/components/admin-panel';

export default function ProfilePage() {
  const t = useTranslations('ProfilePage');
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
      toast({ title: t('toast_signout_success') });
    } catch (error) {
      console.error("Sign out error", error);
      toast({ variant: 'destructive', title: t('toast_signout_fail') });
    }
  };

  const LevelProgress = ({ userProfile }: { userProfile: User }) => {
    const currentLevel = getLevelFromXp(userProfile.current_xp);
    const nextLevelIndex = levels.findIndex(l => l.name === currentLevel.name) + 1;
    const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    const progress = nextLevel
      ? ((userProfile.current_xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
      : 100;

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('level_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 font-semibold">
              <Award className="h-5 w-5 text-amber-400" />
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
          <Progress value={progress} className="w-full" />
          <p className="text-right text-xs text-muted-foreground mt-1">
            {userProfile.current_xp} XP {nextLevel ? `/ ${nextLevel.minXp} XP` : ''}
          </p>
        </CardContent>
      </Card>
    );
  }

  const AuroBalance = ({ userProfile }: { userProfile: User }) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('auro_balance_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gem className="h-8 w-8 text-cyan-400" />
              <div>
                <p className="text-2xl font-bold">{userProfile.auro_balance}</p>
                <p className="text-xs text-muted-foreground -mt-1">{t('auro_unit')}</p>
              </div>
            </div>
            <Button onClick={() => router.push('/pricing')}>{t('button_buy_auro')}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = userProfile?.email === 'admin@viewora.ai';

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!userProfile) {
    return <div className="container text-center">User not found.</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <LevelProgress userProfile={userProfile} />
      <AuroBalance userProfile={userProfile} />
      {isAdmin && <AdminPanel />}
      <Card>
        <CardHeader>
            <CardTitle>{t('app_account_title')}</CardTitle>
        </CardHeader>
        <CardContent>
             <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto">
                <LogOut className="mr-2 h-4 w-4" />
                {t('button_sign_out')}
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
