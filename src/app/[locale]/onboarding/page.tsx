'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useUser, useFirestore } from '@/lib/firebase/client-provider';
import { doc, updateDoc } from 'firebase/firestore';
import type { OnboardingResults } from '@/types';
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
  const { user, firestore } = useUser();
  const { toast } = useToast();
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingResults>>({});
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);

    try {
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, {
        onboarded: true,
        onboarding_results: answers,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      console.log("✅ [Onboarding] Progress saved. Redirecting to dashboard...");
      toast({ title: t('toast_success_title'), description: t('toast_success_desc') });
      
      // Nuclear Redirect
      setTimeout(() => {
        window.location.href = window.location.origin + '/dashboard';
      }, 500);
    } catch (e: any) {
      console.error("Onboarding finish error:", e);
      window.alert("Kayıt Hatası: " + e.message);
      toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_desc') });
      setIsSaving(false);
    }
  };

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

        {/* 🛠️ DEBUG SKIP (Only on localhost) */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="text-center mt-8">
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-primary transition-colors"
            >
              [ DEBUG: SKIP ONBOARDING ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}