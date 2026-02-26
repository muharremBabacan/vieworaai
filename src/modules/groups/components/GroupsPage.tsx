'use client';
import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, addDoc, doc, updateDoc, arrayUnion, getDocs } from 'firebase/firestore';
import type { Group, User } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, LogIn, Users, Crown } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function GroupsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

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
  
  const createFormSchema = z.object({
    name: z.string().min(3, 'Grup adı en az 3 karakter olmalıdır.').max(50, 'Grup adı en fazla 50 karakter olabilir.'),
    description: z.string().max(200, 'Açıklama 200 karakteri geçemez.').optional(),
  });

  const joinFormSchema = z.object({
      code: z.string().length(6, 'Kod 6 haneli olmalıdır.').regex(/^\d{6}$/, 'Kod sadece 6 rakamdan oluşmalıdır.'),
  });

  const createForm = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const joinForm = useForm<z.infer<typeof joinFormSchema>>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: { code: '' },
  });
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const groupLimits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = (ownedGroups?.length || 0) < groupLimits.maxGroups;

  const onCreateGroup = async (values: z.infer<typeof createFormSchema>) => {
    if (!user || !firestore) return;
    try {
      const newGroup: Omit<Group, 'id'> = {
        name: values.name,
        description: values.description || '',
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
        joinCode: String(Math.floor(100000 + Math.random() * 900000)),
        maxMembers: getGroupLimits(userProfile?.level_name).maxMembers,
      };
      const docRef = await addDoc(collection(firestore, 'groups'), newGroup);
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Grup Oluşturuldu!", description: `'${values.name}' adlı grubunuz başarıyla oluşturuldu.` });
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata", description: "Grup oluşturulurken bir sorun oluştu." });
    }
  };

  const onJoinGroup = async (values: z.infer<typeof joinFormSchema>) => {
      if (!user) return;
      const q = query(collection(firestore, "groups"), where("joinCode", "==", values.code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          toast({ variant: "destructive", title: "Grup Bulunamadı", description: "Bu koda sahip bir grup bulunamadı. Kodu kontrol edin." });
          return;
      }

      const group = querySnapshot.docs[0].data() as Group;
      
      if (group.memberIds.includes(user.uid)) {
          toast({ title: "Zaten Üyesiniz", description: `Zaten '${group.name}' grubunun bir üyesisiniz. Yönlendiriliyorsunuz.` });
          router.push(`/groups/${group.id}`);
          return;
      }
      
      if (group.memberIds.length >= group.maxMembers) {
          toast({ variant: "destructive", title: "Katılım Başarısız", description: "Grup dolu olabilir veya bir hata oluştu." });
          return;
      }

      try {
          await updateDoc(doc(firestore, "groups", group.id), {
              memberIds: arrayUnion(user.uid)
          });
          toast({ title: "Başarıyla Katıldın!", description: `'${group.name}' grubuna hoş geldin.` });
          router.push(`/groups/${group.id}`);
      } catch (error) {
          toast({ variant: "destructive", title: "Katılım Başarısız", description: "Grup dolu olabilir veya bir hata oluştu." });
      }
  };

  const isLoading = isUserLoading || isGroupsLoading || isOwnedLoading;

  return (
    <div className="container mx-auto px-4 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight">Gruplarım</h1>
        <div className="flex flex-row items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar py-1">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex-1 sm:flex-none">
                                <DialogTrigger asChild>
                                    <Button disabled={!canCreateGroup} className="w-full sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Yeni Grup Oluştur
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </TooltipTrigger>
                        {!canCreateGroup && <TooltipContent><p>Grup oluşturma limitine ulaştınız ({ownedGroups?.length || 0}/{groupLimits.maxGroups}).</p></TooltipContent>}
                    </Tooltip>
                </TooltipProvider>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Grup Oluştur</DialogTitle>
                        <DialogDescription>Grubunuza bir isim ve amaç vererek topluluğunuzu başlatın.</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(onCreateGroup)} className="space-y-4">
                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Grup Adı</FormLabel>
                                    <FormControl><Input placeholder="Örn: Ankara Sokak Fotoğrafçıları" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Açıklama (İsteğe Bağlı)</FormLabel>
                                    <FormControl><Textarea placeholder="Grubun amacı, hedefleri veya kuralları hakkında kısa bilgi." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full h-11">Oluştur</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="flex-1 sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95">
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
                                    <FormControl><Input placeholder="123456" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full h-11">Gruba Katıl</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </div>
      
      {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[24px]" />)}
          </div>
      ) : memberGroups && memberGroups.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberGroups.map(group => (
                  <Card key={group.id} className="flex flex-col group overflow-hidden border-border/40 bg-card/50 rounded-[24px] transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]">
                      <CardHeader>
                          <CardTitle className="flex justify-between items-start text-xl font-bold">
                              <span className="truncate mr-2">{group.name}</span>
                              {group.ownerId === user?.uid && (
                                  <TooltipProvider>
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Crown className="h-5 w-5 text-amber-400 shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent>Bu grubun sahibisiniz.</TooltipContent>
                                      </Tooltip>
                                  </TooltipProvider>
                              )}
                          </CardTitle>
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
              ))}
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
