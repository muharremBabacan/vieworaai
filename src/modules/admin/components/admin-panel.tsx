
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
import { collection, doc, writeBatch, getCountFromServer, updateDoc, deleteDoc, query, orderBy, where, addDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import { Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, Check, Scale, UserCheck, Cpu, Star, Bell, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Competition, ScoringModel, User, GlobalNotification } from '@/types';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

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
    scoringModel: ScoringModel;
    juryIds: string[];
    isCommunityVoteActive: boolean;
    isAIAnalysisIncluded: boolean;
    juryWeight: number;
    aiWeight: number;
    communityWeight: number;
}

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreatingComp, setIsCreatingComp] = useState(false);
    const [isSendingNotif, setIsSendingNotif] = useState(false);
    const [editingCompId, setEditingCompId] = useState<string | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43';

    const competitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: competitions, isLoading: compsLoading } = useCollection<Competition>(competitionsQuery);

    const mentorsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'users'), where('is_mentor', '==', true)) : null,
        [firestore, isAdmin]
    );
    const { data: mentors } = useCollection<User>(mentorsQuery);

    const { control: lessonControl, watch: lessonWatch, handleSubmit: handleLessonSubmit } = useForm<{ level: Level; category: string; }>({
        defaultValues: { level: 'Temel', category: '' }
    });

    const { control: compControl, handleSubmit: handleCompSubmit, reset: resetComp, setValue: setCompValue, watch: compWatch } = useForm<CompetitionFormValues>({
        defaultValues: {
            title: '',
            description: '',
            theme: '',
            prize: '',
            targetLevel: 'Neuner',
            scoringModel: 'hybrid',
            juryIds: [],
            isCommunityVoteActive: true,
            isAIAnalysisIncluded: true,
            juryWeight: 40,
            aiWeight: 30,
            communityWeight: 30,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
    });

    const { control: notifControl, handleSubmit: handleNotifSubmit, reset: resetNotif } = useForm<{ title: string; message: string; targetLevel: string; type: any }>({
        defaultValues: { title: '', message: '', targetLevel: 'all', type: 'system' }
    });
    
    const selectedLevel = lessonWatch('level');
    const selectedJuryIds = compWatch('juryIds');
    const scoringModel = compWatch('scoringModel');

    useEffect(() => {
        if (scoringModel === 'community') {
            setCompValue('isCommunityVoteActive', true);
            setCompValue('isAIAnalysisIncluded', false);
            setCompValue('juryWeight', 0);
            setCompValue('aiWeight', 0);
            setCompValue('communityWeight', 100);
        } else if (scoringModel === 'jury_ai') {
            setCompValue('isCommunityVoteActive', false);
            setCompValue('isAIAnalysisIncluded', true);
            setCompValue('juryWeight', 70);
            setCompValue('aiWeight', 30);
            setCompValue('communityWeight', 0);
        } else if (scoringModel === 'hybrid') {
            setCompValue('isCommunityVoteActive', true);
            setCompValue('isAIAnalysisIncluded', true);
            setCompValue('juryWeight', 40);
            setCompValue('aiWeight', 30);
            setCompValue('communityWeight', 30);
        } else if (scoringModel === 'ai_only') {
            setCompValue('isCommunityVoteActive', false);
            setCompValue('isAIAnalysisIncluded', true);
            setCompValue('juryWeight', 0);
            setCompValue('aiWeight', 100);
            setCompValue('communityWeight', 0);
        }
    }, [scoringModel, setCompValue]);

    const onGenerateLessons = async (data: { level: Level; category: string; }) => {
        if (!data.level || !data.category || !firestore || !isAdmin) return;
        setIsGenerating(true);
        try {
            const lessons = await generateDailyLessons({ level: data.level, category: data.category, language: 'tr' });
            const batch = writeBatch(firestore);
            lessons.forEach(lessonData => {
                const docRef = doc(collection(firestore, 'academyLessons'));
                batch.set(docRef, { ...lessonData, id: docRef.id, imageUrl: `https://picsum.photos/seed/${docRef.id}/600/400`, createdAt: new Date().toISOString() });
            });
            await batch.commit().catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'academyLessons',
                    operation: 'create'
                }));
            });
            toast({ title: "Başarılı!" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata!" });
        } finally { setIsGenerating(false); }
    };

    const onSubmitCompetition = async (data: CompetitionFormValues) => {
        if (!firestore || !isAdmin || isCreatingComp) return;
        setIsCreatingComp(true);

        try {
            if (editingCompId) {
                await updateDoc(doc(firestore, 'competitions', editingCompId), { ...data });
                toast({ title: "Yarışma Güncellendi" });
                setEditingCompId(null);
            } else {
                const batch = writeBatch(firestore);
                const compRef = doc(collection(firestore, 'competitions'));
                const notifRef = doc(collection(firestore, 'global_notifications'));
                const compId = compRef.id;
                
                batch.set(compRef, {
                    ...data,
                    id: compId,
                    createdAt: new Date().toISOString(),
                    imageUrl: `https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1000&auto=format&fit=crop`,
                    imageHint: data.theme,
                });
                
                batch.set(notifRef, {
                    id: notifRef.id,
                    title: "Yeni Yarışma!",
                    message: `${data.title} başladı! Katılmak için hazır mısın?`,
                    type: 'competition',
                    targetLevel: data.targetLevel === 'Neuner' ? 'all' : data.targetLevel,
                    competitionId: compId,
                    createdAt: new Date().toISOString(),
                });

                await batch.commit().catch(async (error) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: 'competitions',
                        operation: 'create'
                    }));
                });
                toast({ title: "Yarışma Oluşturuldu" });
            }
            resetComp();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsCreatingComp(false); }
    };

    const onSendNotification = async (data: { title: string; message: string; targetLevel: string; type: any }) => {
        if (!firestore || !isAdmin || isSendingNotif) return;
        setIsSendingNotif(true);
        try {
            const notifRef = doc(collection(firestore, 'global_notifications'));
            await addDoc(collection(firestore, 'global_notifications'), {
                id: notifRef.id,
                title: data.title,
                message: data.message,
                type: data.type,
                targetLevel: data.targetLevel === 'all' ? null : data.targetLevel,
                createdAt: new Date().toISOString(),
            });
            toast({ title: "Bildirim Gönderildi", description: "Duyuru başarıyla yayınlandı." });
            resetNotif();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata", description: "Bildirim gönderilemedi." });
        } finally { setIsSendingNotif(false); }
    };

    const handleEditComp = (comp: Competition) => {
        setEditingCompId(comp.id);
        setCompValue('title', comp.title);
        setCompValue('description', comp.description);
        setCompValue('theme', comp.theme);
        setCompValue('prize', comp.prize);
        setCompValue('targetLevel', comp.targetLevel);
        setCompValue('scoringModel', comp.scoringModel);
        setCompValue('juryIds', comp.juryIds || []);
        setCompValue('isCommunityVoteActive', comp.isCommunityVoteActive ?? true);
        setCompValue('isAIAnalysisIncluded', comp.isAIAnalysisIncluded ?? true);
        setCompValue('juryWeight', comp.juryWeight ?? 40);
        setCompValue('aiWeight', comp.aiWeight ?? 30);
        setCompValue('communityWeight', comp.communityWeight ?? 30);
        setCompValue('startDate', comp.startDate.split('T')[0]);
        setCompValue('endDate', comp.endDate.split('T')[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteComp = (compId: string) => {
        if (!firestore || !isAdmin) return;
        if (!confirm('Silmek istiyor musunuz?')) return;
        deleteDoc(doc(firestore, 'competitions', compId)).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `competitions/${compId}`,
                operation: 'delete'
            }));
        });
        toast({ title: "Yarışma Silindi" });
    };

    const handleEndComp = async (compId: string) => {
        if (!firestore || !isAdmin) return;
        await updateDoc(doc(firestore, 'competitions', compId), { endDate: new Date().toISOString() });
        toast({ title: "Yarışma Bitirildi" });
    };

    useEffect(() => {
        const fetchCount = async () => {
            if (!firestore || !isAdmin) return;
            try {
                const snapshot = await getCountFromServer(collection(firestore, "users"));
                setTotalUsers(snapshot.data().count);
            } catch (e) {} finally {
                setIsFetchingCount(false);
            }
        };
        fetchCount();
    }, [firestore, isAdmin]);

    if (!isAdmin && user) return <div className="p-8"><Alert variant="destructive"><AlertTitle>Erişim Engellendi</AlertTitle></Alert></div>;

    return (
        <div className="space-y-8 pb-20">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Toplam Kullanıcı</CardTitle></CardHeader>
                    <CardContent className="py-6">{isFetchingCount ? <Skeleton className="h-12 w-24" /> : <p className="text-5xl font-bold tracking-tighter text-primary">{totalUsers || '0'}</p>}</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-400" /> Ders Üret</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Controller name="level" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Seviye" /></SelectTrigger>
                                    <SelectContent>{Object.keys(curriculum).map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent></Select>
                                )} />
                                <Controller name="category" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                                    <SelectContent>{selectedLevel && curriculum[selectedLevel as Level]?.map(cat => <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>)}</SelectContent></Select>
                                )} />
                            </div>
                            <Button type="submit" disabled={isGenerating} className="w-full">Üret ve Kaydet</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-400" /> Duyuru Gönder</CardTitle>
                        <CardDescription>Kullanıcılara veya belirli seviyelere bildirim yollayın.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleNotifSubmit(onSendNotification)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Başlık</Label>
                                <Controller name="title" control={notifControl} render={({ field }) => <Input placeholder="Duyuru Başlığı" {...field} />} />
                            </div>
                            <div className="space-y-2">
                                <Label>Mesaj</Label>
                                <Controller name="message" control={notifControl} render={({ field }) => <Textarea placeholder="Kullanıcılara ne söylemek istersiniz?" {...field} />} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hedef Kitle</Label>
                                    <Controller name="targetLevel" control={notifControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Herkes</SelectItem>
                                                {gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tür</Label>
                                    <Controller name="type" control={notifControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="system">Sistem Duyurusu</SelectItem>
                                                <SelectItem value="competition">Yarışma Haberi</SelectItem>
                                                <SelectItem value="exhibition">Sergi Güncellemesi</SelectItem>
                                                <SelectItem value="reward">Ödül Bildirimi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                            </div>
                            <Button type="submit" disabled={isSendingNotif} className="w-full">
                                {isSendingNotif ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Bildirimi Yayınla
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Yarışma Başlat</CardTitle>
                        <CardDescription>Yeni bir fotoğraf yarışması kurgulayın.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCompSubmit(onSubmitCompetition)} className="space-y-4">
                            <div className="space-y-2"><Label>Başlık</Label><Controller name="title" control={compControl} render={({ field }) => <Input placeholder="Yarışma Başlığı" {...field} />} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Tema</Label><Controller name="theme" control={compControl} render={({ field }) => <Input placeholder="Siyah Beyaz vb." {...field} />} /></div>
                                <div className="space-y-2"><Label>Ödül</Label><Controller name="prize" control={compControl} render={({ field }) => <Input placeholder="100 Auro" {...field} />} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Seviye</Label>
                                    <Controller name="targetLevel" control={compControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>
                                    )} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <Controller name="scoringModel" control={compControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="community">Topluluk</SelectItem>
                                            <SelectItem value="hybrid">Hibrit</SelectItem>
                                            <SelectItem value="ai_only">Sadece AI</SelectItem>
                                        </SelectContent></Select>
                                    )} />
                                </div>
                            </div>
                            <Button type="submit" disabled={isCreatingComp} className="w-full">
                                {isCreatingComp ? <Loader2 className="mr-2 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                                Yarışmayı Oluştur
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Aktif Yarışmalar</CardTitle></CardHeader>
                <CardContent>
                    {compsLoading ? <Skeleton className="h-32 w-full" /> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Başlık</TableHead><TableHead>Seviye</TableHead><TableHead>Strateji</TableHead><TableHead className="text-right">İşlemler</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {competitions?.map((comp) => {
                                    const isEnded = new Date() > new Date(comp.endDate);
                                    return (
                                        <TableRow key={comp.id}>
                                            <TableCell className="font-medium">{comp.title}</TableCell>
                                            <TableCell><Badge variant="secondary">{comp.targetLevel}</Badge></TableCell>
                                            <TableCell><Badge variant="outline">{comp.scoringModel}</Badge></TableCell>
                                            <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleDeleteComp(comp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
