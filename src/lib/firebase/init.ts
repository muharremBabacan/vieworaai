import { firebaseConfig } from '@/lib/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

// Singleton instances
let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
  firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(firebaseApp);
  
  // Guarded Firestore Init
  try {
    db = initializeFirestore(firebaseApp, { 
        experimentalForceLongPolling: true
    });
  } catch (e) {
    db = getFirestore(firebaseApp);
  }
  
  storage = getStorage(firebaseApp);
}

/**
 * Backward compatibility for Provider-based usage
 */
export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null, auth: null, firestore: null, storage: null, messaging: null };
  }

  return {
    firebaseApp,
    auth,
    firestore: db,
    storage,
    messaging: null,
  };
}

export { firebaseApp as app, auth, db, storage };

export async function getMessagingService(app: FirebaseApp): Promise<Messaging | null> {
    if (typeof window === 'undefined') return null;
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
}
