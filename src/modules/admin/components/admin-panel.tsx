
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  collection, doc, updateDoc, query, orderBy,
  addDoc, setDoc, increment, where, writeBatch, deleteDoc
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import {
  Loader2, Trophy, Camera, Users, Globe, Gem, Settings2, Sparkles, GraduationCap, Package, Save, CreditCard, Activity as ActivityIcon, Edit3, Shield
} from 'lucide-react';
import type { Competition, Exhibition, AnalysisLog, User, AppSettings, PixPackage, PixPurchase } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppConfig } from '@/components/AppConfigProvider';
import AcademyAdminPanel from './AcademyAdminPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const configSchema = z.object({
  currencyName: z.string().min(2, 'En az 2 karakter').max(10, 'En fazla 10 karakter'),
});

const userEditSchema = z.object({
  level_name: z.string(),
  auro_balance: z.coerce.number().min(0),
  total_analyses_count: z.coerce.number().min(0),
  total_mentor_analyses_count: z.coerce.number().min(0),
  total_exhibitions_count: z.coerce.number().min(0),
  total_competitions_count: z.coerce.number().min(0),
});

export default function AdminPanel() {
  const t = useTranslations('MasterAdmin');
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { currencyName: currentCurrency } = useAppConfig();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('accounting');
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [notifyingOwnerId, setNotifyingOwnerId] = useState<string | null>(null);
  const [notifyingOwnerName, setNotifyingOwnerName] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState('');

  // Unconditional Hooks at top
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
  const allGroupsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'groups'), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const allExhibitionsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'exhibitions'), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );

  const { data: appConfig } = useDoc<AppSettings>(configRef);
  const { data: logs } = useCollection<AnalysisLog>(logsQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);
  const { data: dbPackages } = useCollection<PixPackage>(packagesQuery);
  const { data: pendingPurchases } = useCollection<PixPurchase>(purchasesQuery);
  const { data: allGroups } = useCollection<Group>(allGroupsQuery);
  const { data: allExhibitions } = useCollection<Exhibition>(allExhibitionsQuery);

  const configForm = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: { currencyName: currentCurrency || 'Pix' }
  });

  useEffect(() => {
    if (appConfig) configForm.reset({ currencyName: appConfig.currencyName });
  }, [appConfig, configForm]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
    const adminUids = ['01DT86bQwWUVmrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
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

  // Conditional rendering AFTER all hooks to maintain stable order
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
        <Shield size={64} className="text-destructive/20" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">{t('unauthorized')}</h2>
        <Button variant="outline" onClick={() => router.push('/')} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          Ana Sayfaya Dön
        </Button>
      </div>
    );
  }

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
      } as AnalysisLog);

      await batch.commit();
      toast({ title: t("toast_payment_approved") });
    } catch (e) {
      toast({ variant: 'destructive', title: t("toast_error") });
    } finally { setIsSubmitting(false); }
  };

  const handleSendNotification = async () => {
    if (!firestore || !notifyingOwnerId || !notificationMsg || isSubmitting) return;
    setIsSubmitting(true);
    try {
        const notifRef = doc(collection(firestore, 'notifications'));
        await setDoc(notifRef, {
            id: notifRef.id,
            userId: notifyingOwnerId,
            title: "Admin Mesajı",
            message: notificationMsg,
            type: 'system',
            createdAt: new Date().toISOString(),
            read: false
        });
        toast({ title: t('toast_notification_sent') });
        setNotifyingOwnerId(null);
        setNotificationMsg('');
    } catch (e) {
        toast({ variant: 'destructive', title: t('toast_error') });
    } finally { setIsSubmitting(false); }
  };

  const handleArchiveGroup = async (groupId: string) => {
    if (!firestore || isSubmitting) return;
    try {
        await updateDoc(doc(firestore, 'groups', groupId), { isArchived: true });
        toast({ title: "Grup Arşivlendi" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!firestore || isSubmitting) return;
    if (!confirm("Bu grubu tamamen silmek istediğinize emin misiniz?")) return;
    try {
        await deleteDoc(doc(firestore, 'groups', groupId));
        toast({ title: "Grup Silindi" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  return (
    <div className="container mx-auto px-4 pb-24 pt-10 animate-in fade-in duration-700">
      <header className="mb-16 text-center space-y-2">
        <h1 className="text-7xl font-black tracking-tighter uppercase leading-none">{isUsersLoading ? '...' : users?.length || 0} {t("visionary")}</h1>
        <p className="text-sm font-black text-primary uppercase tracking-[0.4em] opacity-70">{t('admin_panel')}</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="relative filter-scroll mb-10">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x snap-mandatory">
            <TabsList className="inline-flex w-max bg-secondary/30 p-1 rounded-2xl h-14 border border-border/40 gap-1 px-1">
              <TabsTrigger value="accounting" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">{t('tab_accounting')}</TabsTrigger>
              <TabsTrigger value="payments" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">{t('tab_payments')}</TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">{t('tab_users')}</TabsTrigger>
              <TabsTrigger value="community" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">{t('tab_community')}</TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 px-8 font-black uppercase text-xs tracking-widest rounded-xl snap-start">{t('tab_general')}</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="accounting" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-primary/5 border-primary/20 rounded-[32px] shadow-sm">
              <CardHeader className="pb-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">{t('package')}</div>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/70">{t('spent')}</CardDescription>
              </CardHeader>
              <CardContent><p className="text-4xl font-black text-primary">{metrics?.totalAuro || 0}</p></CardContent>
            </Card>
            {/* Other metric cards... */}
          </div>
          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-card/50">
            <CardHeader className="bg-secondary/20 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><ActivityIcon className="h-6 w-6 text-primary" /> {t('recent_transactions')}</CardTitle></CardHeader>
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
              <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><CreditCard className="h-6 w-6 text-primary" /> {t('pending_payments')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingPurchases && pendingPurchases.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>{t('visionary')}</TableHead><TableHead>{t('package')}</TableHead><TableHead>{t('price')}</TableHead><TableHead>PIX</TableHead><TableHead className="text-right">{t('action')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingPurchases.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold px-8">{p.user_name}</TableCell>
                        <TableCell>{p.package_name}</TableCell>
                        <TableCell>{p.price} TL</TableCell>
                        <TableCell className="font-black text-primary">{p.pix_amount}</TableCell>
                        <TableCell className="text-right px-8"><Button onClick={() => handleApprovePurchase(p)} size="sm" className="bg-green-600 hover:bg-green-700 h-8">{t('approve')}</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="py-20 text-center text-muted-foreground font-bold uppercase text-xs">{t('no_pending_payments')}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 border-b p-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><Users className="h-6 w-6 text-primary" /> {t('user_management')}</CardTitle>
                <div className="flex items-center bg-background/50 rounded-xl px-3 border border-border/60">
                  <Input placeholder={t("search_user")} value={userSearch} onChange={e => setUserSearch(e.target.value)} className="border-none bg-transparent h-10 w-64 focus-visible:ring-0" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="px-8">Vizyoner</TableHead><TableHead>{t('level_rank')}</TableHead><TableHead>PIX</TableHead><TableHead>{t('photo_analysis')} (F/L)</TableHead><TableHead className="text-right px-8">{t('action')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="px-8 py-5"><div className="flex flex-col"><span className="font-black text-base">{u.name}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">{u.email}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 text-primary">{u.level_name}</Badge></TableCell>
                      <TableCell className="font-black text-foreground">{u.auro_balance}</TableCell>
                      <TableCell><div className="flex gap-2 text-[10px] font-bold uppercase"><span className="text-blue-400">F: {u.total_analyses_count || 0}</span><span className="text-purple-400">L: {u.total_mentor_analyses_count || 0}</span></div></TableCell>
                      <TableCell className="text-right px-8"><Button onClick={() => setEditingUser(u)} variant="ghost" size="sm" className="rounded-lg hover:bg-primary/10 hover:text-primary"><Edit3 className="h-4 w-4 mr-2" /> {t('manage')}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academy"><AcademyAdminPanel /></TabsContent>

        <TabsContent value="community" className="space-y-8">
            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
                <CardHeader className="bg-secondary/20 border-b p-8">
                    <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Globe className="h-6 w-6 text-primary" /> {t('list_groups')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-8 font-black">Grup Adı</TableHead>
                                <TableHead>Tür</TableHead>
                                <TableHead>Gizlilik</TableHead>
                                <TableHead>Üye</TableHead>
                                <TableHead className="text-right px-8">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allGroups?.map(g => (
                                <TableRow key={g.id} className="group hover:bg-muted/30">
                                    <TableCell className="px-8">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{g.name}</span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground opacity-60">ID: {g.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase">{g.purpose}</Badge></TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={cn("text-[10px] font-black uppercase", g.isGalleryPublic ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                            {g.isGalleryPublic ? "Global" : "Özel"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-bold">{g.memberIds.length}</TableCell>
                                    <TableCell className="text-right px-8 space-x-2">
                                        <Button size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase" onClick={() => { setNotifyingOwnerId(g.ownerId); setNotifyingOwnerName(g.name); }}>{t('button_notify')}</Button>
                                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-amber-500 hover:text-amber-600" onClick={() => handleArchiveGroup(g.id)}>{t('button_archive')}</Button>
                                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-red-500 hover:text-red-600" onClick={() => handleDeleteGroup(g.id)}>{t('button_delete')}</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
                <CardHeader className="bg-secondary/20 border-b p-8">
                    <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight"><Trophy className="h-6 w-6 text-primary" /> {t('list_exhibitions')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-8 font-black">Sergi Adı</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right px-8">Tarih</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allExhibitions?.map(ex => (
                                <TableRow key={ex.id} className="group hover:bg-muted/30">
                                    <TableCell className="px-8 font-bold">{ex.title}</TableCell>
                                    <TableCell><Badge className={cn(ex.isActive ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground")}>{ex.isActive ? "Aktif" : "Pasif"}</Badge></TableCell>
                                    <TableCell className="text-right px-8 text-[10px] font-bold text-muted-foreground">{ex.startDate} - {ex.endDate}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-12">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
            <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><Settings2 className="h-6 w-6 text-primary" /> {t('branding')}</CardTitle></CardHeader>
            <CardContent className="p-8">
              <Form {...configForm}><form onSubmit={configForm.handleSubmit(async (v) => { if (firestore) { await setDoc(doc(firestore, 'app_settings', 'config'), v, { merge: true }); toast({ title: t("toast_saved") }); } })} className="space-y-8 max-w-md">
                <FormField control={configForm.control} name="currencyName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase">{t('currency_name')}</FormLabel><FormControl><Input {...field} className="rounded-2xl" /></FormControl></FormItem>
                )} />
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl font-black uppercase shadow-xl shadow-primary/10">{t('save')}</Button>
              </form></Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserEditDialog userToEdit={editingUser} isOpen={!!editingUser} onClose={() => setEditingUser(null)} onUpdate={async (id, v) => { if(firestore) await updateDoc(doc(firestore, 'users', id), v); toast({title: t("toast_user_updated")}); }} />

      <Dialog open={!!notifyingOwnerId} onOpenChange={(o) => !o && setNotifyingOwnerId(null)}>
        <DialogContent className="max-w-md rounded-[32px]">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Sahibine Mesaj Gönder</DialogTitle>
                <p className="text-xs font-bold text-muted-foreground">{notifyingOwnerName} Grubu Hakkında</p>
            </DialogHeader>
            <div className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Mesajınız</Label>
                    <textarea 
                        value={notificationMsg} 
                        onChange={(e) => setNotificationMsg(e.target.value)}
                        className="w-full h-32 rounded-2xl bg-muted/30 border border-border/60 p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Grup kurulalları ihlali veya bilgilendirme..."
                    />
                </div>
                <Button onClick={handleSendNotification} disabled={isSubmitting || !notificationMsg} className="w-full h-12 rounded-2xl font-black uppercase shadow-xl">
                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Bildirimi Gönder"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserEditDialog({ userToEdit, isOpen, onClose, onUpdate }: { userToEdit: User | null, isOpen: boolean, onClose: () => void, onUpdate: (userId: string, values: any) => Promise<void> }) {
  const t = useTranslations('MasterAdmin');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      level_name: userToEdit?.level_name || 'Neuner',
      auro_balance: userToEdit?.auro_balance || 0,
      total_analyses_count: userToEdit?.total_analyses_count || 0,
      total_mentor_analyses_count: userToEdit?.total_mentor_analyses_count || 0,
      total_exhibitions_count: userToEdit?.total_exhibitions_count || 0,
      total_competitions_count: userToEdit?.total_competitions_count || 0,
    }
  });

  useEffect(() => {
    if (userToEdit) {
      form.reset({
        level_name: userToEdit.level_name,
        auro_balance: userToEdit.auro_balance,
        total_analyses_count: userToEdit.total_analyses_count || 0,
        total_mentor_analyses_count: userToEdit.total_mentor_analyses_count || 0,
        total_exhibitions_count: userToEdit.total_exhibitions_count || 0,
        total_competitions_count: userToEdit.total_competitions_count || 0,
      });
    }
  }, [userToEdit, form]);

  const onSubmit = async (values: any) => {
    if (!userToEdit) return;
    setIsUpdating(true);
    await onUpdate(userToEdit.id, values);
    setIsUpdating(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">{t('edit_visionary')}</DialogTitle>
          <p className="text-xs font-bold text-muted-foreground">@{userToEdit?.name}</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level_name"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('level_rank')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Neuner">Neuner</SelectItem>
                        <SelectItem value="Viewner">Viewner</SelectItem>
                        <SelectItem value="Vexer">Vexer</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="auro_balance"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('pix_balance')}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-xl h-11 bg-muted/30 border-border/60" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_analyses_count"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('photo_analysis')}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-xl h-11 bg-muted/30 border-border/60" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_mentor_analyses_count"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('mentor_analysis')}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-xl h-11 bg-muted/30 border-border/60" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_exhibitions_count"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('exhibitions')}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-xl h-11 bg-muted/30 border-border/60" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_competitions_count"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('competitions')}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-xl h-11 bg-muted/30 border-border/60" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isUpdating} className="w-full h-12 rounded-2xl font-black uppercase">
                {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : t('save_changes')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
