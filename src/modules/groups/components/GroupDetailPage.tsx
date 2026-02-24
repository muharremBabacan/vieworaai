'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, deleteDoc, collection, query, where, addDoc, writeBatch } from 'firebase/firestore';
import type { Group, PublicUserProfile, GroupInvite } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, UserPlus, Trash2, Copy, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

export default function GroupDetailPage() {
  const t = useTranslations('GroupDetailPage');
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const MemberItem = ({ member, isOwner, onRemove }: { member: PublicUserProfile, isOwner: boolean, onRemove: (memberId: string, memberName: string) => void }) => {
    const { user } = useUser();
    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={member.photoURL || ''} alt={member.name || ''} />
                    <AvatarFallback>{member.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.name}</span>
            </div>
            {isOwner && user?.uid !== member.id && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                           <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('remove_dialog_title')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('remove_dialog_description', { memberName: member.name || 'member' })}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onRemove(member.id, member.name || 'User')}>{t('button_remove')}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
  };

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  const isOwner = group?.ownerId === user?.uid;
  
  const membersQuery = useMemoFirebase(() => group ? query(collection(firestore, 'public_profiles'), where('id', 'in', group.memberIds)) : null, [group, firestore]);
  const { data: members, isLoading: areMembersLoading } = useCollection<PublicUserProfile>(membersQuery);
  
  const inviteFormSchema = z.object({ email: z.string().email(t('form_error_email')) });
  const inviteForm = useForm({ resolver: zodResolver(inviteFormSchema) });

  const handleInviteMember = async (values: { email: string }) => {
    if (!group || !isOwner) {
        toast({ variant: 'destructive', title: t('toast_add_member_error_title'), description: t('toast_add_member_no_permission') });
        return;
    }
    if (group.memberIds.length >= group.maxMembers) {
        toast({ variant: 'destructive', title: t('toast_group_full_title'), description: t('toast_group_full_description', { maxMembers: group.maxMembers }) });
        return;
    }

    try {
        const userQuery = query(collection(firestore, 'users'), where('email', '==', values.email));
        const userSnapshot = await getDoc(userQuery.firestore, userQuery.path);
        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: t('toast_user_not_found_title'), description: t('toast_user_not_found_description') });
            return;
        }
        const invitedUser = userSnapshot.docs[0].data() as PublicUserProfile;

        if (group.memberIds.includes(invitedUser.id)) {
            toast({ variant: 'destructive', title: t('toast_already_member_title'), description: t('toast_already_member_description') });
            return;
        }

        const batch = writeBatch(firestore);
        const inviteRef = doc(collection(firestore, 'group_invites'));
        const newInvite: Omit<GroupInvite, 'id'> = {
            groupId: group.id,
            groupName: group.name,
            fromUserId: user.uid,
            fromUserName: user.displayName || 'Owner',
            toUserId: invitedUser.id,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        batch.set(inviteRef, { ...newInvite, id: inviteRef.id });
        await batch.commit();

        toast({ title: t('toast_invite_sent_title'), description: t('toast_invite_sent_description', { email: values.email }) });
        inviteForm.reset();

    } catch (e) {
        toast({ variant: 'destructive', title: t('toast_add_member_error_title'), description: t('toast_add_member_generic_error') });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isOwner) return;
      try {
          await updateDoc(groupRef, { memberIds: arrayRemove(memberId) });
          toast({ title: t('toast_remove_success', { memberName }) });
      } catch (e) {
          toast({ variant: 'destructive', title: t('toast_remove_error') });
      }
  };
  
  const handleDeleteGroup = async () => {
    if (!group || !isOwner) return;
    try {
        await deleteDoc(groupRef);
        toast({ title: t('toast_delete_success') });
        router.push('/groups');
    } catch (e) {
        toast({ variant: 'destructive', title: t('toast_delete_error') });
    }
  };

  const shareableLink = typeof window !== 'undefined' ? `${window.location.origin}/groups/join/${group?.id}` : '';

  useEffect(() => {
    if (group?.joinCode) {
      QRCode.toDataURL(shareableLink, { width: 256, margin: 2 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [group?.joinCode, shareableLink]);
  
  const copyToClipboard = (text: string, type: 'code' | 'link') => {
      navigator.clipboard.writeText(text).then(() => {
          toast({ title: t('toast_copied_title'), description: type === 'code' ? t('toast_copied_code') : t('toast_copied_link') });
      }).catch(() => toast({ variant: 'destructive', title: 'Hata', description: `${type} ${t('toast_copy_error')}` }));
  };

  if (isGroupLoading) {
    return <div className="container text-center p-8"><Skeleton className="h-12 w-full" /></div>;
  }

  if (!group || error) {
    return (
      <div className="container text-center p-8">
        <h1 className="text-2xl font-bold">{t('group_not_found_title')}</h1>
        <p className="text-muted-foreground">{error ? t('group_not_found_error') : t('group_not_found_no_permission')}</p>
        <Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> {t('button_go_back')}</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
                <p className="text-muted-foreground">{group.description}</p>
            </div>
            {isOwner && (
                <Dialog>
                    <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" />{t('button_invite_member')}</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{t('button_invite_member')}</DialogTitle><DialogDescription>{t('invite_member_description')}</DialogDescription></DialogHeader>
                        <Form {...inviteForm}>
                            <form onSubmit={inviteForm.handleSubmit(handleInviteMember)} className="space-y-4">
                                <FormField control={inviteForm.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input type="email" placeholder="kullanici@email.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" className="w-full">{t('button_invite')}</Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )}
        </div>

        <Tabs defaultValue="members" className="w-full">
            <TabsList>
                <TabsTrigger value="members">{t('tab_members')}</TabsTrigger>
                <TabsTrigger value="gallery" disabled>{t('tab_gallery')}</TabsTrigger>
                <TabsTrigger value="competitions">{t('tab_competitions')}</TabsTrigger>
                {isOwner && <TabsTrigger value="settings">{t('tab_settings')}</TabsTrigger>}
            </TabsList>
            <TabsContent value="members" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">{t('members_title')} ({members?.length || 0} / {group.maxMembers})
                        {isOwner && (
                            <Dialog>
                                <DialogTrigger asChild><Button variant="secondary">{t('button_show_invite')}</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>{t('invite_dialog_title')}</DialogTitle><DialogDescription>{t('invite_dialog_description')}</DialogDescription></DialogHeader>
                                    <div className="flex flex-col items-center gap-4">
                                        {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="Group QR Code" />}
                                        <div className="flex items-center gap-2">
                                            <Input readOnly value={group.joinCode} className="text-center font-mono text-lg tracking-widest" />
                                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(group.joinCode || '', 'code')}><Copy /></Button>
                                        </div>
                                         <div className="flex items-center gap-2 w-full">
                                            <Input readOnly value={shareableLink} className="text-sm" />
                                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(shareableLink, 'link')}><LinkIcon /></Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {areMembersLoading ? (
                            <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                        ) : (
                            <div className="space-y-1">
                                {members?.map(member => <MemberItem key={member.id} member={member} isOwner={isOwner} onRemove={handleRemoveMember} />)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="competitions" className="mt-6">
                <p className="text-muted-foreground text-center p-8">{t('wip_placeholder')}</p>
            </TabsContent>
            {isOwner && (
                <TabsContent value="settings" className="mt-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('delete_group_title')}</CardTitle>
                            <CardDescription>{t('delete_group_description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive">{t('button_delete_group')}</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>{t('delete_group_dialog_title')}</AlertDialogTitle><AlertDialogDescription>{t('delete_group_dialog_description')}</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup}>{t('button_delete_group')}</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    </div>
  );
}
