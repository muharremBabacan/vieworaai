
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, orderBy, limit, doc, writeBatch, increment } from 'firebase/firestore';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import type { User, Photo, StoredStrategicFeedback, AnalysisLog, UserTier } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, History, Target, Compass, Award, Gem, CheckCircle2, ChevronRight, BarChart3, Info, TrendingUp, Lock, Zap, Diamond } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useRouter } from 'next/navigation';
import { typography } from "@/lib/design/typography";
import { canAccess } from '@/lib/auth/canAccess';
import { useTranslations } from 'next-intl';

const MENTOR_COSTS: Record<UserTier, number> = {
  start: 2,
  pro: 5,
  master: 10
};

function FeedbackDisplay({ analysis }: { analysis: StoredStrategicFeedback }) {
  const t = useTranslations('LumaMentorPage');
  const steps = analysis?.actionTask?.steps || [];
  const evalQuestions = analysis?.actionTask?.evaluationQuestions || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="rounded-[32px] border-primary/20 bg-primary/5 shadow-xl overflow-hidden">
        <CardHeader className="p-8 border-b border-primary/10">
          <CardTitle className={cn(typography.cardTitle, "text-2xl font-black flex items-center gap-3")}>
            <Compass className="h-6 w-6 text-primary" /> {t('analysis_card_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <p className={cn(typography.subtitle, "text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium")}>
            {analysis.feedback}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-border/40 bg-secondary/20">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black tracking-widest uppercase">{t('task_card_badge')}</Badge>
            <span className={cn(typography.meta, "font-bold uppercase")}>{new Date(analysis.createdAt).toLocaleDateString()}</span>
          </div>
          <CardTitle className={cn(typography.h1, "text-3xl uppercase")}>{analysis.actionTask?.title || t('task_card_default_title')}</CardTitle>
          <CardDescription className={cn(typography.subtitle, "text-base font-bold mt-2 italic")}>“{analysis.actionTask?.purpose || ""}”</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid gap-4">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl bg-muted/30 border border-border/40 hover:border-primary/30 transition-colors group">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-sm group-hover:scale-110 transition-transform">{i + 1}</div>
                <p className={cn(typography.body, "text-sm font-bold leading-relaxed")}>{step}</p>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-border/40">
            <h4 className={cn(typography.eyebrow, "text-primary mb-6 flex items-center gap-2")}>
              <CheckCircle2 className="h-4 w-4" /> {t('eval_questions_title')}
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {evalQuestions.map((q, i) => (
                <div key={i} className={cn(typography.meta, "p-4 rounded-xl border border-dashed border-border/60 bg-muted/10 font-medium italic leading-relaxed")}>
                  "{q}"
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LumaMentorPage() {
  const t = useTranslations('LumaMentorPage');
  const { user, uid, isFirebaseReady, profile: userProfile, isProfileLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<StoredStrategicFeedback | null>(null);

  const historyQuery = useMemoFirebase(() => {
    if (!uid || !firestore || !isFirebaseReady) return null;
    return query(
      collection(firestore, 'users', uid, 'strategic_feedbacks'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [uid, firestore, isFirebaseReady]);
  const { data: history, isLoading: isHistoryLoading } = useCollection<StoredStrategicFeedback>(historyQuery, { requireAuth: true });

  const photosQuery = useMemoFirebase(() => {
    if (!uid || !firestore || !isFirebaseReady) return null;
    return query(
      collection(firestore, 'users', uid, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [uid, firestore, isFirebaseReady]);
  const { data: photos } = useCollection<Photo>(photosQuery, { requireAuth: true });

  const hasAccessToAnalysis = canAccess(userProfile, "mentorAnalysis");
  const currentTier = userProfile?.tier || 'start';
  const strategicCost = MENTOR_COSTS[currentTier];

  const handleStartAnalysis = async () => {
    if (!user || !userProfile || !firestore || !photos || !hasAccessToAnalysis) {
      if (!hasAccessToAnalysis) {
        toast({
          variant: 'destructive',
          title: t('toast_no_access'),
          description: t('toast_no_access_desc'),
        });
      }
      return;
    }

    if (userProfile.pix_balance < strategicCost) {
      toast({
        variant: 'destructive',
        title: t('toast_insufficient_Pix', { currency: currencyName }),
        description: t('toast_insufficient_Pix_desc', { cost: strategicCost, currency: currencyName }),
        action: (
          <Button variant="outline" size="sm" onClick={() => router.push('/pricing')}>
            Pix Yükle
          </Button>
        )
      });
      return;
    }

    const analyzedPhotos = photos.filter(p => !!p.aiFeedback);
    if (analyzedPhotos.length < 3) {
      toast({
        variant: 'destructive',
        title: t('toast_data_insufficient'),
        description: t('toast_data_insufficient_desc'),
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
        language: userProfile.language || 'tr'
      });

      const feedbackData: Omit<StoredStrategicFeedback, 'id'> = {
        ...result,
        createdAt: new Date().toISOString()
      };

      const batch = writeBatch(firestore);
      const feedbackRef = doc(collection(firestore, 'users', uid, 'strategic_feedbacks'));
      const logRef = doc(collection(firestore, 'analysis_logs'));
      const userRef = doc(firestore, 'users', uid);

      batch.set(feedbackRef, { ...feedbackData, id: feedbackRef.id });
      batch.update(userRef, {
        pix_balance: increment(-strategicCost),
        total_mentor_analyses_count: increment(1)
      });

      batch.set(logRef, {
        id: logRef.id,
        userId: uid,
        userName: userProfile.name || 'Sanatçı',
        type: 'mentor',
        pixSpent: strategicCost,
        timestamp: feedbackData.createdAt,
        status: 'success'
      } as any);

      await batch.commit();
      
      setCurrentAnalysis({ ...feedbackData, id: feedbackRef.id });
      toast({ title: t('toast_success') });

    } catch (error: any) {
      toast({ variant: 'destructive', title: t('toast_error'), description: t('toast_error_desc') });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTierIcon = (tier: UserTier) => {
    switch (tier) {
      case 'start': return <Zap size={12} />;
      case 'pro': return <Sparkles size={12} />;
      case 'master': return <Diamond size={12} />;
      default: return null;
    }
  };

  if (isProfileLoading || isHistoryLoading) {
    return <div className="container mx-auto px-4 py-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-12 space-y-1">
        <p className={cn(typography.eyebrow, "ml-1")}>{t('eyebrow')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className={cn(typography.h1, "leading-none uppercase")}>{t('title')}</h1>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[9px] h-7 px-4 rounded-full flex items-center gap-2">
            {getTierIcon(currentTier)}
            {t('tier_badge_prefix')} {currentTier.toUpperCase()} {t('tier_badge_suffix')}
          </Badge>
        </div>
        <p className={cn(typography.subtitle, "opacity-80 pt-2")}>{t('subtitle')}</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-12">
        {!currentAnalysis && (
          <div className="relative p-10 md:p-16 border-2 border-dashed border-border/60 rounded-[48px] bg-card/30 hover:bg-card/40 transition-all group shadow-inner overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="text-center md:text-left space-y-4 max-w-md">
                <h2 className={cn(typography.h1, "uppercase leading-tight")}>{t('start_card_title')}</h2>
                <p className={cn(typography.h2, "text-xl md:text-2xl font-bold text-muted-foreground")}>{t('start_card_subtitle')}</p>
                <p className={cn(typography.body, "text-muted-foreground/70")}>{t('start_card_desc')}</p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <Sparkles className="text-primary" size={40} />
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  <Button 
                    onClick={handleStartAnalysis} 
                    disabled={isAnalyzing || !hasAccessToAnalysis}
                    className={cn(typography.button, "px-12 h-14 rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95", !hasAccessToAnalysis && "bg-secondary text-muted-foreground border-border")}
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin h-5 w-5" /> : (
                      <>
                        {!hasAccessToAnalysis && <Lock className="mr-2 h-4 w-4" />}
                        {t('button_start', { cost: strategicCost, currency: currencyName })}
                      </>
                    )}
                  </Button>
                  
                  <div className="flex items-center gap-4 px-4 py-2 bg-background/50 backdrop-blur-sm rounded-full border border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-amber-400" /> 
                      <span className={cn(typography.meta, "font-black uppercase tracking-widest text-[9px]")}>+50 XP</span>
                    </div>
                    <div className="w-px h-3 bg-border" />
                    <div className="flex items-center gap-1.5">
                      <Gem className="h-3.5 w-3.5 text-cyan-400" /> 
                      <span className={cn(typography.meta, "font-black uppercase tracking-widest text-[9px]")}>{userProfile?.pix_balance} {currencyName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentAnalysis && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
              <Badge className="bg-primary/10 text-primary border-primary/20 font-black h-6 uppercase tracking-widest px-3">{t('plan_ready_badge')}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setCurrentAnalysis(null)} className={cn(typography.button, "rounded-xl font-bold text-muted-foreground")}>{t('button_close')}</Button>
            </div>
            <FeedbackDisplay analysis={currentAnalysis} />
          </div>
        )}

        {history && history.length > 0 && (
          <div className="space-y-6 pt-12 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 ml-2">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center"><History size={16} className="text-muted-foreground" /></div>
              <h3 className={typography.eyebrow}>{t('prev_routes_title')}</h3>
            </div>
            
            <div className="grid gap-4">
              {history.map((item, idx) => (
                <Dialog key={item.id}>
                  <DialogTrigger asChild>
                    <Card className="rounded-[24px] border-border/40 bg-card/20 hover:border-primary/30 transition-all duration-300 cursor-pointer group shadow-sm">
                      <CardContent className="p-6 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(typography.meta, "font-black text-primary uppercase tracking-widest")}>{new Date(item.createdAt).toLocaleDateString()}</span>
                            <div className="h-1 w-1 rounded-full bg-border" />
                            <span className={cn(typography.meta, "font-bold uppercase")}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                          </div>
                          <h4 className={cn(typography.cardTitle, "tracking-tight group-hover:text-primary transition-colors")}>{item.actionTask?.title || t('task_card_default_title')}</h4>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[40px] p-0 border-border/40 bg-background/95 backdrop-blur-xl">
                    <div className="p-8">
                      <DialogHeader className="mb-8">
                        <DialogTitle className={cn(typography.h1, "text-3xl flex items-center gap-3 uppercase")}>
                          <Target className="h-7 w-7 text-primary" /> {t('history_dialog_title')}
                        </DialogTitle>
                      </DialogHeader>
                      <FeedbackDisplay analysis={item} />
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
