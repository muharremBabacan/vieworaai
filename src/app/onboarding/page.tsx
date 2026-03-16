
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { User, OnboardingResults, UserProfileIndex } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  Loader2, Smartphone, Camera, Layers, Users, Map, Utensils, 
  Share2, Palette, Zap, Layout, Eye, XCircle, Settings, Sliders, 
  Heart, GraduationCap, Briefcase, AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/core/components/logo';
import { useTranslations } from 'next-intl';

type Question = {
  id: keyof OnboardingResults;
  text: string;
  options: {
    id: string;
    label: string;
    icon: any;
    color: string;
  }[];
};

export default function OnboardingPage() {
  const t = useTranslations('OnboardingPage');
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingResults>>({});
  const [isSaving, setIsCreating] = useState(false);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const questions: Question[] = [
    {
      id: 'device_type',
      text: t('q.device_type.text'),
      options: [
        { id: 'mobile', label: t('q.device_type.mobile'), icon: Smartphone, color: 'text-blue-400' },
        { id: 'camera', label: t('q.device_type.camera'), icon: Camera, color: 'text-purple-400' },
        { id: 'hybrid', label: t('q.device_type.hybrid'), icon: Layers, color: 'text-cyan-400' },
      ]
    },
    {
      id: 'interest',
      text: t('q.interest.text'),
      options: [
        { id: 'portrait', label: t('q.interest.portrait'), icon: Users, color: 'text-pink-400' },
        { id: 'landscape', label: t('q.interest.landscape'), icon: Map, color: 'text-green-400' },
        { id: 'street', label: t('q.interest.street'), icon: Map, color: 'text-orange-400' },
        { id: 'food', label: t('q.interest.food'), icon: Utensils, color: 'text-yellow-400' },
        { id: 'social', label: t('q.interest.social'), icon: Share2, color: 'text-blue-500' },
        { id: 'art', label: t('q.interest.art'), icon: Palette, color: 'text-red-400' },
      ]
    },
    {
      id: 'approach',
      text: t('q.approach.text'),
      options: [
        { id: 'lighting', label: t('q.approach.lighting'), icon: Zap, color: 'text-amber-400' },
        { id: 'composition', label: t('q.approach.composition'), icon: Layout, color: 'text-indigo-400' },
        { id: 'casual', label: t('q.approach.casual'), icon: Eye, color: 'text-teal-400' },
      ]
    },
    {
      id: 'technical_level',
      text: t('q.technical_level.text'),
      options: [
        { id: 'beginner', label: t('q.technical_level.beginner'), icon: XCircle, color: 'text-slate-400' },
        { id: 'intermediate', label: t('q.technical_level.intermediate'), icon: Settings, color: 'text-orange-400' },
        { id: 'advanced', label: t('q.technical_level.advanced'), icon: Sliders, color: 'text-red-500' },
      ]
    },
    {
      id: 'motivation',
      text: t('q.motivation.text'),
      options: [
        { id: 'social', label: t('q.motivation.social'), icon: Share2, color: 'text-blue-400' },
        { id: 'hobby', label: t('q.motivation.hobby'), icon: Heart, color: 'text-pink-500' },
        { id: 'learning', label: t('q.motivation.learning'), icon: GraduationCap, color: 'text-emerald-400' },
        { id: 'professional', label: t('q.motivation.professional'), icon: Briefcase, color: 'text-amber-600' },
      ]
    }
  ];

  const handleSelect = (questionId: keyof OnboardingResults, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    if (step < questions.length - 1) setTimeout(() => setStep(s => s + 1), 300);
  };

  const handleFinish = async () => {
    if (!user || !firestore || isSaving) return;
    setIsCreating(true);

    const results = answers as OnboardingResults;
    
    // Vizyoner DNA - İki Katmanlı Başlangıç İndeksi
    const initialProfileIndex: UserProfileIndex = {
      dominant_style: results.interest,
      strengths: results.approach === 'casual' ? [] : [results.approach],
      weaknesses: [],
      dominant_technical_level: results.technical_level,
      trend: { direction: 'stagnant', percentage: 0 },
      consistency_gap: 0,
      profile_index_score: results.technical_level === 'advanced' ? 70 : results.technical_level === 'intermediate' ? 50 : 30,
      
      // 1. Teknik Katman (AI Fotoğraf Analizi Kaynaklı)
      technical: {
        composition: results.approach === 'composition' ? 6 : 4,
        light: results.approach === 'lighting' ? 6 : 4,
        technical_clarity: results.technical_level === 'advanced' ? 7 : results.technical_level === 'intermediate' ? 5 : 3,
        boldness: 4,
        storytelling: 4
      },

      // 2. Davranış Katmanı / Aktivite Sinyalleri (Kullanıcı Aktiviteleri Kaynaklı)
      activity_signals: {
        learning_score: 0,
        competition_score: 0,
        exhibition_score: 0,
        group_activity_score: 0
      },

      communication_profile: {
        tone: results.motivation === 'professional' ? 'direct' : 'supportive',
        explanation_depth: results.technical_level === 'beginner' ? 'medium' : 'high',
        challenge_level: results.technical_level === 'advanced' ? 4 : 2
      }
    };

    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        onboarded: true,
        onboarding_results: results,
        profile_index: initialProfileIndex,
        interests: [results.interest]
      });
      toast({ title: t('toast_success_title'), description: t('toast_success_desc') });
      router.push('/dashboard');
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_desc') });
      setIsCreating(false);
    }
  };

  if (isProfileLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  const currentQuestion = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 md:pt-20 animate-in fade-in duration-700">
      <div className="max-w-2xl w-full space-y-12">
        <header className="flex flex-col items-center text-center space-y-6">
          <Logo className="scale-75" />
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary font-bold animate-pulse mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-xs uppercase tracking-widest">{t('analysis_title')}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase">{t('analysis_title')}</h1>
            <p className="text-muted-foreground font-medium">{t('analysis_subtitle')}</p>
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('step_label')} {step + 1} / {questions.length}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-10 md:p-16 space-y-10">
            <h2 className="text-2xl md:text-3xl font-black text-center leading-tight">{currentQuestion.text}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.id;
                return (
                  <button key={opt.id} onClick={() => handleSelect(currentQuestion.id, opt.id)} className={cn("flex items-center gap-4 p-6 rounded-3xl border-2 text-left transition-all group active:scale-95", isSelected ? "border-primary bg-primary/10 shadow-lg shadow-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/30")}>
                    <div className={cn("p-3 rounded-2xl bg-secondary transition-colors group-hover:bg-background", opt.color)}><opt.icon className="h-6 w-6" /></div>
                    <span className="font-bold text-lg">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between pt-6 border-t border-border/20">
              <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="font-black uppercase tracking-widest text-[10px]">{t('back_button')}</Button>
              {step === questions.length - 1 ? (
                <Button onClick={handleFinish} disabled={!answers[currentQuestion.id] || isSaving} className="px-10 h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">{isSaving ? <Loader2 className="animate-spin" /> : t('finish_button')}</Button>
              ) : (
                <Button variant="secondary" onClick={() => setStep(s => s + 1)} disabled={!answers[currentQuestion.id]} className="font-black uppercase tracking-widest text-[10px]">{t('next_button')}</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
