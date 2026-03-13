
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
  addDoc, setDoc, increment, where, writeBatch
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import {
  Loader2, Trophy, Activity, Camera, Users, Globe, Gem, Settings2, Sparkles, GraduationCap, Package, Save, CheckCircle2, XCircle, CreditCard, Check, X
} from 'lucide-react';
import type { Competition, Exhibition, AnalysisLog, User, AppSettings, PixPackage, PixPurchase } from '@/types';
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
import { Switch } from '@/components/ui/switch';

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

const packageSchema = z.object({
  name: z.string().min(2, 'Gerekli'),
  description: z.string().min(5, 'Gerekli'),
  price: z.coerce.number().min(1),
  pix_amount: z.coerce.number().min(1),
  payment_link: z.string().url('Geçerli bir URL girin'),
  active: z.boolean(),
  order: z.number()
});

function PackageEditor({ pkg, onSave }: { pkg: PixPackage, onSave: (values: any) => Promise<void> }) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      pix_amount: pkg.pix_amount || 0,
      payment_link: pkg.payment_link,
      active: pkg.active,
      order: pkg.order
    }
  });

  const handleSubmit = async (values: any) => {
    setIsSaving(true);
    await onSave({ ...values, id: pkg.id });
    setIsSaving(false);
  };

  return (
    <Card className="rounded-2xl border-border/40 bg-muted/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-black uppercase tracking-widest">{pkg.name}</CardTitle>
          <Badge variant={form.watch('active') ? 'default' : 'secondary'} className="h-5 text-[9px]">
            {form.watch('active') ? 'AKTİF' : 'PASİF'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] font-black uppercase">İsim</FormLabel><FormControl><Input {...field} className="h-9 text-xs" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] font-black uppercase">Fiyat (TL)</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="pix_amount" render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] font-black uppercase">Miktar</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] font-black uppercase">Sıra</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel className="text-[9px] font-black uppercase">Açıklama</FormLabel><FormControl><Textarea {...field} className="text-xs min-h-[60px]" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="payment_link" render={({ field }) => (
              <FormItem><FormLabel className="text-[9px] font-black uppercase">Ödeme Linki</FormLabel><FormControl><Input {...field} className="h-9 text-xs" /></FormControl></FormItem>
            )} />
            <div className="flex items-center justify-between pt-2">
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-[10px] font-bold">Aktif</FormLabel>
                </FormItem>
              )} />
              <Button type="submit" disabled={isSaving} size="sm" className="h-8 rounded-lg font-black uppercase text-[10px]">
                {isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <><Save className="mr-1.5 h-3 w-3" /> Kaydet</>}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { currencyName: currentCurrency } = useAppConfig();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('accounting');
  const [userSearch, setUserSearch] = useState('');

  // 🪝 HOOKS - ALL AT THE TOP
  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'app_settings', 'config') : null), [firestore]);
  const logsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'analysis_logs'), orderBy('timestamp', 'desc')) : null,
    [firestore]
  );
  const usersQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'users') : null,
    [firestore]
  );
  const packagesQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'pix_packages'), orderBy('order', 'asc')) : null,
    [firestore]
  );
  const purchasesQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'pix_purchases'), where('status', '==', 'pending'), orderBy('created_at', 'desc')) : null,
    [firestore]
  );

  const { data: appConfig } = useDoc<AppSettings>(configRef);
  const { data: logs } = useCollection<AnalysisLog>(logsQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);
  const { data: dbPackages } = useCollection<PixPackage>(packagesQuery);
  const { data: pendingPurchases } = useCollection<PixPurchase>(purchasesQuery);

  const configForm = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: { currencyName: currentCurrency }
  });

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

  useEffect(() => {
    if (appConfig) configForm.reset({ currencyName: appConfig.currencyName });
  }, [appConfig, configForm]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
    const adminUids = ['01DT86bQwWUVrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
    return adminEmails.includes(user.email || '') || adminUids.includes(user.uid);
  }, [user]);

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

  if (!isAdmin) return <div className="p-20 text-center font-bold text-destructive uppercase tracking-widest">YETKİSİZ ERİŞİM</div>;

  const onUpdateConfig = async (values: z.infer<typeof configSchema>) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'app_settings', 'config'), values, { merge: true });
      toast({ title: "Ayarlar Kaydedildi" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally { setIsSubmitting(false); }
  };

  const handleUpdatePackage = async (values: any) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'pix_packages', values.id), values, { merge: true });
      toast({ title: "Paket Güncellendi" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleApprovePurchase = async (purchase: PixPurchase) => {
    if (!firestore || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const purchaseRef = doc(firestore, 'pix_purchases', purchase.id);
      const userRef = doc(firestore, 'users', purchase.user_id);
      const logRef = doc(collection(firestore, 'analysis_logs'));

      batch.update(purchaseRef, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.uid
      });

      batch.update(userRef, {
        auro_balance: increment(purchase.pix_amount),
        pix_balance: increment(purchase.pix_amount)
      });

      batch.set(logRef, {
        id: logRef.id,
        userId: purchase.user_id,
        userName: purchase.user_name,
        type: 'package',
        auroSpent: -purchase.pix_amount,
        timestamp: new Date().toISOString(),
        status: 'success'
      });

      await batch.commit();
      toast({ title: "Ödeme Onaylandı", description: `${purchase.user_name} hesabına ${purchase.pix_amount} PIX eklendi.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Onay Hatası" });
    } finally { setIsSubmitting(false); }
  };

  const handleRejectPurchase = async (purchase: PixPurchase) => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'pix_purchases', purchase.id), { status: 'rejected' });
      toast({ title: "Ödeme Reddedildi" });
    } catch (e) { toast({ variant: 'destructive', title: "Red Hatası" }); } finally { setIsSubmitting(false); }
  };

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
              <TabsTrigger value="accounting" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">Muhasebe</TabsTrigger>
              <TabsTrigger value="payments" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start relative">
                Ödemeler
                {pendingPurchases && pendingPurchases.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white border-2 border-background animate-pulse">
                    {pendingPurchases.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="content" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">İçerik</TabsTrigger>
              <TabsTrigger value="academy" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">Akademi</TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">Üyeler</TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">Genel</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="accounting" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-primary/5 border-primary/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">Harcanan</CardDescription></CardHeader><CardContent><p className="text-4xl font-black text-primary">{metrics?.totalAuro || 0}</p></CardContent></Card>
            <Card className="bg-blue-500/5 border-blue-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-blue-400/70">Analiz</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.techAuro || 0}</p></CardContent></Card>
            <Card className="bg-purple-500/5 border-purple-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Mentor</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.mentorAuro || 0}</p></CardContent></Card>
            <Card className="bg-cyan-500/5 border-cyan-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-cyan-400/70">Sergi</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.exhibitionAuro || 0}</p></CardContent></Card>
            <Card className="bg-amber-500/5 border-amber-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Yarışma</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.competitionAuro || 0}</p></CardContent></Card>
            <Card className="bg-green-500/5 border-green-500/20 rounded-[32px] shadow-sm"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-black uppercase tracking-widest text-green-400/70">Hediye</CardDescription></CardHeader><CardContent><p className="text-3xl font-black">{metrics?.totalGifts || 0}</p></CardContent></Card>
          </div>
          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-card/50">
            <CardHeader className="bg-secondary/20 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Activity className="h-6 w-6 text-primary" /> Son İşlemler</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border/40">
                  {logs?.map(log => (
                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl border", log.type === 'technical' ? "bg-blue-500/10 text-blue-400" : log.type === 'mentor' ? "bg-purple-500/10 text-purple-400" : "bg-cyan-500/10 text-cyan-400")}>
                          {log.type === 'technical' ? <Camera className="h-5 w-5" /> : log.type === 'mentor' ? <Sparkles className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                        </div>
                        <div><p className="text-lg font-black tracking-tight">{log.userName}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: tr })}</p></div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/30 border border-border/40 font-black text-primary text-sm">
                        <Gem className="h-3.5 w-3.5" /> {log.auroSpent > 0 ? `-${log.auroSpent}` : `+${Math.abs(log.auroSpent)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-8">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 border-b p-8">
              <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight uppercase tracking-widest"><CreditCard className="h-6 w-6 text-primary" /> Bekleyen Ödemeler</CardTitle>
              <CardDescription>İyzico linki üzerinden yapılan taleplerin onaylanması ve bakiyelerin yüklenmesi.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pendingPurchases && pendingPurchases.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-8 font-black uppercase text-[10px]">Vizyoner</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Paket</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Fiyat</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">PIX</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Tarih</TableHead>
                      <TableHead className="text-right px-8 font-black uppercase text-[10px]">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPurchases.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="px-8 py-5 font-black">{p.user_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase">{p.package_name}</Badge></TableCell>
                        <TableCell className="font-bold">{p.price} TL</TableCell>
                        <TableCell className="font-black text-primary">{p.pix_amount}</TableCell>
                        <TableCell className="text-[10px] font-medium opacity-60">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: tr })}</TableCell>
                        <TableCell className="text-right px-8 space-x-2">
                          <Button onClick={() => handleRejectPurchase(p)} variant="ghost" size="sm" className="h-9 rounded-xl text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></Button>
                          <Button onClick={() => handleApprovePurchase(p)} size="sm" className="h-9 rounded-xl bg-green-600 hover:bg-green-700"><Check className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/20" />
                  <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Bekleyen ödeme bulunmuyor.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-12">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
              <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black uppercase"><Globe className="h-6 w-6 text-primary" /> Yeni Sergi</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...exhibitionForm}><form onSubmit={exhibitionForm.handleSubmit(onCreateExhibition)} className="space-y-6">
                  <FormField control={exhibitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Salon Adı</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  <FormField control={exhibitionForm.control} name="description" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Açıklama</FormLabel><FormControl><Textarea {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl font-black uppercase shadow-xl shadow-primary/20">Aktif Et</Button>
                </form></Form>
              </CardContent>
            </Card>
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
              <CardHeader className="bg-amber-500/5 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black uppercase"><Trophy className="h-6 w-6 text-amber-400" /> Yeni Yarışma</CardTitle></CardHeader>
              <CardContent className="p-8">
                <Form {...competitionForm}><form onSubmit={competitionForm.handleSubmit(onCreateCompetition)} className="space-y-6">
                  <FormField control={competitionForm.control} name="title" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Yarışma Adı</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  <FormField control={competitionForm.control} name="prize" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Ödül</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>)} />
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl font-black uppercase shadow-xl shadow-amber-500/20 bg-amber-500 text-black hover:bg-amber-600">Başlat</Button>
                </form></Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="academy"><AcademyAdminPanel /></TabsContent>

        <TabsContent value="users">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 border-b p-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase"><Users className="h-6 w-6 text-primary" /> Kullanıcılar</CardTitle>
                <Input placeholder="İsim veya e-posta ara..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="max-w-xs rounded-xl h-10 bg-background/50" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="px-8 font-black uppercase text-[10px]">Vizyoner</TableHead><TableHead className="font-black uppercase text-[10px]">Seviye</TableHead><TableHead className="font-black uppercase text-[10px]">PIX</TableHead><TableHead className="text-right px-8 font-black uppercase text-[10px]">İşlem</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-8 py-5"><div className="flex flex-col"><span className="font-black">{u.name}</span><span className="text-[10px] text-muted-foreground uppercase">{u.email}</span></div></TableCell>
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

        <TabsContent value="settings" className="space-y-12">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black uppercase"><Settings2 className="h-6 w-6 text-primary" /> Markalama</CardTitle></CardHeader>
            <CardContent className="p-8">
              <Form {...configForm}><form onSubmit={configForm.handleSubmit(onUpdateConfig)} className="space-y-8 max-w-md">
                <FormField control={configForm.control} name="currencyName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase">Para Birimi İsmi</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl font-black uppercase shadow-xl shadow-primary/10">Kaydet</Button>
              </form></Form>
            </CardContent>
          </Card>

          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
            <CardHeader className="bg-secondary/10 border-b p-8">
              <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><Package className="h-6 w-6 text-primary" /> PIX Paket Yönetimi</CardTitle>
              <CardDescription>Aktif paketlerinizi düzenleyin ve ödeme linklerini tanımlayın.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dbPackages?.map(pkg => (<PackageEditor key={pkg.id} pkg={pkg} onSave={handleUpdatePackage} />)) || (
                  <div className="col-span-full py-12 text-center space-y-4 border-2 border-dashed rounded-[32px]">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground/30" /><p className="text-muted-foreground font-medium">Paket bulunamadı.</p>
                    <Button variant="outline" className="rounded-xl font-black uppercase text-[10px]" onClick={async () => {
                      if(!firestore) return;
                      const defaults = [
                        { id: 'starter', name: 'Starter Paket', description: 'Hızlı başlangıç için temel paket.', price: 99, pix_amount: 20, payment_link: 'https://iyzi.link/AKg9LA', active: true, order: 1 },
                        { id: 'creator', name: 'Creator Paket', description: 'Gelişmiş analizler ve tam erişim.', price: 199, pix_amount: 60, payment_link: 'https://iyzi.link/AKg9OQ', active: true, order: 2 },
                        { id: 'pro', name: 'Pro Paket', description: 'Profesyonel araçlar ve mentorluk.', price: 349, pix_amount: 150, payment_link: 'https://iyzi.link/AKg9Og', active: true, order: 3 }
                      ];
                      for(const d of defaults) await setDoc(doc(firestore, 'pix_packages', d.id), d);
                      toast({ title: "Varsayılanlar Oluşturuldu" });
                    }}>Varsayılanları Yükle</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
