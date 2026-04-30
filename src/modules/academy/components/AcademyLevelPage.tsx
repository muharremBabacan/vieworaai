'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import type { Lesson, User } from '@/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { uploadAndProcessImage } from '@/lib/image/actions';
import { prepareOptimizedFile } from '@/lib/image/image-processing-final';
import { getLevelFromXp } from '@/lib/gamification';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/shared/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, UploadCloud, Loader2, GraduationCap, Camera, Scan, Lightbulb, Brain } from 'lucide-react';
import { evaluatePracticeSubmission, type EvaluatePracticeSubmissionOutput } from '@/ai/flows/evaluate-practice-submission';
import { useAppConfig } from '@/components/AppConfigProvider';
import { typography } from "@/lib/design/typography";
import { cn } from '@/lib/utils';
import { VieworaImage } from '@/core/components/viewora-image';

const getDeterminsticPlaceholder = (id: string) => {
    const images = ["https://picsum.photos/seed/1/600/400", "https://picsum.photos/seed/2/600/400", "https://picsum.photos/seed/3/600/400", "https://picsum.photos/seed/4/600/400"];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
};

function PracticeSubmission({ lesson, onFeedbackReady }: { lesson: Lesson, onFeedbackReady: (result: any) => void }) {
    const t = useTranslations('AcademyLevelPage');
    const { user, uid } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<EvaluatePracticeSubmissionOutput | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const acceptedFile = acceptedFiles[0];
            setFile(acceptedFile);
            setPreview(URL.createObjectURL(acceptedFile));
            setAnalysisResult(null);
        }
    }, [toast, t]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const handleGetFeedback = async () => {
        if (!file || !uid || !firestore) return;

        setIsUploading(true);
        toast({ title: t('toast_analysis_start_title'), description: t('toast_analysis_start_description') });
        
        try {
            // 📐 Client-side Optimization (Resolution Check + Resize)
            const optimizedFile = await prepareOptimizedFile(file, 1600);

            const photoId = crypto.randomUUID();
            const formData = new FormData();
            formData.append('file', optimizedFile);
            
            // 🔄 Server Action ile Türevleri Üret ve Yükle
            const imageUrlsResponse = await uploadAndProcessImage(formData, uid, photoId, 'academy-practice');
            
            if (!imageUrlsResponse.success) {
                throw new Error(imageUrlsResponse.error || 'Upload failed');
            }

            const imageUrls = imageUrlsResponse.data;
            
            setIsUploading(false);
            setIsAnalyzing(true);

            const result = await evaluatePracticeSubmission({
                photoUrl: imageUrls.analysis,
                practiceTask: lesson.practiceTask,
                analysisCriteria: lesson.analysisCriteria || [],
                language: "tr",
            });

            setAnalysisResult(result);
            onFeedbackReady(result);
            toast({ title: t('toast_feedback_ready_title'), description: t('toast_feedback_ready_description') });

        } catch (error: any) {
            console.error("Analysis failed:", error);
            if (error.message === 'PHOTO_TOO_SMALL') {
                toast({ 
                    variant: 'destructive', 
                    title: t('error_photo_too_small_title'),
                    description: t('error_photo_too_small_description') 
                });
            } else if (error.message === 'Failed to fetch' || (error instanceof TypeError && error.message.includes('fetch'))) {
                toast({ 
                    variant: 'destructive', 
                    title: t('toast_network_error_title'), 
                    description: t('toast_network_error_description') 
                });
            } else {
                toast({ variant: 'destructive', title: t('toast_analysis_fail_title'), description: t('toast_analysis_fail_description') });
            }
        } finally {
            setIsUploading(false);
            setIsAnalyzing(false);
        }
    };
    
    return (
        <Card>
            <CardHeader><CardTitle className={typography.cardTitle}>{t('practice_submission_title')}</CardTitle></CardHeader>
            <CardContent>
                <p className={typography.body}>{t('practice_submission_description')}</p>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                            {isDragActive ? <p className="text-primary">{t('upload_prompt_drag')}</p> : <p className={typography.meta}>{t('upload_prompt_click')} <span className="text-muted-foreground">{t('upload_prompt_drag')}</span></p>}
                        </div>
                        {preview && <div className="mt-4 relative aspect-video rounded-lg overflow-hidden"><img src={preview} alt="Preview" className="object-cover w-full h-full" /></div>}
                    </div>
                    <div className="flex flex-col justify-center items-center">
                        {analysisResult ? (
                            <div className="text-center">
                                <h3 className={typography.cardTitle}>{t('score', { score: analysisResult.score })}</h3>
                                <p className={cn(typography.body, "mt-2")}>{analysisResult.feedback}</p>
                                <Button onClick={() => { setFile(null); setPreview(null); setAnalysisResult(null); }} className={cn(typography.button, "mt-4")}>{t('button_new_photo')}</Button>
                            </div>
                        ) : (
                            <Button onClick={handleGetFeedback} disabled={!file || isUploading || isAnalyzing} className={cn(typography.button, "w-full")}>
                                {(isUploading || isAnalyzing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isAnalyzing ? t('button_evaluating') : t('button_get_feedback')}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function LessonItem({ lesson, isCompleted, onComplete }: { lesson: Lesson; isCompleted: boolean; onComplete: (lessonId: string) => void; }) {
  const t = useTranslations('AcademyLevelPage');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [practiceResult, setPracticeResult] = useState<any | null>(null);
  const { currencyName } = useAppConfig();

  const handleLessonComplete = () => {
      onComplete(lesson.id);
      setIsDialogOpen(false);
  }

  return (
    <>
      <Card className={cn(
        "group overflow-hidden rounded-[28px] border-border/40 bg-card/40 backdrop-blur-sm transition-all duration-500",
        isCompleted ? "opacity-80 grayscale-[0.3]" : "hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1"
      )}>
        <div className="aspect-[4/3] relative overflow-hidden">
          <VieworaImage 
            fallbackUrl={lesson.imageUrl || getDeterminsticPlaceholder(lesson.id)}
            type="featureCover"
            alt={lesson.title}
            containerClassName="w-full h-full"
            className="transition-transform duration-700 group-hover:scale-105"
          />
          {isCompleted && (
            <div className="absolute top-3 right-3 bg-green-500 text-white p-1.5 rounded-full shadow-lg z-10 animate-in zoom-in duration-300">
              <CheckCircle size={14} className="fill-current"/>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent opacity-60 pointer-events-none" />
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="min-h-[3.5rem]">
            <h3 className="text-sm font-black uppercase tracking-tight leading-tight line-clamp-2 transition-colors group-hover:text-primary">{lesson.title}</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 line-clamp-1 opacity-70">{lesson.learningObjective}</p>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsDialogOpen(true)} 
                className="h-8 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary"
            >
                {t('dialog_theory')}
            </Button>
            
            {isCompleted ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 text-green-500 border border-green-500/20">
                <span className="text-[10px] font-black uppercase tracking-tighter">{t('button_completed')}</span>
              </div>
            ) : (
                <Button 
                    size="sm" 
                    onClick={handleLessonComplete} 
                    disabled={!practiceResult || practiceResult.score < 7} 
                    className="h-8 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                    {t('button_complete_lesson', { xp: 10, Pix: 1 })}
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle className={typography.cardTitle}>{lesson.title}</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6">
                <Accordion type="multiple" defaultValue={['objective', 'theory']} className="w-full">
                    <AccordionItem value="objective"><AccordionTrigger className={typography.cardTitle}>{t('dialog_objective')}</AccordionTrigger><AccordionContent className={typography.body}>{lesson.learningObjective}</AccordionContent></AccordionItem>
                    <AccordionItem value="theory"><AccordionTrigger className={typography.cardTitle}>{t('dialog_theory')}</AccordionTrigger><AccordionContent className={cn(typography.body, "prose prose-sm dark:prose-invert")}>{lesson.theory}</AccordionContent></AccordionItem>
                    <AccordionItem value="criteria"><AccordionTrigger className={typography.cardTitle}>{t('dialog_criteria')}</AccordionTrigger><AccordionContent><ul className={cn(typography.body, "list-disc pl-5 space-y-1")}>{(lesson.analysisCriteria || []).map((c, i) => <li key={i}>{c}</li>)}</ul></AccordionContent></AccordionItem>
                    <AccordionItem value="task"><AccordionTrigger className={typography.cardTitle}>{t('dialog_task')}</AccordionTrigger><AccordionContent className={typography.body}>{lesson.practiceTask}</AccordionContent></AccordionItem>
                    <AccordionItem value="auro-note"><AccordionTrigger className={cn(typography.cardTitle, "text-cyan-400")}>{t('dialog_Pix_note')}</AccordionTrigger><AccordionContent className={cn(typography.body, "italic")}>{lesson.auroNote}</AccordionContent></AccordionItem>
                </Accordion>
                <PracticeSubmission lesson={lesson} onFeedbackReady={setPracticeResult} />
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AcademyLevelPage() {
    const t = useTranslations('AcademyLevelPage');
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user, uid, isFirebaseReady, profile: userProfile, isProfileLoading } = useUser();
    const { toast } = useToast();
    const { currencyName } = useAppConfig();

    const level = params?.level as string;
    const levelFormatted = useMemo(() => level ? level.charAt(0).toUpperCase() + level.slice(1) : '', [level]);
    
    // ALL HOOKS CALLED AT TOP
    const lessonsQuery = useMemoFirebase(() => 
        (firestore && levelFormatted && isFirebaseReady) ? query(collection(firestore, 'academy_lessons'), where('level', '==', levelFormatted), orderBy('createdAt', 'desc')) : null,
        [firestore, levelFormatted, isFirebaseReady]
    );
    const { data: lessons, isLoading: lessonsLoading } = useCollection<Lesson>(lessonsQuery);

    const userProgressQuery = useMemoFirebase(() =>
      (uid && !uid.includes('@') && firestore && isFirebaseReady) ? collection(firestore, 'users', uid, 'lessonProgress') : null,
      [uid, firestore, isFirebaseReady]
    );
    const { data: progressData } = useCollection<{ lessonId: string; isCompleted: boolean }>(userProgressQuery, { requireAuth: true });

    const completedLessonIds = useMemo(() => {
        if (!progressData) return new Set();
        return new Set(progressData.filter(p => p.isCompleted).map(p => p.lessonId));
    }, [progressData]);

    const groupedLessons = useMemo(() => {
        if (!lessons) return {};
        return lessons.reduce((acc, lesson) => {
            const category = lesson.category || t('category_other');
            if (!acc[category]) acc[category] = [];
            acc[category].push(lesson);
            return acc;
        }, {} as Record<string, Lesson[]>);
    }, [lessons, t]);

    const lessonsInCategoryCount = lessons?.length || 0;

    const handleCompleteLesson = useCallback(async (lessonId: string) => {
        if (!uid || !firestore || !userProfile) return;

        const batch = writeBatch(firestore);
        const progressRef = doc(firestore, 'users', uid, 'lessonProgress', lessonId);
        const userRef = doc(firestore, 'users', uid);
        
        const xpGain = 10;
        const pixGain = 1;

        batch.set(progressRef, { lessonId, isCompleted: true, completedAt: new Date().toISOString() });
        batch.update(userRef, { 
            current_xp: increment(xpGain),
            pix_balance: increment(pixGain),
            'profile_index.activity_signals.learning_score': increment(5) 
        });

        await batch.commit();
        toast({
        title: t('toast_reward_title'),
        description: t('toast_reward_description', { xp: xpGain, Pix: pixGain }),
      });

        const oldLevel = getLevelFromXp(userProfile.current_xp);
        const newLevel = getLevelFromXp(userProfile.current_xp + xpGain);

        if (newLevel.name !== oldLevel.name) {
            await updateDoc(userRef, { level_name: newLevel.name });
            toast({ title: t('toast_level_up_title'), description: t('toast_level_up_description', { level: newLevel.name }) });
        }
    }, [firestore, userProfile, toast, t, uid, user]);

    if (isProfileLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    }
    
    const getCategoryIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('pozlama') || cat.includes('exposure')) return <Camera className="h-5 w-5 text-blue-400" />;
        if (cat.includes('kompozisyon') || cat.includes('composition')) return <Scan className="h-5 w-5 text-purple-400" />;
        if (cat.includes('ışık') || cat.includes('light')) return <Lightbulb className="h-5 w-5 text-amber-400" />;
        if (cat.includes('giriş') || cat.includes('intro')) return <GraduationCap className="h-5 w-5 text-green-400" />;
        return <Brain className="h-5 w-5 text-primary" />;
    };

    return (
        <div className="container mx-auto px-4 pt-6 pb-24">
            <header className="mb-12">
                <Button variant="ghost" onClick={() => router.push('/academy')} className="mb-6 h-8 rounded-xl px-0 font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-transparent hover:text-primary transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('button_back_to_academy')}
                </Button>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">{levelFormatted} <span className="text-primary block sm:inline">{t('page_title_suffix')}</span></h1>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                         <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> 
                         {lessonsInCategoryCount} Ders Mevcut
                    </div>
                </div>
            </header>

            {lessonsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-6">
                            <Skeleton className="h-10 w-2/3 rounded-2xl" />
                            <div className="space-y-4">
                                {[...Array(3)].map((_, j) => (
                                    <Skeleton key={j} className="h-64 w-full rounded-[28px]" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : Object.keys(groupedLessons).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-start">
                    {Object.entries(groupedLessons).map(([category, lessonsInCategory]) => (
                        <section key={category} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: '0.1s' }}>
                            <div className="flex items-center gap-3 pb-4 border-b border-border/40">
                                <div className="p-2.5 rounded-2xl bg-secondary/50 border border-border/40 shadow-inner">
                                    {getCategoryIcon(category)}
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tighter transition-colors select-none">{category}</h2>
                            </div>
                            <div className="flex flex-col gap-6">
                                {lessonsInCategory.map(lesson => (
                                    <LessonItem 
                                        key={lesson.id} 
                                        lesson={lesson} 
                                        isCompleted={completedLessonIds.has(lesson.id)} 
                                        onComplete={handleCompleteLesson} 
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-card/20 rounded-[40px] border border-dashed border-border/60">
                    <GraduationCap size={64} className="mx-auto text-muted-foreground/30 mb-6" />
                    <h2 className="text-2xl font-black uppercase tracking-tight mb-2">{t('no_lessons_title')}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('no_lessons_description')}</p>
                </div>
            )}
        </div>
    );
}
