
'use client';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import {
  collection, doc, updateDoc, query, orderBy,
  addDoc, deleteDoc
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/lib/firebase';
import {
  Loader2, Trophy, Sparkles, Globe, Activity, Camera, Trash2, Users, List, Search
} from 'lucide-react';
import type { Competition, Exhibition, AnalysisLog, User } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const exhibitionSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  minLevel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  imageHint: z.string().min(2)
});

const competitionSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  theme: z.string().min(3),
  prize: z.string().min(3),
  targetLevel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  imageHint: z.string().min(2)
});

export default function AdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('accounting');

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
    const adminUids = ['01DT86bQwWUVrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
    return adminEmails.includes(user.email || '') || adminUids.includes(user.uid);
  }, [user]);

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
    firestore && isAdmin ? query(collection(firestore, 'users'), orderBy('createdAt', 'desc')) : null,
    [firestore, isAdmin]
  );

  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);
  const { data: competitions } = useCollection<Competition>(competitionsQuery);
  const { data: logs } = useCollection<AnalysisLog>(logsQuery);
  const { data: users } = useCollection<User>(usersQuery);

  const metrics = useMemo(() => {
    if (!logs) return null;
    return {
      totalAuro: logs.reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      techAuro: logs.filter(l => l.type === 'technical').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      mentorAuro: logs.filter(l => l.type === 'mentor').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      exhibitionAuro: logs.filter(l => l.type === 'exhibition').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
      competitionAuro: logs.filter(l => l.type === 'competition').reduce((sum, log) => sum + (log.auroSpent || 0), 0),
    };
  }, [logs]);

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
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
  };

  const onCreateCompetition = async (values: z.infer<typeof competitionSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(firestore, 'competitions'), {
        ...values,
        imageUrl: `https://picsum.photos/seed/${values.imageHint.replace(/\s+/g, '')}/1200/800`,
        scoringModel: 'hybrid', juryWeight: 40, aiWeight: 40, communityWeight: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Yarışma Oluşturuldu" });
      competitionForm.reset();
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsSubmitting(false); }
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
    <div className="container mx-auto px-4 pb-24">
      <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4 bg-primary/10 px-6 py-3 rounded-full border border-primary/20">
          <Activity className="h-5 w-5 text-primary" />
          <p className="text-sm font-bold text-primary">TOPLAM {users?.length || 0} VİZYONER KAYITLI</p>
        </div>
      </header>

      <Tabs defaultValue="accounting" onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-secondary/30 p-1 rounded-xl h-12">
          <TabsTrigger value="accounting" className="px-6 font-bold">Muhasebe</TabsTrigger>
          <TabsTrigger value="content" className="px-6 font-bold">İçerik Yönetimi</TabsTrigger>
          <TabsTrigger value="users" className="px-6 font-bold">Kullanıcılar</TabsTrigger>
        </TabsList>

        <TabsContent value="accounting" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-primary/5 border-primary/20 rounded-[24px]">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-primary">Harcanan Toplam</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-black text-primary">{metrics?.totalAuro || 0} <span className="text-xs">Auro</span></p></CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20 rounded-[24px]">
              <CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase text-blue-400/70">Teknik Analiz</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-black">{metrics?.techAuro || 0}</p></CardContent>
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

          <Card className="rounded-[24px] border-border/40 overflow-hidden shadow-xl">
            <CardHeader className="bg-secondary/20 border-b border-border/40"><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-primary" /> Son İşlemler</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border/40">
                  {logs?.map(log => (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", log.type === 'technical' ? "bg-blue-500/10 text-blue-400" : log.type === 'mentor' ? "bg-purple-500/10 text-purple-400" : "bg-cyan-500/10 text-cyan-400")}>
                          {log.type === 'technical' ? <Camera className="h-4 w-4" /> : log.type === 'mentor' ? <Sparkles className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{log.userName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{log.type} ANALİZİ</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">-{log.auroSpent} AURO</p>
                        <p className="text-[10px] text-muted-foreground">{log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: tr }) : 'Az önce'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-12 animate-in fade-in duration-500">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-6"><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Yeni Sergi Salonu</CardTitle></CardHeader>
              <CardContent className="p-6">
                <Form {...exhibitionForm}>
                  <form onSubmit={exhibitionForm.handleSubmit(onCreateExhibition)} className="space-y-4">
                    <FormField control={exhibitionForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Başlık</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                    <FormField control={exhibitionForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Açıklama</FormLabel><FormControl><Textarea {...field} className="rounded-xl min-h-[100px]" /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={exhibitionForm.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>Başlangıç</FormLabel><FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl></FormItem>
                      )} />
                      <FormField control={exhibitionForm.control} name="endDate" render={({ field }) => (
                        <FormItem><FormLabel>Bitiş</FormLabel><FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold">{isSubmitting ? <Loader2 className="animate-spin" /> : "Sergiyi Aktif Et"}</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
              <CardHeader className="bg-amber-500/5 border-b border-border/40 p-6"><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Yeni Yarışma</CardTitle></CardHeader>
              <CardContent className="p-6">
                <Form {...competitionForm}>
                  <form onSubmit={competitionForm.handleSubmit(onCreateCompetition)} className="space-y-4">
                    <FormField control={competitionForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Yarışma Adı</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={competitionForm.control} name="theme" render={({ field }) => (
                        <FormItem><FormLabel>Tema</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                      )} />
                      <FormField control={competitionForm.control} name="prize" render={({ field }) => (
                        <FormItem><FormLabel>Ödül</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={competitionForm.control} name="targetLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seviye</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seviye seç..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Neuner">Neuner</SelectItem>
                            <SelectItem value="Viewner">Viewner</SelectItem>
                            <SelectItem value="Sytner">Sytner</SelectItem>
                            <SelectItem value="Vexer">Vexer</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold bg-amber-500 text-black hover:bg-amber-600">{isSubmitting ? <Loader2 className="animate-spin" /> : "Yarışmayı Başlat"}</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black flex items-center gap-2 px-2"><List className="h-5 w-5 text-primary" /> Mevcut Salonlar ve Yarışmalar</h3>
            <div className="grid gap-4">
              {exhibitions?.map(ex => (
                <Card key={ex.id} className="rounded-2xl border-border/40 overflow-hidden bg-card/30">
                  <div className="flex items-center p-4 justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><Globe className="h-6 w-6 text-primary" /></div>
                      <div>
                        <p className="font-bold">{ex.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">SERGİ SALONU • {ex.minLevel}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExhibition(ex.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
              {competitions?.map(comp => (
                <Card key={comp.id} className="rounded-2xl border-border/40 overflow-hidden bg-card/30">
                  <div className="flex items-center p-4 justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Trophy className="h-6 w-6 text-amber-400" /></div>
                      <div>
                        <p className="font-bold">{comp.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">YARIŞMA • {comp.targetLevel}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCompetition(comp.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6 animate-in fade-in duration-500">
          <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 border-b border-border/40">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Kullanıcı Listesi</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="İsim veya e-posta..." className="pl-9 h-9 rounded-full bg-muted/50 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İsim</TableHead>
                    <TableHead>Seviye</TableHead>
                    <TableHead>Auro</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] uppercase font-black">{u.level_name}</Badge></TableCell>
                      <TableCell className="font-black text-cyan-400">{u.auro_balance}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase">Yönet</Button>
                      </TableCell>
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
