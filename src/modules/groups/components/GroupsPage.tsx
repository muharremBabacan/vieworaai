'use client';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, addDoc, doc, updateDoc, arrayUnion, getDocs, getDoc, setDoc } from 'firebase/firestore';
import type { Group, User, GroupPurpose } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import { canAccess } from '@/lib/auth/canAccess';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, LogIn, Users, Crown, Loader2, GraduationCap, Trophy, Map, ShieldCheck, Lock, Hash, Copy } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PURPOSE_CONFIG: Record<GroupPurpose, { label: string; icon: any; color: string }> = {
  study: { label: 'Eğitim', icon: GraduationCap, color: 'bg-blue-500/10 text-blue-400' },
  challenge: { label: 'Yarışma', icon: Trophy, color: 'bg-amber-500/10 text-amber-400' },
  walk: { label: 'Gezi', icon: Map, color: 'bg-green-500/10 text-green-400' },
  mentor: { label: 'Eğitimci', icon: ShieldCheck, color: 'bg-purple-500/10 text-purple-400' },
};

export default function GroupsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const groupsQuery = useMemoFirebase(
    () => user ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid)) : null,
    [user, firestore]
  );
  const { data: memberGroups, isLoading: isGroupsLoading } = useCollection<Group>(groupsQuery);

  const ownedGroupsQuery = useMemoFirebase(
    () => user ? query(collection(firestore, 'groups'), where('ownerId', '==', user.uid)) : null,
    [user, firestore]
  );
  const { data: ownedGroups, isLoading: isOwnedLoading } = useCollection<Group>(ownedGroupsQuery);
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const createFormSchema = z.object({
    name: z.string().min(3, 'Grup adı en az 3 karakter olmalıdır.').max(50, 'Grup adı en fazla 50 karakter olabilir.'),
    description: z.string().max(200, 'Açıklama 200 karakteri geçemez.').optional(),
    purpose: z.enum(['study', 'challenge', 'walk', 'mentor'] as const, {
      required_error: "Lütfen bir grup amacı seçin.",
    }),
  });

  const joinFormSchema = z.object({
      code: z.string().length(6, 'Kod 6 haneli olmalıdır.').regex(/^\d{6}$/, 'Kod sadece 6 rakamdan oluşmalıdır.'),
  });

  const createForm = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { name: '', description: '', purpose: 'study' },
  });

  const joinForm = useForm<z.infer<typeof joinFormSchema>>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: { code: '' },
  });

  const hasAccessToCreate = canAccess(userProfile, "createGroup");
  const groupLimits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = hasAccessToCreate && (ownedGroups?.length || 0) < groupLimits.maxGroups;

  const onCreateGroup = async (values: z.infer<typeof createFormSchema>) => {
    if (!user || !firestore || isCreating || !hasAccessToCreate) return;
    setIsCreating(true);
    try {
      const newGroup: Omit<Group, 'id'> = {
        name: values.name,
        description: values.description || '',
        purpose: values.purpose,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
        joinCode: String(Math.floor(100000 + Math.random() * 900000)),
        maxMembers: getGroupLimits(userProfile?.level_name).maxMembers,
      };
      const docRef = await addDoc(collection(firestore, 'groups'), newGroup);
      await updateDoc(docRef, { id: docRef.id });
      
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      const publicSnap = await getDoc(publicRef);
      if (!publicSnap.exists()) {
          await setDoc(publicRef, {
              id: user.uid,
              name: userProfile?.name || user.displayName || "Sanatçı",
              email: user.email,
              photoURL: userProfile?.photoURL || user.photoURL || null,
              level_name: userProfile?.level_name || 'Neuner'
          });
      }

      toast({ title: "Grup Oluşturuldu!", description: `'${values.name}' adlı grubunuz başarıyla oluşturuldu.` });
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata", description: "Grup oluşturulurken bir sorun oluştu." });
    } finally {
      setIsCreating(false);
    }
  };

  const onJoinGroup = async (values: z.infer<typeof joinFormSchema>) => {
      if (!user || !firestore || isJoining) return;
      setIsJoining(true);
      
      try {
          const q = query(collection(firestore, "groups"), where("joinCode", "==", values.code));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              toast({ variant: "destructive", title: "Grup Bulunamadı", description: "Bu koda sahip bir grup bulunamadı. Kodu kontrol edin." });
              return;
          }

          const groupDoc = querySnapshot.docs[0];
          const groupData = groupDoc.data() as Group;
          const groupId = groupDoc.id;
          
          if (groupData.memberIds.includes(user.uid)) {
              toast({ title: "Zaten Üyesiniz", description: `Zaten '${groupData.name}' grubunun bir üyesisiniz. Yönlendiriliyorsunuz.` });
              setIsJoinDialogOpen(false);
              router.push(`/groups/${groupId}`);
              return;
          }
          
          if (groupData.memberIds.length >= groupData.maxMembers) {
              toast({ variant: "destructive", title: "Katılım Başarısız", description: "Grup kapasitesi dolu." });
              return;
          }

          await updateDoc(doc(firestore, "groups", groupId), {
              memberIds: arrayUnion(user.uid)
          });

          const publicRef = doc(firestore, 'public_profiles', user.uid);
          const publicSnap = await getDoc(publicRef);
          if (!publicSnap.exists()) {
              const userSnap = await getDoc(doc(firestore, 'users', user.uid));
              if (userSnap.exists()) {
                  const userData = userSnap.data() as User;
                  await setDoc(publicRef, {
                      id: user.uid,
                      name: userData.name,
                      email: userData.email,
                      photoURL: userData.photoURL || null,
                      level_name: userData.level_name || 'Neuner'
                  });
              }
          }
          
          toast({ title: "Başarıyla Katıldın!", description: `'${groupData.name}' grubuna hoş geldin.` });
          joinForm.reset();
          setIsJoinDialogOpen(false);
          router.push(`/groups/${groupId}`);
      } catch (error) {
          console.error("Join group error:", error);
          toast({ variant: "destructive", title: "Katılım Başarısız", description: "Bir hata oluştu, lütfen tekrar deneyin." });
      } finally {
          setIsJoining(false);
      }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Kopyalandı!", description: "Grup numarası panoya kopyalandı." });
  };

  const isLoading = isUserLoading || isGroupsLoading || isOwnedLoading;

  return (
    <div className="container mx-auto px-4 pt-6">
      <div className="flex flex-col gap-6 mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight">Gruplarım</h1>
        
        {mounted && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="w-full sm:w-auto">
                                <DialogTrigger asChild>
                                    <Button 
                                      disabled={!canCreateGroup} 
                                      className={cn("w-full sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95", !hasAccessToCreate && "opacity-70 bg-secondary")}
                                    >
                                        {!hasAccessToCreate ? <Lock className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                        Yeni Grup Oluştur
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl font-bold text-xs">
                            {!hasAccessToCreate 
                              ? <p>Grup kurmak için <b>Viewner</b> seviyesine ulaşmalısın.</p>
                              : <p>Grup oluşturma limitine ulaştınız ({ownedGroups?.length || 0}/{groupLimits.maxGroups}).</p>}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Grup Oluştur</DialogTitle>
                        <DialogDescription>Grubunuza bir isim ve amaç vererek topluluğunuzu başlatın.</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(onCreateGroup)} className="space-y-4">
                            <FormField control={createForm.control} name="purpose" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Grup Amacı</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 rounded-xl">
                                                <SelectValue placeholder="Bir amaç seçin" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="study">Study Group (Eğitim)</SelectItem>
                                            <SelectItem value="challenge">Challenge Group (Yarışma)</SelectItem>
                                            <SelectItem value="walk">Photo Walk (Gezi)</SelectItem>
                                            <SelectItem value="mentor">Mentor Group (Eğitimci)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Grup Adı</FormLabel>
                                    <FormControl><Input placeholder="Örn: Ankara Sokak Fotoğrafçıları" {...field} className="h-11 rounded-xl" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Açıklama (İsteğe Bağlı)</FormLabel>
                                    <FormControl><Textarea placeholder="Grubun amacı, hedefleri veya kuralları hakkında kısa bilgi." {...field} className="rounded-xl" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" disabled={isCreating} className="w-full h-11 rounded-xl font-bold">
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Grubu Kur
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95">
                        <LogIn className="mr-2 h-4 w-4" /> Koda Göre Katıl
                    </Button>
                </DialogTrigger>
                <DialogContent>
                     <DialogHeader>
                        <DialogTitle>Bir Gruba Katıl</DialogTitle>
                        <DialogDescription>Katılmak istediğiniz grubun 6 haneli davet kodunu girin.</DialogDescription>
                    </DialogHeader>
                    <Form {...joinForm}>
                        <form onSubmit={joinForm.handleSubmit(onJoinGroup)} className="space-y-4">
                            <FormField control={joinForm.control} name="code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Davet Kodu</FormLabel>
                                    <FormControl><Input placeholder="123456" {...field} className="h-11 rounded-xl" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" disabled={isJoining} className="w-full h-11 rounded-xl font-bold">
                                {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Gruba Katıl
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      
      {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[24px]" />)}
          </div>
      ) : memberGroups && memberGroups.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberGroups.map(group => {
                  const purpose = PURPOSE_CONFIG[group.purpose || 'study'];
                  const isOwner = group.ownerId === user?.uid;
                  return (
                    <Card key={group.id} className="flex flex-col group overflow-hidden border-border/40 bg-card/50 rounded-[24px] transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-start text-xl font-bold">
                                <span className="truncate mr-2">{group.name}</span>
                                <div className="flex gap-1">
                                    {isOwner && <Crown className="h-4 w-4 text-amber-400" />}
                                </div>
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className={cn("px-2 py-0 h-5 text-[9px] font-black uppercase tracking-widest border-none", purpose.color)}>
                                    <purpose.icon size={10} className="mr-1" /> {purpose.label}
                                </Badge>
                                {isOwner && group.joinCode && (
                                  <Badge variant="outline" className="px-2 py-0 h-5 text-[9px] font-black uppercase tracking-widest bg-muted/50 flex items-center gap-1 cursor-pointer hover:bg-muted" onClick={(e) => { e.preventDefault(); copyToClipboard(group.joinCode!); }}>
                                    <Hash size={8} /> {group.joinCode}
                                  </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col">
                            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow mb-6 h-10">{group.description || "Bu grup için bir açıklama bulunmuyor."}</p>
                            <div className="flex justify-between items-center mt-auto">
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    <Users className="h-4 w-4" />
                                    <span>{group.memberIds.length} üye</span>
                                </div>
                                <Button asChild className="rounded-xl px-6 shadow-lg shadow-primary/10">
                                    <Link href={`/groups/${group.id}`}>Grubu Gör</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                  );
              })}
          </div>
      ) : (
          <div className="text-center py-32 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5 animate-in fade-in zoom-in duration-500">
              <div className="h-20 w-20 rounded-3xl bg-secondary/50 flex items-center justify-center mx-auto mb-6">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Henüz Bir Gruba Üye Değilsiniz</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">Yeni bir grup oluşturarak kendi topluluğunuzu başlatın veya bir arkadaşınızdan davet alın.</p>
          </div>
      )}
    </div>
  );
}
