/**
 * Firebase İstemci SDK Barrel Dosyası
 * Kesin ve çakışmasız export yönetimi.
 */

// 1. App Initialization
export { app, auth, db, storage, getMessagingService, initializeFirebase } from './init';

// 2. Auth & Profile Hooks (ClientProvider)
export { 
  FirebaseClientProvider, 
  useUser, 
  useAuth, 
  useFirestore, 
  useStorage, 
  useFirebaseApp, 
  useProfile, 
  useMemoFirebase,
  useFirebase
} from './client-provider';

// 3. Firestore Hooks
export * from './firestore/use-collection';
export * from './firestore/use-doc';

// 4. Utilities
export * from './non-blocking-updates';
export * from './non-blocking-login';
