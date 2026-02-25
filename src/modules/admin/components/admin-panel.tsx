
'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { generateStrategicFeedback } from '@/ai/flows/generate-strategic-feedback';
import { collection, doc, writeBatch, getCountFromServer, addDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/lib/firebase';
import { Loader2, Zap, BrainCircuit, Users, BookOpen, MessageSquareText, AlertCircle, Trophy, Calendar } from 'lucide-react';
import testUser1Data from '@/lib/test_user_1.json';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';

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

interface CompetitionFormValues {
    title: string;
    description: string;
    theme: string;
    prize: string;
    targetLevel: string;
    startDate: string;
    endDate: string;
}

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreatingComp, setIsCreatingComp] = useState(false);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [aiResponse, setAiResponse] = useState('');
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);
    const [countError, setCountError] = useState<string | null>(null);

    const isAdmin = user?.email === 'admin@viewora.ai';

    const { control: lessonControl, watch: lessonWatch, handleSubmit: handleLessonSubmit } = useForm<{ level: Level; category: string; }>({
        defaultValues: { level: 'Temel', category: '' }
    });

    const { control: feedbackControl, handleSubmit: handleFeedbackSubmit } = useForm<{ prompt: string; }>({
        defaultValues: { prompt: "Fotoğraflarımda sürekli aynı hataları yapıyorum. Işık kontrolünde nasıl daha iyi olabilirim?" }
    });

    const { control: compControl, handleSubmit: handleCompSubmit, reset: resetComp } = useForm<CompetitionFormValues>({
        defaultValues: {
            title: '',
            description: '',
            theme: '',
            prize: '',
            targetLevel: 'Neuner',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
    });
    
    const selectedLevel = lessonWatch('level');

    const onGenerateLessons = async (data: { level: Level; category: string; }) => {
        if (!data.level || !data.category) {
            toast({ variant: 'destructive', title: "Eksik Seçim", description: "Lütfen ders üretmek için bir seviye ve bir kategori seçin." });
            return;
        }
        setIsGenerating(true);
        try {
            const lessons = await generateDailyLessons({ level: data.level, category: data.category, language: 'tr' });
            if (firestore) {
                const batch = writeBatch(firestore);
                lessons.forEach(lessonData => {
                    const docRef = doc(collection(firestore, 'academyLessons'));
                    batch.set(docRef, {
                        ...lessonData,
                        id: docRef.id,
                        imageUrl: `https://picsum.photos/seed/${docRef.id}/600/400`,
                        createdAt: new Date().toISOString()
                    });
                });
                await batch.commit();
            }
            toast({ title: "Başarılı!", description: `${lessons.length} yeni ders eklendi.` });
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata!", description: "Dersler üretilemedi." });
        } finally { setIsGenerating(false); }
    };

    const onCreateCompetition = async (data: CompetitionFormValues) => {
        if (!firestore || !isAdmin) return;
        setIsCreatingComp(true);
        try {
            const docRef = await addDoc(collection(firestore, 'competitions'), {
                ...data,
                createdAt: new Date().toISOString(),
                imageUrl: `https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1000&auto=format&fit=crop`, // Default photography image
                imageHint: data.theme,
            });
            await updateDoc(doc(firestore, 'competitions', docRef.id), { id: docRef.id });

            // Add notification for level users
            await addDoc(collection(firestore, 'global_notifications'), {
                title: "Yeni Yarışma!",
                message: `${data.title} yarışması başladı! Hedef seviye: ${data.targetLevel}`,
                targetLevel: data.targetLevel,
                competitionId: docRef.id,
                createdAt: new Date().toISOString(),
            });

            toast({ title: "Yarışma Oluşturuldu", description: "Tüm ilgili kullanıcılara bildirim gönderildi." });
            resetComp();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata", description: "Yarışma oluşturulamadı." });
        } finally { setIsCreatingComp(false); }
    };

    useEffect(() => {
        const fetchTotalUsers = async () => {
            if (!firestore || !isAdmin) return;
            try {
                const snapshot = await getCountFromServer(collection(firestore, "users"));
                setTotalUsers(snapshot.data().count);
            } catch (e) { setCountError("Veri çekilemedi."); } finally { setIsFetchingCount(false); }
        };
        fetchTotalUsers();
    }, [firestore, isAdmin]);

    if (!isAdmin && user) {
        return <div className="container mx-auto p-8"><Alert variant="destructive"><AlertTitle>Erişim Engellendi</AlertTitle></Alert></div>;
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Toplam Kullanıcı</CardTitle>
                    </CardHeader>
                    <CardContent className="py-6">
                        {isFetchingCount ? <Skeleton className="h-12 w-24" /> : <p className="text-5xl font-bold tracking-tighter text-primary">{totalUsers || '0'}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-400" /> Günlük Ders Üret</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Controller name="level" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Seviye" /></SelectTrigger>
                                        <SelectContent>{Object.keys(curriculum).map(l => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                                <Controller name="category" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                                        <SelectContent>{selectedLevel && curriculum[selectedLevel].map(cat => <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </div>
                            <Button type="submit" disabled={isGenerating} className="w-full">Üret ve Kaydet</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Yarışma Oluştur</CardTitle>
                    <CardDescription>Belirli bir seviye ve tarih aralığı için yeni bir yarışma düzenleyin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCompSubmit(onCreateCompetition)} className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Yarışma Başlığı (Konu)</Label>
                                <Controller name="title" control={compControl} render={({ field }) => <Input placeholder="Örn: Sokak ve İnsan" {...field} />} />
                            </div>
                            <div className="space-y-2">
                                <Label>Açıklama & Şartlar</Label>
                                <Controller name="description" control={compControl} render={({ field }) => <Textarea placeholder="Kurallar ve katılım şartları..." {...field} />} />
                            </div>
                            <div className="grid gap-4 grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Tema</Label>
                                    <Controller name="theme" control={compControl} render={({ field }) => <Input placeholder="Örn: Siyah Beyaz" {...field} />} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ödül</Label>
                                    <Controller name="prize" control={compControl} render={({ field }) => <Input placeholder="Örn: 100 Auro" {...field} />} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Hedef Kullanıcı Seviyesi</Label>
                                <Controller name="targetLevel" control={compControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </div>
                            <div className="grid gap-4 grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Başlangıç Tarihi</Label>
                                    <Controller name="startDate" control={compControl} render={({ field }) => <Input type="date" {...field} />} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Bitiş Tarihi</Label>
                                    <Controller name="endDate" control={compControl} render={({ field }) => <Input type="date" {...field} />} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <Button type="submit" disabled={isCreatingComp} className="w-full h-12 text-lg">
                                    {isCreatingComp ? <Loader2 className="mr-2 animate-spin" /> : <Trophy className="mr-2" />}
                                    Yarışmayı Başlat ve Bildir
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
