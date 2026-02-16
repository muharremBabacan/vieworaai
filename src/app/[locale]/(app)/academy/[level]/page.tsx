'use client';

import { useState, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection, useStorage } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { evaluatePracticeSubmission, type EvaluatePracticeSubmissionOutput } from '@/ai/flows/evaluate-practice-submission';
import type { User as UserProfile } from '@/types';
import type { Lesson as AcademyLesson } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen, Camera, Info, Target, FileText, Bot, AlertTriangle, UploadCloud, X, Loader2, Zap, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getLevelFromXp } from '@/lib/gamification';
import { cn } from '@/lib/utils';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';


// Helper to map URL slugs to Firestore level names and titles
const levelSlugMap: Record<string, { name: 'Temel' | 'Orta' | 'İleri'; title: string }> = {
    'temel': { name: 'Temel', title: 'Temel Seviye Dersleri' },
    'orta': { name: 'Orta', title: 'Orta Seviye Dersleri' },
    'ileri': { name: 'İleri', title: 'İleri Seviye Dersleri' }
};

const levelCategoryMap: Record<string, string[]> = {
  'Temel': ["Fotoğrafçılığa Giriş", "Pozlama Temelleri", "Netlik ve Odaklama", "Temel Kompozisyon", "Işık Bilgisi"],
  'Orta': ["Tür Bazlı Çekim Teknikleri", "İleri Pozlama Teknikleri", "Işık Yönetimi", "Görsel Hikâye Anlatımı", "Post-Prodüksiyon Temelleri"],
  'İleri': ["Uzmanlık Alanı Derinleşme", "Profesyonel Işık Kurulumu", "Gelişmiş Teknikler", "Sanatsal Kimlik ve Stil", "Ticari ve Marka Konumlandırma"],
};

