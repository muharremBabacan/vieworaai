'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, limit, where } from 'firebase/firestore';
import type { Notification } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Mail } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS, de, fr, es, ar, ru, el, zhCN, ja } from 'date-fns/locale';

const localeMap: Record<string, Locale> = { tr, en: enUS, de, fr, es, ar, ru, el, zh: zhCN, ja };


export function NotificationsPopover() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const dateFnsLocale = localeMap[locale] || enUS;

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc'), 
      limit(20)
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(notificationsQuery);

  const unreadCount = useMemo(() => notifications?.filter(n => !n.isRead).length ?? 0, [notifications]);

  const handleNotificationClick = (notification: Notification) => {
    if (!user || notification.isRead) return;
    const notifRef = doc(firestore, 'notifications', notification.id);
    updateDocumentNonBlocking(notifRef, { isRead: true });
  };
  
  const markAllAsRead = () => {
    if (!user || !notifications) return;
    notifications.forEach(n => {
      if (!n.isRead) {
        const notifRef = doc(firestore, 'notifications', n.id);
        updateDocumentNonBlocking(notifRef, { isRead: true });
      }
    });
  }

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
          {unreadCount > 0 && (
             <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={markAllAsRead}>
                {t('mark_all_as_read')}
             </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          <div className="p-2">
            {notifications && notifications.length > 0 ? (
              notifications.map((notification) => {
                const content = (
                    <div
                      key={notification.id}
                      className={cn("flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent", !notification.isRead && "bg-blue-500/10 hover:bg-blue-500/20")}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                        <Mail className="h-4 w-4 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                         <p className="text-xs text-muted-foreground/70">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateFnsLocale })}
                         </p>
                      </div>
                    </div>
                );

                return notification.link ? (
                    <Link href={notification.link} key={notification.id} onClick={() => setIsOpen(false)} className="block">
                        {content}
                    </Link>
                ) : (
                    <div key={notification.id}>{content}</div>
                );
              })
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
