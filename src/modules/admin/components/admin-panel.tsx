'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { addDoc, collection, doc, getDocs, query, writeBatch, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useUser } from '@/lib/firebase';
import { Loader2, Zap, BrainCircuit, Users } from 'lucide-react';
import testUser1Data from '@/lib/test_user_1.json';
import { Skeleton } from '@/components/ui/skeleton';

const curriculum = {
  Temel: [ "cat_b_intro", "cat_b_exposure", "cat_b_focus", "cat_b_composition", "cat_b_light" ],
  Orta: [ "cat_i_genres", "cat_i_advanced_exposure", "cat_i_light_management", "cat_i_storytelling", "cat_i_post_production" ],
  İleri: [ "cat_a_specialization", "cat_a_studio_light", "cat_a_advanced_techniques", "cat_a_style", "cat_a_business" ],
};
type Level = keyof typeof curriculum;

export default function AdminPanel() {
    const t = useTranslations('ProfilePage');
    const tCurriculum = useTranslations('Curriculum');
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [aiResponse, setAiResponse] = useState('');
    const [totalUsers, setTotalUsers] = useState<number | null>(null);

    const { control: lessonControl, watch: lessonWatch, handleSubmit: handleLessonSubmit } = useForm<{ level: Level; category: string; }>({
        defaultValues: { level: 'Temel', category: '' }
    });

    const { control: feedbackControl, handleSubmit: handleFeedbackSubmit } = useForm<{ prompt: string; }>({
        defaultValues: { prompt: "Fotoğraflarımda sürekli aynı hataları yapıyorum. Işık kontrolünde nasıl daha iyi olabilirim?" }
    });
    
    const selectedLevel = lessonWatch('level');

    const onGenerateLessons = async (data: { level: Level; category: string; }) => {
        if (!data.level || !data.category) {
            toast({ variant: 'destructive', title: t('admin_toast_missing_selection_title'), description: t('admin_toast_missing_selection_description') });
            return;
        }
        setIsGenerating(true);
        toast({ title: t('admin_toast_generating_title'), description: t('admin_toast_generating_description', { level: data.level, category: data.category }) });
        try {
            const lessons = await generateDailyLessons({ level: data.level, category: data.category, language: 'tr' });
            if (firestore) {
                const batch = writeBatch(firestore);
                lessons.forEach(lessonData => {
                    const docRef = doc(collection(firestore, 'academyLessons'));
                    const completeLessonData = {
                        ...lessonData,
                        id: docRef.id,
                        imageUrl: `https://picsum.photos/seed/${docRef.id}/600/400`,
                        createdAt: new Date().toISOString()
                    };
                    batch.set(docRef, completeLessonData);
                });
                await batch.commit();
            }
            toast({ title: t('admin_toast_generate_success_title'), description: t('admin_toast_generate_success_description', { count: lessons.length, category: data.category }) });
        } catch (error) {
            console.error("Lesson generation error:", error);
            toast({ variant: 'destructive', title: t('admin_toast_generate_error_title'), description: t('admin_toast_generate_error_description') });
        } finally {
            setIsGenerating(false);
        }
    };

    const onGetStrategicFeedback = async (data: { prompt: string; }) => {
        setIsGeneratingFeedback(true);
        setAiResponse('');
        try {
            const result = await generateStrategicFeedback({
                userPrompt: data.prompt,
                userProfileIndex: testUser1Data
            });
            setAiResponse(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Strategic feedback error:", error);
            setAiResponse('Hata oluştu: ' + (error as Error).message);
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    useEffect(() => {
        const fetchTotalUsers = async () => {
            if (!firestore) return;
            try {
                const coll = collection(firestore, "users");
                const snapshot = await getCountFromServer(coll);
                setTotalUsers(snapshot.data().count);
            } catch (error) {
                console.error("Error fetching total users:", error);
            }
        };

        if (user && firestore) {
            fetchTotalUsers();
        }
    }, [user, firestore]);

    return (
        <div className="grid gap-8 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="text-yellow-400" /> {t('admin_tools_title')}</CardTitle>
                    <CardDescription>{t('admin_tools_description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">{t('admin_generate_lessons_title')}</h4>
                        <p className="text-sm text-muted-foreground">{t('admin_generate_lessons_description')}</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Controller
                                name="level"
                                control={lessonControl}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder={t('admin_select_level')} /></SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(curriculum).map(level => (
                                                <SelectItem key={level} value={level}>{level}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <Controller
                                name="category"
                                control={lessonControl}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLevel}>
                                        <SelectTrigger><SelectValue placeholder={t('admin_select_category')} /></SelectTrigger>
                                        <SelectContent>
                                            {selectedLevel && curriculum[selectedLevel].map(cat => (
                                                <SelectItem key={cat} value={tCurriculum(cat as any)}>{tCurriculum(cat as any)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <Button type="submit" disabled={isGenerating} className="w-full">
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin_button_generate')}
                        </Button>
                    </form>

                    <form onSubmit={handleFeedbackSubmit(onGetStrategicFeedback)} className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">{t('admin_strategic_feedback_title')}</h4>
                        <p className="text-sm text-muted-foreground">{t('admin_strategic_feedback_description')}</p>
                        <div>
                            <Label htmlFor="prompt">{t('admin_prompt_label')}</Label>
                            <Controller
                                name="prompt"
                                control={feedbackControl}
                                render={({ field }) => <Textarea id="prompt" {...field} className="mt-1" />}
                            />
                        </div>
                        <Button type="submit" disabled={isGeneratingFeedback} className="w-full">
                            {isGeneratingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin_button_get_feedback')}
                        </Button>
                        {aiResponse && (
                            <div>
                                <Label>{t('admin_response_label')}</Label>
                                <pre className="mt-1 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap"><code>{aiResponse}</code></pre>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>

             <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users />{t('admin_total_users_title')}</CardTitle>
                        <CardDescription>{t('admin_total_users_description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalUsers === null ? <Skeleton className="h-10 w-24" /> : <p className="text-4xl font-bold">{totalUsers}</p>}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BrainCircuit /> {t('admin_edit_exhibition_title')}</CardTitle>
                        <CardDescription>{t('admin_edit_exhibition_description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Bu özellik yakında eklenecektir.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
