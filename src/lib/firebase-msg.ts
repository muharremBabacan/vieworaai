import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';
import { firebaseConfig } from './firebase/config';

// 🚀 Singleton pattern for client-side Firebase Initialization
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window !== 'undefined') {
    const supported = await isSupported();
    return supported ? getMessaging(firebaseApp) : null;
  }
  return null;
};

export default firebaseApp;
