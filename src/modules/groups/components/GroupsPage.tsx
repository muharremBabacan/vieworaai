'use client';
import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, addDoc, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Group, User } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/navigation';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function GroupsPage() {
  const t = useTranslations('GroupsPage');
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
    name: z.string().min(3, t('form_error_name_min')).max(50, t('form_error_name_max')),
    description: z.string().max(200, t('form_error_description_max')).optional(),
  });

  const joinFormSchema = z.object({
      code: z.string().length(6, t('form_error_code_length')).regex(/^\d{6}$/, t('form_error_code_format')),
  });

  const createForm = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const joinForm = useForm<z.infer<typeof joinFormSchema>>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: { code: '' },
  });
  
  const { data: userProfile } = useCollection<User>(useMemoFirebase(() => user ? query(collection(firestore, 'users'), where('id', '==', user.uid)) : null, [user, firestore]));
  const groupLimits = getGroupLimits(userProfile?.[0]?.level_name);
  const canCreateGroup = (ownedGroups?.length || 0) < groupLimits.maxGroups;

  const onCreateGroup = async (values: z.infer<typeof createFormSchema>>) => {
    if (!user || !firestore) return;
    try {
      const newGroup: Omit<Group, 'id'> = {
        name: values.name,
        description: values.description || '',
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
        joinCode: String(Math.floor(100000 + Math.random() * 900000)),
        maxMembers: getGroupLimits(userProfile?.[0]?.level_name).maxMembers,
      };
      const docRef = await addDoc(collection(firestore, 'groups'), newGroup);
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: t('toast_create_success_title'), description: t('toast_create_success_description', { name: values.name }) });
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast_create_error_title'), description: t('toast_create_error_description') });
    }
  };

  const onJoinGroup = async (values: z.infer<typeof joinFormSchema>>) => {
      if (!user) return;
      const q = query(collection(firestore, "groups"), where("joinCode", "==", values.code));
      const querySnapshot = await getDoc(doc(q.firestore, q.path));

      if (querySnapshot.empty) {
          toast({ variant: "destructive", title: t('toast_join_not_found_title'), description: t('toast_join_not_found_description') });
          return;
      }

      const group = querySnapshot.docs[0].data() as Group;
      
      if (group.memberIds.includes(user.uid)) {
          toast({ title: t('toast_join_already_member_title'), description: t('toast_join_already_member_description', { name: group.name }) });
          router.push(`/groups/${group.id}`);
          return;
      }
      
      if (group.memberIds.length >= group.maxMembers) {
          toast({ variant: "destructive", title: t('toast_join_fail_title'), description: t('toast_join_fail_description') });
          return;
      }

      try {
          await updateDoc(doc(firestore, "groups", group.id), {
              memberIds: arrayUnion(user.uid)
          });
          toast({ title: t('toast_join_success_title'), description: t('toast_join_success_description', { name: group.name }) });
          router.push(`/groups/${group.id}`);
      } catch (error) {
          toast({ variant: "destructive", title: t('toast_join_fail_title'), description: t('toast_join_fail_description') });
      }
  };

  const isLoading = isUserLoading || isGroupsLoading || isOwnedLoading;

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Gruplarım</h1>
        <div className="flex gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="inline-block">
                                <DialogTrigger asChild>
                                    <Button disabled={!canCreateGroup}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> {t('button_create_group')}
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </TooltipTrigger>
                        {!canCreateGroup && <TooltipContent><p>{t('create_limit_tooltip', { ownedCount: ownedGroups?.length || 0, limit: groupLimits.maxGroups })}</p></TooltipContent>}
                    </Tooltip>
                </TooltipProvider>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                        <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(onCreateGroup)} className="space-y-4">
                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form_label_group_name')}</FormLabel>
                                    <FormControl><Input placeholder={t('form_placeholder_name')} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form_label_group_description')}</FormLabel>
                                    <FormControl><Textarea placeholder={t('form_placeholder_description')} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full">{t('button_create')}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary"><LogIn className="mr-2 h-4 w-4" /> {t('button_join_by_code')}</Button>
                </DialogTrigger>
                <DialogContent>
                     <DialogHeader>
                        <DialogTitle>{t('join_dialog_title')}</DialogTitle>
                        <DialogDescription>{t('join_dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...joinForm}>
                        <form onSubmit={joinForm.handleSubmit(onJoinGroup)} className="space-y-4">
                            <FormField control={joinForm.control} name="code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form_label_invite_code')}</FormLabel>
                                    <FormControl><Input placeholder={t('form_placeholder_code')} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full">{t('button_join')}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </div>
      
      {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
          </div>
      ) : memberGroups && memberGroups.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberGroups.map(group => (
                  <Card key={group.id} className="flex flex-col">
                      <CardHeader>
                          <CardTitle className="flex justify-between items-start">
                              {group.name}
                              {group.ownerId === user?.uid && (
                                  <TooltipProvider>
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Crown className="h-5 w-5 text-amber-400" />
                                          </TooltipTrigger>
                                          <TooltipContent>{t('card_owner_tooltip')}</TooltipContent>
                                      </Tooltip>
                                  </TooltipProvider>
                              )}
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-grow flex flex-col">
                          <p className="text-sm text-muted-foreground flex-grow mb-4">{group.description}</p>
                          <div className="flex justify-between items-center">
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  <span>{t('card_member_count', { count: group.memberIds.length })}</span>
                               </div>
                               <Button asChild>
                                  <Link href={`/groups/${group.id}`}>{t('button_view_group')}</Link>
                               </Button>
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>
      ) : (
          <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
              <h3 className="text-2xl font-semibold">{t('no_groups_title')}</h3>
              <p className="text-muted-foreground mt-2">{t('no_groups_description')}</p>
          </div>
      )}
    </div>
  );
}
