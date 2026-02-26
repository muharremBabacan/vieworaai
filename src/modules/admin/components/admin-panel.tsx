
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
import { collection, doc, writeBatch, getCountFromServer, updateDoc, deleteDoc, query, orderBy, where, addDoc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, Check, Scale, UserCheck, Cpu, Star, Bell, Send, Globe, LayoutGrid, Image as ImageIcon, Sparkles, Calendar, Rocket, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Competition, ScoringModel, User, GlobalNotification, Photo, ExhibitionConfig } from '@/types';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const [isUpdatingExhibition, setIsUpdatingExhibition] = useState(false);
    const [editingCompId, setEditingCompId] = useState<string | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43' || user?.email === 'babacan.muharrem@gmail.com';

    // Milestones logic
    const milestones = [50, 100, 200, 500, 1000, 5000];
    const nextMilestone = milestones.find(m => m > (totalUsers || 0)) || milestones[milestones.length - 1];
    const progressToMilestone = totalUsers ? Math.min((totalUsers / nextMilestone) * 100, 100) : 0;

    // Queries
    const competitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: competitions, isLoading: compsLoading } = useCollection<Competition>(competitionsQuery);

    const exhibitionQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: exhibitionPhotos, isLoading: exhibitionLoading } = useCollection<Photo>(exhibitionQuery);

    const exhibitionConfigRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'settings', 'exhibition') : null, [firestore, isAdmin]);
    const { data: exhibitionConfig } = useDoc<ExhibitionConfig>(exhibitionConfigRef);

    // Forms
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

    const { control: exhibitionForm, handleSubmit: handleExhibitionSubmit } = useForm<Omit<ExhibitionConfig, 'id' | 'updatedAt'>>({
        values: exhibitionConfig ? {
            currentTheme: exhibitionConfig.currentTheme,
            description: exhibitionConfig.description,
            endDate: exhibitionConfig.endDate?.split('T')[0] || '',
            minLevel: exhibitionConfig.minLevel,
            isActive: exhibitionConfig.isActive,
        } : {
            currentTheme: 'Serbest Tema',
            description: 'İstediğiniz kategoride fotoğrafınızı paylaşın.',
            endDate: '',
            minLevel: 'Neuner',
            isActive: true,
        }
    });
    
    const selectedLevel = lessonWatch('level');
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
            await batch.commit();
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

                await batch.commit();
                toast({ title: "Yarışma Oluşturuldu" });
            }
            resetComp();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsCreatingComp(false); }
    };

    const onUpdateExhibitionConfig = async (data: Omit<ExhibitionConfig, 'id' | 'updatedAt'>) => {
        if (!firestore || !isAdmin || isUpdatingExhibition) return;
        setIsUpdatingExhibition(true);
        try {
            await setDoc(doc(firestore, 'settings', 'exhibition'), {
                ...data,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            toast({ title: "Sergi Yapılandırması Güncellendi" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally {
            setIsUpdatingExhibition(false);
        }
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
            toast({ title: "Bildirim Gönderildi" });
            resetNotif();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsSendingNotif(false); }
    };

    const handleDeleteExhibitionPhoto = async (photoId: string) => {
        if (!firestore || !isAdmin) return;
        if (!confirm('Bu fotoğrafı sergiden kaldırmak istediğinize emin misiniz?')) return;
        try {
            await deleteDoc(doc(firestore, 'public_photos', photoId));
            toast({ title: "Fotoğraf Sergiden Kaldırıldı" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Hata" });
        }
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
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleDeleteComp = (compId: string) => {
        if (!firestore || !isAdmin) return;
        if (!confirm('Silmek istiyor musunuz?')) return;
        deleteDoc(doc(firestore, 'competitions', compId));
        toast({ title: "Yarışma Silindi" });
    };

    const handleEndComp = async (compId: string) => {
        if (!firestore || !isAdmin) return;
        if (!confirm('Yarışmayı sonlandırmak istiyor musunuz?')) return;
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
        <div className="space-y-10 pb-20">
            
            {/* 1. SEVİYE: TOTAL USERS & GROWTH GOALS (CENTERED REDESIGN) */}
            <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20 overflow-hidden relative min-h-[500px] flex items-center justify-center">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Rocket className="h-64 w-64 text-primary rotate-12" />
                </div>
                <CardContent className="py-16 relative z-10 w-full">
                    <div className="flex flex-col items-center justify-center text-center space-y-8">
                        {/* Sayı */}
                        <div className="flex items-center justify-center">
                            {isFetchingCount ? (
                                <Skeleton className="h-40 w-64" />
                            ) : (
                                <p className="text-[12rem] font-black tracking-tighter leading-none bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent drop-shadow-2xl">
                                    {totalUsers || '0'}
                                </p>
                            )}
                        </div>

                        {/* Etiketler ve Başlık */}
                        <div className="space-y-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    <h3 className="text-base font-black uppercase tracking-[0.3em] text-primary">Topluluk Büyümesi</h3>
                                </div>
                                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-70">Canlı Kullanıcı İstatistiği</p>
                            </div>
                            
                            <div className="flex flex-col items-center gap-2">
                                <Badge variant="outline" className="text-xs font-black tracking-[0.2em] border-primary/30 text-primary px-4 py-1 uppercase bg-primary/5">Kayıtlı Sanatçı</Badge>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-50">Global Erişim</p>
                            </div>
                        </div>

                        {/* Hedef Barı */}
                        <div className="w-full max-w-2xl mt-12 space-y-6">
                            <div className="flex justify-between items-end px-1">
                                <div className="text-left space-y-1">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Target className="h-3 w-3 text-accent" /> Sonraki Hedef
                                    </p>
                                    <p className="text-2xl font-black text-foreground tracking-tight">{nextMilestone} Kullanıcı</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-primary leading-none">%{progressToMilestone.toFixed(0)}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Tamamlandı</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <Progress value={progressToMilestone} className="h-5 bg-primary/10 border border-primary/5" />
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter px-1">
                                    <span>0</span>
                                    <span>{Math.floor(nextMilestone * 0.25)}</span>
                                    <span>{Math.floor(nextMilestone * 0.5)}</span>
                                    <span>{Math.floor(nextMilestone * 0.75)}</span>
                                    <span className="text-primary">{nextMilestone}</span>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed italic max-w-lg mx-auto opacity-80 pt-4">
                                "{nextMilestone} kullanıcı hedefine ulaşmak için {(nextMilestone - (totalUsers || 0))} yeni sanatçıya ihtiyacımız var. Topluluğu canlandırmak için yeni bir yarışma başlatmayı veya duyuru yapmayı düşünün."
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. SEVİYE: ACTIVE LISTS */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="flex flex-col h-[500px]">
                    <CardHeader className="shrink-0">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Trophy className="h-5 w-5 text-amber-400" /> Aktif Yarışmalar
                        </CardTitle>
                        <CardDescription>Yayında olan tüm yarışmaları buradan yönetin.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                            {compsLoading ? <div className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Başlık</TableHead>
                                            <TableHead>Seviye</TableHead>
                                            <TableHead className="text-right pr-6">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {competitions?.map((comp) => {
                                            const isEnded = new Date() > new Date(comp.endDate);
                                            return (
                                                <TableRow key={comp.id}>
                                                    <TableCell className="pl-6 font-medium">{comp.title}</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px]">{comp.targetLevel}</Badge></TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-1">
                                                            {!isEnded && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEndComp(comp.id)} title="Bitir">
                                                                    <StopCircle className="h-4 w-4 text-orange-500" />
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditComp(comp)} title="Düzenle">
                                                                <Edit className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteComp(comp.id)} title="Sil">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="flex flex-col h-[500px]">
                    <CardHeader className="shrink-0">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Globe className="h-5 w-5 text-cyan-400" /> Sergi Salonu Denetimi
                        </CardTitle>
                        <CardDescription>Halka açık sergideki son fotoğrafları kontrol edin.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-6">
                        <ScrollArea className="h-full">
                            {exhibitionLoading ? <div className="grid grid-cols-3 gap-2">{[...Array(6)].map((_,i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}</div> : (
                                <div className="grid grid-cols-3 gap-3">
                                    {exhibitionPhotos?.map((photo) => (
                                        <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border/50">
                                            <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover" unoptimized />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                                <p className="text-[8px] text-white font-bold truncate w-full text-center">@{photo.userName}</p>
                                                <Button size="icon" variant="destructive" className="h-7 w-7 rounded-full" onClick={() => handleDeleteExhibitionPhoto(photo.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!exhibitionPhotos || exhibitionPhotos.length === 0) && (
                                        <div className="col-span-3 py-20 text-center text-muted-foreground italic text-sm">Sergide henüz fotoğraf yok.</div>
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* 3. SEVİYE: MANAGEMENT TOOLS */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-purple-400" /> Ders Üretme Aracı
                        </CardTitle>
                        <CardDescription>AI ile seçtiğiniz seviyede 5 yeni mikro-ders oluşturun.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Controller name="level" control={lessonControl} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                            <Button type="submit" disabled={isGenerating} className="w-full h-11 font-bold">
                                {isGenerating ? <Loader2 className="mr-2 animate-spin h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Dersleri Üret ve Kaydet
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-blue-400" /> Duyuru Merkezi
                        </CardTitle>
                        <CardDescription>Kullanıcılara veya belirli seviyelere global bildirim yollayın.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleNotifSubmit(onSendNotification)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Hedef Kitle</Label>
                                    <Controller name="targetLevel" control={notifControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tüm Kullanıcılar</SelectItem>
                                                {gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Duyuru Türü</Label>
                                    <Controller name="type" control={notifControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="system">Sistem</SelectItem>
                                                <SelectItem value="competition">Yarışma</SelectItem>
                                                <SelectItem value="reward">Ödül</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Input placeholder="Duyuru Başlığı" {...notifControl.register('title')} className="h-10" />
                                <Textarea placeholder="Duyuru mesajınız..." {...notifControl.register('message')} className="min-h-[80px]" />
                            </div>
                            <Button type="submit" disabled={isSendingNotif} className="w-full h-11" variant="secondary">
                                {isSendingNotif ? <Loader2 className="mr-2 animate-spin h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                Bildirimi Yayınla
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* EXHIBITION MANAGEMENT */}
            <Card className="border-cyan-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-cyan-400" /> Sergi Etkinliği Yönetimi
                    </CardTitle>
                    <CardDescription>Sergi salonunun aktif temasını ve katılım şartlarını belirleyin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleExhibitionSubmit(onUpdateExhibitionConfig)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Sergi Teması</Label>
                                    <Controller name="currentTheme" control={exhibitionForm} render={({ field }) => <Input placeholder="Örn: Şehir Işıkları" {...field} />} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Katılım Şartları / Açıklama</Label>
                                    <Controller name="description" control={exhibitionForm} render={({ field }) => <Textarea placeholder="Serginin amacı ve kuralları..." {...field} className="min-h-[100px]" />} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bitiş Tarihi</Label>
                                        <Controller name="endDate" control={exhibitionForm} render={({ field }) => <Input type="date" {...field} />} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Min. Seviye Şartı</Label>
                                        <Controller name="minLevel" control={exhibitionForm} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 py-4">
                                    <Label>Sergi Aktif mi?</Label>
                                    <Controller name="isActive" control={exhibitionForm} render={({ field }) => (
                                        <Button 
                                            type="button" 
                                            variant={field.value ? "default" : "outline"} 
                                            size="sm" 
                                            onClick={() => field.onChange(!field.value)}
                                        >
                                            {field.value ? "Yayında" : "Yayından Kaldırıldı"}
                                        </Button>
                                    )} />
                                </div>
                            </div>
                        </div>
                        <Button type="submit" disabled={isUpdatingExhibition} className="w-full h-12 font-bold bg-cyan-600 hover:bg-cyan-700">
                            {isUpdatingExhibition ? <Loader2 className="mr-2 animate-spin h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                            Sergi Kurallarını Güncelle
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* COMPETITION FORM */}
            <Card className="border-amber-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-400" /> {editingCompId ? 'Yarışmayı Güncelle' : 'Yeni Yarışma Başlat'}
                    </CardTitle>
                    <CardDescription>Resmi global yarışma parametrelerini belirleyin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCompSubmit(onSubmitCompetition)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="space-y-2"><Label>Başlık</Label><Controller name="title" control={compControl} render={({ field }) => <Input placeholder="Yarışma Başlığı" {...field} />} /></div>
                                <div className="space-y-2"><Label>Açıklama</Label><Controller name="description" control={compControl} render={({ field }) => <Textarea placeholder="Kurallar ve detaylar..." {...field} className="min-h-[120px]" />} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Tema</Label><Controller name="theme" control={compControl} render={({ field }) => <Input placeholder="Örn: Siyah Beyaz" {...field} />} /></div>
                                    <div className="space-y-2"><Label>Ödül</Label><Controller name="prize" control={compControl} render={({ field }) => <Input placeholder="Örn: 100 Auro" {...field} />} /></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Hedef Seviye</Label><Controller name="targetLevel" control={compControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>
                                    )} /></div>
                                    <div className="space-y-2"><Label>Puanlama Modeli</Label><Controller name="scoringModel" control={compControl} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="community">Sadece Topluluk</SelectItem>
                                            <SelectItem value="hybrid">Hibrit (Jüri+AI+Topluluk)</SelectItem>
                                            <SelectItem value="ai_only">Sadece AI</SelectItem>
                                        </SelectContent></Select>
                                    )} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Başlangıç Tarihi</Label><Controller name="startDate" control={compControl} render={({ field }) => <Input type="date" {...field} />} /></div>
                                    <div className="space-y-2"><Label>Bitiş Tarihi</Label><Controller name="endDate" control={compControl} render={({ field }) => <Input type="date" {...field} />} /></div>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-4">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Puan Ağırlıkları (%)</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1"><Label className="text-[10px]">Jüri</Label><Input type="number" {...compControl.register('juryWeight')} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-[10px]">AI</Label><Input type="number" {...compControl.register('aiWeight')} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-[10px]">Topluluk</Label><Input type="number" {...compControl.register('communityWeight')} className="h-8 text-xs" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button type="submit" disabled={isCreatingComp} className="flex-1 h-12 text-lg font-bold">
                                {isCreatingComp ? <Loader2 className="mr-2 animate-spin" /> : <Trophy className="mr-2 h-5 w-5" />}
                                {editingCompId ? 'Değişiklikleri Kaydet' : 'Yarışmayı Hemen Başlat'}
                            </Button>
                            {editingCompId && (
                                <Button type="button" variant="outline" className="h-12 px-8" onClick={() => { setEditingCompId(null); resetComp(); }}>İptal</Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