function PracticeSubmission({ lesson }: { lesson: AcademyLesson }) {
  const t = useTranslations('AcademyLevelPage');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EvaluatePracticeSubmissionOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const storage = useStorage();
  const params = useParams();
  const locale = params.locale as string;

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
         toast({
          variant: 'destructive',
          title: t('toast_file_size_title'),
          description: t('toast_file_size_description'),
        });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setResult(null); // Clear previous result
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };

  const handleAnalyze = async () => {
    if (!file || !authUser) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen önce bir fotoğraf seçin.' });
      return;
    }

    setIsAnalyzing(true);
    toast({ title: t('toast_analysis_start_title'), description: t('toast_analysis_start_description') });

    const filePath = `users/${authUser.uid}/practice-submissions/${Date.now()}-${file.name}`;
    const imageRef = storageRef(storage, filePath);
    
    let downloadURL;
    try {
      await uploadBytes(imageRef, file);
      downloadURL = await getDownloadURL(imageRef);
    } catch (storageError) {
      console.error("Storage upload failed:", storageError);
      toast({
        variant: 'destructive',
        title: t('toast_upload_fail_title'),
        description: t('toast_upload_fail_description'),
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      const analysisResult = await evaluatePracticeSubmission({
        photoUrl: downloadURL,
        practiceTask: lesson.practiceTask,
        analysisCriteria: lesson.analysisCriteria,
        language: locale,
      });
      setResult(analysisResult);
      toast({ title: t('toast_feedback_ready_title'), description: t('toast_feedback_ready_description') });
    } catch (error) {
      console.error('Practice analysis failed:', error);
      toast({
        variant: 'destructive',
        title: t('toast_analysis_fail_title'),
        description: t('toast_analysis_fail_description'),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="mt-4 space-y-4 rounded-lg border bg-background/50 p-4">
      <h4 className="font-semibold text-card-foreground">{t('practice_submission_title')}</h4>
      <p className="text-sm text-muted-foreground -mt-3">{t('practice_submission_description')}</p>
      
      {result ? (
        <Card className={cn("border-2", result.isSuccess ? "border-green-500" : "border-amber-500")}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {result.isSuccess ? <CheckCircle className="h-6 w-6 text-green-500"/> : <XCircle className="h-6 w-6 text-amber-500"/>}
              <p className="font-semibold text-lg">{t('score', { score: result.score })}</p>
            </div>
            <p className="text-sm text-muted-foreground">{result.feedback}</p>
            <Button onClick={handleClear} variant="outline" size="sm" className="w-full">{t('button_new_photo')}</Button>
          </CardContent>
        </Card>
      ) : preview ? (
        <Card className="overflow-hidden">
          <div className="relative aspect-video">
            <Image src={preview} alt="Preview" fill sizes="33vw" className="object-contain" />
            <Button
              variant="destructive" size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full"
              onClick={handleClear} disabled={isAnalyzing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
             <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('button_evaluating')}</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> {t('button_get_feedback')}</>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <div
          className={cn(
            'relative w-full h-40 rounded-md border-2 border-dashed border-muted-foreground/50 transition-colors duration-200 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary hover:bg-accent',
            isDragging && 'border-primary bg-accent'
          )}
          onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
          <div className="space-y-2">
            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('upload_prompt_click')}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t('upload_prompt_drag')}</p>
          </div>
        </div>
      )}
    </div>
  );
}


function LessonDetailDialog({ lesson, isOpen, onOpenChange, onLearn, isCompleted }: { lesson: AcademyLesson | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onLearn: (lessonId: string, xp: number, auro: number) => void; isCompleted: boolean; }) {
  const t = useTranslations('AcademyLevelPage');
  if (!lesson) return null;

  const xpForLesson = 10;
  const auroForLesson = 2;

  const handleLearn = () => {
    if (isCompleted) return;
    onLearn(lesson.id, xpForLesson, auroForLesson);
  };

  const accordionItems = [
    { value: 'objective', trigger: t('dialog_objective'), content: lesson.learningObjective, icon: Target },
    { value: 'theory', trigger: t('dialog_theory'), content: lesson.theory, icon: FileText },
    { value: 'criteria', trigger: t('dialog_criteria'), content: <ul className="list-disc space-y-2 pl-5">{lesson.analysisCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>, icon: Info },
    { value: 'task', trigger: t('dialog_task'), content: <><p>{lesson.practiceTask}</p><PracticeSubmission lesson={lesson}/></>, icon: Camera },
    { value: 'auro', trigger: t('dialog_auro_note'), content: lesson.auroNote, icon: Bot },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0">
        <div className="md:w-2/5 w-full relative aspect-video">
           <Image
            src={lesson.imageUrl}
            alt={lesson.title}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover md:rounded-l-lg"
            data-ai-hint={lesson.imageHint}
          />
           <div className="absolute top-4 left-4">
            <Badge variant="secondary">{lesson.category}</Badge>
          </div>
        </div>
        <div className="md:w-3/5 w-full overflow-y-auto flex flex-col">
            <div className='p-6 flex flex-col h-full'>
              <DialogHeader className="mb-4">
                <DialogTitle className="font-sans text-2xl">{lesson.title}</DialogTitle>
              </DialogHeader>

              <div className="flex-grow">
                <Accordion type="single" collapsible className="w-full" defaultValue="objective">
                  {accordionItems.map(item => (
                    <AccordionItem value={item.value} key={item.value}>
                      <AccordionTrigger>
                        <div className='flex items-center gap-2'>
                          <item.icon className="h-4 w-4" />
                          {item.trigger}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 text-sm text-muted-foreground">
                        {item.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <Button
                  onClick={handleLearn}
                  disabled={isCompleted}
                  className="w-full"
                  size="lg"
                  variant={isCompleted ? 'secondary' : 'default'}
                >
                  {isCompleted ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {t('button_completed')}
                    </>
                  ) : (
                    <>
                      <BookOpen className="mr-2 h-4 w-4" />
                      {t('button_complete_lesson', { xp: xpForLesson, auro: auroForLesson })}
                    </>
                  )}
                </Button>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function LessonCard({ lesson, onSelect, isCompleted }: { lesson: AcademyLesson; onSelect: () => void; isCompleted: boolean; }) {
  return (
    <Card onClick={onSelect} className="overflow-hidden cursor-pointer group h-full flex flex-col">
       <CardHeader className="p-0 relative aspect-video bg-muted flex items-center justify-center">
        {lesson.imageUrl ? (
            <>
                <Image
                  src={lesson.imageUrl}
                  alt={lesson.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint={lesson.imageHint}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </>
        ) : (
            <Camera className="h-12 w-12 text-muted-foreground" />
        )}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300">
            <Check className="h-16 w-16 text-white/80" />
          </div>
        )}
      </CardHeader>
       <CardContent className="p-4 flex-grow flex flex-col justify-center">
        <CardTitle className="font-sans text-base line-clamp-2 leading-snug">{lesson.title}</CardTitle>
      </CardContent>
    </Card>
  );
}


export default function LevelPage() {
  const t = useTranslations('AcademyLevelPage');
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const [selectedLesson, setSelectedLesson] = useState<AcademyLesson | null>(null);

  const levelSlug = Array.isArray(params.level) ? params.level[0] : params.level;
  
  if (levelSlug === 'temel-egitim') {
    router.replace('/academy/temel');
    return null;
  }
  
  const levelInfo = levelSlug ? levelSlugMap[levelSlug] : null;
  const levelName = levelInfo?.name;

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const lessonsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'academyLessons');
  }, [firestore, authUser]);
  
  const { data: allLessons, isLoading } = useCollection<AcademyLesson>(lessonsQuery);

  // Filter and sort lessons on the client-side
  const lessons = useMemo(() => {
    if (!allLessons || !levelName) return [];
    
    const filtered = allLessons.filter(lesson => {
      // Prioritize the explicit `level` property from the document
      if (lesson.level) {
        return lesson.level === levelName;
      }
      
      // Fallback for older data: check if the lesson's category belongs to the current level
      const categoriesForLevel = levelCategoryMap[levelName as keyof typeof levelCategoryMap] || [];
      return categoriesForLevel.includes(lesson.category);
    });
    
    // Sort by creation date, most recent first
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allLessons, levelName]);


  const handleLearn = (lessonId: string, xpToAdd: number, auroToAdd: number) => {
    if (!userProfile || !userDocRef) return;
    const completedModules = userProfile.completed_modules || [];
    if (completedModules.includes(lessonId)) return;

    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    
    const currentLevel = getLevelFromXp(currentXp);
    const newXp = currentXp + xpToAdd;
    const newLevel = getLevelFromXp(newXp);
    const newAuro = currentAuro + auroToAdd;

    const updatePayload: Partial<UserProfile> = {
      current_xp: newXp,
      auro_balance: newAuro,
      completed_modules: [...completedModules, lessonId],
    };

    if (newLevel.name !== currentLevel.name) {
      updatePayload.level_name = newLevel.name;
      if (newLevel.isMentor) {
        updatePayload.is_mentor = true;
      }
    }

    updateDocumentNonBlocking(userDocRef, updatePayload);
    toast({
      title: t('toast_reward_title'),
      description: t('toast_reward_description', { xp: xpToAdd, auro: auroToAdd }),
    });

    if (updatePayload.level_name) {
      setTimeout(() => {
        toast({
          title: t('toast_level_up_title'),
          description: t('toast_level_up_description', { level: updatePayload.level_name }),
        });
      }, 100);
      if (updatePayload.is_mentor) {
        setTimeout(() => {
          toast({
            title: t('toast_mentor_title'),
            description: t('toast_mentor_description'),
          });
        }, 200);
      }
    }
  };
  
  // If the category slug is invalid, redirect or show an error
  if (!levelName && !isLoading) {
      return (
          <div className="container mx-auto text-center py-20">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="mt-4 text-xl font-semibold">{t('invalid_level_title')}</h3>
              <p className="text-muted-foreground mt-2">{t('invalid_level_description')}</p>
              <Button onClick={() => router.push('/academy')} className="mt-6">{t('button_back_to_academy')}</Button>
          </div>
      );
  }

  const groupedLessons = useMemo(() => {
    if (!lessons) return {};
    return lessons.reduce((acc, lesson) => {
        const category = lesson.category || t('category_other');
        if (!acc[category]) {
        acc[category] = [];
        }
        acc[category].push(lesson);
        return acc;
    }, {} as Record<string, AcademyLesson[]>) ?? {};
  }, [lessons, t]);

  const orderedCategories = Object.keys(groupedLessons).sort();


  if (isLoading) {
     return (
      <div className="container mx-auto space-y-12">
        {Array.from({length: 3}).map((_, i) => (
            <section key={i}>
                <Skeleton className="h-8 w-1/4 mb-6" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, j) => (
                    <Card key={j} className="overflow-hidden">
                        <CardHeader className="p-0 relative aspect-video">
                            <Skeleton className="w-full h-full"/>
                        </CardHeader>
                        <CardContent className="p-4">
                            <Skeleton className="h-5 w-3/4 mb-1"/>
                            <Skeleton className="h-5 w-5/6"/>
                        </CardContent>
                    </Card>
                ))}
                </div>
            </section>
        ))}
    </div>
    );
  }

  return (
    <div className="container mx-auto">
      {(!lessons || lessons.length === 0) ? (
        <div className="text-center py-20 rounded-lg border border-dashed">
            <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">{t('no_lessons_title')}</h3>
            <p className="text-muted-foreground mt-2">{t('no_lessons_description')}</p>
        </div>
      ) : (
        <div className="space-y-12">
            {orderedCategories.map(category => (
                groupedLessons[category] && groupedLessons[category].length > 0 && (
                    <section key={category}>
                        <h2 className="text-2xl font-bold tracking-tight mb-6 border-b pb-2">{category}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {groupedLessons[category].map(lesson => (
                                <LessonCard 
                                    key={lesson.id} 
                                    lesson={lesson} 
                                    onSelect={() => setSelectedLesson(lesson)}
                                    isCompleted={userProfile?.completed_modules?.includes(lesson.id) || false}
                                />
                            ))}
                        </div>
                    </section>
                )
            ))}
        </div>
      )}

      <LessonDetailDialog
        lesson={selectedLesson}
        isOpen={!!selectedLesson}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedLesson(null); }}
        onLearn={handleLearn}
        isCompleted={!!selectedLesson && (userProfile?.completed_modules?.includes(selectedLesson.id) || false)}
      />
    </div>
  );
}
