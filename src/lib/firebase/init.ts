import { firebaseConfig } from '@/lib/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

/**
 * Firebase istemci servislerini başlatır.
 * Bu fonksiyon sadece tarayıcı ortamında çalışacak şekilde tasarlanmıştır.
 */
export function initializeFirebase(): {
  firebaseApp: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
  messaging: Messaging | null;
} {
  // 🚫 SSR veya Build sırasında Firebase'i başlatma
  if (typeof window === 'undefined') {
    return {
      firebaseApp: null,
      auth: null,
      firestore: null,
      storage: null,
      messaging: null,
    };
  }

  // Tarayıcı ortamında güvenli başlatma
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  let messaging: Messaging | null = null;
  
  // Messaging check (only in supported environments)
  isSupported().then(supported => {
    if (supported) {
      messaging = getMessaging(firebaseApp);
    }
  });

  let firestore: Firestore;
  try {
    firestore = initializeFirestore(firebaseApp, { 
        experimentalForceLongPolling: true,
        useFetchStreams: false 
    });
  } catch (e) {
    // If already initialized, fallback to getFirestore
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    storage: getStorage(firebaseApp),
    messaging: null,
  };
}

export async function getMessagingService(app: FirebaseApp): Promise<Messaging | null> {
    if (typeof window === 'undefined') return null;
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
}
