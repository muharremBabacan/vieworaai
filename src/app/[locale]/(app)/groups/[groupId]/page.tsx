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
import { useTranslations } from 'next-intl';

const addMemberSchema = (t: Function) => z.object({
  email: z.string().email(t('form_error_email')),
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

function AddMemberForm({ group, groupRef, userLevel }: { group: Group; groupRef: any; userLevel?: string; }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema(t)),
    defaultValues: { email: '' },
  });

  const { maxMembers } = getGroupLimits(userLevel);

  async function onSubmit(values: AddMemberValues) {
    if (group.memberIds.length >= maxMembers) {
      toast({ variant: 'destructive', title: t('toast_group_full_title'), description: t('toast_group_full_description', { maxMembers }) });
      return;
    }
    
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', values.email), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: t('toast_user_not_found_title'), description: t('toast_user_not_found_description') });
        return;
      }
      
      const userToAddDoc = querySnapshot.docs[0];
      const userToAddId = userToAddDoc.id;

      if (group.memberIds.includes(userToAddId)) {
        toast({ variant: 'destructive', title: t('toast_already_member_title'), description: t('toast_already_member_description') });
        return;
      }

      await updateDoc(groupRef, {
        memberIds: arrayUnion(userToAddId),
      });

      await updateDoc(userToAddDoc.ref, {
        groups: arrayUnion(group.id)
      });

      toast({ title: t('toast_member_added_title'), description: t('toast_member_added_description', { email: values.email }) });
      form.reset();
    } catch (error: any) {
      console.error("Üye ekleme hatası:", error);
       toast({
        variant: 'destructive',
        title: t('toast_add_member_error_title'),
        description: error.message.includes('permission-denied') 
          ? t('toast_add_member_no_permission') 
          : t('toast_add_member_generic_error'),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus /> {t('button_invite_member')}</CardTitle>
        <CardDescription>{t('invite_member_description')}</CardDescription>
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
    if (!firestore || !groupId || !currentUser) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId, currentUser]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;

  const handleInviteDialogOpenChange = (open: boolean) => {
    if (open && isOwner && !group?.joinCode && groupDocRef) {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
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
    const typeKey = type.toLowerCase() as 'link' | 'code';
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: t('toast_copied_title'), description: t(`toast_copied_${typeKey}` as any) });
    }, (err) => {
      toast({ variant: 'destructive', title: t('toast_add_member_error_title'), description: `${type} ${t('toast_copy_error')}` });
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
          <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_title')}</h3>
          <p className="text-muted-foreground mt-2">
            {groupError ? t('group_not_found_error') : t('group_not_found_no_permission')}
          </p>
          <Button onClick={() => window.history.back()} className="mt-6">{t('button_go_back')}</Button>
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
                {isOwner && joinUrl && (
                    <Dialog open={isInviteDialogOpen} onOpenChange={handleInviteDialogOpenChange}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <QrCode className="h-5 w-5" />
                                <span className="sr-only">{t('button_show_invite')}</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('invite_dialog_title')}</DialogTitle>
                                <DialogDescription>
                                    {t('invite_dialog_description')}
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
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t('or_divider')}</span></div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="join-code">{t('label_join_code')}</Label>
                              <div className="flex items-center space-x-2">
                                <Input id="join-code" value={group.joinCode || 'YOK'} readOnly className="font-mono text-center tracking-wider text-lg" />
                                <Button onClick={() => copyToClipboard(group.joinCode || '', 'Kod')} disabled={!group.joinCode}>{t('button_copy')}</Button>
                              </div>
                            </div>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t('or_divider')}</span></div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="join-link">{t('label_shareable_link')}</Label>
                                <div className="flex items-center space-x-2">
                                  <Input id="join-link" value={joinUrl} readOnly />
                                  <Button onClick={() => copyToClipboard(joinUrl, 'Link')}>{t('button_copy')}</Button>
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
            <p>{t('wip_placeholder')}</p>
        </CardContent>
      </Card>

    </div>
  );
}
