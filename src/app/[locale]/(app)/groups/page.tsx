'use client';

import { useState, useMemo, useEffect } from 'react';
import { Link, useRouter } from '@/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, getDocs, updateDoc, arrayUnion, limit, getDoc, documentId, addDoc } from 'firebase/firestore';
import type { User as UserProfile, Group } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Users, Crown, User, Loader2, Info, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getGroupLimits } from '@/lib/gamification';

const createGroupSchema = z.object({
  name: z.string().min(3, 'Grup adı en az 3 karakter olmalıdır.').max(50, 'Grup adı en fazla 50 karakter olabilir.'),
  description: z.string().max(200, 'Açıklama 200 karakteri geçemez.').optional(),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;

function CreateGroupDialog({ canCreate, limit, ownedCount, userLevel }: { canCreate: boolean; limit: number; ownedCount: number, userLevel?: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<CreateGroupValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (values: CreateGroupValues) => {
    if (!user || !firestore) return;

    try {
      const groupsCollectionRef = collection(firestore, 'groups');
      const { maxMembers } = getGroupLimits(userLevel);

      const newGroupData = {
        name: values.name,
        description: values.description || '',
        ownerId: user.uid,
        memberIds: [user.uid],
        joinCode: Math.floor(100000 + Math.random() * 900000).toString(),
        createdAt: new Date().toISOString(),
        maxMembers: maxMembers,
      };
      
      const newGroupRef = await addDoc(groupsCollectionRef, newGroupData);

      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
          groups: arrayUnion(newGroupRef.id)
      });


      toast({
        title: 'Grup Oluşturuldu!',
        description: `'${values.name}' adlı grubunuz başarıyla oluşturuldu.`,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Grup oluşturma hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Grup oluşturulurken bir sorun oluştu.',
      });
    }
  };
  
  const triggerButton = (
    <DialogTrigger asChild>
      <Button disabled={!canCreate}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Yeni Grup Oluştur
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {canCreate ? (
        triggerButton
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
                <div tabIndex={0}>{triggerButton}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Grup oluşturma limitine ulaştınız ({ownedCount}/{limit}).</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yeni Grup Oluştur</DialogTitle>
          <DialogDescription>Grubunuza bir isim ve amaç vererek topluluğunuzu başlatın.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grup Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn: Ankara Sokak Fotoğrafçıları" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama (İsteğe Bağlı)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Grubun amacı, hedefleri veya kuralları hakkında kısa bilgi." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Oluştur
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const joinGroupSchema = z.object({
  code: z.string().length(6, 'Kod 6 haneli olmalıdır.').regex(/^\d{6}$/, 'Kod sadece 6 rakamdan oluşmalıdır.'),
});
type JoinGroupValues = z.infer<typeof joinGroupSchema>;

function JoinGroupDialog() {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<JoinGroupValues>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = async (values: JoinGroupValues) => {
    if (!user || !firestore) return;

    const code = values.code;
    
    try {
      const q = query(collection(firestore, 'groups'), where('joinCode', '==', code), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Grup Bulunamadı', description: 'Bu koda sahip bir grup bulunamadı. Kodu kontrol edin.' });
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const group = groupDoc.data() as Group;
      const groupRef = groupDoc.ref;

      if (group.memberIds.includes(user.uid)) {
        toast({ title: 'Zaten Üyesiniz', description: `Zaten '${group.name}' grubunun bir üyesisiniz. Yönlendiriliyorsunuz.` });
        router.push(`/groups/${groupDoc.id}`);
        return;
      }
      
      // The group is found, now attempt to join. Security rules will handle capacity check.
      await updateDoc(groupRef, {
        memberIds: arrayUnion(user.uid),
      });

      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
          groups: arrayUnion(groupDoc.id)
      });

      toast({ title: 'Başarıyla Katıldın!', description: `'${group.name}' grubuna hoş geldin.` });
      form.reset();
      setOpen(false);

    } catch (error) {
      console.error('Koda göre katılma hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Katılım Başarısız',
        description: 'Gruba katılamadınız. Grup dolu olabilir veya bir hata oluştu.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Koda Göre Katıl
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bir Gruba Katıl</DialogTitle>
          <DialogDescription>Katılmak istediğiniz grubun 6 haneli davet kodunu girin.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Davet Kodu</FormLabel>
                  <FormControl>
                    <Input placeholder="123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gruba Katıl
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function GroupCard({ group }: { group: Group }) {
  const { user } = useUser();
  const isOwner = user?.uid === group.ownerId;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{group.name}</span>
          {isOwner && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Crown className="h-5 w-5 text-amber-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bu grubun sahibisiniz.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
        {group.description && <CardDescription className="line-clamp-2 h-10">{group.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-grow flex items-end justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{group.memberIds.length} üye</span>
        </div>
        <Button variant="secondary" size="sm" asChild>
           <Link href={`/groups/${group.id}`}>Grubu Gör</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function GroupsPageSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full mt-2" />
                        <Skeleton className="h-4 w-1/2 mt-1" />
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-9 w-24" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const groupIds = useMemo(() => userProfile?.groups, [userProfile]);

  const memberGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !groupIds || groupIds.length === 0) {
      return null;
    }
    // Firestore 'in' queries are limited to 30 items.
    if (groupIds.length > 30) {
      console.warn("User is a member of more than 30 groups, query will be truncated to the first 30.");
    }
    return query(collection(firestore, 'groups'), where(documentId(), 'in', groupIds.slice(0, 30)));
  }, [firestore, user, groupIds]);

  const { data: memberGroups, isLoading: isGroupsLoading } = useCollection<Group>(memberGroupsQuery);

  const ownedGroups = useMemo(() => {
      if (!user || !memberGroups) return [];
      return memberGroups.filter(g => g.ownerId === user.uid);
  }, [user, memberGroups]);
  
  const limits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = memberGroups ? ownedGroups.length < limits.maxGroups : false;

  const isLoading = isProfileLoading || (userProfile && groupIds && groupIds.length > 0 && isGroupsLoading);
  
  const noGroups = userProfile && (!groupIds || groupIds.length === 0);

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          {/* Page title is already in layout */}
        </div>
        <div className="flex items-center gap-2">
            <JoinGroupDialog />
            <CreateGroupDialog 
                canCreate={canCreateGroup} 
                limit={limits.maxGroups} 
                ownedCount={ownedGroups?.length ?? 0}
                userLevel={userProfile?.level_name}
            />
        </div>
      </div>

      {isLoading ? (
        <GroupsPageSkeleton />
      ) : (noGroups || (memberGroups && memberGroups.length === 0)) ? (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">Henüz Bir Gruba Üye Değilsiniz</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Yeni bir grup oluşturarak kendi topluluğunuzu başlatın veya bir arkadaşınızdan davet alın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memberGroups?.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
