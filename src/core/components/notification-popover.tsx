'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, doc, query, where, arrayUnion, writeBatch, limit, orderBy, updateDoc } from 'firebase/firestore';
import type { GroupInvite, GlobalNotification, User } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Button } from '@/shared/ui/button';
import { Bell, Users, Check, X, Trophy, Globe, Gift, Info, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/shared/hooks/use-toast';
import { useDoc } from '@/lib/firebase';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // User profile for level-based filtering and read status
  const userRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userRef);

  // Group Invites Query
  const invitesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'group_invites'),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
    );
  }, [user, firestore]);

  const { data: invitesData, error: invitesError } = useCollection<GroupInvite>(invitesQuery);

  // Global Notifications Query
  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'global_notifications'),
        orderBy('createdAt', 'desc'),
        limit(20)
    );
  }, [firestore]);

  const { data: globalNotifsData, error: notifsError } = useCollection<GlobalNotification>(notificationsQuery);

  // Personal Notifications Query (Refills, Level ups etc.)
  const personalNotifsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [user, firestore]);

  const { data: personalNotifsData } = useCollection<any>(personalNotifsQuery);

  const notifications = useMemo(() => {
    let combined: any[] = [];
    
    // Add invites
    if (invitesData) {
      combined = [...combined, ...invitesData.map(i => ({ ...i, category: 'invite' }))];
    }
    
    // Add global notifications filtered by level
    if (globalNotifsData && userProfile) {
      const filtered = globalNotifsData.filter(n => 
        !n.targetLevel || n.targetLevel === 'all' || n.targetLevel === userProfile.level_name
      );
      combined = [...combined, ...filtered.map(n => ({ ...n, category: 'global' }))];
    }

    // Add personal notifications
    if (personalNotifsData) {
      combined = [...combined, ...personalNotifsData.map(n => ({ ...n, category: 'personal' }))];
    }
    
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invitesData, globalNotifsData, personalNotifsData, userProfile]);
  
  // Calculate unread count based on timestamp
  const unreadCount = useMemo(() => {
    if (!userProfile?.lastNotificationsViewedAt) return notifications.length;
    const lastViewed = new Date(userProfile.lastNotificationsViewedAt).getTime();
    return notifications.filter(n => new Date(n.createdAt).getTime() > lastViewed).length;
  }, [notifications, userProfile?.lastNotificationsViewedAt]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && user && firestore) {
      // Mark all as viewed by updating the timestamp in user profile
      updateDoc(doc(firestore, 'users', user.uid), {
        lastNotificationsViewedAt: new Date().toISOString()
      }).catch(err => console.error("Failed to update notification viewed timestamp", err));
    }
  };

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
         toast({ title: "Başarıyla Katıldın!", description: `${invite.groupName} grubuna hoş geldin.` });
         setIsOpen(false);
         router.push(`/groups/${invite.groupId}`);
       } catch (error) {
         toast({ variant: 'destructive', title: "Katılım Başarısız", description: "Bir hata oluştu." });
       }
    } else {
        batch.update(inviteRef, { status: 'declined' });
        await batch.commit();
    }
  };

  const getIcon = (item: any) => {
    if (item.category === 'invite') return <Users className="h-4 w-4 text-blue-400" />;
    if (item.category === 'personal' && item.type === 'reward') return <Sparkles className="h-4 w-4 text-yellow-400" />;
    switch (item.type) {
      case 'competition': return <Trophy className="h-4 w-4 text-amber-400" />;
      case 'exhibition': return <Globe className="h-4 w-4 text-cyan-400" />;
      case 'reward': return <Gift className="h-4 w-4 text-purple-400" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div id="notification-anchor" className="relative">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground border-2 border-background">
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden border-border/40 shadow-2xl" align="end">
          <div className="bg-secondary/30 px-4 py-3 border-b flex items-center justify-between">
            <h4 className="font-bold text-sm">Bildirimler</h4>
            {unreadCount > 0 && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{unreadCount} YENİ</span>}
          </div>
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border/40">
              {invitesError || notifsError ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <p>Bildirimler yüklenirken bir sorun oluştu.</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((item) => {
                  const isUnread = !userProfile?.lastNotificationsViewedAt || 
                                  new Date(item.createdAt).getTime() > new Date(userProfile.lastNotificationsViewedAt).getTime();
                  
                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 transition-colors group relative",
                        isUnread ? "bg-primary/5 hover:bg-primary/10" : "opacity-60 hover:bg-accent/50"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border/50 transition-colors",
                          isUnread && "border-primary/30"
                        )}>
                          {getIcon(item)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {item.category === 'invite' ? 'Grup Daveti' : (item.title || 'Sistem Duyurusu')}
                            </p>
                            {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </div>
                          <p className={cn(
                            "text-sm leading-relaxed text-foreground/90",
                            isUnread && "font-medium"
                          )}>
                            {item.category === 'invite' ? (
                              <><b>{item.fromUserName}</b> sizi "<b>{item.groupName}</b>" grubuna davet etti.</>
                            ) : item.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: tr })}
                          </p>
                          
                          {item.category === 'invite' && (
                            <div className="mt-3 flex gap-2">
                               <Button size="sm" variant="secondary" className="h-8 flex-1 rounded-lg text-xs" onClick={() => handleInviteAction(item, 'accepted')}>Kabul Et</Button>
                               <Button size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-destructive" onClick={() => handleInviteAction(item, 'declined')}>Reddet</Button>
                            </div>
                          )}
                          
                          {item.type === 'competition' && (
                            <Button variant="outline" size="sm" className="mt-2 h-7 text-[10px] rounded-lg border-primary/20 hover:bg-primary/10" onClick={() => { setIsOpen(false); router.push('/competitions'); }}>Yarışmaya Git</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center space-y-3">
                  <div className="h-12 w-12 bg-secondary/50 rounded-full flex items-center justify-center mx-auto">
                    <Bell className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Henüz yeni bir bildiriminiz yok.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}