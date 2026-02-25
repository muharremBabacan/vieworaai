
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
import { Loader2, Zap, BrainCircuit, Users, BookOpen, MessageSquareText, AlertCircle } from 'lucide-react';
import testUser1Data from '@/lib/test_user_1.json';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    const [isFetchingCount, setIsFetchingCount] = useState(true);
    const [countError, setCountError] = useState<string | null>(null);

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.email === 'babacan.muharrem@gmail.com';

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
            if (!firestore || !user || !isAdmin) return;
            
            setIsFetchingCount(true);
            setCountError(null);
            
            try {
                const coll = collection(firestore, "users");
                const snapshot = await getCountFromServer(coll);
                setTotalUsers(snapshot.data().count);
            } catch (error: any) {
                console.error("Error fetching total users:", error);
                setCountError(error.message || "Veri çekilemedi.");
                setTotalUsers(null); 
            } finally {
                setIsFetchingCount(false);
            }
        };

        if (user && firestore && isAdmin) {
            fetchTotalUsers();
        } else if (user && !isAdmin) {
            setIsFetchingCount(false);
        }
    }, [user, firestore, isAdmin]);

    if (!isAdmin && user) {
        return (
            <div className="container mx-auto p-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erişim Engellendi</AlertTitle>
                    <AlertDescription>
                        Bu sayfayı görüntülemek için yönetici yetkiniz bulunmamaktadır.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Kart 1: Toplam Kullanıcı */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> 
                        Toplam Kullanıcı
                    </CardTitle>
                    <CardDescription>Sisteme kayıtlı toplam kullanıcı sayısı.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 items-center justify-center py-6">
                    {isFetchingCount ? (
                        <Skeleton className="h-12 w-24" />
                    ) : countError ? (
                        <div className="text-center text-destructive">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-xs">{countError}</p>
                            <Button variant="link" size="sm" onClick={() => window.location.reload()}>Tekrar Dene</Button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-5xl font-bold tracking-tighter text-primary">
                                {totalUsers !== null ? totalUsers : '0'}
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">Aktif Üye</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Kart 2: Sergi Düzenleme */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BrainCircuit className="h-5 w-5 text-cyan-400" />
                        Sergi Düzenle
                    </CardTitle>
                    <CardDescription>Herkese açık sergi alanındaki fotoğrafları yönetin.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 items-center justify-center py-6">
                    <div className="text-center text-muted-foreground">
                        <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Bu özellik üzerinde çalışılıyor.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Kart 3: Günlük Ders Üret */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-400" />
                        Günlük Ders Üret
                    </CardTitle>
                    <CardDescription>YZ'nin seçtiğiniz kategori için 5 yeni ders oluşturmasını sağlayın.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Seviye</Label>
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
                            </div>
                            <div className="space-y-2">
                                <Label>Kategori</Label>
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
                        </div>
                        <Button type="submit" disabled={isGenerating} className="w-full">
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Üret ve Kaydet
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Kart 4: Geri Bildirim Test */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-yellow-400" />
                        Stratejik Geri Bildirim
                    </CardTitle>
                    <CardDescription>Yeni koçluk prompt'unu test verileriyle kontrol edin.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                    <form onSubmit={handleFeedbackSubmit(onGetStrategicFeedback)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="prompt">Test Mesajı</Label>
                            <Controller
                                name="prompt"
                                control={feedbackControl}
                                render={({ field }) => <Textarea id="prompt" {...field} className="min-h-[100px]" />}
                            />
                        </div>
                        <Button type="submit" disabled={isGeneratingFeedback} className="w-full" variant="secondary">
                            {isGeneratingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Test Et
                        </Button>
                    </form>
                    {aiResponse && (
                        <div className="mt-4">
                            <Label className="text-xs text-muted-foreground uppercase">YZ Yanıtı</Label>
                            <pre className="mt-1 p-2 bg-muted rounded-md text-[10px] font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto border">
                                <code>{aiResponse}</code>
                            </pre>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
