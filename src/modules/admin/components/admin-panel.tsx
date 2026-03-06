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
  addDoc, setDoc, increment
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import {
  Loader2, Trophy, Activity, Camera, Users, Globe, Gem, Settings2, Sparkles, GraduationCap
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
import AcademyAdminPanel from './AcademyAdminPanel';

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

  const logsQuery = useMemoFirebase(() =>
    firestore && isAdmin ? query(collection(firestore, 'analysis_logs'), orderBy('timestamp', 'desc')) : null,
    [firestore, isAdmin]
  );
  const usersQuery = useMemoFirebase(() =>
    firestore && isAdmin ? collection(firestore, 'users') : null,
    [firestore, isAdmin]
  );

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
    return users.filter(u => u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
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
        ...values, imageUrl: `https://picsum.photos/seed/${values.imageHint.replace(/\s+/g, '')}/1200/800`,
        isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Sergi Salonu Açıldı" });
      exhibitionForm.reset();
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
  };

  const onCreateCompetition = async (values: z.infer<typeof competitionSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(firestore, 'competitions'), {
        ...values, imageUrl: `https://picsum.photos/seed/${values.imageHint.replace(/\s+/g, '')}/1200/800`,
        participantCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        scoringModel: 'hybrid', juryWeight: 40, aiWeight: 40, communityWeight: 20
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Yarışma Oluşturuldu" });
      competitionForm.reset();
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
  };

  if (!isAdmin) return <div className="p-20 text-center font-bold text-destructive uppercase tracking-widest">YETKİSİZ ERİŞİM</div>;

  return (
    <div className="container mx-auto px-4 pb-24 pt-10 animate-in fade-in duration-700">
      <header className="mb-16 text-center space-y-2">
        <h1 className="text-7xl font-black tracking-tighter uppercase leading-none">{isUsersLoading ? '...' : users?.length || 0} VİZYONER</h1>
        <p className="text-sm font-black text-primary uppercase tracking-[0.4em] opacity-70">Yönetici Paneli</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="relative filter-scroll mb-10">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x snap-mandatory">
            <TabsList className="inline-flex w-max bg-secondary/30 p-1 rounded-2xl h-14 border border-border/40 gap-1 px-1">
              <TabsTrigger value="accounting" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start flex-shrink-0">Muhasebe</TabsTrigger>
              <TabsTrigger value="content" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start flex-shrink-0">İçerik</TabsTrigger>
              <TabsTrigger value="academy" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start flex-shrink-0">Akademi</TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start flex-shrink-0">Üyeler</TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start flex-shrink-0">Genel</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="accounting" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-primary/5 border-primary/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">Toplam Harcanan</CardDescription></CardHeader><CardContent><p className="text-4xl font-black text-primary">{metrics?.totalAuro || 0}</p></CardContent></Card>
            <Card className="bg-blue-500/5 border-blue-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-blue-400/70">Teknik Analiz</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.techAuro || 0}</p></CardContent></Card>
            <Card className="bg-purple-500/5 border-purple-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Mentorluk</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.mentorAuro || 0}</p></CardContent></Card>
            <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-cyan-400/70">Sergi</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.exhibitionAuro || 0}</p></CardContent></Card>
            <Card className="bg-amber-500/5 border-amber-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Yarışma</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.competitionAuro || 0}</p></CardContent></Card>
            <Card className="bg-green-500/5 border-green-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-green-400/70">Hediyeler</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.totalGifts || 0}</p></CardContent></Card>
          </div>
          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-card/50">
            <CardHeader className="bg-secondary/20 border-b border-border/40 p-8">
              <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Activity className="h-6 w-6 text-primary" /> Son İşlemler</CardTitle>
              <CardDescription className="sr-only">Sistem genelindeki son harcamalar.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border/40">
                  {logs && logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl border", log.type === 'technical' ? "bg-blue-500/10 text-blue-400" : log.type === 'mentor' ? "bg-purple-500/10 text-purple-400" : "bg-cyan-500/10 text-cyan-400")}>
                          {log.type === 'technical' ? <Camera className="h-5 w-5" /> : log.type === 'mentor' ? <Sparkles className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-lg font-black tracking-tight">{log.userName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: tr }) : 'Az önce'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/30 border border-border/40 font-black text-primary text-sm">
                        <Gem className="h-3.5 w-3.5" /> {log.auroSpent > 0 ? `-${log.auroSpent}` : `+${Math.abs(log.auroSpent)}`}
                      </div>
                    </div>
                  )) : (
                    <div className="p-20 text-center text-muted-foreground font-medium italic">Henüz işlem kaydı bulunmuyor.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-12">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Globe className="h-6 w-6 text-primary" /> Yeni Sergi Salonu</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...exhibitionForm}><form onSubmit={exhibitionForm.handleSubmit(onCreateExhibition)} className="space-y-6">
                  <FormField control={exhibitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Salon Adı</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={exhibitionForm.control} name="description" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Açıklama</FormLabel><FormControl><Textarea {...field} className="rounded-2xl min-h-[100px]" /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={exhibitionForm.control} name="minLevel" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Min. Seviye</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Neuner">Neuner</SelectItem><SelectItem value="Viewner">Viewner</SelectItem></SelectContent></Select></FormItem>)} />
                    <FormField control={exhibitionForm.control} name="imageHint" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Görsel İpucu</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black tracking-widest shadow-xl shadow-primary/20">{isSubmitting ? <Loader2 className="animate-spin" /> : "Sergiyi Aktif Et"}</Button>
                </form></Form>
              </CardContent>
            </Card>
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden">
              <CardHeader className="bg-amber-500/5 border-b border-border/40 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Trophy className="h-6 w-6 text-amber-400" /> Yeni Yarışma</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...competitionForm}><form onSubmit={competitionForm.handleSubmit(onCreateCompetition)} className="space-y-6">
                  <FormField control={competitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Yarışma Adı</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  <FormField control={competitionForm.control} name="description" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Kurallar</FormLabel><FormControl><Textarea {...field} className="rounded-2xl min-h-[80px]" /></FormControl></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={competitionForm.control} name="theme" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Tema</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                    <FormField control={competitionForm.control} name="prize" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest">Ödül</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black tracking-widest bg-amber-500 text-black hover:bg-amber-600 shadow-xl shadow-amber-500/20">{isSubmitting ? <Loader2 className="animate-spin" /> : "Yarışmayı Başlat"}</Button>
                </form></Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="academy">
          <AcademyAdminPanel />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Users className="h-6 w-6 text-primary" /> Kullanıcı Listesi</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="px-8 font-black uppercase text-[10px]">Vizyoner</TableHead><TableHead className="font-black uppercase text-[10px]">Seviye</TableHead><TableHead className="font-black uppercase text-[10px]">{currentCurrency}</TableHead><TableHead className="text-right px-8 font-black uppercase text-[10px]">İşlem</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-8 py-5"><div className="flex flex-col"><span className="font-black tracking-tight">{u.name}</span><span className="text-xs text-muted-foreground">{u.email}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase">{u.level_name}</Badge></TableCell>
                      <TableCell className="font-black text-primary">{u.auro_balance}</TableCell>
                      <TableCell className="text-right px-8"><Button variant="ghost" size="sm" className="rounded-xl h-9 font-black uppercase text-[10px]">Yönet</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Settings2 className="h-6 w-6 text-primary" /> Markalama</CardTitle></CardHeader>
            <CardContent className="p-8">
              <Form {...configForm}><form onSubmit={configForm.handleSubmit(onUpdateConfig)} className="space-y-8 max-w-md">
                <FormField control={configForm.control} name="currencyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest">Para Birimi İsmi</FormLabel>
                    <FormControl><Input {...field} className="rounded-2xl" /></FormControl>
                    <FormDescription className="text-xs italic">Uygulama genelindeki tüm birim metinleri bununla değiştirilecektir.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/10">Ayarları Güncelle</Button>
              </form></Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
