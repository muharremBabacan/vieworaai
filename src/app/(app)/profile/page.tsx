'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Award, Gem, Camera, Tag, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Dummy data for now
const xpForNextLevel = 250;
const photoCount = 0; // Replace with real data later

export default function ProfilePage() {
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => {
        if (!authUser) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [authUser, firestore]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    if (isUserLoading || isProfileLoading || !userProfile) {
        return (
            <div className="space-y-6">
                <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
            </div>
        )
    }

    const xpPercentage = (userProfile.xp / xpForNextLevel) * 100;

    return (
        <div className="container mx-auto">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Award className="h-6 w-6 text-primary" />
                            <span>Seviye: {userProfile.level}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-muted-foreground">Deneyim Puanı (XP)</span>
                                <span className="text-sm font-bold">{userProfile.xp} / {xpForNextLevel}</span>
                            </div>
                            <Progress value={xpPercentage} />
                            <p className="text-xs text-muted-foreground mt-1">Sonraki seviye için {xpForNextLevel > userProfile.xp ? xpForNextLevel - userProfile.xp : 0} XP daha.</p>
                        </div>
                        
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center gap-3">
                                <Gem className="h-5 w-5 text-blue-400"/>
                                <span className="text-muted-foreground">Token Bakiyesi</span>
                            </div>
                            <span className="text-lg font-bold">{userProfile.tokenBalance}</span>
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
                            {userProfile.interests.map(interest => (
                                <Badge key={interest} variant="secondary">{interest}</Badge>
                            ))}
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
                            <span className="text-muted-foreground">Yüklenen Fotoğraf</span>
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
                        <CardDescription>Becerilerini sergile ve ödüller kazan!</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center py-10">
                        <p className="text-muted-foreground">Şu anda aktif bir yarışma bulunmuyor. Takipte kalın!</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
