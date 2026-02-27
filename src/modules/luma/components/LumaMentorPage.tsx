'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit, where, writeBatch, increment, setDoc } from 'firebase/firestore';
import type { User, Photo, StrategicFeedback, AnalysisLog, UserProfileIndex } from '@/types';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Camera, Zap, ChevronRight, Target, BadgeCheck, Star, Info } from 'lucide-react';
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

    // Fetch Recent Photos for Context - Increased to 12 for deeper analysis
    const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'), limit(12)) : null, [user, firestore]);
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

            const profileIndex: UserProfileIndex = {
                dominant_style: stats.dominantGenre,
                strengths: stats.avgLight > 7.5 ? ["Işık Kullanımı"] : ["Görsel Farkındalık"],
                weaknesses: stats.avgComp < 7 ? ["Kompozisyon Dengesi"] : ["Teknik Detaylar"],
                dominant_technical_level: levelMapping[userProfile.level_name] || 'beginner',
                trend: { 
                    direction: stats.avgLight > 7 || stats.avgComp > 7 ? 'improving' : 'stagnant', 
                    percentage: 12 
                },
                consistency_gap: stats.avgFocus > 8 ? 10 : 20,
                metrics: {
                    composition: Math.round(stats.avgComp * 10),
                    light: Math.round(stats.avgLight * 10),
                    storytelling: Math.round(stats.avgCreativity * 8), 
                    technical_clarity: Math.round((stats.avgFocus + stats.avgColor) / 2 * 10),
                    boldness: Math.round(stats.avgCreativity * 10)
                },
                communication_profile: { 
                    tone: userProfile.level_name === 'Neuner' ? 'supportive' : 'direct', 
                    explanation_depth: 'medium', 
                    challenge_level: 3 
                },
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

            batch.update(doc(firestore, 'users', user.uid), { 
              auro_balance: increment(-MENTOR_COST),
              total_auro_spent: increment(MENTOR_COST),
              total_analyses_count: increment(1),
              profile_index: profileIndex
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

                {/* 🔒 Strategic Analysis Area */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Derinlik</h3>
                    {!strategicFeedback ? (
                        <Card className="rounded-[32px] border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden shadow-md">
                            <CardContent className="p-10 text-center space-y-6">
                                <div className="max-w-sm mx-auto space-y-3">
                                    <h4 className="text-xl font-bold">Detaylı gelişim planını görmek ister misin?</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Son 12 fotoğrafını tarayıp, vizyonunu ustalığa taşıyacak stratejik bir yol haritası hazırlayabilirim.
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
                        <Card className="rounded-[32px] border-primary/20 bg-card overflow-hidden animate-in slide-in-from-bottom-4 duration-500 shadow-xl">
                            <CardContent className="p-0">
                                {/* Header / Summary Area */}
                                <div className="p-8 bg-secondary/20 border-b border-border/40">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Sparkles className="h-5 w-5 text-purple-400" />
                                        <h4 className="text-lg font-black uppercase tracking-widest">Luma Analizi – Kişisel Strateji</h4>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed font-medium">
                                            {strategicFeedback.feedback}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Weekly Task Area */}
                                <div className="p-8 space-y-8">
                                    <div>
                                        <h5 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
                                            <BadgeCheck className="h-4 w-4" /> Haftalık Görev – {strategicFeedback.actionTask.title}
                                        </h5>
                                        
                                        <div className="space-y-6">
                                            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                                                <h6 className="text-sm font-black uppercase tracking-tight text-primary/80 mb-2">Amaç</h6>
                                                <p className="text-sm text-foreground/80">{strategicFeedback.actionTask.purpose}</p>
                                            </div>

                                            <div className="space-y-4">
                                                {strategicFeedback.actionTask.steps.map((step, i) => (
                                                    <div key={i} className="flex items-start gap-4">
                                                        <div className="h-6 w-6 rounded-full bg-secondary text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">{i+1}</div>
                                                        <p className="text-sm text-foreground/90 leading-relaxed">{step}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Self-Evaluation Section */}
                                    <div className="pt-8 border-t border-border/40">
                                        <h6 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Değerlendirme</h6>
                                        <ul className="grid gap-2">
                                            {strategicFeedback.actionTask.evaluationQuestions.map((q, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground italic">
                                                    <ChevronRight className="h-3 w-3 text-primary" /> {q}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Weekly Targets Badge list */}
                                    <div className="pt-6 flex flex-wrap gap-2">
                                        {strategicFeedback.actionTask.weeklyTarget.map((target, i) => (
                                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20 text-[10px] font-bold uppercase tracking-tight">
                                                <Star className="h-3 w-3 fill-current" /> {target}
                                            </div>
                                        ))}
                                    </div>

                                    {/* 📚 Glossary / Explanations Section */}
                                    {strategicFeedback.explanations && strategicFeedback.explanations.length > 0 && (
                                        <div className="pt-8 border-t border-border/40">
                                            <div className="flex items-center gap-2 mb-4 opacity-60">
                                                <Info className="h-3 w-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Sözlük</span>
                                            </div>
                                            <div className="space-y-3">
                                                {strategicFeedback.explanations.map((exp, i) => (
                                                    <p key={i} className="text-[10px] text-muted-foreground/80 leading-relaxed">
                                                        <span className="font-black text-primary/60 mr-1">* {exp.term.toUpperCase()}:</span> {exp.definition}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
