'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';
import { getLevelFromXp, levels } from '@/lib/gamification';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Gem, UserCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAppConfig } from '@/components/AppConfigProvider';

const UserInfoCard = ({ user, userProfile }: { user: any; userProfile: User }) => {
  const displayName = userProfile.name || 'Kullanıcı';
  const displayEmail = userProfile.email || 'email@example.com';
  const fallbackChar = displayName?.charAt(0).toUpperCase() || 'U';
  const displayPhotoURL = userProfile.photoURL || user.photoURL || '';

  return (
    <Card className="rounded-[32px] overflow-hidden">
      <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-8">
        <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-xl">
          <AvatarImage src={displayPhotoURL} alt={displayName} className="object-cover" />
          <AvatarFallback className="text-3xl font-black bg-secondary">{fallbackChar}</AvatarFallback>
        </Avatar>
        <div className="flex-1 w-full text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <h2 className="text-3xl font-black tracking-tight">{displayName}</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary transition-all">
                  <UserCircle className="h-6 w-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 overflow-hidden border-border/40 shadow-2xl rounded-[32px] bg-background/95 backdrop-blur-xl">
                <div className="bg-gradient-to-br from-primary/30 to-accent/30 p-8 flex flex-col items-center">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-2xl mb-4">
                    <AvatarImage src={displayPhotoURL} alt={displayName} className="object-cover" />
                    <AvatarFallback className="text-3xl font-black">{fallbackChar}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-black text-xl text-foreground tracking-tight">{displayName}</h3>
                  <Badge className="mt-3 bg-primary text-white border-none px-4 h-7 rounded-full font-black uppercase tracking-widest text-[10px]">
                    {userProfile.level_name}
                  </Badge>
                </div>
                <div className="bg-card/50 p-4 border-t border-border/40 text-center">
                   <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">Viewora Üyesi</p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-muted-foreground font-medium">{displayEmail}</p>
          <div className="pt-2">
            <Badge variant="outline" className="border-border/60 text-[10px] font-black uppercase tracking-widest h-6 px-3">{userProfile.tier} PAKETİ</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LevelProgress = ({ userProfile }: { userProfile: User }) => {
    const currentLevel = getLevelFromXp(userProfile.current_xp);
    const nextLevelIndex = levels.findIndex(l => l.name === currentLevel.name) + 1;
    const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    const progress = nextLevel
      ? ((userProfile.current_xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
      : 100;

    return (
      <Card className="rounded-[32px] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
              <Award className="h-6 w-6 text-amber-400" />
              Seviye & İlerleme
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="flex justify-between items-end mb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mevcut Rütbe</p>
              <p className="text-2xl font-black tracking-tight text-primary uppercase">{currentLevel.name}</p>
            </div>
            <div className="text-right space-y-1">
              {nextLevel ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hedef</p>
                  <p className="text-sm font-bold uppercase">{nextLevel.name}</p>
                </>
              ) : (
                <Badge className="bg-amber-500 text-black font-black uppercase h-6">Maksimum Seviye</Badge>
              )}
            </div>
          </div>
          <Progress value={progress} className="w-full h-3 rounded-full bg-secondary" />
          <div className="flex justify-between mt-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{userProfile.current_xp} XP</span>
            {nextLevel && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{nextLevel.minXp} XP</span>}
          </div>
        </CardContent>
      </Card>
    );
}

const AuroBalance = ({ userProfile, router }: { userProfile: User, router: any }) => {
    const { currencyName } = useAppConfig();
    return (
      <Card className="rounded-[32px] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
              <Gem className="h-6 w-6 text-cyan-400" />
              {currencyName} Bakiyesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-5xl font-black tracking-tighter text-foreground">{userProfile.auro_balance}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">{currencyName} Mevcut</p>
            </div>
            <Button onClick={() => router.push('/pricing')} className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
              {currencyName} Yükle
            </Button>
          </div>
        </CardContent>
      </Card>
    );
}

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-8 px-4 py-10">
        <Skeleton className="h-12 w-48 rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-[32px]" />
        <Skeleton className="h-48 w-full rounded-[32px]" />
        <Skeleton className="h-40 w-full rounded-[32px]" />
      </div>
    );
  }

  if (!userProfile || !user) {
    return <div className="container text-center px-4 py-20 font-bold uppercase tracking-widest">Kullanıcı bulunamadı.</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-10 px-4 pt-10 pb-24 animate-in fade-in duration-700">
      <h1 className="text-5xl font-black tracking-tighter uppercase">Profilim</h1>
      
      <UserInfoCard user={user} userProfile={userProfile} />
      <LevelProgress userProfile={userProfile} />
      <AuroBalance userProfile={userProfile} router={router}/>
    </div>
  );
}
