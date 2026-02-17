'use client';
import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection } from 'firebase/firestore';
import type { Group, User as UserProfile } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Users, Crown, Loader2, AlertTriangle, UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';

const addMemberSchema = (t: Function) => z.object({
  userId: z.string().min(1, {message: 'Kullanıcı ID\'si gereklidir.'}),
});

type AddMemberValues = z.infer<ReturnType<typeof addMemberSchema>>;

function MemberAvatar({ userId }: { userId: string }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId || !currentUser) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId, currentUser]);
  
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  if (isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!userProfile) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Avatar>
                        <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t('tooltip_user_not_found')}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
  }
  
  const fallbackChar = userProfile.name?.charAt(0) || userProfile.email?.charAt(0) || '?';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Avatar>
            <AvatarFallback>{fallbackChar.toUpperCase()}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p>{userProfile.name || userProfile.email}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AddMemberForm({ group, userLevel }: { group: Group; userLevel?: string; }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema(t)),
    defaultValues: { userId: '' },
  });

  const { maxMembers } = getGroupLimits(userLevel);

  async function onSubmit(values: AddMemberValues) {
    if (!currentUser || !firestore) return;
    
    if (group.memberIds.length >= maxMembers) {
      toast({ variant: 'destructive', title: t('toast_group_full_title'), description: t('toast_group_full_description', { maxMembers }) });
      return;
    }

    if (group.memberIds.includes(values.userId)) {
      toast({ variant: 'destructive', title: t('toast_already_member_title'), description: t('toast_already_member_description')});
      return;
    }
    
    try {
        const inviterProfileDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if(!inviterProfileDoc.exists()) throw new Error("Inviter profile not found");
        const inviterProfile = inviterProfileDoc.data() as UserProfile;
        const inviterName = inviterProfile?.name || 'Anonymous';
        
        const inviteeDoc = await getDoc(doc(firestore, 'users', values.userId));
        if (!inviteeDoc.exists()) {
          toast({ variant: 'destructive', title: t('toast_user_not_found_title'), description: "Bu ID'ye sahip bir kullanıcı bulunamadı." });
          return;
        }
        
        const invitesCollectionRef = collection(firestore, 'group_invites');
        addDocumentNonBlocking(invitesCollectionRef, {
            groupId: group.id,
            groupName: group.name,
            fromUserId: currentUser.uid,
            fromUserName: inviterName,
            toUserId: values.userId,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });
      
      toast({ title: t('toast_invite_sent_title'), description: `Grup davetiyesi gönderildi.` });
      form.reset();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
       toast({
        variant: 'destructive',
        title: t('toast_add_member_error_title'),
        description: t('toast_add_member_generic_error'),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus /> {t('button_invite_member')}</CardTitle>
        <CardDescription>Davet etmek istediğiniz kullanıcının Profil sayfasından kopyalayabileceğiniz Kullanıcı ID'sini girin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormControl>
                    <Input placeholder="Kullanıcı ID'si" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('button_invite')}
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
  const t = useTranslations('GroupDetailPage');
  const router = useRouter();

  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const groupDocRef = useMemoFirebase(() => {
    if (!firestore || !groupId || !currentUser) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId, currentUser]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;

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
          <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_title')}</h3>
          <p className="text-muted-foreground mt-2">
            {groupError ? t('group_not_found_error') : t('group_not_found_no_permission')}
          </p>
          <Button onClick={() => router.back()} className="mt-6">{t('button_go_back')}</Button>
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
            <div className="flex items-center gap-2"><Users /> {t('members_title')}</div>
             <div className="flex items-center gap-2">
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
      
      {isOwner && (
        <AddMemberForm group={group} userLevel={userProfile?.level_name} />
      )}

      {/* Placeholder for future sections */}
      <Card className="border-dashed">
        <CardContent className="p-10 text-center text-muted-foreground">
            <p>{t('wip_placeholder')}</p>
        </CardContent>
      </Card>

    </div>
  );
}
