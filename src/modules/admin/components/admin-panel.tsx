
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
import { collection, doc, writeBatch, getCountFromServer, updateDoc, deleteDoc, query, orderBy, where, addDoc, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import { Loader2, Users, BookOpen, Trophy, Trash2, Edit, StopCircle, Check, Bell, Send, Globe, LayoutGrid, Sparkles, Target, Rocket, Calendar, Flag, Zap, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { levels as gamificationLevels } from '@/lib/gamification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Competition, ScoringModel, User, Exhibition, DailyStats, AnalysisLog } from '@/types';
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

export default function AdminPanel() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState(true);
    const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'all'>('daily');

    const isAdmin = user?.email === 'admin@viewora.ai' || user?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43' || user?.email === 'babacan.muharrem@gmail.com' || user?.uid === 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1';

    // Fetch Stats
    const statsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'global_stats'), orderBy('date', 'desc'), limit(30)) : null,
        [firestore, isAdmin]
    );
    const { data: globalStats } = useCollection<DailyStats>(statsQuery);

    // Fetch Recent Logs for average calculation
    const logsQuery = useMemoFirebase(() => 
        (firestore && isAdmin) ? query(collection(firestore, 'analysis_logs'), orderBy('timestamp', 'desc'), limit(100)) : null,
        [firestore, isAdmin]
    );
    const { data: recentLogs } = useCollection<AnalysisLog>(logsQuery);

    const metrics = useMemo(() => {
        if (!globalStats || globalStats.length === 0) return null;
        
        const today = globalStats[0];
        const last7Days = globalStats.slice(0, 7);
        
        const weeklyTotalAnalyses = last7Days.reduce((acc, s) => acc + s.technicalAnalyses + s.mentorAnalyses, 0);
        const weeklyTotalAuro = last7Days.reduce((acc, s) => acc + s.auroSpent, 0);
        const avgDau = last7Days.reduce((acc, s) => acc + s.dau, 0) / last7Days.length;

        const totalAnalyses = recentLogs?.length || 0;
        const avgAnalysisPerUser = totalUsers && totalUsers > 0 ? totalAnalyses / totalUsers : 0;

        return {
            today,
            weeklyTotalAnalyses,
            weeklyTotalAuro,
            avgDau,
            avgAnalysisPerUser,
            totalAnalyses
        };
    }, [globalStats, totalUsers, recentLogs]);

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
            {/* 5 CRITICAL METRICS DASHBOARD */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-widest">Günlük Aktif (DAU)</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-3xl font-black">{metrics?.today.dau || 0}</p>
                            <Users className="h-5 w-5 text-primary opacity-50" />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Haftalık Ort: {metrics?.avgDau.toFixed(1)}</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-widest">Kişi Başı Analiz</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-3xl font-black">{metrics?.avgAnalysisPerUser.toFixed(1) || '0.0'}</p>
                            <TrendingUp className="h-5 w-5 text-amber-500 opacity-50" />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Kritik karlılık verisi</p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-500/5 border-purple-500/20">
                    <CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-widest">Günlük Analiz</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-3xl font-black">{(metrics?.today.technicalAnalyses || 0) + (metrics?.today.mentorAnalyses || 0)}</p>
                            <Activity className="h-5 w-5 text-purple-500 opacity-50" />
                        </div>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[8px] font-bold text-blue-400">T: {metrics?.today.technicalAnalyses}</span>
                            <span className="text-[8px] font-bold text-purple-400">M: {metrics?.today.mentorAnalyses}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-cyan-500/5 border-cyan-500/20">
                    <CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-widest">Foto Yükleme</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-3xl font-black">{metrics?.today.photoUploads || 0}</p>
                            <Camera className="h-5 w-5 text-cyan-500 opacity-50" />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Toplam veri akışı</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-widest">Auro Harcama</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-3xl font-black">{metrics?.today.auroSpent || 0}</p>
                            <DollarSign className="h-5 w-5 text-green-500 opacity-50" />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Haftalık Toplam: {metrics?.weeklyTotalAuro}</p>
                    </CardContent>
                </Card>
            </div>

            {/* GROWTH DASHBOARD */}
            <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20 overflow-hidden relative">
                <CardContent className="py-12 text-center space-y-6 relative z-10">
                    <div className="flex flex-col items-center">
                        {isFetchingCount ? <Skeleton className="h-20 w-48" /> : <p className="text-8xl font-black tracking-tighter leading-none bg-gradient-to-b from-white to-muted-foreground bg-clip-text text-transparent">{totalUsers || '0'}</p>}
                        <Badge variant="outline" className="mt-4 text-xs font-black tracking-widest border-primary/30 text-primary px-4 py-1 uppercase bg-primary/5">Toplam Sanatçı</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* RECENT ACTIVITY LOGS (PRACTICAL TABLE) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Son Analiz Hareketleri</CardTitle>
                    <CardDescription>Sistemin oluşturduğu son 100 maliyetli işlem.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Kullanıcı</TableHead>
                                    <TableHead>Tür</TableHead>
                                    <TableHead>Auro</TableHead>
                                    <TableHead className="text-right pr-6">Tarih</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentLogs?.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell className="pl-6 py-3 font-medium">{log.userName}</TableCell>
                                        <TableCell>
                                            <Badge variant={log.type === 'mentor' ? 'default' : 'secondary'} className="text-[10px]">
                                                {log.type === 'mentor' ? 'Mentor' : 'Teknik'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-cyan-400">-{log.auroSpent}</TableCell>
                                        <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
