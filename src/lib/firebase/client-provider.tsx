'use client';

import { createContext, useContext, useEffect, useState, useMemo, DependencyList } from 'react';
import { 
  onAuthStateChanged, 
  getAuth, 
  Auth,
  signInWithCustomToken,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  doc,
  onSnapshot
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { app } from './init';
import { useDoc } from './firestore/use-doc';
import { useCollection } from './firestore/use-collection';
import type { User as UserProfile } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  isProfileLoading: boolean;
  auth: Auth;
  firestore: Firestore;
  sessionUser: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function FirebaseClientProvider({ children, sessionUser }: { children: React.ReactNode, sessionUser: any }) {
  const auth = useMemo(() => getAuth(app), []);
  const firestore = useMemo(() => getFirestore(app), []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(!!sessionUser);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // 🛡️ AUTH WATCHER
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("🔑 [Auth] State Changed:", firebaseUser ? `User: ${firebaseUser.uid}` : "No User");
      setUser(firebaseUser);
      setAuthReady(true);
      
      if (!firebaseUser) {
        setProfile(null);
        setIsProfileLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    // 🔑 SESSION SYNC: If server has a token but client doesn't know the user yet
    if (sessionUser?.customToken && !user && authReady) {
      console.log("🔑 [Auth] Client-side Sync starting with Custom Token...");
      signInWithCustomToken(auth, sessionUser.customToken)
        .then(() => console.log("🔑 [Auth] Client-side Sync SUCCESS!"))
        .catch(err => console.error("🔑 [Auth] Client-side Sync ERROR:", err));
    }
  }, [sessionUser, user, auth, authReady]);

  useEffect(() => {
    // 📄 PROFILE WATCHER
    if (!user) return;

    setIsProfileLoading(true);
    console.log("📡 [Firestore] Starting Profile Watch for:", user.uid);
    console.log("📡 [Firestore] Starting Profile Watch for UID:", user.uid);

    const unsubscribeProfile = onSnapshot(doc(firestore, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        console.log("📡 [Firestore] DATA RECEIVED:", { 
          targetUid: user.uid, 
          onboarded: data.onboarded,
          hasResults: !!data.onboarding_results 
        });
        setProfile(data);
      } else {
        console.warn("📡 [Firestore] NO DOCUMENT FOUND for UID:", user.uid);
        setProfile(null);
      }
      setIsProfileLoading(false);
    }, (error) => {
      console.error("🔥 [Firestore] Profile Watch ERROR:", error);
      setIsProfileLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, firestore]);

  const value = {
    user,
    profile,
    authReady,
    isProfileLoading,
    auth,
    firestore,
    sessionUser
  };



  return (
    <AuthContext.Provider value={value}>
      {children}

    </AuthContext.Provider>
  );
}

import { setDoc } from 'firebase/firestore';

export const useUser = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useUser must be used within FirebaseClientProvider');
  return context;
};

// Simplified aliases for consistency
export const useAuth = () => useUser().auth;
export const useFirestore = () => useUser().firestore;
export const useStorage = () => useMemo(() => getStorage(app), []);
export const useFirebaseApp = () => app;

export const useProfile = () => {
  const { profile, isProfileLoading } = useUser();
  return { profile, isProfileLoading };
};

export const useFirebase = () => {
  const { auth, firestore, user, authReady } = useUser();
  return { 
    auth, 
    firestore, 
    storage: getStorage(app), 
    firebaseApp: app, 
    user, 
    isUserLoading: !authReady 
  };
};

export { useDoc, useCollection };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | null {
  const isBrowser = typeof window !== 'undefined';
  return useMemo(() => {
    if (!isBrowser) return null;
    return factory();
  }, [isBrowser, ...deps]);
}
