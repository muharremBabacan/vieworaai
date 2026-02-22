
'use client';

import { useState, useMemo } from 'react';
import { Link, useRouter } from '@/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, updateDoc, arrayUnion, getDocs, limit } from 'firebase/firestore';
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
import { PlusCircle, Users, Crown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getGroupLimits } from '@/lib/gamification';
import { useTranslations } from 'next-intl';

const createGroupSchema = (t: Function) => z.object({
  name: z.string().min(3, t('form_error_name_min')).max(50, t('form_error_name_max')),
  description: z.string().max(200, t('form_error_description_max')).optional(),
});

type CreateGroupValues = z.infer<ReturnType<typeof createGroupSchema>>;

function CreateGroupDialog({ canCreate, limit, ownedCount, userLevel }: { canCreate: boolean; limit: number; ownedCount: number, userLevel?: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const t = useTranslations('GroupsPage');

  const form = useForm<CreateGroupValues>({
    resolver: zodResolver(createGroupSchema(t)),
    defaultValues: { name: '', description: '' },
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
        createdAt: new Date().toISOString(),
        maxMembers: maxMembers,
        joinCode: Math.floor(100000 + Math.random() * 900000).toString(),
      };
      
      addDocumentNonBlocking(groupsCollectionRef, newGroupData);

      toast({
        title: t('toast_create_success_title'),
        description: t('toast_create_success_description', { name: values.name }),
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Grup oluşturma hatası:', error);
      toast({
        variant: 'destructive',
        title: t('toast_create_error_title'),
        description: t('toast_create_error_description'),
      });
    }
  };
  
  const triggerButton = (
    <DialogTrigger asChild>
      <Button disabled={!canCreate}>
        <PlusCircle className="mr-2 h-4 w-4" />
        {t('button_create_group')}
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
              <p>{t('create_limit_tooltip', { ownedCount, limit })}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('create_dialog_title')}</DialogTitle>
          <DialogDescription>{t('create_dialog_description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form_label_group_name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('form_placeholder_name')} {...field} />
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
                  <FormLabel>{t('form_label_group_description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('form_placeholder_description')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('button_create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const joinByCodeSchema = (t: Function) => z.object({
  code: z.string().length(6, t('form_error_code_length')).regex(/^\d{6}$/, t('form_error_code_format')),
});

type JoinByCodeValues = z.infer<ReturnType<typeof joinByCodeSchema>>;

function JoinByCodeDialog() {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const t = useTranslations('GroupsPage');
  const router = useRouter();

  const form = useForm<JoinByCodeValues>({
    resolver: zodResolver(joinByCodeSchema(t)),
    defaultValues: { code: '' },
  });

  const onSubmit = async (values: JoinByCodeValues) => {
    if (!user || !firestore) return;

    try {
      const q = query(collection(firestore, 'groups'), where("joinCode", "==", values.code), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: t('toast_join_not_found_title'), description: t('toast_join_not_found_description') });
        return;
      }
      
      const groupDoc = querySnapshot.docs[0];
      const group = { id: groupDoc.id, ...groupDoc.data() } as Group;

      if (group.memberIds.includes(user.uid)) {
        toast({ title: t('toast_join_already_member_title'), description: t('toast_join_already_member_description', {name: group.name}) });
        router.push(`/groups/${group.id}`);
        return;
      }

      await updateDoc(groupDoc.ref, {
        memberIds: arrayUnion(user.uid),
      });

      toast({ title: t('toast_join_success_title'), description: t('toast_join_success_description', { name: group.name }) });
      form.reset();
      setOpen(false);
      router.push(`/groups/${group.id}`);

    } catch (error: any) {
        console.error('Kod ile gruba katılma hatası:', error);
        toast({
            variant: 'destructive',
            title: t('toast_join_fail_title'),
            description: t('toast_join_fail_description'),
        });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t('button_join_by_code')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('join_dialog_title')}</DialogTitle>
          <DialogDescription>{t('join_dialog_description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form_label_invite_code')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('form_placeholder_code')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('button_join')}
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
  const t = useTranslations('GroupsPage');
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
                  <p>{t('card_owner_tooltip')}</p>
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
          <span>{t('card_member_count', { count: group.memberIds.length })}</span>
        </div>
        <Button variant="secondary" size="sm" asChild>
           <Link href={`/groups/${group.id}`}>{t('button_view_group')}</Link>
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
  const t = useTranslations('GroupsPage');
  const tNav = useTranslations('AppLayout');
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const memberGroupsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'groups'), where("memberIds", "array-contains", user.uid));
  }, [user, firestore]);

  const { data: memberGroups, isLoading: isGroupsLoading } = useCollection<Group>(memberGroupsQuery);

  const ownedGroups = useMemo(() => {
      if (!user || !memberGroups) return [];
      return memberGroups.filter(g => g.ownerId === user.uid);
  }, [user, memberGroups]);
  
  const limits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = memberGroups ? ownedGroups.length < limits.maxGroups : false;

  const isLoading = isProfileLoading || isGroupsLoading;
  
  const noGroups = !isLoading && (!memberGroups || memberGroups.length === 0);

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{tNav('title_groups')}</h1>
        <div className="flex items-center gap-2">
            <JoinByCodeDialog />
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
      ) : noGroups ? (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">{t('no_groups_title')}</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            {t('no_groups_description')}
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
