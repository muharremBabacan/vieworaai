'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { generateDailyLessons } from '@/ai/flows/generate-daily-lessons';
import { collection, doc, writeBatch, getCountFromServer, updateDoc, deleteDoc, query, orderBy, where, addDoc, limit, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import { 
    Loader2, Users, BookOpen, Trophy, Trash2, 
    Sparkles, Globe, Rocket, PieChart, Coins, Activity, Camera, Plus, Scale, Cpu, Star
} from 'lucide-react';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { Competition, User, Exhibition, DailyStats, AnalysisLog } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

const competitionSchema = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    theme: z.string().min(3),
    prize: z.string().min(3),
    targetLevel: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    scoringModel: z.enum(['community', 'jury_ai', 'hybrid', 'ai_only', 'custom']),
    juryWeight: z.number().min(0).max(100),
    aiWeight: z.number().min(0).max(100),
    communityWeight: z.number().min(0).max(100),
    imageHint: z.string().min(2)
});

const exhibitionSchema = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    minLevel: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    imageHint: z.string().min(2)
});

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'>('daily');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'analysis' | 'exhibition' | 'competition'>('all');

    const isAdmin = useMemo(() => {
        if (!user) return false;
        const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
        const adminUids = ['01DT86bQwWUVmrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
        return adminEmails.includes(user.email || '') || adminUids.includes(user.uid);
    }, [user]);

    const statsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'global_stats'), orderBy('date', 'desc'), limit(30)) : null,
        [firestore, isAdmin]
    );
    const { data: globalStats } = useCollection<DailyStats>(statsQuery);

    const logsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'analysis_logs'), orderBy('timestamp', 'desc'), limit(200)) : null,
        [firestore, isAdmin]
    );
    const { data: recentLogs } = useCollection<AnalysisLog>(logsQuery);

    const competitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: competitions } = useCollection<Competition>(competitionsQuery);

    const exhibitionsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'exhibitions'), orderBy('createdAt', 'desc')) : null,
        [firestore, isAdmin]
    );
    const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

    const competitionForm = useForm<z.infer<typeof competitionSchema>>({
        resolver: zodResolver(competitionSchema),
        defaultValues: {
            title: '', description: '', theme: '', prize: '', targetLevel: 'Neuner',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            scoringModel: 'hybrid', juryWeight: 40, aiWeight: 40, communityWeight: 20,
            imageHint: 'photography competition'
        }
    });

    const exhibitionForm = useForm<z.infer<typeof exhibitionSchema>>({
        resolver: zodResolver(exhibitionSchema),
        defaultValues: {
            title: '', description: '', minLevel: 'Neuner',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            imageHint: 'art gallery exhibition'
        }
    });

    const metrics = useMemo(() => {
        if (!globalStats || !recentLogs) return null;
        const totalAuroSpent = recentLogs.reduce((acc, log) => acc + (log.auroSpent || 0), 0);
        
        return {
            today: globalStats[0] || { dau: 0, photoUploads: 0, technicalAnalyses: 0, mentorAnalyses: 0 },
            totalAuroSpent,
            technicalAuro: recentLogs.filter(l => l.type === 'technical').reduce((acc, l) => acc + l.auroSpent, 0),
            mentorAuro: recentLogs.filter(l => l.type === 'mentor').reduce((acc, l) => acc + l.auroSpent, 0),
            exhibitionAuro: recentLogs.filter(l => l.type === 'exhibition').reduce((acc, l) => acc + l.auroSpent, 0),
            competitionAuro: recentLogs.filter(l => l.type === 'competition').reduce((acc, l) => acc + l.auroSpent, 0),
            totalAnalyses: recentLogs.filter(l => l.type === 'technical' || l.type === 'mentor').length
        };
    }, [globalStats, recentLogs]);

    useEffect(() => {
        const fetchCount = async () => {
            if (!firestore || !isAdmin) return;
            try {
                const snapshot = await getCountFromServer(collection(firestore, "users"));
                setTotalUsers(snapshot.data().count);
            } catch (e) {
                console.error("User count fetch error", e);
            } finally { setIsFetchingCount(false); }
        };
        fetchCount();
    }, [firestore, isAdmin]);

    const handleGenerateLessons = async () => {
        if (!selectedLevel || !selectedCategory) {
            toast({ variant: 'destructive', title: "Seçim Eksik" });
            return;
        }
        setIsGenerating(true);
        try {
            const lessons = await generateDailyLessons({ level: selectedLevel as any, category: selectedCategory, language: 'tr' });
            const batch = writeBatch(firestore);
            lessons.forEach(lesson => {
                const newDocRef = doc(collection(firestore, 'academyLessons'));
                batch.set(newDocRef, { ...lesson, id: newDocRef.id, createdAt: new Date().toISOString() });
            });
            await batch.commit();
            toast({ title: "Dersler Oluşturuldu" });
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsGenerating(false); }
    };

    const onCreateCompetition = async (values: z.infer<typeof competitionSchema>) => {
        if (!firestore || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const imageUrl = `https://picsum.photos/seed/${values.imageHint.replace(/\s/g, '')}/1200/800`;
            const docRef = await addDoc(collection(firestore, 'competitions'), {
                ...values,
                imageUrl,
                createdAt: new Date().toISOString()
            });
            await updateDoc(docRef, { id: docRef.id });
            toast({ title: "Yarışma Oluşturuldu" });
            competitionForm.reset();
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
    };

    const onCreateExhibition = async (values: z.infer<typeof exhibitionSchema>) => {
        if (!firestore || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const imageUrl = `https://picsum.photos/seed/${values.imageHint.replace(/\s/g, '')}/1200/800`;
            const docRef = await addDoc(collection(firestore, 'exhibitions'), {
                ...values,
                imageUrl,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await updateDoc(docRef, { id: docRef.id });
            toast({ title: "Sergi Salonu Açıldı" });
            exhibitionForm.reset();
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
    };

    const handleDelete = async (col: string, id: string) => {
        if (!confirm("Silmek istediğinize emin misiniz?")) return;
        try {
            await deleteDoc(doc(firestore, col, id));
            toast({ title: "Silindi" });
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
    };

    if (!isAdmin && user) return <div className="p-8 text-center"><Badge variant="destructive" className="px-4 py-2">Erişim Engellendi</Badge></div>;

    return (
        <div className="space-y-10 pb-32">
            {/* HERO: TOTAL USER COUNT */}
            <div className="relative overflow-hidden rounded-[40px] border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-12 text-center shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <Badge variant="outline" className="text-[10px] font-black tracking-[0.3em] border-primary/30 text-primary px-6 py-1.5 uppercase bg-primary/5 rounded-full animate-in fade-in zoom-in duration-700">Kayıtlı Vizyoner Topluluğu</Badge>
                    <div className="flex flex-col items-center justify-center min-h-[120px]">
                        {isFetchingCount ? (
                            <div className="flex items-center gap-3 text-muted-foreground/30">
                                <Loader2 className="h-12 w-12 animate-spin" /><span className="text-4xl font-black animate-pulse">Tarama yapılıyor...</span>
                            </div>
                        ) : (
                            <div className="animate-in slide-in-from-bottom-8 duration-1000 ease-out">
                                <p className="text-9xl font-black tracking-tighter leading-none bg-gradient-to-b from-white via-white to-muted-foreground/50 bg-clip-text text-transparent drop-shadow-sm">{totalUsers?.toLocaleString('tr-TR') || '0'}</p>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium tracking-wide opacity-60">Viewora ekosistemi büyümeye devam ediyor.</p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-secondary/20 p-2 rounded-[24px] border border-border/40 backdrop-blur-md sticky top-20 z-40">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {['hourly', 'daily', 'weekly', 'monthly', 'all'].map((f) => (
                        <Button 
                            key={f} 
                            variant={timeFilter === f ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-xl text-[10px] font-bold uppercase tracking-widest px-4 h-9"
                            onClick={() => setTimeFilter(f as any)}
                        >
                            {f === 'hourly' ? 'Saatlik' : f === 'daily' ? 'Günlük' : f === 'weekly' ? 'Haftalık' : f === 'monthly' ? 'Aylık' : 'Tümü'}
                        </Button>
                    ))}
                </div>
                <div className="hidden sm:block h-6 w-px bg-border/50 mx-2" />
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {['all', 'analysis', 'exhibition', 'competition'].map((c) => (
                        <Button 
                            key={c} 
                            variant={categoryFilter === c ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-xl text-[10px] font-bold uppercase tracking-widest px-4 h-9"
                            onClick={() => setCategoryFilter(c as any)}
                        >
                            {c === 'all' ? 'Hepsi' : c === 'analysis' ? 'Analiz' : c === 'exhibition' ? 'Sergi' : 'Yarışma'}
                        </Button>
                    ))}
                </div>
            </div>

            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="bg-secondary/30 p-1 rounded-2xl mb-8">
                    <TabsTrigger value="dashboard" className="rounded-xl flex items-center gap-2"><PieChart className="h-4 w-4" /> Dashboard</TabsTrigger>
                    <TabsTrigger value="accounting" className="rounded-xl flex items-center gap-2"><Coins className="h-4 w-4" /> Muhasebe</TabsTrigger>
                    <TabsTrigger value="operations" className="rounded-xl flex items-center gap-2"><Rocket className="h-4 w-4" /> Operasyonlar</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-primary/5 border-primary/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">Aktif Sanatçılar (DAU)</CardDescription></CardHeader>
                            <CardContent><div className="flex items-center justify-between"><p className="text-4xl font-black">{metrics?.today.dau || 0}</p><Users className="h-6 w-6 text-primary opacity-40" /></div></CardContent>
                        </Card>
                        <Card className="bg-purple-500/5 border-purple-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Toplam Analiz</CardDescription></CardHeader>
                            <CardContent><div className="flex items-center justify-between"><p className="text-4xl font-black">{metrics?.totalAnalyses || 0}</p><Sparkles className="h-6 w-6 text-purple-400 opacity-40" /></div></CardContent>
                        </Card>
                        <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-cyan-400/70">Fotoğraf Trafiği</CardDescription></CardHeader>
                            <CardContent><div className="flex items-center justify-between"><p className="text-4xl font-black">{metrics?.today.photoUploads || 0}</p><Camera className="h-6 w-6 text-cyan-400 opacity-40" /></div></CardContent>
                        </Card>
                        <Card className="bg-amber-500/5 border-amber-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-amber-400/70">Yarışma & Sergi</CardDescription></CardHeader>
                            <CardContent><div className="flex items-center justify-between"><p className="text-4xl font-black">{(competitions?.length || 0) + (exhibitions?.length || 0)}</p><Globe className="h-6 w-6 text-amber-400 opacity-40" /></div></CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="accounting" className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                        <Card className="bg-green-500/10 border-green-500/20 rounded-[24px] lg:col-span-1 shadow-lg shadow-green-500/5">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-green-400 tracking-widest">Harcanan Toplam</CardDescription></CardHeader>
                            <CardContent><p className="text-5xl font-black text-green-400 drop-shadow-sm">{metrics?.totalAuroSpent || 0}</p></CardContent>
                        </Card>
                        
                        <Card className="bg-blue-500/5 border-blue-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-blue-400/70">Teknik Analiz</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-black">{metrics?.technicalAuro || 0}</p></CardContent>
                        </Card>

                        <Card className="bg-purple-500/5 border-purple-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-purple-400/70">Mentorluk</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-black">{metrics?.mentorAuro || 0}</p></CardContent>
                        </Card>

                        <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-cyan-400/70">Sergi</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-black">{metrics?.exhibitionAuro || 0}</p></CardContent>
                        </Card>

                        <Card className="bg-amber-500/5 border-amber-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-amber-400/70">Yarışma</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-black">{metrics?.competitionAuro || 0}</p></CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-[24px]">
                        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Son İşlemler</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="pl-6">Sanatçı</TableHead><TableHead>Tür</TableHead><TableHead>Miktar</TableHead><TableHead className="text-right pr-6">Tarih</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {recentLogs?.map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell className="pl-6 font-bold">{log.userName}</TableCell>
                                                <TableCell><Badge variant="secondary" className="text-[10px] uppercase font-bold">{log.type}</Badge></TableCell>
                                                <TableCell className="font-black text-red-400">-{log.auroSpent}</TableCell>
                                                <TableCell className="text-right pr-6 text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('tr-TR')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="operations" className="space-y-12">
                    <Card className="rounded-[24px]">
                        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Akademi Ders Üretimi</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground">Zorluk</Label>
                                    <Select value={selectedLevel} onValueChange={v => { setSelectedLevel(v); setSelectedCategory(''); }}>
                                        <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                                        <SelectContent>{Object.keys(curriculum).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground">Müfredat</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedLevel}>
                                        <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                                        <SelectContent>{selectedLevel && curriculum[selectedLevel as keyof typeof curriculum].map(c => <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleGenerateLessons} disabled={isGenerating} className="w-full h-12 font-bold rounded-xl">{isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="mr-2" />} AI Üretimi Başlat</Button>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Yarışma Yönetimi</CardTitle><CardDescription>Yarışmaları oluşturun ve katılımları takip edin.</CardDescription></div>
                            <Dialog>
                                <DialogTrigger asChild><Button size="sm" className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Yeni Yarışma</Button></DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader><DialogTitle>Yeni Yarışma Oluştur</DialogTitle></DialogHeader>
                                    <Form {...competitionForm}>
                                        <form onSubmit={competitionForm.handleSubmit(onCreateCompetition)} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={competitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Başlık</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={competitionForm.control} name="theme" render={({ field }) => (<FormItem><FormLabel>Tema</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            </div>
                                            <FormField control={competitionForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Açıklama</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <div className="grid grid-cols-3 gap-4">
                                                <FormField control={competitionForm.control} name="prize" render={({ field }) => (<FormItem><FormLabel>Ödül</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={competitionForm.control} name="targetLevel" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Seviye</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={competitionForm.control} name="scoringModel" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Model</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="hybrid">Hibrit</SelectItem>
                                                                <SelectItem value="ai_only">Sadece AI</SelectItem>
                                                                <SelectItem value="community">Topluluk</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-xl">
                                                <FormField control={competitionForm.control} name="juryWeight" render={({ field }) => (<FormItem><FormLabel>Jüri %</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>)} />
                                                <FormField control={competitionForm.control} name="aiWeight" render={({ field }) => (<FormItem><FormLabel>AI %</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>)} />
                                                <FormField control={competitionForm.control} name="communityWeight" render={({ field }) => (<FormItem><FormLabel>Topluluk %</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={competitionForm.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Başlangıç</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={competitionForm.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Bitiş</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                            <FormField control={competitionForm.control} name="imageHint" render={({ field }) => (<FormItem><FormLabel>Görsel İpucu</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2" />} Yarışmayı Başlat</Button>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Yarışma</TableHead><TableHead>Seviye</TableHead><TableHead>Bitiş</TableHead><TableHead className="text-right">Aksiyon</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {competitions?.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-bold">{c.title}</TableCell>
                                            <TableCell><Badge variant="outline">{c.targetLevel}</Badge></TableCell>
                                            <TableCell className="text-xs">{new Date(c.endDate).toLocaleDateString('tr-TR')}</TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDelete('competitions', c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div><CardTitle className="flex items-center gap-3"><Globe className="h-5 w-5 text-cyan-500" /> Sergi Yönetimi</CardTitle><CardDescription>Sergi salonlarını açın ve temaları düzenleyin.</CardDescription></div>
                            <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Yeni Sergi</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Yeni Sergi Salonu Aç</DialogTitle></DialogHeader>
                                    <Form {...exhibitionForm}>
                                        <form onSubmit={exhibitionForm.handleSubmit(onCreateExhibition)} className="space-y-4">
                                            <FormField control={exhibitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Sergi Adı</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                            <FormField control={exhibitionForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Açıklama</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={exhibitionForm.control} name="minLevel" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Min. Seviye</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>{gamificationLevels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={exhibitionForm.control} name="imageHint" render={({ field }) => (<FormItem><FormLabel>Görsel İpucu</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={exhibitionForm.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Başlangıç</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={exhibitionForm.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Bitiş</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                            <Button type="submit" className="w-full" disabled={isSubmitting}>Sergiyi Aç</Button>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Sergi Salonu</TableHead><TableHead>Min. Seviye</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Aksiyon</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {exhibitions?.map(ex => (
                                        <TableRow key={ex.id}>
                                            <TableCell className="font-bold">{ex.title}</TableCell>
                                            <TableCell><Badge variant="outline">{ex.minLevel}</Badge></TableCell>
                                            <TableCell><Badge className={cn(ex.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>{ex.isActive ? "Aktif" : "Pasif"}</Badge></TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDelete('exhibitions', ex.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
