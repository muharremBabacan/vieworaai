'use client';
import React, { useMemo, useState } from 'react';
import { Link } from '@/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User as UserProfile, UserProfileIndex } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Gem, Award, Users, Trophy, ChevronRight, CheckCircle, Copy, TrendingUp, TrendingDown, Minus, Target, Brush, Camera, Smartphone, AlertTriangle, UserCheck, CalendarDays } from 'lucide-react';
import { getLevelFromXp, levels as allLevels } from '@/lib/gamification';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from 'recharts';
import { isWithinInterval, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

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

function PublicProfilePreviewCard({ userProfile, userId }: { userProfile: UserProfile; userId: string }) {
    const t = useTranslations('ProfilePage');
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('public_profile_preview_title')}</CardTitle>
          <CardDescription>{t('public_profile_preview_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg border p-4">
             <Avatar className="h-12 w-12">
                {userProfile.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.name || ''} />}
                <AvatarFallback>{userProfile.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold">{userProfile.name}</p>
              <p className="text-sm text-muted-foreground">{userProfile.level_name}</p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/u/${userId}`}>{t('public_profile_preview_button')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
}

const InfoListItem = ({ icon, title, href }: { icon: React.ElementType, title: string, href: string }) => (
    <Link href={href} className="block w-full p-3 rounded-lg hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-4 w-full">
            <div className="flex-shrink-0 bg-secondary p-3 rounded-lg">
                {React.createElement(icon, { className: "h-5 w-5 text-primary" })}
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-card-foreground">{title}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
        </div>
    </Link>
);


function StrengthChart({ strengthMap }: { strengthMap: UserProfileIndex['strength_map'] }) {
    const tRatings = useTranslations('Ratings');
    const chartData = useMemo(() => [
        { subject: tRatings('composition'), value: strengthMap?.composition || 0, fullMark: 100 },
        { subject: tRatings('light'), value: strengthMap?.light || 0, fullMark: 100 },
        { subject: tRatings('exposure'), value: strengthMap?.exposure || 0, fullMark: 100 },
        { subject: tRatings('storytelling'), value: strengthMap?.storytelling || 0, fullMark: 100 },
        { subject: tRatings('consistency'), value: strengthMap?.consistency || 0, fullMark: 100 },
    ], [strengthMap, tRatings]);

    const chartConfig = {
      value: { label: "Skor", color: "hsl(var(--primary))" },
    };

    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-full w-full">
            <RadarChart data={chartData}>
                 <ChartTooltip content={<ChartTooltipContent />} />
                 <PolarGrid />
                 <PolarAngleAxis dataKey="subject" />
                 <PolarRadiusAxis angle={30} domain={[0, 100]} />
                 <Radar name="Skor" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                 <Legend />
            </RadarChart>
        </ChartContainer>
    );
}

const StatItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | number | null }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
            <Icon className="h-5 w-5 text-primary mt-0.5" />
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold capitalize">{value}</p>
            </div>
        </div>
    );
};

function ProfileInsights({ profileIndex }: { profileIndex: UserProfileIndex }) {
    const TrendIcon = profileIndex.trend_direction === 'improving' ? TrendingUp : profileIndex.trend_direction === 'declining' ? TrendingDown : Minus;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Brush className="h-6 w-6 text-primary" />
                    Stratejik Analiz
                </CardTitle>
                 <CardDescription>Yapay zeka koçunun senin hakkındaki öngörüleri.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                 <StatItem icon={TrendIcon} label="Performans Trendi" value={profileIndex.trend_direction} />
                 <StatItem icon={Target} label="En Zayıf Alan" value={profileIndex.weakest_area} />
                 <StatItem icon={Camera} label="Dominant Tarz" value={profileIndex.dominant_style} />
                 <StatItem icon={Smartphone} label="Dominant Cihaz" value={profileIndex.dominant_device} />
            </CardContent>
        </Card>
    )
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

function UserStatsAdminTool() {
    const firestore = useFirestore();
    const [filter, setFilter] = useState<'week' | 'today' | 'all'>('week');

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);

    const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

    const stats = useMemo(() => {
        if (!users) return { total: 0, active: 0, newUsers: 0 };

        const now = new Date();
        
        const totalUsers = users.length;
        
        const last30Days = subDays(now, 30);
        const activeUsers = users.filter(u => u.lastLoginAt && isWithinInterval(new Date(u.lastLoginAt), { start: last30Days, end: now })).length;

        let newUsersCount = 0;
        if (filter === 'today') {
            const todayStart = startOfDay(now);
            const todayEnd = endOfDay(now);
            newUsersCount = users.filter(u => u.createdAt && isWithinInterval(new Date(u.createdAt), { start: todayStart, end: todayEnd })).length;
        } else if (filter === 'week') {
            const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
            const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
            newUsersCount = users.filter(u => u.createdAt && isWithinInterval(new Date(u.createdAt), { start: weekStart, end: weekEnd })).length;
        } else { // 'all'
            newUsersCount = totalUsers;
        }
        
        return {
            total: totalUsers,
            active: activeUsers,
            newUsers: newUsersCount
        };
    }, [users, filter]);

    const getNewUsersTitle = () => {
        switch(filter) {
            case 'today': return 'Bugün Katılan Üyeler';
            case 'week': return 'Bu Hafta Katılan Üyeler';
            case 'all': default: return 'Toplam Üye';
        }
    }

    if (isLoading) {
        return (
            <div>
                <h3 className="font-semibold text-lg">Üye İstatistikleri</h3>
                <p className="text-sm text-muted-foreground mb-4">Uygulamanın kullanıcı özeti.</p>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </div>
                     <div className="flex gap-2 my-4">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                    </div>
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div>
            <h3 className="font-semibold text-lg">Üye İstatistikleri</h3>
            <p className="text-sm text-muted-foreground mb-4">Uygulamanın kullanıcı özeti.</p>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard title="Toplam Üye" value={stats.total} icon={Users} />
                    <StatCard title="Aktif Üyeler (Son 30 gün)" value={stats.active} icon={UserCheck} />
                </div>
                <div>
                    <div className="flex items-center gap-2 my-4">
                        <Button variant={filter === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('week')}>Bu Hafta</Button>
                        <Button variant={filter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('today')}>Bugün</Button>
                        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tümü</Button>
                    </div>
                    <StatCard 
                        title={getNewUsersTitle()} 
                        value={stats.newUsers} 
                        icon={CalendarDays} 
                    />
                </div>
            </div>
        </div>
    )
}

export default function ProfilePage() {
  const { user: authUser, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const t = useTranslations('ProfilePage');
  const tNav = useTranslations('AppLayout');

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
  
  const handleCopyId = () => {
    navigator.clipboard.writeText(authUser.uid);
    toast({ title: "Kopyalandı!", description: "Kullanıcı ID'niz panoya kopyalandı." });
  };

  const {
    name,
    email,
    auro_balance,
    current_xp,
    level_name,
    profileIndex
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
           <CardContent>
            <div className="flex items-center space-x-2">
              <Input value={authUser.uid} readOnly className="flex-1 bg-secondary/30" />
              <Button variant="outline" size="icon" onClick={handleCopyId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <PublicProfilePreviewCard userProfile={{...userProfile, photoURL: authUser.photoURL}} userId={authUser.uid} />

        {profileIndex ? (
            <>
                <ProfileInsights profileIndex={profileIndex} />
                 {profileIndex.strength_map && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Trophy className="h-6 w-6 text-primary" />
                                Güçlü Yönler Haritası
                            </CardTitle>
                            <CardDescription>Fotoğrafçılık yeteneklerinin dağılımı.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-80">
                           <StrengthChart strengthMap={profileIndex.strength_map} />
                        </CardContent>
                    </Card>
                )}
            </>
        ) : (
             <Card className="border-dashed">
                <CardHeader className="text-center items-center">
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                    <CardTitle>Profil Analizi Bekleniyor</CardTitle>
                    <CardDescription className="max-w-xs">Genel fotoğrafçılık profiliniz henüz oluşturulmadı. Daha fazla fotoğraf analiz ederek koçunuzun sizi tanımasına yardımcı olun.</CardDescription>
                </CardHeader>
            </Card>
        )}

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
        
        {isAdmin && (
            <Card>
                <CardHeader>
                    <CardTitle>{t('admin_tools_title')}</CardTitle>
                    <CardDescription>{t('admin_tools_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <UserStatsAdminTool />
                </CardContent>
            </Card>
        )}
        
        <Card>
            <CardContent className="p-3 divide-y divide-border">
                <InfoListItem icon={Users} title={tNav('nav_groups')} href="/groups" />
                <InfoListItem icon={Trophy} title={tNav('title_competitions')} href="/competitions" />
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
