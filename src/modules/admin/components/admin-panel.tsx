'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  collection, doc, updateDoc, query, orderBy,
  addDoc, deleteDoc, setDoc, increment
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import {
  Loader2, Trophy, Sparkles, Globe, Activity, Camera, Trash2, Users, List, Search, GraduationCap, Layout, Gift, Gem, Settings2
} from 'lucide-react';
import type { Competition, Exhibition, AnalysisLog, User, AppSettings } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppConfig } from '@/components/AppConfigProvider';

const exhibitionSchema = z.object({
  title: z.string().min(3, 'En az 3 karakter'),
  description: z.string().min(10, 'En az 10 karakter'),
  minLevel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  imageHint: z.string().min(2, 'Görsel ipucu gerekli')
});

const competitionSchema = z.object({
  title: z.string().min(3, 'En az 3 karakter'),
  description: z.string().min(10, 'En az 10 karakter'),
  theme: z.string().min(3, 'En az 3 karakter'),
  prize: z.string().min(3, 'Ödül belirtilmeli'),
  targetLevel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  imageHint: z.string().min(2, 'Görsel ipucu gerekli')
});

const configSchema = z.object({
  currencyName: z.string().min(2, 'En az 2 karakter').max(10, 'En fazla 10 karakter'),
});

export default function AdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { currencyName: currentCurrency } = useAppConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('accounting');
  const [userSearch, setUserSearch] = useState('');

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
    const adminUids = ['01DT86bQwWUVrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
    return adminEmails.includes(user.email || '') || adminUids.includes(user.uid);
  }, [user]);

  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'app_settings', 'config') : null), [firestore]);
  const { data: appConfig } = useDoc<AppSettings>(configRef);

  const configForm = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: { currencyName: currentCurrency }
  });

  useEffect(() => {
    if (appConfig) configForm.reset({ currencyName: appConfig.currencyName });
  }, [appConfig, configForm]);

  const onUpdateConfig = async (values: z.infer<typeof configSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'app_settings', 'config'), values, { merge: true });
      toast({ title: "Ayarlar Kaydedildi", description: `Para birimi artık '${values.currencyName}' olarak kullanılacak.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata", description: "Ayarlar güncellenemedi." });
    } finally { setIsSubmitting(false); }
  };

  const exhibitionsQuery = useMemoFirebase(() =>
    firestore && isAdmin ? query(collection(firestore, 'exhibitions'), orderBy('createdAt', 'desc')) : null,
    [firestore, isAdmin]
  );
  const competitionsQuery = useMemoFirebase(() =>
    firestore && isAdmin ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
    [firestore, isAdmin]
  );
  const logsQuery = useMemoFirebase(() =>
    firestore && isAdmin ? query(collection(firestore, 'analysis_logs'), orderBy('timestamp', 'desc')) : null,
    [firestore, isAdmin]
  );
  const usersQuery = useMemoFirebase(() =>
    firestore && isAdmin ? collection(firestore, 'users') : null,
    [firestore, isAdmin]
  );

  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);
  const { data: competitions } = useCollection<Competition>(competitionsQuery);
  const { data: logs } = useCollection<AnalysisLog>(logsQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  const metrics = useMemo(() => {
    if (!logs) return null;
    return {
      totalAuro: logs.filter(l => l.auroSpent > 0).reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      techAuro: logs.filter(l => l.type === 'technical').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      mentorAuro: logs.filter(l => l.type === 'mentor').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      exhibitionAuro: logs.filter(l => l.type === 'exhibition').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      competitionAuro: logs.filter(l => l.type === 'competition').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      totalGifts: Math.abs(logs.filter(l => l.type === 'gift').reduce((sum, log) => sum + (log.auroSpent || 0), 0)),
    };
  }, [logs]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearch) return users;
    const term = userSearch.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(term) || 
      u.email?.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  const exhibitionForm = useForm({
    resolver: zodResolver(exhibitionSchema),
    defaultValues: {
      title: '', description: '', minLevel: 'Neuner',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      imageHint: 'art gallery'
    }
  });

  const competitionForm = useForm({
    resolver: zodResolver(competitionSchema),
    defaultValues: {
      title: '', description: '', theme: '', prize: '', targetLevel: 'Neuner',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      imageHint: 'photography competition'
    }
  });

  const onCreateExhibition = async (values: z.infer<typeof exhibitionSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(firestore, 'exhibitions'), {
        ...values,
        imageUrl: `https://picsum.photos/seed/${values.imageHint.replace(/\s+/g, '')}/1200/800`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Sergi Salonu Açıldı" });
      exhibitionForm.reset();
    } catch (e) { 
      console.error(e);
      toast({ variant: 'destructive', title: "Hata", description: "Sergi oluşturulamadı." }); 
    } finally { setIsSubmitting(false); }
  };

  const onCreateCompetition = async (values: z.infer<typeof competitionSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(firestore, 'competitions'), {
        ...values,
        imageUrl: `https://picsum.photos/seed/${values.imageHint.replace(/\s+/g, '')}/1200/800`,
        scoringModel: 'hybrid', juryWeight: 40, aiWeight: 40, communityWeight: 20,
        participantCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Yarışma Oluşturuldu" });
      competitionForm.reset();
    } catch (e) { 
      console.error(e);
      toast({ variant: 'destructive', title: "Hata", description: "Yarışma oluşturulamadı." }); 
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteExhibition = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'exhibitions', id));
      toast({ title: "Sergi silindi" });
    } catch (e) { toast({ variant: 'destructive', title: "Silme hatası" }); }
  };

  const handleDeleteCompetition = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'competitions', id));
      toast({ title: "Yarışma silindi" });
    } catch (e) { toast({ variant: 'destructive', title: "Silme hatası" }); }
  };

  if (!isAdmin) return <div className="p-20 text-center font-bold text-destructive">YETKİSİZ ERİŞİM</div>;

  return (
    <div className="container mx-auto px-4 pb-24 animate-in fade-in duration-700">
      <header className="mb-16 text-center space-y-2 pt-6">
        <h1 className="text-7xl font-black tracking-tighter uppercase leading-none">
          {isUsersLoading ? '...' : users?.length || 0} VİZYONER
        </h1>
        <p className="text-sm font-black text-primary uppercase tracking-[0.4em] opacity-70">
          Yönetici Paneli
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="relative filter-scroll">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x">
            <TabsList className="flex w-max bg-secondary/30 p-1 rounded-2xl h-14 border border-border/40 gap-1">
              <TabsTrigger value="accounting" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full whitespace-nowrap">Muhasebe</TabsTrigger>
              <TabsTrigger value="content" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full whitespace-nowrap">İçerik Yönetimi</TabsTrigger>
              <TabsTrigger value="academy" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full whitespace-nowrap">Akademi</TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full whitespace-nowrap">Kullanıcılar</TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full whitespace-nowrap">Genel Ayarlar</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="accounting" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-primary/5 border-primary/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">Harcanan Toplam</CardDescription></CardHeader>
              <CardContent><p className="text-4xl font-black text-primary">{metrics?.totalAuro || 0}</p></CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-blue-400/70">Teknik Analiz</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black">{metrics?.techAuro || 0}</p></CardContent>
            </Card>
            <Card className="bg-purple-500/5 border-purple-500/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Mentorluk</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black">{metrics?.mentorAuro || 0}</p></CardContent>
            </Card>
            <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-cyan-400/70">Sergi</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black">{metrics?.exhibitionAuro || 0}</p></CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Yarışma</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black">{metrics?.competitionAuro || 0}</p></CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-green-400/70">Hediyeler</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black">{metrics?.totalGifts || 0}</p></CardContent>
            </Card>
          </div>

          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="bg-secondary/20 border-b border-border/40 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Activity className="h-6 w-6 text-primary" /> Son İşlemler</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border/40">
                  {logs && logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl border transition-all group-hover:scale-110", 
                          log.type === 'technical' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : 
                          log.type === 'mentor' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : 
                          log.type === 'competition' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          log.type === 'gift' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          "bg-cyan-500/10 text-cyan-400 border-cyan-500/20")}>
                          {log.type === 'technical' ? <Camera className="h-5 w-5" /> : 
                           log.type === 'mentor' ? <Sparkles className="h-5 w-5" /> : 
                           log.type === 'competition' ? <Trophy className="h-5 w-5" /> :
                           log.type === 'gift' ? <Gift className="h-5 w-5" /> :
                           <Globe className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-lg font-black tracking-tight">{log.userName}</p>
                          <div className="flex items-center gap-2">
                            <p className={cn("text-[10px] font-black uppercase tracking-widest",
                              log.type === 'technical' ? "text-blue-400" :
                              log.type === 'mentor' ? "text-purple-400" :
                              log.type === 'competition' ? "text-amber-400" :
                              log.type === 'gift' ? "text-green-400" :
                              "text-cyan-400"
                            )}>{log.type === 'gift' ? 'Haftalık Hediye' : log.type.toUpperCase() + ' İŞLEMİ'}</p>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: tr }) : 'Az önce'}</p>
                          </div>
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", log.auroSpent < 0 ? "bg-green-500/10 border-green-500/20" : "bg-secondary/30 border-border/40")}>
                        <Gem className={cn("h-3.5 w-3.5", log.auroSpent < 0 ? "text-green-400" : "text-primary")} />
                        <span className={cn("text-sm font-black", log.auroSpent < 0 ? "text-green-400" : "text-primary")}>
                          {log.auroSpent > 0 ? `-${log.auroSpent}` : `+${Math.abs(log.auroSpent)}`}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-32 text-center text-muted-foreground font-bold uppercase tracking-widest">Henüz bir işlem kaydı bulunmuyor.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-12 animate-in fade-in duration-500">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Globe className="h-6 w-6 text-primary" /> Yeni Sergi Salonu</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...exhibitionForm}>
                  <form onSubmit={exhibitionForm.handleSubmit(onCreateExhibition)} className="space-y-6">
                    <FormField control={exhibitionForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Salon Adı</FormLabel><FormControl><Input {...field} placeholder="Örn: Siyah & Beyaz Vizyon" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={exhibitionForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Açıklama</FormLabel><FormControl><Textarea {...field} placeholder="Salonun teması ve vizyonu..." className="rounded-2xl min-h-[120px] bg-muted/30 border-border/60" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={exhibitionForm.control} name="minLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Min. Seviye</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="rounded-2xl h-12 bg-muted/30 border-border/60"><SelectValue placeholder="Seç..." /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Neuner">Neuner</SelectItem><SelectItem value="Viewner">Viewner</SelectItem><SelectItem value="Sytner">Sytner</SelectItem><SelectItem value="Vexer">Vexer</SelectItem></SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={exhibitionForm.control} name="imageHint" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Görsel İpucu</FormLabel><FormControl><Input {...field} placeholder="landscape art" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={exhibitionForm.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Başlangıç</FormLabel><FormControl><Input type="date" {...field} className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                      <FormField control={exhibitionForm.control} name="endDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Bitiş</FormLabel><FormControl><Input type="date" {...field} className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">{isSubmitting ? <Loader2 className="animate-spin" /> : "Sergiyi Aktif Et"}</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
              <CardHeader className="bg-amber-500/5 border-b border-border/40 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Trophy className="h-6 w-6 text-amber-400" /> Yeni Yarışma</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...competitionForm}>
                  <form onSubmit={competitionForm.handleSubmit(onCreateCompetition)} className="space-y-6">
                    <FormField control={competitionForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Yarışma Adı</FormLabel><FormControl><Input {...field} placeholder="Örn: Altın Saat Portreleri" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={competitionForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Detaylı Kurallar</FormLabel><FormControl><Textarea {...field} placeholder="Katılım şartları ve vizyon..." className="rounded-2xl min-h-[80px] bg-muted/30 border-border/60" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={competitionForm.control} name="theme" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Tema</FormLabel><FormControl><Input {...field} placeholder="Minimalizm" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                      <FormField control={competitionForm.control} name="prize" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Ödül Notu</FormLabel><FormControl><Input {...field} placeholder="Dinamik Havuz" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={competitionForm.control} name="targetLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Hedef Seviye</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="rounded-2xl h-12 bg-muted/30 border-border/60"><SelectValue placeholder="Seviye seç..." /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Neuner">Neuner</SelectItem><SelectItem value="Viewner">Viewner</SelectItem><SelectItem value="Sytner">Sytner</SelectItem><SelectItem value="Vexer">Vexer</SelectItem></SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={competitionForm.control} name="imageHint" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Görsel İpucu</FormLabel><FormControl><Input {...field} placeholder="camera macro" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={competitionForm.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Başlangıç</FormLabel><FormControl><Input type="date" {...field} className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                      <FormField control={competitionForm.control} name="endDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Bitiş</FormLabel><FormControl><Input type="date" {...field} className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-amber-500 text-black hover:bg-amber-600 shadow-xl shadow-amber-500/20">{isSubmitting ? <Loader2 className="animate-spin" /> : "Yarışmayı Başlat"}</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 px-2"><List className="h-6 w-6 text-primary" /> Mevcut Salonlar ve Yarışmalar</h3>
            <div className="grid gap-4">
              {exhibitions?.map(ex => (
                <Card key={ex.id} className="rounded-[24px] border-border/40 overflow-hidden bg-card/30 group hover:border-primary/30 transition-all">
                  <div className="flex items-center p-6 justify-between">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20"><Globe className="h-7 w-7 text-primary" /></div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{ex.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">SERGİ SALONU • {ex.minLevel}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExhibition(ex.id)} className="rounded-xl h-12 w-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-5 w-5" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
              {competitions?.map(comp => (
                <Card key={comp.id} className="rounded-[24px] border-border/40 overflow-hidden bg-card/30 group hover:border-amber-500/30 transition-all">
                  <div className="flex items-center p-6 justify-between">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><Trophy className="h-7 w-7 text-amber-400" /></div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{comp.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">YARIŞMA • {comp.targetLevel} • {comp.participantCount || 0} Katılımcı</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCompetition(comp.id)} className="rounded-xl h-12 w-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-5 w-5" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="academy" className="space-y-8 animate-in fade-in duration-500">
          <header className="flex items-center justify-between bg-primary/5 p-8 rounded-[40px] border border-primary/10">
            <div className="space-y-1">
              <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <GraduationCap className="h-7 w-7 text-primary" /> Akademi Yönetimi
              </h3>
              <p className="text-sm text-muted-foreground font-medium italic">Ders içerikleri, yapay zeka ile müfredat üretimi ve sınıflandırma planlama alanı.</p>
            </div>
            <Button className="rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/10">
              Ders Planı Hazırla
            </Button>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="rounded-[32px] border-border/40 bg-card/30 hover:border-primary/20 transition-all cursor-pointer group">
              <CardHeader>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Layout className="h-6 w-6 text-blue-400" />
                </div>
                <CardTitle className="text-lg font-black tracking-tight">Müfredat Taslağı</CardTitle>
                <CardTitle className="text-sm font-medium text-muted-foreground">Seviyelere göre ders başlıklarını belirleyin.</CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-[32px] border-border/40 bg-card/30 hover:border-purple-500/20 transition-all cursor-pointer group">
              <CardHeader>
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-lg font-black tracking-tight">AI Ders Üretimi</CardTitle>
                <CardTitle className="text-sm font-medium text-muted-foreground">Luma'nın otomatik ders üretmesini sağlayın.</CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-[32px] border-border/40 bg-card/30 hover:border-amber-500/20 transition-all cursor-pointer group">
              <CardHeader>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <List className="h-6 w-6 text-amber-400" />
                </div>
                <CardTitle className="text-lg font-black tracking-tight">Ders Listesi</CardTitle>
                <CardTitle className="text-sm font-medium text-muted-foreground">Yayındaki tüm dersleri görüntüleyin.</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="rounded-[40px] border-2 border-dashed border-border/40 bg-muted/5 p-20 text-center">
            <GraduationCap className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
            <h4 className="text-xl font-black text-muted-foreground uppercase tracking-widest">Akademi Planlama Yayında Değil</h4>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto font-medium">Bu bölüm yarınki müfredat ve içerik üretim planlaması için ayrılmıştır. Yarın detayları konuşup aktif edeceğiz.</p>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6 animate-in fade-in duration-500">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl backdrop-blur-sm">
            <CardHeader className="bg-secondary/20 border-b border-border/40 p-8">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Users className="h-6 w-6 text-primary" /> Kullanıcı Listesi</CardTitle>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="İsim veya e-posta ile ara..." 
                    className="pl-11 h-12 rounded-2xl bg-background/50 border-border/60 text-sm font-medium" 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/40">
                    <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Vizyoner</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Seviye</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{currentCurrency}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Kayıt</TableHead>
                    <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <TableRow key={u.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                      <TableCell className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-black tracking-tight text-base">{u.name}</span>
                          <span className="text-xs text-muted-foreground font-medium">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-secondary/50 border-border/60">{u.level_name}</Badge></TableCell>
                      <TableCell className="font-black text-primary">{u.auro_balance}</TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '-'}</TableCell>
                      <TableCell className="text-right px-8">
                        <Button variant="ghost" size="sm" className="rounded-xl h-9 font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 hover:text-primary transition-all">Yönet</Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-32 text-muted-foreground font-bold uppercase tracking-[0.2em]">
                        {isUsersLoading ? 'VERİLER YÜKLENİYOR...' : 'ARAMA SONUCU BULUNAMADI.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8 animate-in fade-in duration-500">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-primary/5 border-b border-border/40 p-8">
              <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Settings2 className="h-6 w-6 text-primary" /> Markalama ve Genel Ayarlar</CardTitle>
              <CardDescription>Uygulama genelindeki para birimi ismi ve global kuralları buradan yönetin.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <Form {...configForm}>
                <form onSubmit={configForm.handleSubmit(onUpdateConfig)} className="space-y-8 max-w-md">
                  <FormField control={configForm.control} name="currencyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Para Birimi İsmi</FormLabel>
                      <FormControl><Input {...field} placeholder="Örn: Pix" className="rounded-2xl h-12 bg-muted/30 border-border/60" /></FormControl>
                      <FormDescription className="text-xs italic">Uygulama genelindeki tüm birim metinleri bununla değiştirilecektir.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/10">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Ayarları Güncelle"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}