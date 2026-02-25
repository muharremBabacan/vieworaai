'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { collection, doc, writeBatch, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useUser } from '@/lib/firebase';
import { Loader2, Zap, BrainCircuit, Users } from 'lucide-react';
import testUser1Data from '@/lib/test_user_1.json';
import { Skeleton } from '@/components/ui/skeleton';

const curriculum = {
  Temel: [ 
    { id: "cat_b_intro", label: "Fotoğrafçılığa Giriş" }, 
    { id: "cat_b_exposure", label: "Pozlama Temelleri" }, 
    { id: "cat_b_focus", label: "Netlik ve Odaklama" }, 
    { id: "cat_b_composition", label: "Temel Kompozisyon" }, 
    { id: "cat_b_light", label: "Işık Bilgisi" } 
  ],
  Orta: [ 
    { id: "cat_i_genres", label: "Tür Bazlı Çekim Teknikleri" }, 
    { id: "cat_i_advanced_exposure", label: "İleri Pozlama Teknikleri" }, 
    { id: "cat_i_light_management", label: "Işık Yönetimi" }, 
    { id: "cat_i_storytelling", label: "Görsel Hikâye Anlatımı" }, 
    { id: "cat_i_post_production", label: "Post-Prodüksiyon Temelleri" } 
  ],
  İleri: [ 
    { id: "cat_a_specialization", label: "Uzmanlık Alanı Derinleşme" }, 
    { id: "cat_a_studio_light", label: "Profesyonel Işık Kurulumu" }, 
    { id: "cat_a_advanced_techniques", label: "Gelişmiş Teknikler" }, 
    { id: "cat_a_style", label: "Sanatsal Kimlik ve Stil" }, 
    { id: "cat_a_business", label: "Ticari ve Marka Konumlandırma" } 
  ],
};
type Level = keyof typeof curriculum;

export default function AdminPanel() {
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
            toast({ variant: 'destructive', title: "Eksik Seçim", description: "Lütfen ders üretmek için bir seviye ve bir kategori seçin." });
            return;
        }
        setIsGenerating(true);
        toast({ title: "Dersler Üretiliyor...", description: `YZ, '${data.level}' seviyesi, '${data.category}' kategorisi için 5 yeni ders hazırlıyor.` });
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
            toast({ title: "Başarılı!", description: `${lessons.length} yeni ders '${data.category}' kategorisine eklendi.` });
        } catch (error) {
            console.error("Lesson generation error:", error);
            toast({ variant: 'destructive', title: "Hata!", description: "Dersler üretilirken veya kaydedilirken bir sorun oluştu." });
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
                    <CardTitle className="flex items-center gap-2"><Zap className="text-yellow-400" /> Yönetici Araçları</CardTitle>
                    <CardDescription>Uygulama için yönetimsel görevleri buradan yapın.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">Günlük Dersleri Üret</h4>
                        <p className="text-sm text-muted-foreground">YZ'nin seçtiğiniz kategori için 5 yeni ders oluşturmasını sağlayın.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Controller
                                name="level"
                                control={lessonControl}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Seviye Seçin" /></SelectTrigger>
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
                                        <SelectTrigger><SelectValue placeholder="Kategori Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            {selectedLevel && curriculum[selectedLevel].map(cat => (
                                                <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <Button type="submit" disabled={isGenerating} className="w-full">
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Üret ve Kaydet
                        </Button>
                    </form>

                    <form onSubmit={handleFeedbackSubmit(onGetStrategicFeedback)} className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">Stratejik Geri Bildirim Üret (Test)</h4>
                        <p className="text-sm text-muted-foreground">test_user_1.json verisini kullanarak yeni koçluk prompt'unu test edin.</p>
                        <div>
                            <Label htmlFor="prompt">Prompt</Label>
                            <Controller
                                name="prompt"
                                control={feedbackControl}
                                render={({ field }) => <Textarea id="prompt" {...field} className="mt-1" />}
                            />
                        </div>
                        <Button type="submit" disabled={isGeneratingFeedback} className="w-full">
                            {isGeneratingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Geri Bildirim Al
                        </Button>
                        {aiResponse && (
                            <div>
                                <Label>Yapay Zeka Cevabı</Label>
                                <pre className="mt-1 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap"><code>{aiResponse}</code></pre>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>

             <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Toplam Kullanıcı</CardTitle>
                        <CardDescription>Sisteme kayıtlı toplam kullanıcı sayısı.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalUsers === null ? <Skeleton className="h-10 w-24" /> : <p className="text-4xl font-bold">{totalUsers}</p>}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BrainCircuit /> Sergi Düzenle</CardTitle>
                        <CardDescription>Herkese açık sergi alanındaki fotoğrafları yönetin.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Bu özellik yakında eklenecektir.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
