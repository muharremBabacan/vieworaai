'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import type { User, Photo, StrategicFeedback } from '@/types';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, Sparkles, Target, Zap, ArrowUpRight, Loader2, Award, History, Trophy } from 'lucide-react';
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
    const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'), limit(10)) : null, [user, firestore]);
    const { data: recentPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

    // Calculate aggregated metrics
    const stats = useMemo(() => {
        if (!recentPhotos || recentPhotos.length === 0) return null;
        const analyzed = recentPhotos.filter(p => !!p.aiFeedback);
        if (analyzed.length === 0) return null;

        const sum = analyzed.reduce((acc, p) => ({
            light: acc.light + normalizeScore(p.aiFeedback?.light_score),
            composition: acc.composition + normalizeScore(p.aiFeedback?.composition_score),
            focus: acc.focus + normalizeScore(p.aiFeedback?.focus_score),
            color: acc.color + normalizeScore(p.aiFeedback?.color_control_score),
        }), { light: 0, composition: 0, focus: 0, color: 0 });

        const count = analyzed.length;
        return {
            avgLight: sum.light / count,
            avgComp: sum.composition / count,
            avgFocus: sum.focus / count,
            avgColor: sum.color / count,
            count
        };
    }, [recentPhotos]);

    const handleAskLuma = async () => {
        if (!user || !userProfile || !stats) {
            toast({ variant: 'destructive', title: "Eksik Veri", description: "Analiz yapabilmem için önce birkaç fotoğrafını analiz etmelisin." });
            return;
        }

        setIsAnalyzing(true);
        try {
            const mockIndex: any = {
                dominant_style: "Portre ve Sokak",
                strengths: stats.avgLight > 7 ? ["Işık Kullanımı"] : ["Görsel Farkındalık"],
                weaknesses: stats.avgComp < 6 ? ["Kompozisyon Düzeni"] : ["Detay Kontrolü"],
                dominant_technical_level: (userProfile.level_name?.toLowerCase() as any) || 'beginner',
                trend: { direction: 'improving', percentage: 15 },
                consistency_gap: 12,
                communication_profile: { tone: 'analytical', explanation_depth: 'medium', challenge_level: 3 }
            };

            const result = await generateStrategicFeedback({
                userPrompt: "Genel gelişimimi değerlendir ve bana bu hafta için bir plan hazırla.",
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
            <div className="container mx-auto px-4 py-8 space-y-6">
                <Skeleton className="h-12 w-48" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64 rounded-3xl" />
                    <Skeleton className="h-64 rounded-3xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 pt-8 pb-24 space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <BrainCircuit className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Luma Mentor</h1>
                    </div>
                    <p className="text-muted-foreground text-lg">Kişisel gelişim stratejistiniz ve sanatsal rehberiniz.</p>
                </div>
                <Button 
                    onClick={handleAskLuma} 
                    disabled={isAnalyzing || !stats} 
                    size="lg" 
                    className="h-14 px-8 rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
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
                        <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden">
                            <CardHeader className="bg-secondary/20 border-b pb-6">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Target className="h-5 w-5 text-primary" /> Mevcut Yetkinlik Analizi
                                </CardTitle>
                                <CardDescription>Son {stats.count} fotoğrafındaki teknik performans ortalaman.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 grid sm:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground"><span>Işık Hakimiyeti</span><span>%{stats.avgLight.toFixed(0)}</span></div>
                                        <Progress value={stats.avgLight * 10} className="h-3 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground"><span>Kompozisyon</span><span>%{stats.avgComp.toFixed(0)}</span></div>
                                        <Progress value={stats.avgComp * 10} className="h-3 rounded-full" />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground"><span>Netlik & Odak</span><span>%{stats.avgFocus.toFixed(0)}</span></div>
                                        <Progress value={stats.avgFocus * 10} className="h-3 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground"><span>Renk Kontrolü</span><span>%{stats.avgColor.toFixed(0)}</span></div>
                                        <Progress value={stats.avgColor * 10} className="h-3 rounded-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {feedback && (
                            <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-in slide-in-from-bottom-4 duration-500">
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
                        <Card className="rounded-[32px] border-border/40 bg-card/50">
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

                        <Card className="rounded-[32px] border-border/40 bg-card/50">
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
