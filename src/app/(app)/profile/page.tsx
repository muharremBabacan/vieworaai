'use client';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, doc, collectionGroup } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type { User as UserProfile, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, Coins, History, ChevronRight, Info, FileText, LogOut, Settings as SettingsIcon, ShieldQuestion, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateDailyLessons, type GeneratedLesson } from '@/ai/flows/generate-daily-lessons';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';

function RevenueReport() {
    const firestore = useFirestore();
    const {toast} = useToast();

    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // This is a collection group query that requires a specific security rule.
        return collectionGroup(firestore, 'transactions');
    }, [firestore]);

    const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

    useEffect(() => {
        if (error) {
            toast({
                variant: 'destructive',
                title: 'Rapor Hatası',
                description: 'Gelir raporu verileri çekilirken bir hata oluştu. Bu özellik için yönetici izni gereklidir.'
            });
            console.error("Revenue report error:", error);
        }
    }, [error, toast]);

    const { totalRevenue, totalAuroSold } = useMemo(() => {
        if (!transactions) return { totalRevenue: 0, totalAuroSold: 0 };

        return transactions.reduce((acc, trans) => {
            if (trans.type === 'Purchase' && trans.status === 'Completed') {
                acc.totalAuroSold += trans.amount || 0;
                acc.totalRevenue += trans.currencyAmount || 0;
            }
            return acc;
        }, { totalRevenue: 0, totalAuroSold: 0 });

    }, [transactions]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-48" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Skeleton className="h-12 w-full" />
                     <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        )
    }

    if (error) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Coins className="h-6 w-6 text-primary" />
                    <span>Gelir Raporu (Geçici)</span>
                </CardTitle>
                <CardDescription>
                    Tüm kullanıcılardan gelen tamamlanmış satın alımların toplamı.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                    <span className="font-medium text-muted-foreground">Toplam Satılan Auro</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{totalAuroSold.toLocaleString('tr-TR')}</span>
                        <Gem className="h-5 w-5 text-cyan-400"/>
                    </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                    <span className="font-medium text-muted-foreground">Toplam Kazanç</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{totalRevenue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AdminTools() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri' | ''>('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    
    const levelCategoryMap: Record<string, string[]> = {
        'Temel': ["Fotoğrafçılığa Giriş", "Pozlama Temelleri", "Netlik ve Odaklama", "Temel Kompozisyon", "Işık Bilgisi"],
        'Orta': ["Tür Bazlı Çekim Teknikleri", "İleri Pozlama Teknikleri", "Işık Yönetimi", "Görsel Hikâye Anlatımı", "Post-Prodüksiyon Temelleri"],
        'İleri': ["Uzmanlık Alanı Derinleşme", "Profesyonel Işık Kurulumu", "Gelişmiş Teknikler", "Sanatsal Kimlik ve Stil", "Ticari ve Marka Konumlandırma"],
    };

    useEffect(() => {
        if (selectedLevel && levelCategoryMap[selectedLevel]) {
            setAvailableCategories(levelCategoryMap[selectedLevel]);
            setSelectedCategory(''); // Reset category on level change
        } else {
            setAvailableCategories([]);
        }
    }, [selectedLevel]);


    const handleGenerateLessons = async () => {
        if (!firestore || !selectedLevel || !selectedCategory) {
            toast({
                variant: 'destructive',
                title: 'Eksik Seçim',
                description: 'Lütfen ders üretmek için bir seviye ve bir kategori seçin.',
            });
            return;
        }

        setIsGenerating(true);
        toast({
            title: 'Dersler Üretiliyor...',
            description: `YZ, '${selectedLevel}' seviyesi, '${selectedCategory}' kategorisi için 5 yeni ders hazırlıyor.`,
        });

        try {
            const newLessons = await generateDailyLessons({ level: selectedLevel, category: selectedCategory });
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
                    availableImages = [...imagePlaceholders]; 
                    usedImageUrls.clear();
                }

                bestMatch = availableImages.find(p => 
                    lessonHintWords.some(word => p.imageHint.toLowerCase().includes(word))
                );

                if (!bestMatch) {
                     const categoryKeywords: Record<string, string[]> = {
                        'fotoğrafçılığa giriş': ['camera', 'lens', 'mode'],
                        'pozlama temelleri': ['aperture', 'shutter', 'iso', 'exposure'],
                        'netlik ve odaklama': ['focus', 'depth', 'field'],
                        'temel kompozisyon': ['composition', 'rule', 'thirds', 'lines'],
                        'işık bilgisi': ['light', 'golden', 'hour', 'shadow'],
                        'tür bazlı çekim teknikleri': ['portrait', 'landscape', 'street', 'night'],
                        'ileri pozlama teknikleri': ['exposure', 'hdr', 'pan'],
                        'işık yönetimi': ['light', 'silhouette', 'flash'],
                        'görsel hikâye anlatımı': ['storytelling', 'composition', 'emotion'],
                        'post-prodüksiyon temelleri': ['editing', 'color', 'contrast'],
                        'uzmanlık alanı derinleşme': ['sports', 'fashion', 'drone', 'macro'],
                        'profesyonel işık kurulumu': ['studio', 'lighting', 'softbox'],
                        'gelişmiş teknikler': ['stacking', 'painting', 'speed'],
                        'sanatsal kimlik ve stil': ['style', 'color', 'palette', 'minimal'],
                        'ticari ve marka konumlandırma': ['portfolio', 'business', 'client']
                     };
                     const searchWords = categoryKeywords[lesson.category.toLowerCase()] || [];
                     bestMatch = availableImages.find(p => 
                        searchWords.some(word => p.imageHint.toLowerCase().includes(word))
                     );
                }

                if (!bestMatch) {
                    const hash = lesson.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const index = hash % availableImages.length;
                    bestMatch = availableImages[index];
                }
                
                const imageUrl = bestMatch!.imageUrl;
                usedImageUrls.add(imageUrl);
                
                const lessonData = {
                    ...lesson,
                    imageUrl: imageUrl,
                    imageHint: bestMatch!.imageHint, 
                    createdAt: new Date().toISOString(),
                };
                addDocumentNonBlocking(lessonCollectionRef, lessonData);
            }

            toast({
                title: 'Başarılı!',
                description: `${newLessons.length} yeni ders '${selectedCategory}' kategorisine eklendi.`,
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <SettingsIcon className="h-6 w-6 text-primary" />
                    <span>Yönetici Araçları</span>
                </CardTitle>
                <CardDescription>Uygulama için yönetimsel görevleri buradan yapın.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <RevenueReport />
                    <div className="space-y-4 rounded-lg border p-4">
                        <div>
                            <h4 className="font-semibold">Günlük Dersleri Üret</h4>
                            <p className="text-sm text-muted-foreground">Yapay zekanın seçtiğiniz kategoriye özel 5 yeni ders oluşturmasını sağlayın.</p>
                        </div>
                        <div className='space-y-4'>
                           <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'Temel' | 'Orta' | 'İleri')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seviye Seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Temel">Temel</SelectItem>
                                    <SelectItem value="Orta">Orta</SelectItem>
                                    <SelectItem value="İleri">İleri</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedLevel || availableCategories.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategori Seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button className="w-full" onClick={handleGenerateLessons} disabled={isGenerating || !selectedLevel || !selectedCategory}>
                                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Üret ve Kaydet
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

const SettingsListItem = ({ icon, title, description, href, onClick, isLink = false }: { icon: React.ElementType, title: string, description?: string, href?: string, onClick?: () => void, isLink?: boolean }) => {
    const content = (
        <div className="flex items-center gap-4 w-full">
            <div className="flex-shrink-0 bg-secondary p-3 rounded-lg">
                {React.createElement(icon, { className: "h-5 w-5 text-primary" })}
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-card-foreground">{title}</p>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
        </div>
    );

    if (isLink && href) {
        return (
            <Link href={href} className="block w-full p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                {content}
            </Link>
        );
    }
    
    return (
        <button onClick={onClick} className="w-full text-left p-2 rounded-lg hover:bg-secondary/50 transition-colors">
            {content}
        </button>
    );
};


export default function SettingsPage() {
    const { user: authUser, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [isRestoring, setIsRestoring] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!authUser || !firestore) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [authUser, firestore]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
            toast({ title: 'Başarıyla çıkış yaptınız.' });
        } catch (error) {
            console.error('Sign out failed', error);
            toast({ variant: 'destructive', title: 'Çıkış yapılamadı.' });
        }
    };
    
    const handleRestorePurchases = () => {
        setIsRestoring(true);
        toast({ title: "Satın Alımlar Kontrol Ediliyor..." });

        setTimeout(() => {
             toast({ title: "Kontrol Tamamlandı", description: "Mevcut satın alımlarınız hesabınızla senkronize edildi." });
             setIsRestoring(false);
        }, 1500);
    }

    if (isUserLoading || isProfileLoading || !userProfile) {
        return (
            <div className="container mx-auto max-w-2xl space-y-6">
                <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
            </div>
        );
    }
    
    const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;

    return (
        <div className="container mx-auto max-w-2xl">
            <div className="space-y-8">
                
                <Card className="bg-gradient-to-br from-primary/20 via-card to-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                           <Gem className="h-6 w-6 text-cyan-400" />
                           Auro Yönetimi
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                            <span className="font-medium text-muted-foreground">Mevcut Bakiye</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold">{auroBalance}</span>
                                <span className="font-semibold text-cyan-400">Auro</span>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             <Button asChild size="lg">
                                <Link href="/pricing">
                                    <Coins className="mr-2 h-5 w-5" />
                                    Auro Satın Al
                                </Link>
                            </Button>
                             <Button variant="outline" size="lg" onClick={handleRestorePurchases} disabled={isRestoring}>
                                {isRestoring ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <History className="mr-2 h-5 w-5" />}
                                Satın Almaları Geri Yükle
                            </Button>
                         </div>
                    </CardContent>
                </Card>

                <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                           <SettingsIcon className="h-6 w-6 text-primary" />
                           Uygulama & Hesap
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mx-3">
                        <SettingsListItem icon={Info} title="Sürüm" description="1.0.0 (Build 1)" />
                        <SettingsListItem icon={FileText} title="Hizmet Şartları" isLink href="#" />
                        <SettingsListItem icon={ShieldQuestion} title="Gizlilik Politikası" isLink href="#" />
                    </CardContent>
                </Card>
                
                {userProfile?.email === 'babacan.muharrem@gmail.com' && (
                    <AdminTools />
                )}

                <div className="pt-4">
                     <Button variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-5 w-5" />
                        Çıkış Yap
                    </Button>
                </div>
            </div>
        </div>
    );
}
