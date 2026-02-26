'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit, where, collectionGroup } from 'firebase/firestore';
import type { User, Photo, StrategicFeedback, CompetitionEntry, Group } from '@/types';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Sparkles, Target, Zap, ArrowUpRight, Loader2, Award, History, Trophy, Globe, Users, Star, Medal, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

export default function LumaMentorPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [feedback, setFeedback] = useState<StrategicFeedback | null>(null);

    // Fetch User Profile
    const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

    // Fetch Recent Photos for Context
    const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'), limit(50)) : null, [user, firestore]);
    const { data: allPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

    // Fetch Groups for activity context
    const groupsQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid)) : null, [user, firestore]);
    const { data: userGroups } = useCollection<Group>(groupsQuery);

    // Fetch Competition Entries for badges
    const entriesQuery = useMemoFirebase(() => (user && firestore) ? query(collectionGroup(firestore, 'entries'), where('userId', '==', user.uid)) : null, [user, firestore]);
    const { data: userEntries } = useCollection<CompetitionEntry>(entriesQuery);

    // Calculate aggregated metrics
    const stats = useMemo(() => {
        if (!allPhotos || allPhotos.length === 0) return null;
        const analyzed = allPhotos.filter(p => !!p.aiFeedback);
        if (analyzed.length === 0) return null;

        const sum = analyzed.reduce((acc, p) => ({
            light: acc.light + normalizeScore(p.aiFeedback?.light_score),
            composition: acc.composition + normalizeScore(p.aiFeedback?.composition_score),
            focus: acc.focus + normalizeScore(p.aiFeedback?.focus_score),
            color: acc.color + normalizeScore(p.aiFeedback?.color_control_score),
        }), { light: 0, composition: 0, focus: 0, color: 0 });

        const count = analyzed.length;
        const exhibitionCount = allPhotos.filter(p => p.isSubmittedToExhibition).length;
        const groupCount = userGroups?.length || 0;

        return {
            avgLight: sum.light / count,
            avgComp: sum.composition / count,
            avgFocus: sum.focus / count,
            avgColor: sum.color / count,
            totalAnalyzed: count,
            exhibitionCount,
            groupCount
        };
    }, [allPhotos, userGroups]);

    // Badge counts
    const badges = useMemo(() => {
        if (!userEntries) return { participants: 0, honorable: 0, winners: 0 };
        return userEntries.reduce((acc, entry) => {
            if (entry.award === 'participant') acc.participants++;
            if (entry.award === 'honorable_mention') acc.honorable++;
            if (entry.award === 'winner') acc.winners++;
            return acc;
        }, { participants: 0, honorable: 0, winners: 0 });
    }, [userEntries]);

    const handleAskLuma = async () => {
        if (!user || !userProfile || !stats) {
            toast({ variant: 'destructive', title: "Eksik Veri", description: "Analiz yapabilmem için önce birkaç fotoğrafını analiz etmelisin." });
            return;
        }

        setIsAnalyzing(true);
        try {
            // Map application levels to Genkit flow enum values
            const levelMapping: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
                'Neuner': 'beginner',
                'Viewner': 'beginner',
                'Sytner': 'intermediate',
                'Omner': 'intermediate',
                'Vexer': 'advanced'
            };

            const technicalLevel = levelMapping[userProfile.level_name] || 'beginner';

            const mockIndex = {
                dominant_style: "Portre ve Sokak",
                strengths: stats.avgLight > 7.5 ? ["Işık Kullanımı"] : ["Görsel Farkındalık"],
                weaknesses: stats.avgComp < 7 ? ["Kompozisyon Düzeni"] : ["Detay Kontrolü"],
                dominant_technical_level: technicalLevel,
                trend: { direction: 'improving' as const, percentage: 15 },
                consistency_gap: 12,
                communication_profile: { 
                    tone: 'analytical' as const, 
                    explanation_depth: 'medium' as const, 
                    challenge_level: 3 
                }
            };

            const result = await generateStrategicFeedback({
                userPrompt: "Genel gelişimimi ve topluluk aktivitelerimi değerlendir, bana bu hafta için stratejik bir yol haritası çıkar.",
                userProfileIndex: mockIndex
            });

            setFeedback(result);
            toast({ title: "Analiz Hazır", description: "Luma senin için stratejik planını hazırladı." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Hata", description: "Mentor analizi şu an yapılamıyor." });
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isProfileLoading || isPhotosLoading) {
        return (
            <div className="container mx-auto px-4 py-8 space-y-6 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground animate-pulse">Luma verilerini hazırlıyor...</p>
            </div>
        );
    }

    const firstName = userProfile?.name?.split(' ')[0] || 'Sanatçı';

    return (
        <div className="container mx-auto px-4 pt-8 pb-24 space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                            <BrainCircuit className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Luma Mentor</h1>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Merhaba {firstName}, bugün senin için harika planlarım var.
                        </h2>
                        <p className="text-muted-foreground mt-1 text-lg">Kişisel gelişim stratejistiniz ve sanatsal rehberiniz.</p>
                    </div>
                </div>
                <Button 
                    onClick={handleAskLuma} 
                    disabled={isAnalyzing || !stats} 
                    size="lg" 
                    className="h-14 px-8 rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-accent border-none text-white"
                >
                    {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    Stratejik Analiz Başlat
                </Button>
            </div>

            {!stats ? (
                <Card className="border-dashed border-2 bg-muted/5 rounded-[32px] py-20 text-center">
                    <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-xl font-bold">Henüz Yeterli Veri Yok</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Luma'nın sana mentorluk yapabilmesi için önce "Koç" sayfasından birkaç fotoğrafını analiz etmen gerekiyor.</p>
                </Card>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid sm:grid-cols-2 gap-6">
                            {/* Technical Stats */}
                            <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-sm">
                                <CardHeader className="bg-secondary/20 border-b pb-4">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Target className="h-4 w-4 text-primary" /> Teknik Yetkinlik
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-5">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span>Işık</span>
                                            <span className="text-primary font-mono">{stats.avgLight.toFixed(1)} / 10</span>
                                        </div>
                                        <Progress value={stats.avgLight * 10} className="h-1.5" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span>Kompozisyon</span>
                                            <span className="text-primary font-mono">{stats.avgComp.toFixed(1)} / 10</span>
                                        </div>
                                        <Progress value={stats.avgComp * 10} className="h-1.5" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span>Netlik</span>
                                            <span className="text-primary font-mono">{stats.avgFocus.toFixed(1)} / 10</span>
                                        </div>
                                        <Progress value={stats.avgFocus * 10} className="h-1.5" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Activity Stats */}
                            <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-sm">
                                <CardHeader className="bg-secondary/20 border-b pb-4">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Zap className="h-4 w-4 text-amber-400" /> Aktivite & Etkileşim
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-background/40 p-3 rounded-2xl border border-border/50 text-center">
                                            <Globe className="h-4 w-4 mx-auto mb-1 text-cyan-400" />
                                            <p className="text-xl font-bold">{stats.exhibitionCount}</p>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Sergi Eseri</p>
                                        </div>
                                        <div className="bg-background/40 p-3 rounded-2xl border border-border/50 text-center">
                                            <Users className="h-4 w-4 mx-auto mb-1 text-purple-400" />
                                            <p className="text-xl font-bold">{stats.groupCount}</p>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Grup Üyeliği</p>
                                        </div>
                                        <div className="bg-background/40 p-3 rounded-2xl border border-border/50 text-center">
                                            <Trophy className="h-4 w-4 mx-auto mb-1 text-amber-400" />
                                            <p className="text-xl font-bold">{badges.participants + badges.honorable + badges.winners}</p>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Yarışma</p>
                                        </div>
                                        <div className="bg-background/40 p-3 rounded-2xl border border-border/50 text-center">
                                            <Star className="h-4 w-4 mx-auto mb-1 text-primary" />
                                            <p className="text-xl font-bold">{stats.totalAnalyzed}</p>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Toplam Analiz</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {feedback && (
                            <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-in slide-in-from-bottom-4 duration-500 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-2xl font-black">
                                        <Sparkles className="h-6 w-6 text-purple-400" /> Luma'nın Değerlendirmesi
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-8 space-y-8">
                                    <div className="prose prose-invert max-w-none">
                                        <p className="text-lg leading-relaxed text-foreground/90 italic">
                                            "{feedback.feedback}"
                                        </p>
                                    </div>

                                    <div className="pt-8 border-t border-primary/10">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
                                            <Zap className="h-4 w-4" /> Haftalık Gelişim Görevi
                                        </h4>
                                        <div className="bg-background/50 rounded-2xl p-6 border border-primary/10 shadow-inner">
                                            <h5 className="text-xl font-bold mb-4">{feedback.actionTask.title}</h5>
                                            <ul className="space-y-3">
                                                {feedback.actionTask.steps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                                        <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">{i+1}</div>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="mt-6 flex items-center justify-between border-t border-primary/5 pt-4">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Zorluk Seviyesi</span>
                                                <div className="flex gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div key={i} className={cn("h-1.5 w-6 rounded-full", i < feedback.actionTask.difficulty ? "bg-primary" : "bg-muted")} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* Awards & Badges Section */}
                        <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Medal className="h-5 w-5 text-amber-400" /> Başarılar & Rozetler
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={cn("p-3 rounded-2xl bg-secondary/30 border border-border/50 text-center space-y-2", badges.participants === 0 && "opacity-40")}>
                                        <div className="h-10 w-10 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center shadow-inner">
                                            <Shield className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter">Katılım Şilti</p>
                                        <Badge variant="outline" className={cn("text-[9px]", badges.participants > 0 ? "bg-blue-500/5 text-blue-400 border-blue-500/20" : "")}>
                                            {badges.participants > 0 ? `x${badges.participants} Aktif` : 'Kilitli'}
                                        </Badge>
                                    </div>
                                    <div className={cn("p-3 rounded-2xl bg-secondary/30 border border-border/50 text-center space-y-2", badges.honorable === 0 && "opacity-40")}>
                                        <div className="h-10 w-10 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center">
                                            <Award className="h-5 w-5 text-purple-400" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter">Mansiyon</p>
                                        <Badge variant="outline" className="text-[9px]">
                                            {badges.honorable > 0 ? `x${badges.honorable}` : 'Kilitli'}
                                        </Badge>
                                    </div>
                                    <div className={cn("p-3 rounded-2xl bg-secondary/30 border border-border/50 text-center space-y-2", badges.winners === 0 && "opacity-40")}>
                                        <div className="h-10 w-10 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                                            <Trophy className="h-5 w-5 text-amber-400" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter">Birincilik</p>
                                        <Badge variant="outline" className="text-[9px]">
                                            {badges.winners > 0 ? `x${badges.winners}` : 'Kilitli'}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-sm">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5 text-purple-400" /> Eğitim Önerileri</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 group cursor-pointer hover:bg-secondary/50 transition-all">
                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Sana Özel</p>
                                    <h5 className="font-bold text-sm mt-1 group-hover:text-primary transition-colors">Işık ve Gölge Oyunları</h5>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Zayıf gördüğümüz 'Işık' puanını yükseltmek için bu derse odaklanmalısın.</p>
                                    <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-[10px] font-bold uppercase" asChild><a href="/academy/temel">Derslere Git <ArrowUpRight className="ml-1 h-3 w-3" /></a></Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-sm">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Etkinlik Rehberi</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Yarışma Tavsiyesi</p>
                                    <h5 className="font-bold text-sm mt-1">Minimalist Sokak Yarışması</h5>
                                    <p className="text-xs text-muted-foreground mt-1">Kompozisyon becerilerini sergilemek için harika bir fırsat!</p>
                                    <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-[10px] font-bold uppercase" asChild><a href="/explore">Yarışmayı İncele</a></Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
