'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDocs, limit, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Group, User as UserProfile } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Users, Crown, Loader2, AlertTriangle, UserPlus, QrCode } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const addMemberSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

function MemberAvatar({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);
  
  const { data: user, isLoading } = useDoc<UserProfile>(userDocRef);

  if (isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  if (!user) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Avatar>
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>Kullanıcı bilgisi yüklenemedi</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Avatar>
            {user.email && <AvatarImage src={`https://api.dicebear.com/8.x/lorelei/svg?seed=${user.email}`} alt={user.name || ''} />}
            <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AddMemberForm({ group, groupRef, userLevel }: { group: Group; groupRef: any; userLevel?: string; }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '' },
  });

  const { maxMembers } = getGroupLimits(userLevel);

  async function onSubmit(values: AddMemberValues) {
    if (group.memberIds.length >= maxMembers) {
      toast({ variant: 'destructive', title: 'Grup Dolu', description: `Bu grup en fazla ${maxMembers} üyeye sahip olabilir.` });
      return;
    }
    
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', values.email), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Kullanıcı Bulunamadı', description: 'Bu e-postaya sahip bir kullanıcı yok.' });
        return;
      }
      
      const userToAdd = querySnapshot.docs[0];

      if (group.memberIds.includes(userToAdd.id)) {
        toast({ variant: 'destructive', title: 'Zaten Üye', description: 'Bu kullanıcı zaten grubun bir üyesi.' });
        return;
      }

      // Using updateDoc directly without the non-blocking wrapper for immediate feedback.
      await updateDoc(groupRef, {
        memberIds: arrayUnion(userToAdd.id),
      });

      toast({ title: 'Üye Eklendi!', description: `${values.email} gruba başarıyla eklendi.` });
      form.reset();
    } catch (error: any) {
      console.error("Üye ekleme hatası:", error);
       toast({
        variant: 'destructive',
        title: 'Hata',
        description: error.message.includes('permission-denied') 
          ? 'Üye eklemek için izniniz yok.' 
          : 'Üye eklenirken bir sorun oluştu.',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus /> Üye Davet Et</CardTitle>
        <CardDescription>Gruba eklemek istediğiniz kullanıcının e-posta adresini girin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormControl>
                    <Input placeholder="kullanici@eposta.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Davet Et
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;

  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [joinUrl, setJoinUrl] = useState('');
  const [isInviteDialogOpen, setInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const url = `${window.location.origin}/groups/join/${groupId}`;
        setJoinUrl(url);
    }
  }, [groupId]);

  const groupDocRef = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;

  const handleInviteDialogOpenChange = (open: boolean) => {
    if (open && isOwner && !group?.joinCode && groupDocRef) {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      updateDocumentNonBlocking(groupDocRef, { joinCode: newCode });
      toast({
        title: "Katılım Kodu Oluşturuldu",
        description: "Bu grup için yeni bir katılım kodu oluşturuldu ve kaydedildi."
      });
    }
    setInviteDialogOpen(open);
  };

  const copyToClipboard = (text: string, type: 'Link' | 'Kod') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Kopyalandı!', description: `${type} panoya kopyalandı.` });
    }, (err) => {
      toast({ variant: 'destructive', title: 'Hata', description: `${type} kopyalanamadı.` });
    });
  };

  if (isGroupLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="container mx-auto text-center py-20">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-xl font-semibold">Grup Bulunamadı</h3>
          <p className="text-muted-foreground mt-2">
            {groupError ? 'Bu grubu yüklerken bir hata oluştu.' : 'Böyle bir grup mevcut değil veya görme izniniz yok.'}
          </p>
          <Button onClick={() => window.history.back()} className="mt-6">Geri Dön</Button>
      </div>
    );
  }

  const { maxMembers } = getGroupLimits(userProfile?.level_name);

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
        {group.description && <p className="text-lg text-muted-foreground mt-2">{group.description}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Users /> Üyeler</div>
             <div className="flex items-center gap-2">
                {isOwner && joinUrl && (
                    <Dialog open={isInviteDialogOpen} onOpenChange={handleInviteDialogOpenChange}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <QrCode className="h-5 w-5" />
                                <span className="sr-only">Davet Seçeneklerini Göster</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Gruba Katılım Daveti</DialogTitle>
                                <DialogDescription>
                                    Bu QR kodu, linki veya 6 haneli kodu kullanarak yeni üyeleri grubunuza davet edebilirsiniz.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center justify-center p-4 bg-white rounded-lg my-4">
                                <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(joinUrl)}`}
                                    alt="Grup Katılım QR Kodu"
                                    width={192}
                                    height={192}
                                />
                            </div>
                            
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">VEYA</span></div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="join-code">6 Haneli Katılım Kodu</Label>
                              <div className="flex items-center space-x-2">
                                <Input id="join-code" value={group.joinCode || 'YOK'} readOnly className="font-mono text-center tracking-widest text-lg" />
                                <Button onClick={() => copyToClipboard(group.joinCode || '', 'Kod')} disabled={!group.joinCode}>Kopyala</Button>
                              </div>
                            </div>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">VEYA</span></div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="join-link">Paylaşılabilir Link</Label>
                                <div className="flex items-center space-x-2">
                                  <Input id="join-link" value={joinUrl} readOnly />
                                  <Button onClick={() => copyToClipboard(joinUrl, 'Link')}>Kopyala</Button>
                                </div>
                            </div>

                        </DialogContent>
                    </Dialog>
                )}
                <span className="text-sm font-normal text-muted-foreground">{group.memberIds.length} / {maxMembers}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {group.memberIds.map(memberId => (
              <div key={memberId} className="relative">
                <MemberAvatar userId={memberId} />
                {memberId === group.ownerId && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-400 p-0.5 rounded-full">
                     <Crown className="h-3 w-3 text-black" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {isOwner && groupDocRef && (
        <AddMemberForm group={group} groupRef={groupDocRef} userLevel={userProfile?.level_name} />
      )}

      {/* Placeholder for future sections */}
      <Card className="border-dashed">
        <CardContent className="p-10 text-center text-muted-foreground">
            <p>Gruba özel sergi ve ödev alanı yakında burada olacak.</p>
        </CardContent>
      </Card>

    </div>
  );
}
