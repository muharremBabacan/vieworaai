'use client';
import React, { useEffect, useState, useMemo, useTransition } from 'react';
import { Link, useRouter, usePathname } from '@/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, doc, collectionGroup } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type { User as UserProfile, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, Coins, History, ChevronRight, Info, FileText, LogOut, Settings as SettingsIcon, ShieldQuestion, Loader2, Languages } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import { useLocale, useTranslations } from 'next-intl';

function RevenueReport() {
    const firestore = useFirestore();
    const {toast} = useToast();
    const { user } = useUser();
    const t = useTranslations('ProfilePage');

    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore || !userProfile || userProfile.email !== 'admin@viewora.ai') {
            return null;
        }
        return collectionGroup(firestore, 'transactions');
    }, [firestore, userProfile]);

    const { data: transactions, isLoading: isCollectionLoading, error } = useCollection<Transaction>(transactionsQuery);
    
    const isLoading = isProfileLoading || isCollectionLoading;

    useEffect(() => {
        if (error) {
            toast({
                variant: 'destructive',
                title: t('admin_toast_report_error_title'),
                description: t('admin_toast_report_error_description')
            });
            console.error("Revenue report error:", error);
        }
    }, [error, toast, t]);

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

    if (error || (!transactions && !isLoading)) {
        return null;
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Coins className="h-6 w-6 text-primary" />
                    <span>{t('admin_revenue_report_title')}</span>
                </CardTitle>
                <CardDescription>
                    {t('admin_revenue_report_description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                    <span className="font-medium text-muted-foreground">{t('admin_total_auro_sold')}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{totalAuroSold.toLocaleString('tr-TR')}</span>
                        <Gem className="h-5 w-5 text-cyan-400"/>
                    </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                    <span className="font-medium text-muted-foreground">{t('admin_total_revenue')}</span>
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
    const locale = useLocale();
    const t = useTranslations('ProfilePage');
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
                title: t('admin_toast_missing_selection_title'),
                description: t('admin_toast_missing_selection_description'),
            });
            return;
        }

        setIsGenerating(true);
        toast({
            title: t('admin_toast_generating_title'),
            description: t('admin_toast_generating_description', { level: selectedLevel, category: selectedCategory }),
        });

        try {
            const newLessons = await generateDailyLessons({ level: selectedLevel, category: selectedCategory, language: locale });
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
                title: t('admin_toast_generate_success_title'),
                description: t('admin_toast_generate_success_description', { count: newLessons.length, category: selectedCategory }),
            });

        } catch (error) {
            console.error("Failed to generate or save lessons:", error);
            toast({
                variant: 'destructive',
                title: t('admin_toast_generate_error_title'),
                description: t('admin_toast_generate_error_description'),
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
                    <span>{t('admin_tools_title')}</span>
                </CardTitle>
                <CardDescription>{t('admin_tools_description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <RevenueReport />
                    <div className="space-y-4 rounded-lg border p-4">
                        <div>
                            <h4 className="font-semibold">{t('admin_generate_lessons_title')}</h4>
                            <p className="text-sm text-muted-foreground">{t('admin_generate_lessons_description')}</p>
                        </div>
                        <div className='space-y-4'>
                           <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'Temel' | 'Orta' | 'İleri')}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('admin_select_level')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Temel">Temel</SelectItem>
                                    <SelectItem value="Orta">Orta</SelectItem>
                                    <SelectItem value="İleri">İleri</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedLevel || availableCategories.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('admin_select_category')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button className="w-full" onClick={handleGenerateLessons} disabled={isGenerating || !selectedLevel || !selectedCategory}>
                                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('admin_button_generate')}
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

function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('ProfilePage');

  const localesInfo: { code: string; name: string }[] = [
    { code: 'tr', name: 'Türkçe' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'ar', name: 'العربية' },
    { code: 'ru', name: 'Русский' },
    { code: 'el', name: 'Ελληνικά' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
  ];

  function onSelectChange(nextLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
     <div className="flex items-center gap-4 w-full p-2">
        <div className="flex-shrink-0 bg-secondary p-3 rounded-lg">
            <Languages className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-grow">
            <p className="font-semibold text-card-foreground">{t('language_label')}</p>
            <p className="text-xs text-muted-foreground">{t('language_description')}</p>
        </div>
        <div className="w-[150px]">
            <Select defaultValue={locale} onValueChange={onSelectChange} disabled={isPending}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('language_select_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                    {localesInfo.map((loc) => (
                      <SelectItem key={loc.code} value={loc.code}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    </div>
  );
}


export default function SettingsPage() {
    const { user: authUser, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const t = useTranslations('ProfilePage');
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
            toast({ title: t('toast_signout_success') });
        } catch (error) {
            console.error('Sign out failed', error);
            toast({ variant: 'destructive', title: t('toast_signout_fail') });
        }
    };
    
    const handleRestorePurchases = () => {
        setIsRestoring(true);
        toast({ title: t('toast_restoring_title') });

        setTimeout(() => {
             toast({ title: t('toast_restore_complete_title'), description: t('toast_restore_complete_description') });
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
                           {t('auro_management_title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
                            <span className="font-medium text-muted-foreground">{t('current_balance')}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold">{auroBalance}</span>
                                <span className="font-semibold text-cyan-400">{t('auro_unit')}</span>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             <Button asChild size="lg">
                                <Link href="/pricing">
                                    <Coins className="mr-2 h-5 w-5" />
                                    {t('button_buy_auro')}
                                </Link>
                            </Button>
                             <Button variant="outline" size="lg" onClick={handleRestorePurchases} disabled={isRestoring}>
                                {isRestoring ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <History className="mr-2 h-5 w-5" />}
                                {t('button_restore_purchases')}
                            </Button>
                         </div>
                    </CardContent>
                </Card>

                <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                           <SettingsIcon className="h-6 w-6 text-primary" />
                           {t('app_account_title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mx-3">
                        <LanguageSwitcher />
                        <SettingsListItem icon={Info} title={t('version_label')} description="1.0.0 (Build 1)" />
                        <SettingsListItem icon={FileText} title={t('terms_label')} isLink href="/terms" />
                        <SettingsListItem icon={ShieldQuestion} title={t('privacy_label')} isLink href="/privacy" />
                    </CardContent>
                </Card>
                
                {userProfile?.email === 'admin@viewora.ai' && (
                    <AdminTools />
                )}

                <div className="pt-4">
                     <Button variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-5 w-5" />
                        {t('button_sign_out')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
