'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, limit, where, updateDoc, arrayUnion, deleteDoc, writeBatch } from 'firebase/firestore';
import type { GroupInvite } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Users, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from '@/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS, de, fr, es, ar, ru, el, zhCN, ja } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const localeMap: Record<string, Locale> = { tr, en: enUS, de, fr, es, ar, ru, el, zh: zhCN, ja };

export function GroupInvitesPopover() {
  const t = useTranslations('Notifications');
  const tGroups = useTranslations('GroupsPage');
  const locale = useLocale();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const dateFnsLocale = localeMap[locale] || enUS;
  
  // Query for invites matching the user's ID
  const invitesByIdQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'group_invites'),
        where('inviteeId', '==', user.uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);
  const { data: invites } = useCollection<GroupInvite>(invitesByIdQuery);
  
  const unreadCount = invites?.length || 0;

  const handleInviteAction = async (invite: GroupInvite, action: 'accepted' | 'declined') => {
    if (!user || !firestore) return;
    const inviteRef = doc(firestore, 'group_invites', invite.id);
    
    if (action === 'accepted') {
       const groupRef = doc(firestore, 'groups', invite.groupId);
       const userRef = doc(firestore, 'users', user.uid);
       
       try {
         // Firestore transaction or batch write could make this safer
         await updateDoc(groupRef, { memberIds: arrayUnion(user.uid) });
         await updateDoc(userRef, { groups: arrayUnion(invite.groupId) });
         await deleteDoc(inviteRef);

         toast({ title: tGroups('toast_join_success_title'), description: tGroups('toast_join_success_description', { name: invite.groupName }) });

         setIsOpen(false);
         router.push(`/groups/${invite.groupId}`);
       } catch (error) {
         console.error("Failed to accept invite:", error);
         toast({ variant: 'destructive', title: tGroups('toast_join_fail_title'), description: tGroups('toast_join_fail_description')});
         // Also delete the failed invite so user doesn't get stuck
         await deleteDoc(inviteRef);
       }
    } else { // declined
        await deleteDoc(inviteRef);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-medium text-sm">{t('title')}</h4>
        </div>
        <ScrollArea className="h-96">
          <div className="p-2">
            {invites && invites.length > 0 ? (
              invites.map((invite) => (
                <div key={invite.id} className="block rounded-md p-3 transition-colors hover:bg-accent">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                      <Users className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{t('notification_group_invite_title')}</p>
                      <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('notification_group_invite_body', { inviterName: `<b>${invite.inviterName}</b>`, groupName: `<b>${invite.groupName}</b>` }) }} />
                      <p className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true, locale: dateFnsLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                     <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleInviteAction(invite, 'declined')}>
                       <X className="mr-1 h-4 w-4" /> Hayır
                     </Button>
                     <Button size="sm" variant="ghost" onClick={() => handleInviteAction(invite, 'accepted')}>
                       <Check className="mr-1 h-4 w-4" /> Evet
                     </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p>{t('no_notifications')}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
