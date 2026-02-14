'use client';
import { useEffect, useState } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Award, Gem, Camera, Tag, Trophy, ShieldCheck, Settings, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { levels, getLevelFromXp } from '@/lib/gamification';
import { useToast } from '@/hooks/use-toast';
import { addDays, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { generateDailyLessons, type GeneratedLesson } from '@/ai/flows/generate-daily-lessons';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


function AdminTools() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri' | ''>('');

    const handleGenerateLessons = async () => {
        if (!firestore || !selectedLevel) {
            toast({
                variant: 'destructive',
                title: 'Seviye Seçilmedi',
                description: 'Lütfen ders üretmek için bir seviye seçin.',
            });
            return;
        }

        setIsGenerating(true);
        toast({
            title: 'Dersler Üretiliyor...',
            description: `Yapay zeka, '${selectedLevel}' seviyesi için 5 yeni ders hazırlıyor. Bu işlem biraz zaman alabilir.`,
        });

        try {
            const newLessons = await generateDailyLessons({ level: selectedLevel });
            if (!newLessons || newLessons.length === 0) {
                throw new Error("AI did not return any lessons.");
            }

            const lessonCollectionRef = collection(firestore, 'academyLessons');
            
            const usedImageUrls = new Set<string>();
            const imagePlaceholders = PlaceHolderImages.filter(p => p.id.startsWith('academy-'));

            for (const lesson of newLessons) {
                let bestMatch: ImagePlaceholder | undefined;
                const lessonHintWords = lesson.imageHint.toLowerCase().split(' ');

                let availableImages = imagePlaceholders.filter(p => !usedImageUrls.has(p.imageUrl));
                
                if (availableImages.length === 0) {
                    availableImages = imagePlaceholders;
                    usedImageUrls.clear(); // Allow reuse if all images have been used
                }

                bestMatch = availableImages.find(p => 
                    lessonHintWords.some(word => p.imageHint.toLowerCase().includes(word))
                );

                if (!bestMatch) {
                     bestMatch = availableImages.find(p => p.imageHint.toLowerCase().includes(lesson.category.toLowerCase()));
                }

                if (!bestMatch) {
                    bestMatch = availableImages[Math.floor(Math.random() * availableImages.length)];
                }
                
                const imageUrl = bestMatch?.imageUrl ?? `https://picsum.photos/seed/${lesson.title}/600/400`;
                if(bestMatch?.imageUrl) {
                    usedImageUrls.add(imageUrl);
                }
                
                const lessonData = {
                    ...lesson,
                    imageUrl: imageUrl,
                    imageHint: bestMatch?.imageHint ?? lesson.imageHint,
                    createdAt: new Date().toISOString(),
                };
                addDocumentNonBlocking(lessonCollectionRef, lessonData);
            }

            toast({
                title: 'Başarılı!',
                description: `${newLessons.length} yeni ders akademiye eklendi.`,
            });

        } catch (error) {
            console.error("Failed to generate or save lessons:", error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Dersler üretilirken veya kaydedilirken bir sorun oluştu.',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Settings className="h-6 w-6 text-primary" />
                    <span>Yönetici Araçları</span>
                </CardTitle>
                <CardDescription>Uygulama için yönetimsel görevleri buradan yapın.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className='flex items-center gap-4'>
                       <div>
                            <h4 className="font-semibold">Günlük Dersleri Üret</h4>
                            <p className="text-sm text-muted-foreground">Bir seviye seçin ve yapay zekanın 5 yeni ders oluşturmasını sağlayın.</p>
                       </div>
                       <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'Temel' | 'Orta' | 'İleri')}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Seviye Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Temel">Temel</SelectItem>
                                <SelectItem value="Orta">Orta</SelectItem>
                                <SelectItem value="İleri">İleri</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleGenerateLessons} disabled={isGenerating || !selectedLevel}>
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Üret ve Kaydet
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export default function ProfilePage() {
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemoFirebase(() => {
        if (!authUser || !firestore) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [authUser, firestore]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    
    const photosQuery = useMemoFirebase(() => {
        if (!authUser || !firestore) return null;
        return collection(firestore, 'users', authUser.uid, 'photos');
    }, [authUser, firestore]);

    const { data: userPhotos, isLoading: arePhotosLoading } = useCollection(photosQuery);
    
    const photoCount = userPhotos?.length ?? 0;

    // Haftalık Auro Yenileme Mantığı
    useEffect(() => {
        if (!userProfile || !userDocRef || !authUser || !firestore) return;

        const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
        
        const lastRefillDateStr = userProfile.weekly_free_refill_date;
        if (!lastRefillDateStr || typeof lastRefillDateStr !== 'string') return;
        
        const lastRefillDate = new Date(lastRefillDateStr);
        const sevenDaysAgo = addDays(new Date(), -7);

        if (isBefore(lastRefillDate, sevenDaysAgo) && auroBalance < 10) {
            const refillAmount = 10 - auroBalance;
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
    
    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;
    const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    const interests = userProfile.interests ?? [];

    const currentLevelInfo = getLevelFromXp(currentXp);
    const nextLevelIndex = levels.findIndex(l => l.name === currentLevelInfo.name) + 1;
    const nextLevelInfo = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    const xpForNextLevel = nextLevelInfo ? nextLevelInfo.minXp : currentXp;
    const xpBaseForCurrentLevel = currentLevelInfo.minXp;
    
    const xpInCurrentLevel = currentXp - xpBaseForCurrentLevel;
    const xpRangeOfCurrentLevel = nextLevelInfo ? nextLevelInfo.minXp - xpBaseForCurrentLevel : 0;
    
    const xpPercentage = xpRangeOfCurrentLevel > 0 ? Math.min((xpInCurrentLevel / xpRangeOfCurrentLevel) * 100, 100) : 100;
    const xpToNext = nextLevelInfo ? xpForNextLevel - currentXp : 0;


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
                                <span className="text-sm font-bold">{currentXp} / {nextLevelInfo ? xpForNextLevel : 'MAX'}</span>
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
                            <span className="text-lg font-bold">{auroBalance}</span>
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
                            {interests.length > 0 ? interests.map(interest => (
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

                {userProfile?.email === 'babacan.muharrem@gmail.com' && <AdminTools />}
            </div>
        </div>
    )
}
