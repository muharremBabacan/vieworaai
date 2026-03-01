
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit, writeBatch, increment, addDoc } from 'firebase/firestore';
import type { User, Photo, StrategicFeedback, UserProfileIndex, StoredStrategicFeedback } from '@/types';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, Camera, Zap, Target, BadgeCheck, History } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';

// Luma Detaylı Analiz Ücreti: 10 Auro
const MENTOR_COST = 10;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

function FeedbackDisplay({ feedback }: { feedback: StrategicFeedback }) {
    return (
        <div className="space-y-6">
            <div className="p-6 bg-secondary/20 border-b border-border/40 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    <h4 className="text-sm font-black uppercase tracking-widest">Luma Analizi</h4>
                </div>
                <div className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed font-medium">
                    {feedback.feedback}
                </div>
            </div>
            
            <div className="space-y-6">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4" /> Haftalık Görev – {feedback.actionTask.title}
                </h5>
                <div className="space-y-4">
                    <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                        <h6 className="text-xs font-black uppercase tracking-tight text-primary/80 mb-1">Amaç</h6>
                        <p className="text-sm text-foreground/80">{feedback.actionTask.purpose}</p>
                    </div>
                    <div className="space-y-3">
                        {feedback.actionTask.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-4">
                                <div className="h-6 w-6 rounded-full bg-secondary text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">{i+1}</div>
                                <p className="text-sm text-foreground/90 leading-relaxed">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LumaMentorPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [strategicFeedback, setStrategicFeedback] = useState<StrategicFeedback | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

    const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'), limit(12)) : null, [user, firestore]);
    const { data: recentPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

    const feedbacksQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'strategic_feedbacks'), orderBy('createdAt', 'desc'), limit(1)) : null, [user, firestore]);
    const { data: pastFeedbacks } = useCollection<StoredStrategicFeedback>(feedbacksQuery);

    const lastPastFeedback = useMemo(() => pastFeedbacks?.[0] || null, [pastFeedbacks]);
    const lastPhoto = useMemo(() => recentPhotos?.[0] || null, [recentPhotos]);

    const stats = useMemo(() => {
        if (!recentPhotos || recentPhotos.length === 0) return null;
        const analyzed = recentPhotos.filter(p => !!p.aiFeedback);
        if (analyzed.length === 0) return null;

        const sum = analyzed.reduce((acc, p) => ({
            light: acc.light + normalizeScore(p.aiFeedback?.light_score),
            composition: acc.composition + normalizeScore(p.aiFeedback?.composition_score),
            focus: acc.focus + normalizeScore(p.aiFeedback?.focus_score),
            color: acc.color + normalizeScore(p.aiFeedback?.color_control_score),
            creativity: acc.creativity + normalizeScore(p.aiFeedback?.creativity_risk_score),
        }), { light: 0, composition: 0, focus: 0, color: 0, creativity: 0 });

        const genres = analyzed.map(p => p.aiFeedback?.genre).filter(Boolean);
        const dominantGenre = genres.length > 0 ? genres.sort((a, b) => genres.filter(v => v === a).length - genres.filter(v => v === b).length).pop() : 'Karma';

        return {
            avgLight: sum.light / analyzed.length,
            avgComp: sum.composition / analyzed.length,
            avgFocus: sum.focus / analyzed.length,
            avgColor: sum.color / analyzed.length,
            avgCreativity: sum.creativity / analyzed.length,
            totalAnalyzed: analyzed.length,
            lastUploadDate: new Date(recentPhotos[0].createdAt),
            dominantGenre: dominantGenre as string
        };
    }, [recentPhotos]);

    const dynamicGreeting = useMemo(() => {
        if (!stats) return "Merhaba! Yolculuğumuza başlamaya hazır mısın? İlk fotoğrafını yüklediğinde seni daha yakından tanıyabilirim.";
        const now = new Date();
        const daysSinceLast = Math.floor((now.getTime() - stats.lastUploadDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLast >= 3) return `${daysSinceLast} gündür üretmedin. Bugün küçük bir kare yakalayalım mı?`;
        if (stats.avgLight > 8) return "Son günlerde ışığı harika fark ediyorsun. Bu vizyonunu derinleştirebiliriz.";
        return "Bugün ışığı fark ettin mi? Her an yeni bir hikaye barındırıyor.";
    }, [stats]);

    const focusPoint = useMemo(() => {
        if (!stats) return { title: "Fotoğrafın Temelleri", desc: "Kadrajına güvenmeyi öğrenmelisin.", icon: Target };
        const metrics = [
            { id: 'light', score: stats.avgLight, title: "Işığı Evcilleştir", desc: "Bu hafta: Ters ışık ve sert gölgelerle oyna.", icon: Zap },
            { id: 'comp', score: stats.avgComp, title: "Sadeleşmeyi Seç", desc: "Bu hafta: Arka planı olabildiğince sadeleştir.", icon: Target },
            { id: 'focus', score: stats.avgFocus, title: "Netlikte Ustalık", desc: "Bu hafta: Detaylara odaklan, dokuları hisset.", icon: Camera }
        ];
        return metrics.sort((a, b) => a.score - b.score)[0];
    }, [stats]);

    const handleAskLuma = async () => {
        if (!user || !userProfile || !stats || !firestore) {
            toast({ variant: 'destructive', title: "Eksik Veri", description: "Analiz yapabilmem için önce birkaç fotoğrafını analiz etmelisin." });
            return;
        }
        if (userProfile.auro_balance < MENTOR_COST) {
          toast({ variant: 'destructive', title: "Yetersiz Auro", description: `Mentor analizi için ${MENTOR_COST} Auro gereklidir.` });
          return;
        }
        setIsAnalyzing(true);
        try {
            const levelMapping: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
                'Neuner': 'beginner', 'Viewner': 'beginner', 'Sytner': 'intermediate', 'Omner': 'intermediate', 'Vexer': 'advanced'
            };
            const profileIndex: UserProfileIndex = {
                dominant_style: stats.dominantGenre,
                strengths: stats.avgLight > 7.5 ? ["Işık Kullanımı"] : ["Görsel Farkındalık"],
                weaknesses: stats.avgComp < 7 ? ["Kompozisyon Dengesi"] : ["Teknik Detaylar"],
                dominant_technical_level: levelMapping[userProfile.level_name] || 'beginner',
                trend: { direction: (stats.avgLight > 7 || stats.avgComp > 7) ? 'improving' : 'stagnant', percentage: 12 },
                consistency_gap: stats.avgFocus > 8 ? 10 : 20,
                metrics: { composition: Math.round(stats.avgComp * 10), light: Math.round(stats.avgLight * 10), storytelling: Math.round(stats.avgCreativity * 8), technical_clarity: Math.round((stats.avgFocus + stats.avgColor) / 2 * 10), boldness: Math.round(stats.avgCreativity * 10) },
                communication_profile: { tone: 'direct', explanation_depth: 'medium', challenge_level: 3 },
                profile_index_score: Math.round((stats.avgLight + stats.avgComp + stats.avgFocus) / 3 * 10)
            };
            const result = await generateStrategicFeedback({
                userPrompt: "Genel gelişimimi değerlendir ve bana bu hafta için stratejik bir yol haritası çıkar.",
                language: "tr",
                userProfileIndex: profileIndex
            });
            
            const batch = writeBatch(firestore);
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);
            const logRef = doc(collection(firestore, 'analysis_logs'));
            const historyRef = doc(collection(firestore, 'users', user.uid, 'strategic_feedbacks'));

            batch.update(doc(firestore, 'users', user.uid), { 
              auro_balance: increment(-MENTOR_COST),
              total_auro_spent: increment(MENTOR_COST),
              total_analyses_count: increment(1),
              profile_index: profileIndex
            });
            batch.set(historyRef, { 
                ...result, 
                createdAt: new Date().toISOString() 
            });
            batch.set(statRef, { mentorAnalyses: increment(1), auroSpent: increment(MENTOR_COST), date: today }, { merge: true });
            batch.set(logRef, { id: logRef.id, userId: user.uid, userName: userProfile.name || 'Sanatçı', type: 'mentor', auroSpent: MENTOR_COST, timestamp: new Date().toISOString(), status: 'success' });
            
            await batch.commit();
            setStrategicFeedback(result);
            toast({ title: "Analiz Hazır" });
        } catch (error) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsAnalyzing(false); }
    };

    if (isProfileLoading || isPhotosLoading) return <div className="container mx-auto px-4 py-12 flex flex-col items-center gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-muted-foreground animate-pulse font-medium">Luma verilerini hazırlıyor...</p></div>;

    return (
        <div className="container mx-auto px-4 pt-10 pb-24 max-w-2xl animate-in fade-in duration-1000">
            <header className="mb-12 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20"><Sparkles className="h-6 w-6 text-primary" /></div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Luma Mentor</span>
                    </div>
                    {lastPastFeedback && (
                        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="rounded-full h-9 px-4 border-primary/30 text-primary hover:bg-primary/5 font-bold transition-all">
                                    <History className="mr-2 h-4 w-4" /> Son Stratejik Plana Ulaş
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col p-0 border-border/40 bg-background/95 backdrop-blur-xl">
                                <DialogHeader className="p-6 border-b shrink-0">
                                    <DialogTitle className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-primary" /> Kayıtlı Son Plan
                                    </DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="flex-1 p-6">
                                    <FeedbackDisplay feedback={lastPastFeedback} />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight">{dynamicGreeting}</h1>
            </header>

            <div className="space-y-10">
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Günün Odak Noktası</h3>
                    <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden group hover:border-primary/30 transition-all shadow-sm">
                        <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6">
                            <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center shrink-0 border border-border/50 group-hover:scale-110 transition-transform duration-500"><focusPoint.icon className="h-8 w-8 text-primary" /></div>
                            <div className="flex-1 text-center sm:text-left"><h4 className="text-xl font-bold mb-1">{focusPoint.title}</h4><p className="text-muted-foreground text-sm leading-relaxed">{focusPoint.desc}</p></div>
                            <Button onClick={() => router.push('/dashboard')} className="rounded-2xl px-6 font-bold shadow-lg shadow-primary/10"><Camera className="mr-2 h-4 w-4" /> Hemen dene</Button>
                        </CardContent>
                    </Card>
                </section>

                {lastPhoto && (
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Son Kareye Dair</h3>
                        <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-sm">
                            <CardContent className="p-6 flex items-start gap-6">
                                <div className="relative h-24 w-24 rounded-2xl overflow-hidden shrink-0 border border-border/50"><Image src={lastPhoto.imageUrl} alt="Son Kare" fill className="object-cover" unoptimized /></div>
                                <div className="flex-1 space-y-2"><p className="text-sm italic text-foreground/90 leading-relaxed font-medium">{lastPhoto.aiFeedback ? `"${lastPhoto.aiFeedback.short_neutral_analysis}"` : "Henüz analiz edilmemiş bir kare."}</p></div>
                            </CardContent>
                        </Card>
                    </section>
                )}

                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Derinlik</h3>
                    {!strategicFeedback ? (
                        <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden shadow-md">
                            <CardContent className="p-10 text-center space-y-6">
                                <div className="max-w-sm mx-auto space-y-3"><h4 className="text-xl font-bold">Detaylı gelişim planını görmek ister misin?</h4><p className="text-sm text-muted-foreground leading-relaxed">Vizyonunu ustalığa taşıyacak stratejik bir yol haritası hazırlayabilirim.</p></div>
                                <Button onClick={handleAskLuma} disabled={isAnalyzing || !stats} className="h-12 px-10 rounded-2xl font-bold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95">{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Analizi Başlat ({MENTOR_COST} Auro)</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-[32px] border-primary/20 bg-card overflow-hidden animate-in slide-in-from-bottom-4 duration-500 shadow-xl">
                            <CardContent className="p-0">
                                <FeedbackDisplay feedback={strategicFeedback} />
                                <div className="p-8 pt-0">
                                    <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary pt-4" onClick={() => setStrategicFeedback(null)}>Yeni bir analiz ister misin?</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </section>
            </div>
        </div>
    );
}
