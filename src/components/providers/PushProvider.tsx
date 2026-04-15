'use client';

import React, { useEffect, useCallback } from 'react';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { getMessagingInstance } from '@/lib/firebase-msg';
import { NotificationAPI } from '@/lib/api/notification-api';
import { useUser } from '@/lib/firebase';
import { useToast } from '@/shared/hooks/use-toast';

export const PushProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const { toast } = useToast();

  const setupFCM = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !user) return;

    try {
      // 1. Service Worker Registration
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const registration = await navigator.serviceWorker.ready;
      console.log('[PushProvider] SW Registered & Ready');

      // 2. Permission Check
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[PushProvider] Permission denied');
          return;
        }
      }

      // 3. Token Retrieval
      const messaging = await getMessagingInstance();
      if (!messaging) return;

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('[PushProvider] VAPID Key missing in environment.');
      }

      const currentToken = await getToken(messaging, { 
        vapidKey,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        console.log('[PushProvider] Token:', currentToken);
        // Sync with backend Notification Server
        await NotificationAPI.saveToken(user.uid, currentToken);
        // Subscribe to global announcements topic
        await NotificationAPI.subscribeToTopic(currentToken, 'all_users');
      } else {
        console.warn('[PushProvider] No registration token available.');
      }

      // 4. Foreground Message Listener (PRO)
      onMessage(messaging, (payload) => {
        console.log('[PushProvider] Foreground Message:', payload);
        toast({
          title: payload.notification?.title || 'Yeni Bildirim',
          description: payload.notification?.body,
          duration: 10000,
        });
      });

    } catch (error) {
      console.error('[PushProvider] Setup failed:', error);
    }
  }, [user, toast]);

  useEffect(() => {
    // Start setup when user is authenticated
    if (user) {
      setupFCM();
    }
  }, [user, setupFCM]);

  return <>{children}</>;
};
