
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
import { Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, Check, Bell, Send, Globe, LayoutGrid, Sparkles, Target, Rocket, Calendar, Flag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Competition, ScoringModel, User, Exhibition } from '@/types';
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

interface ExhibitionFormValues {
    id?: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    minLevel: string;
    isActive: boolean;
}

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreatingComp, setIsCreatingComp] = useState(false);
    const [isCreatingExhib, setIsCreatingExhib] = useState(false);
    const [isSendingNotif, setIsSendingNotif] = useState(false);
    const [editingCompId, setEditingCompId] = useState<string | null>(null);
    const [editingExhibId, setEditingExhibId] = useState<string | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43' || user?.email === 'babacan.muharrem@gmail.com';

    const milestones = [50, 100, 200, 500, 1000, 5000];
    const nextMilestone = milestones.find(m => m > (totalUsers || 0)) || milestones[milestones.length - 1];
    const progressToMilestone = totalUsers ? Math.min((totalUsers / nextMilestone) * 100, 100) : 0;

    // Fetch Competitions
    const competitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: competitions, isLoading: compsLoading } = useCollection<Competition>(competitionsQuery);

    // Fetch Exhibitions
    const exhibitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'exhibitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: exhibitions, isLoading: exhibsLoading } = useCollection<Exhibition>(exhibitionsQuery);

    // Forms
    const { control: lessonControl, watch: lessonWatch, handleSubmit: handleLessonSubmit } = useForm<{ level: Level; category: string; }>({
        defaultValues: { level: 'Temel', category: '' }
    });

    const { control: compControl, handleSubmit: handleCompSubmit, reset: resetComp, setValue: setCompValue, watch: compWatch } = useForm<CompetitionFormValues>({
        defaultValues: {
            title: '', description: '', theme: '', prize: '', targetLevel: 'Neuner', scoringModel: 'hybrid',
            juryIds: [], isCommunityVoteActive: true, isAIAnalysisIncluded: true, juryWeight: 40, aiWeight: 30, communityWeight: 30,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
    });

    const { control: exhibControl, handleSubmit: handleExhibSubmit, reset: resetExhib, setValue: setExhibValue } = useForm<ExhibitionFormValues>({
        defaultValues: {
            title: '', description: '', minLevel: 'Neuner', isActive: true,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
    });

    const { control: notifControl, handleSubmit: handleNotifSubmit, reset: resetNotif } = useForm<{ title: string; message: string; targetLevel: string; type: any }>({
        defaultValues: { title: '', message: '', targetLevel: 'all', type: 'system' }
    });

    const selectedLevel = lessonWatch('level');
    const compScoringModel = compWatch('scoringModel');

    useEffect(() => {
        if (compScoringModel === 'community') {
            setCompValue('juryWeight', 0); setCompValue('aiWeight', 0); setCompValue('communityWeight', 100);
        } else if (compScoringModel === 'jury_ai') {
            setCompValue('juryWeight', 70); setCompValue('aiWeight', 30); setCompValue('communityWeight', 0);
        } else if (compScoringModel === 'hybrid') {
            setCompValue('juryWeight', 40); setCompValue('aiWeight', 30); setCompValue('communityWeight', 30);
        } else if (compScoringModel === 'ai_only') {
            setCompValue('juryWeight', 0); setCompValue('aiWeight', 100); setCompValue('communityWeight', 0);
        }
    }, [compScoringModel, setCompValue]);

    // Handlers
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
            toast({ title: "Dersler oluşturuldu!" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata!" });
        } finally { setIsGenerating(false); }
    };

    const onSubmitCompetition = async (data: CompetitionFormValues) => {
        if (!firestore || !isAdmin) return;
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
                batch.set(compRef, { ...data, id: compRef.id, createdAt: new Date().toISOString(), imageUrl: `https://picsum.photos/seed/${compRef.id}/800/400`, imageHint: data.theme });
                batch.set(notifRef, { id: notifRef.id, title: "Yeni Yarışma!", message: `${data.title} başladı!`, type: 'competition', targetLevel: data.targetLevel === 'Neuner' ? 'all' : data.targetLevel, competitionId: compRef.id, createdAt: new Date().toISOString() });
                await batch.commit();
                toast({ title: "Yarışma Başlatıldı" });
            }
            resetComp();
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsCreatingComp(false); }
    };

    const onSubmitExhibition = async (data: ExhibitionFormValues) => {
        if (!firestore || !isAdmin) return;
        setIsCreatingExhib(true);
        try {
            if (editingExhibId) {
                await updateDoc(doc(firestore, 'exhibitions', editingExhibId), { ...data, updatedAt: new Date().toISOString() });
                toast({ title: "Sergi Güncellendi" });
                setEditingExhibId(null);
            } else {
                const batch = writeBatch(firestore);
                const exhibRef = doc(collection(firestore, 'exhibitions'));
                const notifRef = doc(collection(firestore, 'global_notifications'));
                batch.set(exhibRef, { ...data, id: exhibRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), imageUrl: `https://picsum.photos/seed/${exhibRef.id}/800/400`, imageHint: data.title });
                batch.set(notifRef, { id: notifRef.id, title: "Yeni Sergi Açıldı!", message: `${data.title} sergi salonunda yerini al!`, type: 'exhibition', targetLevel: data.minLevel === 'Neuner' ? 'all' : data.minLevel, exhibitionId: exhibRef.id, createdAt: new Date().toISOString() });
                await batch.commit();
                toast({ title: "Sergi Yayına Alındı" });
            }
            resetExhib();
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsCreatingExhib(false); }
    };

    const onSendNotification = async (data: { title: string; message: string; targetLevel: string; type: any }) => {
        if (!firestore || !isAdmin) return;
        setIsSendingNotif(true);
        try {
            await addDoc(collection(firestore, 'global_notifications'), { title: data.title, message: data.message, type: data.type, targetLevel: data.targetLevel === 'all' ? null : data.targetLevel, createdAt: new Date().toISOString() });
            toast({ title: "Duyuru Gönderildi" });
            resetNotif();
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSendingNotif(false); }
    };

    const handleEditComp = (comp: Competition) => {
        setEditingCompId(comp.id);
        setCompValue('title', comp.title); setCompValue('description', comp.description); setCompValue('theme', comp.theme);
        setCompValue('prize', comp.prize); setCompValue('targetLevel', comp.targetLevel); setCompValue('scoringModel', comp.scoringModel);
        setCompValue('startDate', comp.startDate.split('T')[0]); setCompValue('endDate', comp.endDate.split('T')[0]);
    };

    const handleEditExhib = (exhib: Exhibition) => {
        setEditingExhibId(exhib.id);
        setExhibValue('title', exhib.title); setExhibValue('description', exhib.description);
        setExhibValue('minLevel', exhib.minLevel); setExhibValue('isActive', exhib.isActive);
        setExhibValue('startDate', exhib.startDate.split('T')[0]); setExhibValue('endDate', exhib.endDate.split('T')[0]);
    };

    const handleEndComp = async (id: string) => {
        if (!firestore || !isAdmin) return;
        try {
            await updateDoc(doc(firestore, 'competitions', id), { endDate: new Date().toISOString() });
            toast({ title: "Yarışma Sona Erdirildi" });
        } catch (e) {}
    };

    const handleEndExhib = async (id: string) => {
        if (!firestore || !isAdmin) return;
        try {
            await updateDoc(doc(firestore, 'exhibitions', id), { endDate: new Date().toISOString(), isActive: false });
            toast({ title: "Sergi Sona Erdirildi" });
        } catch (e) {}
    };

    const handleAnnounceResults = async (comp: Competition) => {
        if (!firestore || !isAdmin) return;
        try {
            await addDoc(collection(firestore, 'global_notifications'), {
                title: "Yarışma Sonuçları!",
                message: `${comp.title} sonuçları belli oldu! Hemen incele.`,
                type: 'reward',
                targetLevel: 'all',
                competitionId: comp.id,
                createdAt: new Date().toISOString()
            });
            toast({ title: "Sonuçlar Duyuruldu" });
        } catch (e) {}
    };

    useEffect(() => {
        const fetchCount = async () => {
            if (!firestore || !isAdmin) return;
            try {
                const snapshot = await getCountFromServer(collection(firestore, "users"));
                setTotalUsers(snapshot.data().count);
            } catch (e) {} finally { setIsFetchingCount(false); }
        };
        fetchCount();
    }, [firestore, isAdmin]);

    if (!isAdmin && user) return <div className="p-8 text-center"><Alert variant="destructive"><AlertTitle>Erişim Engellendi</AlertTitle></Alert></div>;

    return (
        <div className="space-y-10 pb-20">
            {/* GROWTH DASHBOARD */}
            <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20 overflow-hidden relative">
                <CardContent className="py-16 text-center space-y-8 relative z-10">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Rocket className="h-64 w-64 text-primary rotate-12" /></div>
                    <div className="flex flex-col items-center">
                        {isFetchingCount ? <Skeleton className="h-40 w-64" /> : <p className="text-[12rem] font-black tracking-tighter leading-none bg-gradient-to-b from-white to-muted-foreground bg-clip-text text-transparent drop-shadow-2xl">{totalUsers || '0'}</p>}
                        <div className="flex flex-col items-center gap-2 mt-4">
                            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h3 className="text-base font-black uppercase tracking-[0.3em] text-primary">Topluluk Büyümesi</h3></div>
                            <Badge variant="outline" className="text-xs font-black tracking-[0.2em] border-primary/30 text-primary px-4 py-1 uppercase bg-primary/5">Kayıtlı Sanatçı</Badge>
                        </div>
                    </div>
                    <div className="w-full max-w-2xl mx-auto space-y-6">
                        <div className="flex justify-between items-end px-1">
                            <div className="text-left space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><Target className="h-3 w-3 text-accent" /> Sonraki Hedef</p><p className="text-2xl font-black text-foreground tracking-tight">{nextMilestone} Kullanıcı</p></div>
                            <div className="text-right"><p className="text-3xl font-black text-primary leading-none">%{progressToMilestone.toFixed(0)}</p><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Tamamlandı</p></div>
                        </div>
                        <Progress value={progressToMilestone} className="h-5 rounded-full bg-secondary/50" />
                    </div>
                </CardContent>
            </Card>

            {/* ACTIVE LISTS */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Competition List */}
                <Card className="flex flex-col overflow-hidden">
                    <CardHeader className="bg-secondary/20 border-b pb-4"><CardTitle className="flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-amber-400" /> Yarışma Yönetimi</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="max-h-[500px]">
                            <Table>
                                <TableHeader><TableRow><TableHead className="pl-6">Başlık</TableHead><TableHead>Durum</TableHead><TableHead className="text-right pr-6">İşlemler</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {competitions?.map(comp => {
                                        const isEnded = new Date(comp.endDate) < new Date();
                                        return (
                                            <TableRow key={comp.id} className="hover:bg-muted/30">
                                                <TableCell className="pl-6 py-4 font-semibold">{comp.title}</TableCell>
                                                <TableCell>{isEnded ? <Badge variant="secondary">Bitti</Badge> : <Badge className="bg-green-500/20 text-green-500 border-none">Aktif</Badge>}</TableCell>
                                                <TableCell className="text-right pr-6"><div className="flex justify-end gap-1">
                                                    {!isEnded && <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" title="Bitir" onClick={() => handleEndComp(comp.id)}><StopCircle className="h-4 w-4" /></Button>}
                                                    {isEnded && <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title="Sonuçları Duyur" onClick={() => handleAnnounceResults(comp)}><Flag className="h-4 w-4" /></Button>}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" title="Düzenle" onClick={() => handleEditComp(comp)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Sil" onClick={() => { if(confirm('Emin misiniz?')) deleteDoc(doc(firestore!, 'competitions', comp.id)) }}><Trash2 className="h-4 w-4" /></Button>
                                                </div></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Exhibition List */}
                <Card className="flex flex-col overflow-hidden">
                    <CardHeader className="bg-secondary/20 border-b pb-4"><CardTitle className="flex items-center gap-2 text-lg font-bold"><Globe className="h-5 w-5 text-cyan-400" /> Sergi Yönetimi</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="max-h-[500px]">
                            <Table>
                                <TableHeader><TableRow><TableHead className="pl-6">Tema</TableHead><TableHead>Durum</TableHead><TableHead className="text-right pr-6">İşlemler</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {exhibitions?.map(exhib => {
                                        const isEnded = new Date(exhib.endDate) < new Date();
                                        return (
                                            <TableRow key={exhib.id} className="hover:bg-muted/30">
                                                <TableCell className="pl-6 py-4 font-semibold">{exhib.title}</TableCell>
                                                <TableCell>{(exhib.isActive && !isEnded) ? <Badge className="bg-cyan-500/20 text-cyan-500 border-none">Yayında</Badge> : <Badge variant="outline">Pasif</Badge>}</TableCell>
                                                <TableCell className="text-right pr-6"><div className="flex justify-end gap-1">
                                                    {exhib.isActive && !isEnded && <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" title="Kapat" onClick={() => handleEndExhib(exhib.id)}><StopCircle className="h-4 w-4" /></Button>}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" title="Düzenle" onClick={() => handleEditExhib(exhib)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Sil" onClick={() => { if(confirm('Emin misiniz?')) deleteDoc(doc(firestore!, 'exhibitions', exhib.id)) }}><Trash2 className="h-4 w-4" /></Button>
                                                </div></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* CREATION TOOLS */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> {editingCompId ? 'Yarışmayı Düzenle' : 'Yeni Yarışma Ekle'}</CardTitle></CardHeader>
                    <CardContent><form onSubmit={handleCompSubmit(onSubmitCompetition)} className="space-y-4">
                        <Input placeholder="Yarışma Başlığı" {...compControl.register('title')} />
                        <Textarea placeholder="Açıklama" {...compControl.register('description')} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="Tema" {...compControl.register('theme')} />
                            <Input placeholder="Ödül" {...compControl.register('prize')} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Controller name="targetLevel" control={compControl} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Hedef Seviye" /></SelectTrigger><SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>
                            )} />
                            <Controller name="scoringModel" control={compControl} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Puanlama" /></SelectTrigger><SelectContent><SelectItem value="community">Topluluk</SelectItem><SelectItem value="hybrid">Hibrit</SelectItem><SelectItem value="ai_only">Sadece AI</SelectItem></SelectContent></Select>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Başlangıç</Label><Input type="date" {...compControl.register('startDate')} /></div>
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Bitiş</Label><Input type="date" {...compControl.register('endDate')} /></div>
                        </div>
                        <Button type="submit" disabled={isCreatingComp} className="w-full h-11 font-bold">{isCreatingComp ? <Loader2 className="animate-spin" /> : editingCompId ? 'Bilgileri Güncelle' : 'Yarışmayı Başlat'}</Button>
                        {editingCompId && <Button type="button" variant="outline" className="w-full" onClick={() => { setEditingCompId(null); resetComp(); }}>İptal</Button>}
                    </form></CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-cyan-400" /> {editingExhibId ? 'Sergiyi Düzenle' : 'Yeni Sergi Ekle'}</CardTitle></CardHeader>
                    <CardContent><form onSubmit={handleExhibSubmit(onSubmitExhibition)} className="space-y-4">
                        <Input placeholder="Sergi Teması" {...exhibControl.register('title')} />
                        <Textarea placeholder="Sergi Açıklaması" {...exhibControl.register('description')} />
                        <div className="grid grid-cols-2 gap-4">
                            <Controller name="minLevel" control={exhibControl} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Min. Seviye" /></SelectTrigger><SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>
                            )} />
                            <div className="flex items-center gap-2 px-3 border rounded-md">
                                <Label className="text-xs">Aktif</Label>
                                <Controller name="isActive" control={exhibControl} render={({ field }) => <Button type="button" variant={field.value ? 'default' : 'outline'} size="sm" onClick={() => field.onChange(!field.value)}>{field.value ? 'Açık' : 'Kapalı'}</Button>} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Başlangıç</Label><Input type="date" {...exhibControl.register('startDate')} /></div>
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Bitiş</Label><Input type="date" {...exhibControl.register('endDate')} /></div>
                        </div>
                        <Button type="submit" disabled={isCreatingExhib} className="w-full h-11 font-bold bg-cyan-600 hover:bg-cyan-700">{isCreatingExhib ? <Loader2 className="animate-spin" /> : editingExhibId ? 'Sergiyi Güncelle' : 'Sergiyi Başlat'}</Button>
                        {editingExhibId && <Button type="button" variant="outline" className="w-full" onClick={() => { setEditingExhibId(null); resetExhib(); }}>İptal</Button>}
                    </form></CardContent>
                </Card>
            </div>

            {/* OTHER TOOLS */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-400" /> Ders Üretme Aracı</CardTitle></CardHeader>
                    <CardContent><form onSubmit={handleLessonSubmit(onGenerateLessons)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Controller name="level" control={lessonControl} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(curriculum).map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent></Select>} />
                            <Controller name="category" control={lessonControl} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Kategori Seçin" /></SelectTrigger><SelectContent>{selectedLevel && curriculum[selectedLevel as Level]?.map(cat => <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>)}</SelectContent></Select>} />
                        </div>
                        <Button type="submit" disabled={isGenerating} className="w-full h-11 font-bold">
                            {isGenerating ? <Loader2 className="mr-2 animate-spin h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Dersleri Üret ve Kaydet
                        </Button>
                    </form></CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-blue-400" /> Manuel Duyuru Merkezi</CardTitle></CardHeader>
                    <CardContent><form onSubmit={handleNotifSubmit(onSendNotification)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Controller name="targetLevel" control={notifControl} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Hedef Kitle" /></SelectTrigger><SelectContent><SelectItem value="all">Herkes</SelectItem>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select>} />
                            <Controller name="type" control={notifControl} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">Sistem</SelectItem><SelectItem value="reward">Ödül</SelectItem><SelectItem value="exhibition">Sergi</SelectItem></SelectContent></Select>} />
                        </div>
                        <Input placeholder="Duyuru Başlığı" {...notifControl.register('title')} />
                        <Textarea placeholder="Duyuru mesajı..." {...notifControl.register('message')} />
                        <Button type="submit" disabled={isSendingNotif} className="w-full h-11 font-bold" variant="secondary"><Send className="mr-2 h-4 w-4" /> Bildirimi Yayınla</Button>
                    </form></CardContent>
                </Card>
            </div>
        </div>
    );
}
    