
'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import type { Lesson, User } from '@/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, arrayUnion, writeBatch, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { getLevelFromXp, levels } from '@/lib/gamification';

import { useDropzone } from 'react-dropzone';
import { useToast } from '@/shared/hooks/use-toast';
import { useTranslations } from 'next-intl';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CheckCircle, Award, Sparkles, UploadCloud, Loader2 } from 'lucide-react';
import { evaluatePracticeSubmission, type EvaluatePracticeSubmissionOutput } from '@/ai/flows/evaluate-practice-submission';

// Helper function to find a placeholder image
const findPlaceholderImage = (hint: string) => {
    return `https://picsum.photos/seed/${hint.replace(/\s+/g, '')}/600/400`;
};

function PracticeSubmission({ lesson, onFeedbackReady }: { lesson: Lesson, onFeedbackReady: (result: any) => void }) {
    const t = useTranslations('AcademyLevelPage');
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<EvaluatePracticeSubmissionOutput | null>(null);
    const locale = "tr";

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const acceptedFile = acceptedFiles[0];
            if (acceptedFile.size > 10 * 1024 * 1024) { // 10MB
                toast({
                    variant: 'destructive',
                    title: t('toast_file_size_title'),
                    description: t('toast_file_size_description'),
                });
                return;
            }
            setFile(acceptedFile);
            setPreview(URL.createObjectURL(acceptedFile));
            setAnalysisResult(null); // Reset previous result
        }
    }, [toast, t]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const handleGetFeedback = async () => {
        if (!file || !user || !firestore) return;

        setIsUploading(true);
        toast({
            title: t('toast_analysis_start_title'),
            description: t('toast_analysis_start_description'),
        });
        
        try {
            const storage = getStorage();
            const filePath = `users/${user.uid}/practice-submissions/${lesson.id}/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, filePath);
            const uploadResult = await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(uploadResult.ref);

            setIsUploading(false);
            setIsAnalyzing(true);

            const result = await evaluatePracticeSubmission({
                photoUrl: imageUrl,
                practiceTask: lesson.practiceTask,
                analysisCriteria: lesson.analysisCriteria,
                language: locale,
            });

            setAnalysisResult(result);
            onFeedbackReady(result); // Pass result to parent
            toast({
                title: t('toast_feedback_ready_title'),
                description: t('toast_feedback_ready_description'),
            });

        } catch (error) {
            console.error("Analysis failed:", error);
            toast({
                variant: 'destructive',
                title: t('toast_analysis_fail_title'),
                description: t('toast_analysis_fail_description'),
            });
        } finally {
            setIsUploading(false);
            setIsAnalyzing(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('practice_submission_title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-sm mb-4">{t('practice_submission_description')}</p>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div 
                            {...getRootProps()} 
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                        >
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                            {isDragActive ? (
                                <p className="text-primary">{t('upload_prompt_drag')}</p>
                            ) : (
                                <p>{t('upload_prompt_click')} <span className="text-muted-foreground">{t('upload_prompt_drag')}</span></p>
                            )}
                        </div>

                        {preview && (
                            <div className="mt-4 relative aspect-video rounded-lg overflow-hidden">
                                <Image src={preview} alt="Preview" fill className="object-cover" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col justify-center items-center">
                        {analysisResult ? (
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">{t('score', { score: analysisResult.score })}</h3>
                                <p className="mt-2 text-muted-foreground">{analysisResult.feedback}</p>
                                <Button onClick={() => { setFile(null); setPreview(null); setAnalysisResult(null); }} className="mt-4">{t('button_new_photo')}</Button>
                            </div>
                        ) : (
                            <Button onClick={handleGetFeedback} disabled={!file || isUploading || isAnalyzing} className="w-full">
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

  const handleLessonComplete = () => {
      onComplete(lesson.id);
      setIsDialogOpen(false);
  }

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-video">
          <Image
            src={lesson.imageUrl || findPlaceholderImage(lesson.imageHint)}
            alt={lesson.title}
            fill
            className="object-cover"
            data-ai-hint={lesson.imageHint}
          />
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold">{lesson.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{lesson.learningObjective}</p>
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>{t('dialog_theory')}</Button>
            {isCompleted ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-green-500">
                <CheckCircle className="h-4 w-4" /> {t('button_completed')}
              </span>
            ) : (
                <Button size="sm" onClick={handleLessonComplete} disabled={!practiceResult || practiceResult.score < 7}>
                    {t('button_complete_lesson', { xp: 10, auro: 1 })}
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{lesson.title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6">
                <Accordion type="multiple" defaultValue={['objective', 'theory']} className="w-full">
                    <AccordionItem value="objective">
                        <AccordionTrigger>{t('dialog_objective')}</AccordionTrigger>
                        <AccordionContent>{lesson.learningObjective}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="theory">
                        <AccordionTrigger>{t('dialog_theory')}</AccordionTrigger>
                        <AccordionContent className="prose prose-sm dark:prose-invert">{lesson.theory}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="criteria">
                        <AccordionTrigger>{t('dialog_criteria')}</AccordionTrigger>
                        <AccordionContent>
                            <ul className="list-disc pl-5 space-y-1">
                                {lesson.analysisCriteria.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="task">
                        <AccordionTrigger>{t('dialog_task')}</AccordionTrigger>
                        <AccordionContent>{lesson.practiceTask}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="auro-note">
                        <AccordionTrigger className="text-cyan-400">{t('dialog_auro_note')}</AccordionTrigger>
                        <AccordionContent className="italic">{lesson.auroNote}</AccordionContent>
                    </AccordionItem>
                </Accordion>
                <PracticeSubmission lesson={lesson} onFeedbackReady={setPracticeResult} />
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AcademyLevelPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const t = useTranslations('AcademyLevelPage');

    const level = params.level as string;
    const levelFormatted = level.charAt(0).toUpperCase() + level.slice(1);
    
    // Validate level
    const validLevels = ['temel', 'orta', 'ileri'];
    if (!validLevels.includes(level)) {
        return (
            <div className="container text-center">
                <h1 className="text-2xl font-bold">{t('invalid_level_title')}</h1>
                <p className="text-muted-foreground">{t('invalid_level_description')}</p>
                <Button onClick={() => router.push('/academy')} className="mt-4">{t('button_back_to_academy')}</Button>
            </div>
        );
    }
    
    const lessonsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'academyLessons'), where('level', '==', levelFormatted)) : null,
        [firestore, levelFormatted]
    );

    const { data: lessons, isLoading: lessonsLoading } = useCollection<Lesson>(lessonsQuery);

    const userProgressQuery = useMemoFirebase(() =>
      user ? collection(firestore, 'users', user.uid, 'lessonProgress') : null,
      [user, firestore]
    );
    const { data: progressData } = useCollection<{ lessonId: string; isCompleted: boolean }>(userProgressQuery);

    const userProfileQuery = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null, 
        [user, firestore]
    );
    const { data: userProfile } = useDoc<User>(userProfileQuery);


    const completedLessonIds = useMemo(() => {
        if (!progressData) return new Set();
        return new Set(progressData.filter(p => p.isCompleted).map(p => p.lessonId));
    }, [progressData]);

    const groupedLessons = useMemo(() => {
        if (!lessons) return {};
        return lessons.reduce((acc, lesson) => {
            const category = lesson.category || t('category_other');
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(lesson);
            return acc;
        }, {} as Record<string, Lesson[]>);
    }, [lessons, t]);

    const handleCompleteLesson = async (lessonId: string) => {
        if (!user || !firestore || !userProfile) return;

        const batch = writeBatch(firestore);
        const progressRef = doc(firestore, 'users', user.uid, 'lessonProgress', lessonId);
        const userRef = doc(firestore, 'users', user.uid);
        
        const xpGain = 10;
        const auroGain = 1;

        batch.set(progressRef, { lessonId, isCompleted: true, completedAt: new Date().toISOString() });
        batch.update(userRef, { 
            current_xp: increment(xpGain),
            auro_balance: increment(auroGain)
        });

        try {
            await batch.commit();

            toast({ title: t('toast_reward_title'), description: t('toast_reward_description', { xp: xpGain, auro: auroGain }) });

            const oldLevel = getLevelFromXp(userProfile.current_xp);
            const newLevel = getLevelFromXp(userProfile.current_xp + xpGain);

            if (newLevel.name !== oldLevel.name) {
                await updateDoc(userRef, { level_name: newLevel.name });
                toast({ title: t('toast_level_up_title'), description: t('toast_level_up_description', { level: newLevel.name }) });
                if (newLevel.isMentor && !oldLevel.isMentor) {
                    await updateDoc(userRef, { is_mentor: true });
                    toast({ title: t('toast_mentor_title'), description: t('toast_mentor_description') });
                }
            }

        } catch (error) {
            console.error("Error completing lesson:", error);
        }
    };
    
    return (
        <div className="container mx-auto">
            <Button variant="ghost" onClick={() => router.push('/academy')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('button_back_to_academy')}
            </Button>
            <h1 className="text-3xl font-bold tracking-tight mb-8">{levelFormatted} Seviye Dersleri</h1>
            {lessonsLoading ? (
                <div className="space-y-8">
                    {[...Array(2)].map((_, i) => (
                        <div key={i}>
                            <Skeleton className="h-8 w-1/4 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(3)].map((_, j) => (
                                    <Card key={j}>
                                        <Skeleton className="aspect-video" />
                                        <CardContent className="p-4">
                                            <Skeleton className="h-5 w-3/4 mb-2" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : Object.keys(groupedLessons).length > 0 ? (
                <div className="space-y-8">
                    {Object.entries(groupedLessons).map(([category, lessonsInCategory]) => (
                        <section key={category}>
                            <h2 className="text-2xl font-semibold mb-4">{category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="text-center py-16">
                     <h2 className="text-xl font-semibold">{t('no_lessons_title')}</h2>
                    <p className="text-muted-foreground mt-2">{t('no_lessons_description')}</p>
                </div>
            )}
        </div>
    );
}
