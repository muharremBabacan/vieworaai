import { useEffect, useState } from 'react';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { initializeFirebase } from '@/lib/firebase/init';
import { NotificationAPI } from '@/lib/api/notification-api';
import { useUser } from '@/lib/firebase';

export function useNotificationSetup() {
  const { user } = useUser();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!user || typeof window === 'undefined' || isSettingUp) return;
    
    setIsSettingUp(true);
    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        const { firebaseApp } = initializeFirebase();
        if (!firebaseApp) return;

        const supported = await isSupported();
        if (!supported) {
            console.warn('[Notifications] Messaging not supported in this browser.');
            return;
        }

        const messaging = getMessaging(firebaseApp);
        
        // VAPID Key from Next.js Public Env
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        
        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
          console.log('[Notifications] Token retrieved:', token);
          await NotificationAPI.saveToken(user.uid, token);
        }
      }
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
    } finally {
      setIsSettingUp(false);
    }
  };

  return {
    permission,
    requestPermission,
    isLoading: isSettingUp
  };
}
