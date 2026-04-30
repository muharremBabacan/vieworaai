import { firebaseConfig } from '@/lib/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';
import { getAuth, Auth, indexedDBLocalPersistence, setPersistence } from 'firebase/auth';
import { getAnalytics, Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

// Singleton instances
let firebaseApp: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;
let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  console.log("🌐 [FirebaseInit] CLIENT PROJECT:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  
  firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  // Analytics
  isAnalyticsSupported().then(yes => {
    if (yes) analytics = getAnalytics(firebaseApp);
  });

  // 🛡️ AUTH INITIALIZATION (MANDATORY FOR PWA/iOS)
  auth = getAuth(firebaseApp);
  // Set persistence to indexedDB for reliable cross-session survival
  setPersistence(auth, indexedDBLocalPersistence).catch(err => {
    console.error("❌ [FirebaseInit] Persistence error:", err);
  });

  // Firestore (long polling iOS/PWA için)
  try {
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch {
    db = getFirestore(firebaseApp);
  }

  storage = getStorage(firebaseApp);
}

/**
 * Firebase init (Auth dahil)
 */
export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null, firestore: null, storage: null, messaging: null, auth: null };
  }

  return {
    firebaseApp,
    firestore: db,
    storage,
    auth,
    messaging: null,
  };
}

export { firebaseApp as app, db, storage, auth, analytics };

/**
 * Messaging (opsiyonel)
 */
export async function getMessagingService(app: FirebaseApp): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
}