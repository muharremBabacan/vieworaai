'use client';
import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Award, Gem, Camera, Tag, Trophy, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { levels, getLevelFromXp } from '@/lib/gamification';
import { useToast } from '@/hooks/use-toast';
import { addDays, isBefore } from 'date-fns';

export default function ProfilePage() {
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemoFirebase(() => {
        if (!authUser) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [authUser, firestore]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    
    const photosQuery = useMemoFirebase(() => {
        if (!authUser) return null;
        return collection(firestore, 'users', authUser.uid, 'photos');
    }, [authUser, firestore]);

    const { data: userPhotos, isLoading: arePhotosLoading } = useCollection(photosQuery);
    
    const photoCount = userPhotos?.length ?? 0;

    // Haftalık Auro Yenileme Mantığı
    useEffect(() => {
        if (!userProfile || !userDocRef || !authUser) return;

        const lastRefillDate = new Date(userProfile.weekly_free_refill_date);
        const sevenDaysAgo = addDays(new Date(), -7);

        if (isBefore(lastRefillDate, sevenDaysAgo) && userProfile.auro_balance < 10) {
            const refillAmount = 10 - userProfile.auro_balance;
            const newAuroBalance = 10;
            
            updateDocumentNonBlocking(userDocRef, {
                auro_balance: newAuroBalance,
                weekly_free_refill_date: new Date().toISOString()
            });

            const transactionsCollectionRef = collection(firestore, 'users', authUser.uid, 'transactions');
            addDocumentNonBlocking(transactionsCollectionRef, {
                userId: authUser.uid,
                amount: refillAmount,
                type: 'Refill',
                status: 'Completed',
                transactionDate: new Date().toISOString(),
            });
            
            toast({
                title: '✨ Haftalık Hediye!',
                description: `Auro bakiyeniz 10'a tamamlandı.`
            });
        }
    }, [userProfile, userDocRef, authUser, firestore, toast]);


    if (isUserLoading || isProfileLoading || !userProfile || (authUser && arePhotosLoading)) {
        return (
            <div className="container mx-auto space-y-6">
                <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
            </div>
        )
    }

    const currentLevelInfo = getLevelFromXp(userProfile.current_xp);
    const nextLevelIndex = levels.findIndex(l => l.name === currentLevelInfo.name) + 1;
    const nextLevelInfo = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    const xpForNextLevel = nextLevelInfo ? nextLevelInfo.minXp : userProfile.current_xp;
    const xpBaseForCurrentLevel = currentLevelInfo.minXp;
    
    const xpInCurrentLevel = userProfile.current_xp - xpBaseForCurrentLevel;
    const xpRangeOfCurrentLevel = nextLevelInfo ? nextLevelInfo.minXp - xpBaseForCurrentLevel : 0;
    
    const xpPercentage = xpRangeOfCurrentLevel > 0 ? Math.min((xpInCurrentLevel / xpRangeOfCurrentLevel) * 100, 100) : 100;
    const xpToNext = nextLevelInfo ? xpForNextLevel - userProfile.current_xp : 0;


    return (
        <div className="container mx-auto">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <Award className="h-6 w-6 text-primary" />
                             <span>Seviye</span>
                           </div>
                           <Badge variant={currentLevelInfo.isMentor ? 'default' : 'secondary'} className={`capitalize ${currentLevelInfo.isMentor ? 'bg-amber-500 text-black' : ''}`}>
                               {currentLevelInfo.isMentor && <ShieldCheck className="mr-2 h-4 w-4"/>}
                               {currentLevelInfo.name}
                           </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-muted-foreground">Deneyim Puanı (XP)</span>
                                <span className="text-sm font-bold">{userProfile.current_xp} / {nextLevelInfo ? xpForNextLevel : 'MAX'}</span>
                            </div>
                            <Progress value={xpPercentage} />
                            {nextLevelInfo ? (
                                <p className="text-xs text-muted-foreground mt-1">{nextLevelInfo.name} seviyesi için {xpToNext} XP daha.</p>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-1">Tebrikler! En yüksek seviyeye ulaştınız!</p>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center gap-3">
                                <Gem className="h-5 w-5 text-cyan-400"/>
                                <span className="text-muted-foreground">Auro Bakiyesi</span>
                            </div>
                            <span className="text-lg font-bold">{userProfile.auro_balance}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Tag className="h-6 w-6 text-primary" />
                            <span>İlgi Alanlarım</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {userProfile.interests && userProfile.interests.length > 0 ? userProfile.interests.map(interest => (
                                <Badge key={interest} variant="secondary">{interest}</Badge>
                            )) : <p className="text-sm text-muted-foreground">Henüz ilgi alanı seçmediniz.</p>}
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Camera className="h-6 w-6 text-primary" />
                            <span>İstatistikler</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Analiz Edilen Fotoğraf</span>
                            <span className="text-lg font-bold">{photoCount}</span>
                        </div>
                         {/* More stats can go here */}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 lg:col-span-3">
                     <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Trophy className="h-6 w-6 text-primary" />
                            <span>Yaklaşan Yarışmalar</span>
                        </CardTitle>
                        <CardDescription>Becerilerini sergile, XP ve Auro kazan!</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center py-10">
                        <p className="text-muted-foreground">Şu anda aktif bir yarışma bulunmuyor. Takipte kalın!</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
