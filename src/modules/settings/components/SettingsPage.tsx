'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { User } from '@/types';
import { useTranslations } from 'next-intl';
import { getLevelFromXp, levels } from '@/lib/gamification';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, LogOut, Code, Settings as SettingsIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase';
import { useRouter, Link } from '@/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const DeveloperTools = ({ userProfile, t, user, firestore, toast }: { userProfile: User, t: any, user: any, firestore: any, toast: any }) => {
  const handleLevelChange = async (newLevelName: string) => {
    if (!user || !firestore) return;
    const newLevel = levels.find(l => l.name === newLevelName);
    if (!newLevel) return;

    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        level_name: newLevel.name,
        is_mentor: newLevel.isMentor || false,
        current_xp: newLevel.minXp,
      });
      toast({
        title: t('developer_level_change_success_title'),
        description: t('developer_level_change_success_description', { level: newLevel.name }),
      });
    } catch (error) {
      console.error("Failed to update level:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Code className="h-6 w-6" />
          {t('developer_tools_title')}
        </CardTitle>
        <CardDescription>{t('developer_tools_description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
          <SelectTrigger>
            <SelectValue placeholder="Kullanıcı seviyesini değiştir" />
          </SelectTrigger>
          <SelectContent>
            {levels.map(level => (
              <SelectItem key={level.name} value={level.name}>
                {level.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};


export default function SettingsPage() {
  const t = useTranslations('ProfilePage');
  const tNav = useTranslations('AppLayout');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const isAdmin = userProfile?.email === 'babacan.muharrem@gmail.com';

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: t('toast_signout_success') });
      router.push('/');
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast_signout_fail') });
      console.error('Sign out failed', error);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!userProfile || !user) {
    return <div className="container text-center">Kullanıcı bulunamadı.</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{tNav('title_settings')}</h1>
      
      <LevelProgress userProfile={userProfile} t={t} />

      {isAdmin && <DeveloperTools userProfile={userProfile} t={t} user={user} firestore={firestore} toast={toast} />}

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-3">
                <SettingsIcon className="h-6 w-6" />
                {t('app_account_title')}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                    <p className="font-medium">{t('language_label')}</p>
                    <p className="text-sm text-muted-foreground">{t('language_description')}</p>
                </div>
                <Select disabled>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('language_select_placeholder')} />
                    </SelectTrigger>
                </Select>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border">
                <p className="font-medium">{t('version_label')}</p>
                <p className="text-sm text-muted-foreground">1.0.0</p>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <Link href="/terms" className="font-medium w-full">{t('terms_label')}</Link>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <Link href="/privacy" className="font-medium w-full">{t('privacy_label')}</Link>
            </div>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
                <LogOut className="mr-2 h-4 w-4" /> {t('button_sign_out')}
            </Button>
        </CardContent>
      </Card>

    </div>
  );
}
