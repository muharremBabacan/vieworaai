
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
import { generateWeeklyCompetition } from '@/ai/flows/generate-weekly-competition';
import { collection, doc, writeBatch, getCountFromServer, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import { Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, Check, Sparkles, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Competition, User } from '@/types';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';

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
    id?: string;
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
    const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
    const [isCreatingComp, setIsCreatingComp] = useState(false);
    const [editingCompId, setEditingCompId] = useState<string | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);

    const isAdmin = user?.email === 'admin@viewora.ai';

    const competitionsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );
    const { data: competitions, isLoading: compsLoading } = useCollection<Competition>(competitionsQuery);

    const { control: lessonControl, watch: lessonWatch, handleSubmit: handleLessonSubmit } = useForm<{ level: Level; category: string; }>({
        defaultValues: { level: 'Temel', category: '' }
    });

    const { control: compControl, handleSubmit: handleCompSubmit, reset: resetComp, setValue: setCompValue } = useForm<CompetitionFormValues>({
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
        if (!data.level || !data.category || !firestore) {
            toast({ variant: 'destructive', title: "Eksik Seçim", description: "Lütfen ders üretmek için bir seviye ve bir kategori seçin." });
            return;
        }
        setIsGenerating(true);
        try {
            const lessons = await generateDailyLessons({ level: data.level, category: data.category, language: 'tr' });
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

            await batch.commit().catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: 'academyLessons/batch',
                    operation: 'create'
                });
                errorEmitter.emit('permission-error', permissionError);
                throw error;
            });

            toast({ title: "Başarılı!", description: `${lessons.length} yeni ders eklendi.` });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Hata!", description: "Dersler üretilemedi." });
        } finally { setIsGenerating(false); }
    };

    const handleGenerateAIWeekly = async () => {
        if (!firestore || !isAdmin) return;
        setIsGeneratingWeekly(true);
        toast({ title: "Luma Analiz Ediyor...", description: "Kullanıcı istatistiklerine göre haftalık yarışma tasarlanıyor." });

        try {
            // 1. Fetch user distribution
            const userDocs = await getDocs(collection(firestore, 'users')).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'users',
                    operation: 'list'
                }));
                throw err;
            });

            const stats: Record<string, number> = {};
            userDocs.forEach(d => {
                const lvl = d.data().level_name || 'Neuner';
                stats[lvl] = (stats[lvl] || 0) + 1;
            });

            // 2. Call AI
            const aiComp = await generateWeeklyCompetition({ levelStats: stats, language: 'tr' });

            // 3. Create Competition
            const batch = writeBatch(firestore);
            const compRef = doc(collection(firestore, 'competitions'));
            const notifRef = doc(collection(firestore, 'global_notifications'));
            
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 7);

            const competitionData: Competition = {
                id: compRef.id,
                title: aiComp.title,
                description: aiComp.description,
                theme: aiComp.theme,
                prize: aiComp.prize,
                targetLevel: aiComp.targetLevel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                createdAt: new Date().toISOString(),
                imageUrl: `https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1000&auto=format&fit=crop`,
                imageHint: aiComp.imageHint,
            };

            batch.set(compRef, competitionData);
            batch.set(notifRef, {
                id: notifRef.id,
                title: `Yeni Yarışma: ${aiComp.title}`,
                message: `Luma bu haftanın yarışmasını başlattı! Tema: ${aiComp.theme}. Ödül: ${aiComp.prize}`,
                targetLevel: aiComp.targetLevel,
                competitionId: compRef.id,
                createdAt: new Date().toISOString(),
            });

            await batch.commit().catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'batch/ai-weekly',
                    operation: 'write'
                }));
                throw err;
            });

            toast({ title: "AI Yarışması Başlatıldı!", description: aiComp.title });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Hata", description: "AI yarışması oluşturulamadı." });
        } finally {
            setIsGeneratingWeekly(false);
        }
    };

    const onSubmitCompetition = async (data: CompetitionFormValues) => {
        if (!firestore || !isAdmin || isCreatingComp) return;
        setIsCreatingComp(true);

        try {
            if (editingCompId) {
                const compRef = doc(firestore, 'competitions', editingCompId);
                await updateDoc(compRef, { ...data }).catch(async (error) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: compRef.path,
                        operation: 'update',
                        requestResourceData: data
                    }));
                    throw error;
                });
                toast({ title: "Yarışma Güncellendi" });
                setEditingCompId(null);
            } else {
                const batch = writeBatch(firestore);
                const compRef = doc(collection(firestore, 'competitions'));
                const notifRef = doc(collection(firestore, 'global_notifications'));
                
                const compId = compRef.id;
                const competitionData = {
                    ...data,
                    id: compId,
                    createdAt: new Date().toISOString(),
                    imageUrl: `https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1000&auto=format&fit=crop`,
                    imageHint: data.theme,
                };

                batch.set(compRef, competitionData);
                batch.set(notifRef, {
                    id: notifRef.id,
                    title: "Yeni Yarışma!",
                    message: `${data.title} yarışması başladı! Hedef seviye: ${data.targetLevel}`,
                    targetLevel: data.targetLevel,
                    competitionId: compId,
                    createdAt: new Date().toISOString(),
                });

                await batch.commit().catch(async (error) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: 'batch/new-competition',
                        operation: 'create'
                    }));
                    throw error;
                });

                toast({ title: "Yarışma Oluşturuldu" });
            }
            resetComp();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Hata", description: "İşlem başarısız." });
        } finally { setIsCreatingComp(false); }
    };

    const handleEditComp = (comp: Competition) => {
        setEditingCompId(comp.id);
        setCompValue('title', comp.title);
        setCompValue('description', comp.description);
        setCompValue('theme', comp.theme);
        setCompValue('prize', comp.prize);
        setCompValue('targetLevel', comp.targetLevel);
        setCompValue('startDate', comp.startDate.split('T')[0]);
        setCompValue('endDate', comp.endDate.split('T')[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteComp = async (compId: string) => {
        if (!firestore || !isAdmin) return;
        if (!confirm('Bu yarışmayı tamamen silmek istediğinize emin misiniz?')) return;
        
        const compRef = doc(firestore, 'competitions', compId);
        await deleteDoc(compRef).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: compRef.path,
                operation: 'delete'
            }));
            throw error;
        });
        toast({ title: "Yarışma Silindi" });
    };

    const handleEndComp = async (compId: string) => {
        if (!firestore || !isAdmin) return;
        const compRef = doc(firestore, 'competitions', compId);
        await updateDoc(compRef, {
            endDate: new Date().toISOString()
        }).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: compRef.path,
                operation: 'update'
            }));
            throw error;
        });
        toast({ title: "Yarışma Bitirildi" });
    };

    useEffect(() => {
        const fetchTotalUsers = async () => {
            if (!firestore || !isAdmin) return;
            try {
                const snapshot = await getCountFromServer(collection(firestore, "users")).catch(err => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: 'users',
                        operation: 'list'
                    }));
                    throw err;
                });
                setTotalUsers(snapshot.data().count);
            } catch (e) { 
                console.error(e);
            } finally { setIsFetchingCount(false); }
        };
        fetchTotalUsers();
    }, [firestore, isAdmin]);

    if (!isAdmin && user) {
        return <div className="container mx-auto p-8"><Alert variant="destructive"><AlertTitle>Erişim Engellendi</AlertTitle></Alert></div>;
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-3">
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
                        <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-400" /> AI Haftalık Rutin</CardTitle>
                        <CardDescription>İstatistiklere göre otomatik yarışma üret.</CardDescription>
                    </CardHeader>
                    <CardContent className="py-6">
                        <Button onClick={handleGenerateAIWeekly} disabled={isGeneratingWeekly} className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold border-none shadow-lg">
                            {isGeneratingWeekly ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                            AI Yarışması Başlat
                        </Button>
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
                                        <SelectContent>{Object.keys(curriculum).map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                                <Controller name="category" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                                        <SelectContent>{selectedLevel && curriculum[selectedLevel as Level]?.map(cat => <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </div>
                            <Button type="submit" disabled={isGenerating} className="w-full">Üret ve Kaydet</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card className={cn(editingCompId && "border-primary ring-1 ring-primary")}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-400" /> 
                        {editingCompId ? "Yarışmayı Düzenle" : "Yarışma Başlat"}
                    </CardTitle>
                    <CardDescription>
                        {editingCompId ? "Yarışma bilgilerini güncelliyorsunuz." : "Yeni bir global yarışma düzenleyin."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCompSubmit(onSubmitCompetition)} className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Yarışma Başlığı</Label>
                                <Controller name="title" control={compControl} render={({ field }) => <Input placeholder="Örn: Sokak ve İnsan" {...field} />} />
                            </div>
                            <div className="space-y-2">
                                <Label>Açıklama</Label>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                            <div className="pt-4 flex gap-2">
                                {editingCompId && (
                                    <Button type="button" variant="outline" onClick={() => { setEditingCompId(null); resetComp(); }}>İptal</Button>
                                )}
                                <Button type="submit" disabled={isCreatingComp} className="flex-1 h-12 text-lg">
                                    {isCreatingComp ? <Loader2 className="mr-2 animate-spin" /> : editingCompId ? <Check className="mr-2" /> : <Trophy className="mr-2" />}
                                    {editingCompId ? "Değişiklikleri Kaydet" : "Yarışmayı Başlat ve Bildir"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Mevcut Yarışmalar</CardTitle>
                    <CardDescription>Sistemdeki tüm yarışmaları buradan yönetebilirsiniz.</CardDescription>
                </CardHeader>
                <CardContent>
                    {compsLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Başlık</TableHead>
                                    <TableHead>Seviye</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Bitiş</TableHead>
                                    <TableHead className="text-right">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {competitions?.map((comp) => {
                                    const now = new Date();
                                    const isEnded = now > new Date(comp.endDate);
                                    return (
                                        <TableRow key={comp.id}>
                                            <TableCell className="font-medium">{comp.title}</TableCell>
                                            <TableCell><Badge variant="outline">{comp.targetLevel}</Badge></TableCell>
                                            <TableCell>
                                                {isEnded ? (
                                                    <Badge variant="secondary">Bitti</Badge>
                                                ) : (
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Aktif</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{new Date(comp.endDate).toLocaleDateString('tr-TR')}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditComp(comp)} title="Düzenle">
                                                        <Edit className="h-4 w-4 text-blue-400" />
                                                    </Button>
                                                    {!isEnded && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleEndComp(comp.id)} title="Yarışmayı Bitir">
                                                            <StopCircle className="h-4 w-4 text-orange-400" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteComp(comp.id)} title="Yarışmayı Sil">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {competitions?.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Henüz yarışma bulunmuyor.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
