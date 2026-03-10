import { firebaseConfig } from '@/lib/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Firebase istemci servislerini başlatır.
 * Bu fonksiyon sadece tarayıcı ortamında çalışacak şekilde tasarlanmıştır.
 */
export function initializeFirebase(): {
  firebaseApp: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
} {
  // 🚫 SSR veya Build sırasında Firebase'i başlatma
  if (typeof window === 'undefined') {
    return {
      firebaseApp: null,
      auth: null,
      firestore: null,
      storage: null,
    };
  }

  // Tarayıcı ortamında güvenli başlatma
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
  };
}
