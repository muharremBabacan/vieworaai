'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, orderBy, limit, doc, writeBatch, increment, addDoc } from 'firebase/firestore';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import type { User, Photo, StoredStrategicFeedback, AnalysisLog } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, History, Target, Compass, Award, Gem, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STRATEGIC_ANALYSIS_COST = 10;

function FeedbackDisplay({ analysis }: { analysis: StoredStrategicFeedback }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="rounded-[32px] border-primary/20 bg-primary/5 shadow-xl overflow-hidden">
        <CardHeader className="p-8 border-b border-primary/10">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
            <Compass className="h-6 w-6 text-primary" /> Luma Analizi – Kişisel Strateji
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
            {analysis.feedback}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-border/40 bg-secondary/20">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black tracking-widest uppercase">BU HAFTANIN GÖREVİ</Badge>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(analysis.createdAt).toLocaleDateString('tr-TR')}</span>
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter uppercase">{analysis.actionTask.title}</CardTitle>
          <CardDescription className="text-base font-bold mt-2 italic">“{analysis.actionTask.purpose}”</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid gap-4">
            {analysis.actionTask.steps.map((step, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl bg-muted/30 border border-border/40 hover:border-primary/30 transition-colors group">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-sm group-hover:scale-110 transition-transform">{i + 1}</div>
                <p className="text-sm font-bold leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-border/40">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Değerlendirme Soruları
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {analysis.actionTask.evaluationQuestions.map((q, i) => (
                <div key={i} className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/10 text-xs font-medium italic text-muted-foreground leading-relaxed">
                  "{q}"
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {analysis.explanations && analysis.explanations.length > 0 && (
        <Card className="rounded-[24px] border-border/40 bg-secondary/10">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Terimler Sözlüğü</h4>
            <div className="flex flex-wrap gap-3">
              {analysis.explanations.map((exp, i) => (
                <Dialog key={i}>
                  <DialogTrigger asChild>
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 py-1.5 px-3 rounded-xl transition-all">
                      {exp.term}
                    </Badge>
                  </DialogTrigger>
                  <DialogContent className="rounded-[24px]">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black">{exp.term}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm leading-relaxed text-muted-foreground mt-2">{exp.definition}</p>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LumaMentorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<StoredStrategicFeedback | null>(null);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const historyQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'strategic_feedbacks'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [user, firestore]);

  const { data: history, isLoading: isHistoryLoading } = useCollection<StoredStrategicFeedback>(historyQuery);

  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [user, firestore]);

  const { data: photos } = useCollection<Photo>(photosQuery);

  const lastAnalysis = useMemo(() => history?.[0] || null, [history]);

  const handleStartAnalysis = async () => {
    if (!user || !userProfile || !firestore || !photos) return;

    if (userProfile.auro_balance < STRATEGIC_ANALYSIS_COST) {
      toast({
        variant: 'destructive',
        title: "Yetersiz Auro",
        description: `Stratejik analiz için ${STRATEGIC_ANALYSIS_COST} Auro gereklidir.`,
      });
      return;
    }

    const analyzedPhotos = photos.filter(p => !!p.aiFeedback);
    if (analyzedPhotos.length < 3) {
      toast({
        variant: 'destructive',
        title: "Veri Yetersiz",
        description: "En az 3 adet teknik analiz yapılmış fotoğrafınız olmalı.",
      });
      return;
    }

    setIsAnalyzing(true);
    setCurrentAnalysis(null);

    try {
      const result = await generateStrategicFeedback({
        userPrompt: "Genel gelişimim için stratejik bir yol haritası hazırlar mısın?",
        userProfileIndex: userProfile.profile_index || {
          dominant_style: "unknown",
          strengths: [],
          weaknesses: [],
          dominant_technical_level: "beginner",
          trend: { direction: "stagnant", percentage: 0 },
          consistency_gap: 0,
          communication_profile: { tone: "supportive", explanation_depth: "medium", challenge_level: 3 },
          profile_index_score: 50
        },
        language: "tr"
      });

      const feedbackData: Omit<StoredStrategicFeedback, 'id'> = {
        ...result,
        createdAt: new Date().toISOString()
      };

      const batch = writeBatch(firestore);
      const feedbackRef = doc(collection(firestore, 'users', user.uid, 'strategic_feedbacks'));
      const logRef = doc(collection(firestore, 'analysis_logs'));
      const userRef = doc(firestore, 'users', user.uid);
      const today = new Date().toISOString().split('T')[0];
      const statRef = doc(firestore, 'global_stats', `daily_${today}`);

      batch.set(feedbackRef, { ...feedbackData, id: feedbackRef.id });
      batch.update(userRef, {
        auro_balance: increment(-STRATEGIC_ANALYSIS_COST),
        total_auro_spent: increment(STRATEGIC_ANALYSIS_COST)
      });

      const log: AnalysisLog = {
        id: logRef.id,
        userId: user.uid,
        userName: userProfile.name || 'Sanatçı',
        type: 'mentor',
        auroSpent: STRATEGIC_ANALYSIS_COST,
        timestamp: feedbackData.createdAt,
        status: 'success'
      };
      batch.set(logRef, log);

      batch.set(statRef, {
        date: today,
        auroSpent: increment(STRATEGIC_ANALYSIS_COST),
        mentorAnalyses: increment(1)
      }, { merge: true });

      await batch.commit();
      
      setCurrentAnalysis({ ...feedbackData, id: feedbackRef.id });
      toast({ title: "Stratejik Plan Hazır!", description: "Luma sizin için özel bir yol haritası çıkardı." });

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Analiz Yapılamadı" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isProfileLoading || isHistoryLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Luma Hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-24 pt-6 max-w-4xl animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-border/40 pb-10">
        <div className="text-center md:text-left space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <h1 className="text-5xl font-black tracking-tighter">Luma Mentor</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 font-black h-6">PRO</Badge>
          </div>
          <p className="text-muted-foreground font-medium max-w-md">Vizyonunu ustalığa taşıyacak stratejik bir yol haritası hazırlayabilirim.</p>
        </div>
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          {lastAnalysis && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 rounded-2xl font-bold border-primary/30 text-primary hover:bg-primary/5 transition-all active:scale-95 shadow-lg shadow-primary/5">
                  <History className="mr-2 h-4 w-4" /> Son Stratejik Plana Ulaş
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[40px] p-0 border-border/40 bg-background/95 backdrop-blur-xl">
                <div className="p-8">
                  <DialogHeader className="mb-8">
                    <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
                      <Target className="h-7 w-7 text-primary" /> Kayıtlı Yol Haritası
                    </DialogTitle>
                  </DialogHeader>
                  <FeedbackDisplay analysis={lastAnalysis} />
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button 
            onClick={handleStartAnalysis} 
            disabled={isAnalyzing}
            className="h-14 px-10 rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-95 group relative overflow-hidden"
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                <Sparkles className="mr-2 h-5 w-5 text-yellow-400 relative z-10" /> 
                <span className="relative z-10">Stratejik Analiz Başlat ({STRATEGIC_ANALYSIS_COST} Auro)</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {currentAnalysis ? (
        <FeedbackDisplay analysis={currentAnalysis} />
      ) : lastAnalysis ? (
        <div className="space-y-12">
          <div className="flex items-center gap-4 text-muted-foreground mb-6">
            <History className="h-5 w-5" />
            <h3 className="font-black uppercase text-xs tracking-[0.2em]">Analiz Geçmişi</h3>
          </div>
          <div className="grid gap-6">
            {history?.map((item, idx) => (
              <Card key={item.id} className={cn(
                "rounded-[28px] border-border/40 bg-card/30 hover:border-primary/30 transition-all duration-300 cursor-pointer group shadow-sm",
                idx === 0 && "border-primary/20 bg-primary/5"
              )}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {idx === 0 && <Badge className="h-5 text-[9px] font-black bg-primary text-white">EN GÜNCEL</Badge>}
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: tr })}</span>
                      </div>
                      <h4 className="text-xl font-black tracking-tight group-hover:text-primary transition-colors">{item.actionTask.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1 italic font-medium">{item.actionTask.purpose}</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[40px] p-0">
                        <div className="p-8"><FeedbackDisplay analysis={item} /></div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-32 rounded-[48px] border-2 border-dashed border-border/40 bg-muted/5">
          <div className="h-20 w-20 bg-secondary rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Target className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-3xl font-black tracking-tight mb-4">Henüz Stratejik Planın Yok</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-lg leading-relaxed mb-10">Fotoğraflarını tarayıp senin için özel bir gelişim rotası oluşturmamı ister misin?</p>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-6 px-8 py-4 bg-background rounded-full border border-border/60 shadow-lg">
              <div className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-400" /> <span className="text-xs font-bold uppercase">+50 XP</span></div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2"><Gem className="h-4 w-4 text-cyan-400" /> <span className="text-xs font-bold uppercase">10 AURO</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
