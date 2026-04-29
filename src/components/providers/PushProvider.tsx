'use client';

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { getMessagingInstance } from '@/lib/firebase-msg';
import { NotificationAPI } from '@/lib/api/notification-api';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { useToast } from '@/shared/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { User as UserProfile } from '@/types';

interface PushContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  setupFCM: () => Promise<void>;
  dismissPrompt: () => void;
  hasDismissed: boolean;
}

const PushContext = createContext<PushContextType | undefined>(undefined);

export const usePush = () => {
  const context = useContext(PushContext);
  if (!context) throw new Error('usePush must be used within a PushProvider');
  return context;
};

export const PushProvider = ({ children }: { children: React.ReactNode }) => {
  // Fetch user profile to check notifications_enabled preference
  const { user, uid } = useUser(); // 🔑 Extracted consistent uid
  const firestore = useFirestore();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [hasDismissed, setHasDismissed] = useState(false);
  
  // 🛡️ INITIALIZATION GUARD
  const initializedRef = React.useRef(false);

  // 🛡️ ATOMIC FIRESTORE REF
  const userDocRef = useMemoFirebase(() => {
    if (uid && firestore) {
      return doc(firestore, 'users', uid);
    }
    return null;
  }, [uid, firestore]);
  
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    const dismissed = localStorage.getItem('viewora_notifications_dismissed');
    if (dismissed === 'true') setHasDismissed(true);
  }, []);

  const dismissPrompt = () => {
    localStorage.setItem('viewora_notifications_dismissed', 'true');
    setHasDismissed(true);
  };

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    console.log('[PushProvider] Manually requesting permission...');
    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      console.log('[PushProvider] Permission granted manually!');
      await setupFCM(true); // Force run on manual request
    }
  };

  const isNotificationsEnabled = userProfile?.notifications_enabled;

  const setupFCM = useCallback(async (force = false) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !uid) return;
    
    // 🛡️ Guard: Only run once per session unless forced
    if (initializedRef.current && !force) {
        console.log('[PushProvider] Already initialized. Skipping repeat.');
        return;
    }

    // Check if user has explicitly disabled notifications in their profile
    if (userProfile && (userProfile?.notifications_enabled as any) === false) {
      console.log('[PushProvider] Notifications are disabled in user profile. Skipping FCM setup.');
      return;
    }

    try {
      console.log('[PushProvider] Starting FCM Setup flow...');
      initializedRef.current = true; // Mark as started

      // Update state
      setPermission(Notification.permission);

      // 1. Service Worker Registration
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const registration = await navigator.serviceWorker.ready;
      console.log('[PushProvider] SW Registered & Ready');

      // 2. Permission Check (Auto-check only, iOS needs gesture)
      if (Notification.permission !== 'granted') {
          console.warn('[PushProvider] Permission not granted yet.');
          return;
      }

      // 3. Token Retrieval
      const messaging = await getMessagingInstance();
      if (!messaging) return;

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      const currentToken = await getToken(messaging, { 
        vapidKey,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        console.log('[PushProvider] Token identified. Syncing with Server...');
        await NotificationAPI.saveToken(uid, currentToken);
        
        // Subscribe to relevant topics
        console.log('[PushProvider] Subscribing to topics...');
        await NotificationAPI.subscribeToTopic(currentToken, 'all_users');
        await NotificationAPI.subscribeToTopic(currentToken, 'competitions');
        await NotificationAPI.subscribeToTopic(currentToken, 'lessons');
        
        console.log('[PushProvider] All topics synced successfully.');
      }

      // 4. Foreground Message Listener
      onMessage(messaging, (payload) => {
        console.log('[PushProvider] Foreground Message:', payload);
        
        // Double check enabled flag
        if ((userProfile?.notifications_enabled as any) === false) return;

        toast({
          title: payload.notification?.title || 'Yeni Bildirim',
          description: payload.notification?.body,
          duration: 10000,
        });

        if (Notification.permission === 'granted' && payload.notification) {
          try {
            const notification = new Notification(payload.notification.title || 'Viewora AI', {
              body: payload.notification.body,
              icon: '/icon-192.png',
              tag: 'admin-msg',
              renotify: true
            } as any);
            notification.onclick = () => { window.focus(); notification.close(); };
          } catch (e) {
            registration.showNotification(payload.notification.title || 'Viewora AI', {
              body: payload.notification.body,
              icon: '/icon-192.png',
              tag: 'admin-msg'
            });
          }
        }
      });

    } catch (error) {
      console.error('[PushProvider] Setup failed:', error);
      initializedRef.current = false; // Reset on failure to allow retry
    }
  }, [uid, userProfile, toast]); // Now depends on profile state to ensure correct context

  useEffect(() => {
    if (uid && userProfile) {
      console.log('🔁 [PushProvider] Effect triggered for UID:', uid);
      setPermission(Notification.permission);
      setupFCM();
    }
  }, [uid, userProfile, setupFCM]);

  return (
    <PushContext.Provider value={{ permission, requestPermission, setupFCM, dismissPrompt, hasDismissed }}>
      {children}
    </PushContext.Provider>
  );
};
