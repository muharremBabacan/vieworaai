
'use client';
import { useState, useEffect, useMemo } from 'react';
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
import { collection, doc, writeBatch, getCountFromServer, updateDoc, deleteDoc, query, orderBy, where, addDoc, limit, increment } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import { 
    Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, 
    Check, Bell, Send, Globe, LayoutGrid, Sparkles, Target, 
    Rocket, Calendar, Flag, Zap, TrendingUp, DollarSign, 
    Activity, Camera, Filter, PieChart, Coins, Gift, ShoppingCart
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Competition, User, Exhibition, DailyStats, AnalysisLog } from '@/types';
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

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    // --- State & Filters ---
    const [timeFilter, setTimeFilter] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'>('daily');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'analysis' | 'social' | 'auro'>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);
    
    // --- Restored Logic States ---
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [testFeedback, setTestFeedback] = useState<any>(null);
    const [isTestingCoach, setIsTestingCoach] = useState(false);

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43' || user?.email === 'babacan.muharrem@gmail.com' || user?.uid === 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1';

    // --- Data Fetching ---
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

    // --- Metrics & Accounting Calculation ---
    const metrics = useMemo(() => {
        if (!globalStats || globalStats.length === 0 || !recentLogs) return null;
        
        const today = globalStats[0];
        const last7Days = globalStats.slice(0, 7);
        
        const totalAuroSpent = recentLogs.reduce((acc, log) => acc + (log.auroSpent || 0), 0);
        const technicalAuro = recentLogs.filter(l => l.type === 'technical').reduce((acc, l) => acc + l.auroSpent, 0);
        const mentorAuro = recentLogs.filter(l => l.type === 'mentor').reduce((acc, l) => acc + l.auroSpent, 0);
        
        const exhibitionSubmissions = 42; 
        const competitionEntries = 128;
        const giftedAuro = 500;

        return {
            today,
            totalAuroSpent,
            technicalAuro,
            mentorAuro,
            avgDau: last7Days.reduce((acc, s) => acc + s.dau, 0) / last7Days.length,
            exhibitionSubmissions,
            competitionEntries,
            giftedAuro,
            totalAnalyses: recentLogs.length
        };
    }, [globalStats, recentLogs]);

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

    const handleGenerateLessons = async () => {
        if (!selectedLevel || !selectedCategory) {
            toast({ variant: 'destructive', title: "Seçim Eksik", description: "Lütfen seviye ve kategori seçin." });
            return;
        }
        setIsGenerating(true);
        try {
            const lessons = await generateDailyLessons({
                level: selectedLevel as any,
                category: selectedCategory,
                language: 'tr'
            });
            const batch = writeBatch(firestore);
            lessons.forEach(lesson => {
                const newDocRef = doc(collection(firestore, 'academyLessons'));
                batch.set(newDocRef, { ...lesson, id: newDocRef.id, createdAt: new Date().toISOString() });
            });
            await batch.commit();
            toast({ title: "Dersler Oluşturuldu", description: `${lessons.length} yeni ders sisteme eklendi.` });
        } catch (e) {
            toast({ variant: 'destructive', title: "Hata", description: "Ders üretilemedi." });
        } finally { setIsGenerating(false); }
    };

    const handleTestCoach = async () => {
        setIsTestingCoach(true);
        try {
            const mockProfile = (await import('@/lib/test_user_1.json')).default;
            const result = await generateStrategicFeedback({
                userPrompt: "Genel gelişimimi değerlendir.",
                language: "tr",
                userProfileIndex: mockProfile
            });
            setTestFeedback(result);
        } catch (e) {
            toast({ variant: 'destructive', title: "Test Hatası" });
        } finally { setIsTestingCoach(false); }
    };

    if (!isAdmin && user) return <div className="p-8 text-center"><Alert variant="destructive"><AlertTitle>Erişim Engellendi</AlertTitle></Alert></div>;

    return (
        <div className="space-y-10 pb-32">
            {/* --- HERO: TOTAL USER COUNT (STATIC & EXCITING) --- */}
            <div className="relative overflow-hidden rounded-[40px] border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-12 text-center shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <Badge variant="outline" className="text-[10px] font-black tracking-[0.3em] border-primary/30 text-primary px-6 py-1.5 uppercase bg-primary/5 rounded-full animate-in fade-in zoom-in duration-700">
                        Kayıtlı Vizyoner Topluluğu
                    </Badge>
                    
                    <div className="flex flex-col items-center justify-center min-h-[120px]">
                        {isFetchingCount ? (
                            <div className="flex items-center gap-3 text-muted-foreground/30">
                                <Loader2 className="h-12 w-12 animate-spin" />
                                <span className="text-4xl font-black animate-pulse">Tarama yapılıyor...</span>
                            </div>
                        ) : (
                            <div className="animate-in slide-in-from-bottom-8 duration-1000 ease-out">
                                <p className="text-9xl font-black tracking-tighter leading-none bg-gradient-to-b from-white via-white to-muted-foreground/50 bg-clip-text text-transparent drop-shadow-sm">
                                    {totalUsers?.toLocaleString('tr-TR') || '0'}
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground font-medium tracking-wide opacity-60">
                        Viewora ekosistemi büyümeye devam ediyor.
                    </p>
                </div>
            </div>

            {/* --- ADVANCED TOP FILTER BAR --- */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-secondary/30 border border-border/50 rounded-[24px] backdrop-blur-md sticky top-20 z-40">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                    <Filter className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                    {[
                        { id: 'hourly', label: 'Saatlik' },
                        { id: 'daily', label: 'Günlük' },
                        { id: 'weekly', label: 'Haftalık' },
                        { id: 'monthly', label: 'Aylık' },
                        { id: 'all', label: 'Tümü' }
                    ].map(f => (
                        <Button 
                            key={f.id} 
                            variant={timeFilter === f.id ? 'default' : 'ghost'} 
                            size="sm" 
                            className="rounded-xl h-8 px-4 text-xs font-bold transition-all"
                            onClick={() => setTimeFilter(f.id as any)}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
                        <SelectTrigger className="w-[140px] h-8 rounded-xl text-xs font-bold border-none bg-background/50">
                            <SelectValue placeholder="Kategori" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">Tüm Akış</SelectItem>
                            <SelectItem value="analysis">Sadece Analiz</SelectItem>
                            <SelectItem value="social">Sergi & Yarışma</SelectItem>
                            <SelectItem value="auro">Auro Ekonomisi</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="bg-secondary/30 p-1 rounded-2xl mb-8">
                    <TabsTrigger value="dashboard" className="rounded-xl flex items-center gap-2"><PieChart className="h-4 w-4" /> Dashboard</TabsTrigger>
                    <TabsTrigger value="accounting" className="rounded-xl flex items-center gap-2"><Coins className="h-4 w-4" /> Muhasebe</TabsTrigger>
                    <TabsTrigger value="operations" className="rounded-xl flex items-center gap-2"><Rocket className="h-4 w-4" /> Operasyonlar</TabsTrigger>
                </TabsList>

                {/* --- DASHBOARD TAB --- */}
                <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-primary/5 border-primary/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">Aktif Sanatçılar (DAU)</CardDescription></CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <p className="text-4xl font-black">{metrics?.today.dau || 0}</p>
                                    <Users className="h-6 w-6 text-primary opacity-40" />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">Trend: <span className="text-green-400 font-bold">↑ %12</span></p>
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-500/5 border-purple-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Toplam Analiz</CardDescription></CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <p className="text-4xl font-black">{metrics?.totalAnalyses || 0}</p>
                                    <Sparkles className="h-6 w-6 text-purple-400 opacity-40" />
                                </div>
                                <div className="flex gap-3 mt-2">
                                    <span className="text-[9px] font-bold text-blue-400">Teknik: {metrics?.today.technicalAnalyses}</span>
                                    <span className="text-[9px] font-bold text-purple-400">Mentor: {metrics?.today.mentorAnalyses}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-cyan-400/70">Fotoğraf Trafiği</CardDescription></CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <p className="text-4xl font-black">{metrics?.today.photoUploads || 0}</p>
                                    <Camera className="h-6 w-6 text-cyan-400 opacity-40" />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">Depolama Yükü: <span className="font-bold">Düşük</span></p>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-500/5 border-amber-500/20 rounded-[24px]">
                            <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Etkileşim (Sosyal)</CardDescription></CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <p className="text-4xl font-black">{(metrics?.exhibitionSubmissions || 0) + (metrics?.competitionEntries || 0)}</p>
                                    <Globe className="h-6 w-6 text-amber-400 opacity-40" />
                                </div>
                                <div className="flex gap-3 mt-2">
                                    <span className="text-[9px] font-bold text-amber-400">Sergi: {metrics?.exhibitionSubmissions}</span>
                                    <span className="text-[9px] font-bold text-orange-400">Yarışma: {metrics?.competitionEntries}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- ACCOUNTING (MUHASEBE) TAB --- */}
                <TabsContent value="accounting" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="bg-green-500/5 border-green-500/20 rounded-[24px] relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10"><Coins className="h-32 w-32" /></div>
                            <CardHeader><CardDescription className="text-xs font-bold uppercase text-green-400">Harcanan Toplam Auro</CardDescription></CardHeader>
                            <CardContent>
                                <p className="text-5xl font-black text-green-400">{metrics?.totalAuroSpent || 0}</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-[10px] uppercase font-bold"><span>Teknik</span><span>{metrics?.technicalAuro}</span></div>
                                    <Progress value={((metrics?.technicalAuro || 0) / (metrics?.totalAuroSpent || 1)) * 100} className="h-1 bg-green-500/10" />
                                    <div className="flex justify-between text-[10px] uppercase font-bold"><span>Mentor</span><span>{metrics?.mentorAuro}</span></div>
                                    <Progress value={((metrics?.mentorAuro || 0) / (metrics?.totalAuroSpent || 1)) * 100} className="h-1 bg-green-500/10" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-500/5 border-blue-500/20 rounded-[24px]">
                            <CardHeader><CardDescription className="text-xs font-bold uppercase text-blue-400">Hediye / Ücretsiz Kaynaklar</CardDescription></CardHeader>
                            <CardContent>
                                <p className="text-5xl font-black text-blue-400">{metrics?.giftedAuro || 0}</p>
                                <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">Onboarding hediyeleri ve haftalık ücretsiz yenilemeler dahil.</p>
                                <div className="mt-6 flex items-center gap-2"><Gift className="h-4 w-4 text-blue-400" /><span className="text-[10px] font-bold uppercase">Sistem Kaynaklı Akış</span></div>
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-500/5 border-purple-500/20 rounded-[24px]">
                            <CardHeader><CardDescription className="text-xs font-bold uppercase text-purple-400">Satın Alınan Paketler</CardDescription></CardHeader>
                            <CardContent>
                                <p className="text-5xl font-black text-purple-400">0</p>
                                <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">Henüz gerçek satış verisi bulunmuyor (Simülasyon aşaması).</p>
                                <div className="mt-6 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-purple-400" /><span className="text-[10px] font-bold uppercase">Mağaza Performansı</span></div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-[24px]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Mali Hareketler</CardTitle>
                            <CardDescription>Auro harcanan ve kazanılan tüm işlemlerin detaylı dökümü.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">İşlem Sahibi</TableHead>
                                            <TableHead>İşlem Türü</TableHead>
                                            <TableHead>Miktar (Auro)</TableHead>
                                            <TableHead className="text-right pr-6">Tarih</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentLogs?.map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell className="pl-6 py-4 font-bold">{log.userName}</TableCell>
                                                <TableCell>
                                                    <Badge variant={log.type === 'mentor' ? 'default' : 'secondary'} className="text-[10px] font-bold uppercase">
                                                        {log.type === 'mentor' ? 'Elite Mentor' : 'Teknik Analiz'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-black text-red-400">-{log.auroSpent}</TableCell>
                                                <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                                                    {new Date(log.timestamp).toLocaleString('tr-TR')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- OPERATIONS (OPERASYONLAR) TAB --- */}
                <TabsContent value="operations" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Lesson Generator */}
                        <Card className="rounded-[24px]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Akademi Ders Üretimi</CardTitle>
                                <CardDescription>Yapay zeka ile müfredata uygun 5 yeni ders oluşturun.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-muted-foreground">Zorluk Seviyesi</Label>
                                        <Select value={selectedLevel} onValueChange={v => { setSelectedLevel(v); setSelectedCategory(''); }}>
                                            <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(curriculum).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-muted-foreground">Müfredat Konusu</Label>
                                        <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedLevel}>
                                            <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                                            <SelectContent>
                                                {selectedLevel && curriculum[selectedLevel as any].map(c => (
                                                    <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleGenerateLessons} disabled={isGenerating} className="w-full h-12 font-bold rounded-xl shadow-lg">
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    AI Üretimi Başlat
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Coach Tester */}
                        <Card className="rounded-[24px]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <Target className="h-5 w-5 text-purple-400" />
                                    Stratejik Koçluk Testi
                                </CardTitle>
                                <CardDescription>Luma'nın kişisel gelişim planlarını test edin.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button onClick={handleTestCoach} variant="secondary" disabled={isTestingCoach} className="w-full h-12 font-bold rounded-xl">
                                    {isTestingCoach ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Test Profili ile Analiz Et"}
                                </Button>
                                {testFeedback && (
                                    <div className="bg-muted/30 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto border border-border/50">
                                        <pre>{JSON.stringify(testFeedback, null, 2)}</pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Content Management Quick Access */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="rounded-[24px] cursor-pointer hover:bg-accent/50 transition-colors border-border/40" onClick={() => router.push('/competitions')}>
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Trophy className="h-6 w-6 text-amber-500" /></div>
                                <div><h4 className="font-bold">Yarışma Yönetimi</h4><p className="text-[10px] text-muted-foreground uppercase">Aktif Yarışmaları Düzenle</p></div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[24px] cursor-pointer hover:bg-accent/50 transition-colors border-border/40" onClick={() => router.push('/explore')}>
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Globe className="h-6 w-6 text-cyan-500" /></div>
                                <div><h4 className="font-bold">Sergi Salonları</h4><p className="text-[10px] text-muted-foreground uppercase">Genel Sergileri Yönet</p></div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[24px] cursor-pointer hover:bg-accent/50 transition-colors border-border/40" onClick={() => router.push('/academy')}>
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><BookOpen className="h-6 w-6 text-primary" /></div>
                                <div><h4 className="font-bold">Müfredat Paneli</h4><p className="text-[10px] text-muted-foreground uppercase">Ders İçeriklerini İncele</p></div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
