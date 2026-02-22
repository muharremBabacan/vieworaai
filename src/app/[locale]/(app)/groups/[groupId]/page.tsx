'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter, Link } from '@/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, arrayRemove, deleteDoc } from 'firebase/firestore';
import type { Group, PublicUserProfile, User as UserProfileType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, Crown, Loader2, AlertTriangle, X, Settings, Trash2, Construction } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

function MemberItem({ userId, isOwner, onRemove }: { userId: string; isOwner: boolean; onRemove: (memberId: string, memberName: string) => void; }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(
    () => doc(firestore, 'public_profiles', userId),
    [firestore, userId]
  );

  const { data: userProfile, isLoading } = useDoc<PublicUserProfile>(userDocRef);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-5 w-24" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex items-center gap-3 p-2 text-muted-foreground text-sm" title={t('tooltip_user_not_found')}>
        ?
      </div>
    );
  }

  const isCurrentUserOwner = userId === userProfile.id; // Corrected logic
  const isSelf = userId === currentUser?.uid;

  const handleRemoveClick = () => {
      onRemove(userId, userProfile.name || 'Bilinmeyen Kullanıcı');
      setIsAlertOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
        <div className="flex items-center gap-3 flex-1">
          <Avatar>
            {userProfile.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.name || ''} />}
            <AvatarFallback>{userProfile.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{userProfile.name}</span>
            <Badge variant="secondary" className="w-fit text-xs mt-1">
              {userProfile.level_name}
            </Badge>
          </div>
          {isCurrentUserOwner && <Crown className="h-4 w-4 text-amber-400" />}
        </div>
        {isOwner && !isSelf && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setIsAlertOpen(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('remove_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('remove_dialog_description', { memberName: userProfile.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveClick} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('button_remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WIPPlaceholder() {
  const t = useTranslations('GroupDetailPage');
  return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-full">
        <Construction className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {t('wip_placeholder')}
        </p>
      </div>
  )
}

export default function GroupDetailPage() {
  const params = useParams();
  const rawGroupId = params?.groupId;
  const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;

  const t = useTranslations('GroupDetailPage');
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);


  const groupDocRef = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);
  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfileType>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;
  const isMember = group?.memberIds.includes(currentUser?.uid || '') || false;

  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!groupDocRef) return;
    try {
      updateDocumentNonBlocking(groupDocRef, {
        memberIds: arrayRemove(memberIdToRemove),
      });
      toast({ description: t('toast_remove_success', { memberName }) });
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_remove_error') });
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupDocRef) return;
    setIsDeleting(true);
    try {
        await deleteDoc(groupDocRef);
        toast({ description: t('toast_delete_success') });
        router.push('/groups');
    } catch (error) {
        console.error("Group deletion error:", error);
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_delete_error') });
    } finally {
        setIsDeleting(false);
        setDeleteAlertOpen(false);
    }
  };
  
  if (isGroupLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_error')}</h3>
        <p className="text-muted-foreground mt-2">{t('group_not_found_title')}</p>
        <Button onClick={() => router.push('/groups')} className="mt-6">{t('button_go_back')}</Button>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_no_permission')}</h3>
        <Button onClick={() => router.push('/groups')} className="mt-6">{t('button_go_back')}</Button>
      </div>
    );
  }

  const { maxMembers } = getGroupLimits(userProfile?.level_name);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-4">
      <div>
        <h1 className="text-3xl font-bold">{group.name}</h1>
        {group.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="members">{t('tab_members')}</TabsTrigger>
          <TabsTrigger value="gallery">{t('tab_gallery')}</TabsTrigger>
          <TabsTrigger value="assignments">{t('tab_assignments')}</TabsTrigger>
          <TabsTrigger value="competitions">{t('tab_competitions')}</TabsTrigger>
          <TabsTrigger value="events">{t('tab_events')}</TabsTrigger>
          <TabsTrigger value="trainings">{t('tab_trainings')}</TabsTrigger>
          {isOwner && <TabsTrigger value="settings">{t('tab_settings')}</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('members_title')} ({group.memberIds.length} / {maxMembers})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.memberIds.map((memberId: string) => (
                <MemberItem
                  key={memberId}
                  userId={memberId}
                  isOwner={isOwner}
                  onRemove={handleRemoveMember}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gallery" className="mt-4"><WIPPlaceholder /></TabsContent>
        <TabsContent value="assignments" className="mt-4"><WIPPlaceholder /></TabsContent>
        <TabsContent value="competitions" className="mt-4"><WIPPlaceholder /></TabsContent>
        <TabsContent value="events" className="mt-4"><WIPPlaceholder /></TabsContent>
        <TabsContent value="trainings" className="mt-4"><WIPPlaceholder /></TabsContent>

        {isOwner && (
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {t('settings_title')}
                  </CardTitle>
              </CardHeader>
              <CardContent>
                <Card className="border-destructive bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-lg text-destructive">{t('delete_group_title')}</CardTitle>
                        <CardDescription className="text-destructive/80">{t('delete_group_description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" onClick={() => setDeleteAlertOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('button_delete_group')}
                        </Button>
                    </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_group_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_group_dialog_description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('button_delete_group')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
