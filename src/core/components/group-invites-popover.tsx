'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, doc, query, where, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import type { GroupInvite } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Button } from '@/shared/ui/button';
import { Bell, Users, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/shared/hooks/use-toast';

export function GroupInvitesPopover() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const invitesQuery = useMemoFirebase(() => {
    if (!user || !firestore) {
      return null;
    }
    return query(
        collection(firestore, 'group_invites'),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
    );
  }, [user, firestore]);

  const { data: invitesData } = useCollection<GroupInvite>(invitesQuery);

  const invites = useMemo(() => {
    if (!invitesData) return [];
    return [...invitesData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invitesData]);
  
  const unreadCount = invites?.length || 0;

  const handleInviteAction = async (invite: GroupInvite, action: 'accepted' | 'declined') => {
    if (!user || !firestore) return;
    
    const batch = writeBatch(firestore);
    const inviteRef = doc(firestore, 'group_invites', invite.id);

    if (action === 'accepted') {
       const groupRef = doc(firestore, 'groups', invite.groupId);
       
       try {
         batch.update(inviteRef, { status: 'accepted' });
         batch.update(groupRef, { memberIds: arrayUnion(user.uid) });
         
         await batch.commit();

         toast({ 
           title: "Başarıyla Katıldın!", 
           description: `${invite.groupName} grubuna hoş geldin.` 
         });

         setIsOpen(false);
         router.push(`/groups/${invite.groupId}`);
       } catch (error) {
         console.error("Failed to accept invite:", error);
         toast({ 
           variant: 'destructive', 
           title: "Katılım Başarısız", 
           description: "Gruba katılamadınız. Grup dolu olabilir veya bir hata oluştu."
         });
         await updateDoc(inviteRef, { status: 'declined' });
       }
    } else {
        await updateDoc(inviteRef, { status: 'declined' });
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
          <h4 className="font-medium text-sm">Bildirimler</h4>
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
                      <p className="text-sm font-medium leading-none">Grup Daveti</p>
                      <p className="text-sm text-muted-foreground">
                        <b>{invite.fromUserName}</b> sizi "<b>{invite.groupName}</b>" grubuna davet etti.
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true, locale: tr })}
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
                <p>Henüz bildirim yok.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
