'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
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
import { PlusCircle, Users, Crown, User, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const createGroupSchema = z.object({
  name: z.string().min(3, 'Grup adı en az 3 karakter olmalıdır.').max(50, 'Grup adı en fazla 50 karakter olabilir.'),
  description: z.string().max(200, 'Açıklama 200 karakteri geçemez.').optional(),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;

const getGroupLimits = (levelName?: string) => {
  switch (levelName) {
    case 'Vexer':
      return { maxGroups: 10, maxMembers: 40 };
    case 'Omner':
    case 'Sytner':
    case 'Viewner':
      return { maxGroups: 5, maxMembers: 15 };
    case 'Neuner':
    default:
      return { maxGroups: 1, maxMembers: 7 };
  }
};

function CreateGroupDialog({ canCreate, limit, ownedCount }: { canCreate: boolean; limit: number; ownedCount: number }) {
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
      const newGroupData = {
        name: values.name,
        description: values.description || '',
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
      };
      await addDocumentNonBlocking(groupsCollectionRef, newGroupData);

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
           {/* In the future, this will link to /groups/{group.id} */}
           <a href="#">Grubu Gör</a>
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
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const memberGroupsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid)) : null),
    [user, firestore]
  );
  const { data: memberGroups, isLoading: memberLoading } = useCollection<Group>(memberGroupsQuery);
  
  const ownedGroupsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'groups'), where('ownerId', '==', user.uid)) : null),
    [user, firestore]
  );
  const { data: ownedGroups, isLoading: ownedLoading } = useCollection<Group>(ownedGroupsQuery);
  
  const limits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = ownedGroups ? ownedGroups.length < limits.maxGroups : false;

  const isLoading = memberLoading || ownedLoading;

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          {/* Page title is already in layout */}
        </div>
        <CreateGroupDialog 
            canCreate={canCreateGroup} 
            limit={limits.maxGroups} 
            ownedCount={ownedGroups?.length ?? 0}
        />
      </div>

      {isLoading ? (
        <GroupsPageSkeleton />
      ) : memberGroups && memberGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memberGroups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">Henüz Bir Gruba Üye Değilsiniz</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Yeni bir grup oluşturarak kendi topluluğunuzu başlatın veya bir arkadaşınızdan davet alın.
          </p>
        </div>
      )}
    </div>
  );
}
