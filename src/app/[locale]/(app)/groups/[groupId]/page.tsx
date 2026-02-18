'use client';
import { useState, useMemo } from 'react';
import { useRouter } from '@/navigation';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, arrayRemove, deleteDoc, updateDoc } from 'firebase/firestore';
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
import { Users, Crown, Loader2, AlertTriangle, UserPlus, X, Trash2, Settings, QrCode, Link as LinkIcon, Copy } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Label } from '@/components/ui/label';

function MemberItem({ userId, isOwner, onRemove }: { userId: string, isOwner: boolean, onRemove: (userId: string, userName: string) => void }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(() => doc(firestore, 'users', userId), [firestore, userId]);
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center gap-3 p-2"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-24" /></div>;
  }

  if (!userProfile) {
    return (
      <div className="flex items-center gap-3 p-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><Avatar><AvatarFallback>?</AvatarFallback></Avatar></TooltipTrigger>
            <TooltipContent><p>{t('tooltip_user_not_found')}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-sm text-muted-foreground">{t('tooltip_user_not_found')}</span>
      </div>
    );
  }

  const isCurrentUserOwner = userId === currentUser?.uid && isOwner;
  const isSelf = userId === currentUser?.uid;

  return (
    <>
      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{userProfile.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{userProfile.name}</span>
          {isOwner && isSelf && <Crown className="h-4 w-4 text-amber-400" />}
        </div>
        {isOwner && !isSelf && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setIsAlertOpen(true)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('remove_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('remove_dialog_description', { memberName: userProfile.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRemove(userId, userProfile.name || 'User')} className="bg-destructive hover:bg-destructive/90">{t('button_remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


function InviteOptionsDialog({ group }: { group: Group }) {
    const t = useTranslations('GroupDetailPage');
    const { toast } = useToast();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${origin}/groups/join/${group.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteLink)}`;

    const copyToClipboard = (text: string, type: 'link' | 'code') => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: t('toast_copied_title'), description: type === 'link' ? t('toast_copied_link') : t('toast_copied_code') });
        }).catch(() => {
            toast({ variant: 'destructive', title: 'Hata', description: type === 'link' ? `Link ${t('toast_copy_error')}` : `Kod ${t('toast_copy_error')}` });
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">{t('button_show_invite')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('invite_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('invite_dialog_description')}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-2 rounded-lg">
                        <Image src={qrCodeUrl} alt="Group Invite QR Code" width={150} height={150} />
                    </div>

                    <div className="relative w-full text-center">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">{t('or_divider')}</span>
                        </div>
                    </div>

                    <div className="w-full space-y-2">
                        <Label htmlFor="join-code" className="text-sm font-medium">{t('label_join_code')}</Label>
                        <div className="flex items-center gap-2">
                            <Input id="join-code" value={group.id.slice(0, 6).toUpperCase()} readOnly className="font-mono text-lg tracking-widest text-center" />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(group.id.slice(0, 6).toUpperCase(), 'code')}><Copy /></Button>
                        </div>
                    </div>
                    
                    <div className="w-full space-y-2">
                        <Label htmlFor="share-link" className="text-sm font-medium">{t('label_shareable_link')}</Label>
                         <div className="flex items-center gap-2">
                            <Input id="share-link" value={inviteLink} readOnly />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(inviteLink, 'link')}><Copy /></Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const t = useTranslations('GroupDetailPage');
  const router = useRouter();
  const { toast } = useToast();

  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const groupDocRef = useMemoFirebase(() => {
    if (!firestore || !groupId || !currentUser) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId, currentUser]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);
  
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;
  
  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!groupDocRef) return;
    try {
        await updateDoc(groupDocRef, {
            memberIds: arrayRemove(memberIdToRemove)
        });
        toast({ title: "Başarılı", description: t('toast_remove_success', { memberName }) });
    } catch(error) {
        toast({ variant: 'destructive', title: 'Hata', description: t('toast_remove_error') });
        console.error("Failed to remove member:", error);
    }
  };
  
  const handleDeleteGroup = async () => {
    if (!groupDocRef) return;
    setIsDeletingGroup(true);
    try {
        await deleteDoc(groupDocRef);
        toast({ title: t('toast_delete_success') });
        router.replace('/groups');
    } catch(error) {
        toast({ variant: 'destructive', title: "Hata", description: t('toast_delete_error') });
        console.error("Failed to delete group:", error);
        setIsDeletingGroup(false);
        setIsDeleteAlertOpen(false);
    }
  }

  if (isGroupLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-3/4" /> <Skeleton className="h-6 w-1/2" />
        <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="container mx-auto text-center py-20">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_title')}</h3>
          <p className="text-muted-foreground mt-2">{groupError ? t('group_not_found_error') : t('group_not_found_no_permission')}</p>
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

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="members">{t('tab_members')}</TabsTrigger>
          <TabsTrigger value="gallery" disabled>{t('tab_gallery')}</TabsTrigger>
          <TabsTrigger value="assignments" disabled>{t('tab_assignments')}</TabsTrigger>
          <TabsTrigger value="competitions" disabled>{t('tab_competitions')}</TabsTrigger>
          <TabsTrigger value="events" disabled>{t('tab_events')}</TabsTrigger>
          <TabsTrigger value="trainings" disabled>{t('tab_trainings')}</TabsTrigger>
          {isOwner && <TabsTrigger value="settings">{t('tab_settings')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Users /> {t('members_title')}</div>
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-normal text-muted-foreground">{group.memberIds.length} / {maxMembers}</span>
                    {isOwner && <InviteOptionsDialog group={group} />}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {group.memberIds.map(memberId => (
                  <MemberItem key={memberId} userId={memberId} isOwner={isOwner} onRemove={handleRemoveMember} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {isOwner && (
            <TabsContent value="settings" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
                            <h4 className="font-semibold text-destructive">{t('delete_group_title')}</h4>
                            <p className="text-sm text-muted-foreground">{t('delete_group_description')}</p>
                            <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)}>{t('button_delete_group')}</Button>
                        </div>
                    </CardContent>
                </Card>
                 <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('delete_group_dialog_title')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('delete_group_dialog_description')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingGroup}>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeletingGroup} className="bg-destructive hover:bg-destructive/90">
                                {isDeletingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Onayla ve Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
