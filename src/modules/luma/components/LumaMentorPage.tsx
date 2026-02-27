'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit, where, writeBatch, increment } from 'firebase/firestore';
import type { User, Photo, StrategicFeedback, AnalysisLog } from '@/types';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Camera, Zap, ChevronRight, Target } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const MENTOR_COST = 2;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

export default function LumaMentorPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [strategicFeedback, setStrategicFeedback] = useState<StrategicFeedback | null>(null);

    // Fetch User Profile
    const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

    // Fetch Recent Photos for Context
    const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'), limit(5)) : null, [user, firestore]);
    const { data: recentPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

    const lastPhoto = useMemo(() => recentPhotos?.[0] || null, [recentPhotos]);

    // Calculate aggregated metrics for coach logic
    const stats = useMemo(() => {
        if (!recentPhotos || recentPhotos.length === 0) return null;
        const analyzed = recentPhotos.filter(p => !!p.aiFeedback);
        if (analyzed.length === 0) return null;

        const sum = analyzed.reduce((acc, p) => ({
            light: acc.light + normalizeScore(p.aiFeedback?.light_score),
            composition: acc.composition + normalizeScore(p.aiFeedback?.composition_score),
            focus: acc.focus + normalizeScore(p.aiFeedback?.focus_score),
        }), { light: 0, composition: 0, focus: 0 });

        return {
            avgLight: sum.light / analyzed.length,
            avgComp: sum.composition / analyzed.length,
            avgFocus: sum.focus / analyzed.length,
            totalAnalyzed: analyzed.length,
            lastUploadDate: new Date(recentPhotos[0].createdAt)
        };
    }, [recentPhotos]);

    // 👋 Dynamic Top Messages
    const dynamicGreeting = useMemo(() => {
        if (!stats) return "Merhaba! Yolculuğumuza başlamaya hazır mısın? İlk fotoğrafını yüklediğinde seni daha yakından tanıyabilirim.";
        
        const now = new Date();
        const daysSinceLast = Math.floor((now.getTime() - stats.lastUploadDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLast >= 3) return `${daysSinceLast} gündür üretmedin. Bugün küçük bir kare yakalayalım mı?`;
        if (stats.avgLight > 8) return "Son günlerde ışığı harika fark ediyorsun. Bu vizyonunu derinleştirebiliriz.";
        if (stats.avgComp > 8) return "Minimal kadrajın giderek güçleniyor, bunu hissedebiliyorum.";
        
        return "Bugün ışığı fark ettin mi? Her an yeni bir hikaye barındırıyor.";
    }, [stats]);

    // 📌 Focus Point Logic
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

            const result = await generateStrategicFeedback({
                userPrompt: "Genel gelişimimi değerlendir ve bana bu hafta için stratejik bir yol haritası çıkar.",
                language: "tr",
                userProfileIndex: {
                    dominant_style: "Karma",
                    strengths: stats.avgLight > 7.5 ? ["Işık"] : ["Vizyon"],
                    weaknesses: stats.avgComp < 7 ? ["Kompozisyon"] : ["Teknik"],
                    dominant_technical_level: levelMapping[userProfile.level_name] || 'beginner',
                    trend: { direction: 'improving', percentage: 10 },
                    consistency_gap: 15,
                    communication_profile: { tone: 'direct', explanation_depth: 'medium', challenge_level: 3 }
                }
            });

            const batch = writeBatch(firestore);
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);
            const logRef = doc(collection(firestore, 'analysis_logs'));

            batch.update(doc(firestore, 'users', user.uid), { 
              auro_balance: increment(-MENTOR_COST),
              total_auro_spent: increment(MENTOR_COST),
              total_analyses_count: increment(1)
            });
            
            batch.set(statRef, { 
              mentorAnalyses: increment(1), 
              auroSpent: increment(MENTOR_COST),
              date: today
            }, { merge: true });
            
            batch.set(logRef, { 
              id: logRef.id, 
              userId: user.uid, 
              userName: userProfile.name || 'Sanatçı', 
              type: 'mentor', 
              auroSpent: MENTOR_COST, 
              timestamp: new Date().toISOString(), 
              status: 'success' 
            });

            await batch.commit();
            setStrategicFeedback(result);
            toast({ title: "Analiz Hazır", description: "Luma derin mentorluk planını hazırladı." });
        } catch (error) {
            console.error("Mentor analysis error:", error);
            toast({ variant: 'destructive', title: "Analiz Başarısız", description: "Bir hata oluştu, lütfen tekrar deneyin." });
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isProfileLoading || isPhotosLoading) {
        return (
            <div className="container mx-auto px-4 py-12 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Luma verilerini hazırlıyor...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 pt-10 pb-24 max-w-2xl animate-in fade-in duration-1000">
            {/* 👋 Dynamic Greeting */}
            <header className="mb-12 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Luma Mentor</span>
                </div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight">
                    {dynamicGreeting}
                </h1>
            </header>

            <div className="space-y-10">
                {/* 📌 Focus Point Section */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Günün Odak Noktası</h3>
                    <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden group hover:border-primary/30 transition-all shadow-sm">
                        <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6">
                            <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center shrink-0 border border-border/50 group-hover:scale-110 transition-transform duration-500">
                                <focusPoint.icon className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <h4 className="text-xl font-bold mb-1">{focusPoint.title}</h4>
                                <p className="text-muted-foreground text-sm leading-relaxed">{focusPoint.desc}</p>
                            </div>
                            <Button onClick={() => router.push('/dashboard')} className="rounded-2xl px-6 font-bold shadow-lg shadow-primary/10">
                                <Camera className="mr-2 h-4 w-4" /> Hemen dene
                            </Button>
                        </CardContent>
                    </Card>
                </section>

                {/* 📎 Last Photo Feedback Section */}
                {lastPhoto && (
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Son Kareye Dair</h3>
                        <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-sm">
                            <CardContent className="p-6 flex items-start gap-6">
                                <div className="relative h-24 w-24 rounded-2xl overflow-hidden shrink-0 border border-border/50">
                                    <Image src={lastPhoto.imageUrl} alt="Son Kare" fill className="object-cover" unoptimized />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <p className="text-sm italic text-foreground/90 leading-relaxed font-medium">
                                        {lastPhoto.aiFeedback ? 
                                            `"${lastPhoto.aiFeedback.short_neutral_analysis}"` : 
                                            "Henüz analiz edilmemiş bir kare. Ne hissettiğini merak ediyorum."
                                        }
                                    </p>
                                    {!lastPhoto.aiFeedback && (
                                        <Button variant="ghost" size="sm" onClick={() => router.push('/gallery')} className="text-[10px] h-7 px-2 font-bold uppercase hover:bg-primary/5 hover:text-primary">
                                            Analizi başlat <ChevronRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 🔒 Strategic Analysis Area (Premium Upsell) */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Derinlik</h3>
                    {!strategicFeedback ? (
                        <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden shadow-md">
                            <CardContent className="p-10 text-center space-y-6">
                                <div className="max-w-sm mx-auto space-y-3">
                                    <h4 className="text-xl font-bold">Detaylı gelişim planını görmek ister misin?</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Tüm geçmişini tarayıp, vizyonunu ustalığa taşıyacak stratejik bir yol haritası hazırlayabilirim.
                                    </p>
                                </div>
                                <Button 
                                    onClick={handleAskLuma} 
                                    disabled={isAnalyzing || !stats}
                                    className="h-12 px-10 rounded-2xl font-bold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95"
                                >
                                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Analizi Başlat ({MENTOR_COST} Auro)
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-in slide-in-from-bottom-4 duration-500 shadow-xl">
                            <CardContent className="p-8 space-y-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <Sparkles className="h-5 w-5 text-purple-400" />
                                    <h4 className="text-lg font-black uppercase tracking-widest">Luma'nın Stratejisi</h4>
                                </div>
                                <div className="prose prose-sm dark:prose-invert">
                                    <p className="text-lg leading-relaxed text-foreground/90 italic">"{strategicFeedback.feedback}"</p>
                                </div>
                                
                                <div className="pt-8 border-t border-primary/10">
                                    <h5 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2">
                                        <Zap className="h-4 w-4" /> Haftalık Gelişim Görevi
                                    </h5>
                                    <div className="bg-background/50 rounded-2xl p-6 border border-primary/10">
                                        <h6 className="text-lg font-bold mb-3">{strategicFeedback.actionTask.title}</h6>
                                        <ul className="space-y-2">
                                            {strategicFeedback.actionTask.steps.map((step, i) => (
                                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                                                    <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">{i+1}</div>
                                                    {step}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary" onClick={() => setStrategicFeedback(null)}>Yeni bir analiz ister misin?</Button>
                            </CardContent>
                        </Card>
                    )}
                </section>
            </div>
        </div>
    );
}
