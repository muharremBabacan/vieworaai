'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import type { Lesson, User } from '@/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getLevelFromXp } from '@/lib/gamification';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/shared/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, UploadCloud, Loader2 } from 'lucide-react';
import { evaluatePracticeSubmission, type EvaluatePracticeSubmissionOutput } from '@/ai/flows/evaluate-practice-submission';
import { useAppConfig } from '@/components/AppConfigProvider';
import { typography } from "@/lib/design/typography";
import { cn } from '@/lib/utils';

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
    const { user } = useUser();
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
            if (acceptedFile.size > 10 * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: "Dosya Boyutu Çok Büyük",
                    description: "Lütfen 10MB'dan küçük bir resim dosyası yükleyin.",
                });
                return;
            }
            setFile(acceptedFile);
            setPreview(URL.createObjectURL(acceptedFile));
            setAnalysisResult(null);
        }
    }, [toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const handleGetFeedback = async () => {
        if (!file || !user || !firestore) return;

        setIsUploading(true);
        toast({ title: "Analiz Başlatılıyor...", description: "Ödevinize özel geri bildirim hazırlanıyor." });
        
        try {
            const storage = getStorage();
            const filePath = `users/${user.uid}/practice-submissions/${lesson.id}/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, filePath);
            await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(storageRef);

            setIsUploading(false);
            setIsAnalyzing(true);

            const result = await evaluatePracticeSubmission({
                photoUrl: imageUrl,
                practiceTask: lesson.practiceTask,
                analysisCriteria: lesson.analysisCriteria || [],
                language: "tr",
            });

            setAnalysisResult(result);
            onFeedbackReady(result);
            toast({ title: "Geri Bildirim Hazır!", description: "Aşağıdan sonucu görebilirsiniz." });

        } catch (error) {
            console.error("Analysis failed:", error);
            toast({ variant: 'destructive', title: "Analiz Başarısız", description: "Yapay zeka geri bildirimi oluştururken bir hata oluştu." });
        } finally {
            setIsUploading(false);
            setIsAnalyzing(false);
        }
    };
    
    return (
        <Card>
            <CardHeader><CardTitle className={typography.cardTitle}>Pratiğini Göster</CardTitle></CardHeader>
            <CardContent>
                <p className={typography.body}>Bu ödev için çektiğin fotoğrafı yükle ve anında geri bildirim al.</p>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                            {isDragActive ? <p className="text-primary">veya sürükleyip bırakın</p> : <p className={typography.meta}>Yüklemek için tıklayın <span className="text-muted-foreground">veya sürükleyip bırakın</span></p>}
                        </div>
                        {preview && <div className="mt-4 relative aspect-video rounded-lg overflow-hidden"><Image src={preview} alt="Preview" fill className="object-cover" unoptimized /></div>}
                    </div>
                    <div className="flex flex-col justify-center items-center">
                        {analysisResult ? (
                            <div className="text-center">
                                <h3 className={typography.cardTitle}>Puan: {analysisResult.score}/10</h3>
                                <p className={cn(typography.body, "mt-2")}>{analysisResult.feedback}</p>
                                <Button onClick={() => { setFile(null); setPreview(null); setAnalysisResult(null); }} className={cn(typography.button, "mt-4")}>Yeni Fotoğraf Yükle</Button>
                            </div>
                        ) : (
                            <Button onClick={handleGetFeedback} disabled={!file || isUploading || isAnalyzing} className={cn(typography.button, "w-full")}>
                                {(isUploading || isAnalyzing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isAnalyzing ? "Değerlendiriliyor..." : "Geri Bildirim Al"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function LessonItem({ lesson, isCompleted, onComplete }: { lesson: Lesson; isCompleted: boolean; onComplete: (lessonId: string) => void; }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [practiceResult, setPracticeResult] = useState<any | null>(null);
  const { currencyName } = useAppConfig();

  const handleLessonComplete = () => {
      onComplete(lesson.id);
      setIsDialogOpen(false);
  }

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-video">
          <Image 
            src={lesson.imageUrl || getDeterminsticPlaceholder(lesson.id)} 
            alt={lesson.title} 
            fill 
            className="object-cover" 
            data-ai-hint={lesson.imageHint} 
            unoptimized 
          />
        </div>
        <CardContent className="p-4">
          <h3 className={typography.cardTitle}>{lesson.title}</h3>
          <p className={cn(typography.meta, "mt-1")}>{lesson.learningObjective}</p>
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)} className={typography.button}>Teori</Button>
            {isCompleted ? (
              <span className={cn(typography.meta, "flex items-center gap-2 font-semibold text-green-500")}><CheckCircle className="h-4 w-4" /> Bitti</span>
            ) : (
                <Button size="sm" onClick={handleLessonComplete} disabled={!practiceResult || practiceResult.score < 7} className={typography.button}>
                    Dersi Tamamla (+10 XP, +1 {currencyName})
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
                    <AccordionItem value="objective"><AccordionTrigger className={typography.cardTitle}>Öğrenim Hedefi</AccordionTrigger><AccordionContent className={typography.body}>{lesson.learningObjective}</AccordionContent></AccordionItem>
                    <AccordionItem value="theory"><AccordionTrigger className={typography.cardTitle}>Teori</AccordionTrigger><AccordionContent className={cn(typography.body, "prose prose-sm dark:prose-invert")}>{lesson.theory}</AccordionContent></AccordionItem>
                    <AccordionItem value="criteria"><AccordionTrigger className={typography.cardTitle}>Başarı Kriterleri</AccordionTrigger><AccordionContent><ul className={cn(typography.body, "list-disc pl-5 space-y-1")}>{(lesson.analysisCriteria || []).map((c, i) => <li key={i}>{c}</li>)}</ul></AccordionContent></AccordionItem>
                    <AccordionItem value="task"><AccordionTrigger className={typography.cardTitle}>Pratik Görevi</AccordionTrigger><AccordionContent className={typography.body}>{lesson.practiceTask}</AccordionContent></AccordionItem>
                    <AccordionItem value="auro-note"><AccordionTrigger className={cn(typography.cardTitle, "text-cyan-400")}>{currencyName} Notu</AccordionTrigger><AccordionContent className={cn(typography.body, "italic")}>{lesson.auroNote}</AccordionContent></AccordionItem>
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
    const { currencyName } = useAppConfig();

    const level = params?.level as string;
    const levelFormatted = useMemo(() => level ? level.charAt(0).toUpperCase() + level.slice(1) : '', [level]);
    
    // ALL HOOKS CALLED AT TOP
    const lessonsQuery = useMemoFirebase(() => 
        (firestore && levelFormatted) ? query(collection(firestore, 'academy_lessons'), where('level', '==', levelFormatted), orderBy('createdAt', 'desc')) : null,
        [firestore, levelFormatted]
    );
    const { data: lessons, isLoading: lessonsLoading } = useCollection<Lesson>(lessonsQuery);

    const userProgressQuery = useMemoFirebase(() =>
      (user && firestore) ? collection(firestore, 'users', user.uid, 'lessonProgress') : null,
      [user, firestore]
    );
    const { data: progressData } = useCollection<{ lessonId: string; isCompleted: boolean }>(userProgressQuery);

    const userProfileQuery = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileQuery);

    const completedLessonIds = useMemo(() => {
        if (!progressData) return new Set();
        return new Set(progressData.filter(p => p.isCompleted).map(p => p.lessonId));
    }, [progressData]);

    const groupedLessons = useMemo(() => {
        if (!lessons) return {};
        return lessons.reduce((acc, lesson) => {
            const category = lesson.category || "Diğer";
            if (!acc[category]) acc[category] = [];
            acc[category].push(lesson);
            return acc;
        }, {} as Record<string, Lesson[]>);
    }, [lessons]);

    const handleCompleteLesson = useCallback(async (lessonId: string) => {
        if (!user || !firestore || !userProfile) return;

        const batch = writeBatch(firestore);
        const progressRef = doc(firestore, 'users', user.uid, 'lessonProgress', lessonId);
        const userRef = doc(firestore, 'users', user.uid);
        
        const xpGain = 10;
        const auroGain = 1;

        batch.set(progressRef, { lessonId, isCompleted: true, completedAt: new Date().toISOString() });
        batch.update(userRef, { 
            current_xp: increment(xpGain),
            auro_balance: increment(auroGain),
            'profile_index.activity_signals.learning_score': increment(5) 
        });

        await batch.commit();
        toast({ title: "Ödül Kazandın!", description: `Bu dersten ${xpGain} XP ve ${auroGain} ${currencyName} kazandın.` });

        const oldLevel = getLevelFromXp(userProfile.current_xp);
        const newLevel = getLevelFromXp(userProfile.current_xp + xpGain);

        if (newLevel.name !== oldLevel.name) {
            await updateDoc(userRef, { level_name: newLevel.name });
            toast({ title: "🎉 Seviye Atladın!", description: `Tebrikler! Yeni seviyen: ${newLevel.name}` });
        }
    }, [user, firestore, userProfile, currencyName, toast]);

    if (isProfileLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    }
    
    return (
        <div className="container mx-auto px-4 pt-6 pb-24">
            <Button variant="ghost" onClick={() => router.push('/academy')} className={cn(typography.button, "mb-4 font-bold text-muted-foreground")}><ArrowLeft className="mr-2 h-4 w-4" /> Akademi'ye Dön</Button>
            <h1 className={cn(typography.h2, "mb-8 uppercase")}>{levelFormatted} Seviye Dersleri</h1>
            {lessonsLoading ? (
                <div className="space-y-8">
                    {[...Array(2)].map((_, i) => (
                        <div key={i}><Skeleton className="h-8 w-1/4 mb-4" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(3)].map((_, j) => (<Card key={j}><Skeleton className="aspect-video" /><CardContent className="p-4"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>))}</div></div>
                    ))}
                </div>
            ) : Object.keys(groupedLessons).length > 0 ? (
                <div className="space-y-8">
                    {Object.entries(groupedLessons).map(([category, lessonsInCategory]) => (
                        <section key={category}>
                            <h2 className={cn(typography.cardTitle, "text-2xl mb-4")}>{category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {lessonsInCategory.map(lesson => (<LessonItem key={lesson.id} lesson={lesson} isCompleted={completedLessonIds.has(lesson.id)} onComplete={handleCompleteLesson} />))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16"><h2 className={typography.h2}>Bu Seviyede Henüz Ders Yok</h2></div>
            )}
        </div>
    );
}
