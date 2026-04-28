import { firebaseConfig } from '@/lib/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, indexedDBLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

// Singleton instances
let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Track if persistence has been initialized
let persistenceReady: Promise<void> | null = null;

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

  // 🔑 CRITICAL: Set IndexedDB persistence for PWA + iOS Safari
  // This must be done before any auth calls
  persistenceReady = setPersistence(auth, indexedDBLocalPersistence)
    .then(() => {
      console.log('✅ [Firebase] IndexedDB persistence set successfully.');
    })
    .catch((err) => {
      // Fallback to in-memory if IndexedDB not available (very rare)
      console.warn('⚠️ [Firebase] IndexedDB not available, falling back to in-memory:', err.code);
      return setPersistence(auth, inMemoryPersistence);
    });
}

/**
 * Returns a promise that resolves when Firebase Auth persistence is ready.
 * Always await this before making any auth calls.
 */
export async function waitForPersistence(): Promise<void> {
  if (persistenceReady) await persistenceReady;
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
