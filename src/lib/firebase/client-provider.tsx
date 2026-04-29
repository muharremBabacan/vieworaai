'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  getFirestore,
  Firestore,
  doc,
  onSnapshot
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { signInWithCustomToken, Auth } from 'firebase/auth';
import { app, auth as firebaseAuth } from './init';
import { useSession } from "next-auth/react";
import type { User as UserProfile } from '@/types';

interface AuthContextType {
  user: any | null; // NextAuth user
  profile: UserProfile | null;
  authReady: boolean;
  isProfileLoading: boolean;
  isUserLoading: boolean;
  firestore: Firestore;
  auth: Auth;
  uid: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firestore = useMemo(() => getFirestore(app), []);
  const { data: session, status } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const authReady = status !== "loading";
  const user = session?.user || null;
  
  // 🔑 UID from NextAuth Session (Injected on server)
  const uid = (session as any)?.uid || null;

  // 🛰️ FIREBASE AUTH BRIDGE (KESİN ÇÖZÜM)
  useEffect(() => {
    const run = async () => {
      const firebaseToken = (session as any)?.firebaseToken;

      if (status !== "authenticated" || !firebaseToken) return;

      // 🔥 EN KRİTİK KONTROL
      if (firebaseAuth.currentUser) {
        console.log("⛔ [AuthBridge] Firebase zaten login:", firebaseAuth.currentUser.uid);
        return;
      }

      try {
        console.log("🔥 [AuthBridge] Firebase login başlıyor...");
        await signInWithCustomToken(firebaseAuth, firebaseToken);
        console.log("✅ [AuthBridge] Firebase login OK");
      } catch (err: any) {
        console.error("❌ [AuthBridge] Sync failed:", err.code, err.message);
      }
    };

    run();
  }, [session?.firebaseToken, status]);

  // 🔑 Sync Profile from Firestore using UID
  useEffect(() => {
    if (status !== "authenticated" || !uid) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    
    const unsubscribeProfile = onSnapshot(doc(firestore, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setIsProfileLoading(false);
    }, (error) => {
      console.error('🔥 [Firestore] Profile Watch ERROR:', error);
      setIsProfileLoading(false);
    });

    return () => unsubscribeProfile();
  }, [status, firestore, uid]);

  const value = {
    user,
    profile,
    authReady,
    isProfileLoading,
    isUserLoading: !authReady,
    firestore,
    auth: firebaseAuth,
    uid,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useUser must be used within FirebaseClientProvider');
  return context;
};

export const useFirestore = () => useUser().firestore;
export const useStorage = () => useMemo(() => getStorage(app), []);
export const useFirebaseApp = () => app;

export const useProfile = () => {
  const { profile, isProfileLoading } = useUser();
  return { profile, isProfileLoading };
};

export const useFirebase = () => {
  const { firestore, user, authReady, uid, auth } = useUser();
  return {
    firestore,
    storage: getStorage(app),
    firebaseApp: app,
    user,
    uid,
    auth,
    isUserLoading: !authReady
  };
};

export function useMemoFirebase<T>(factory: () => T, deps: any[]): T | null {
  const isBrowser = typeof window !== 'undefined';
  return useMemo(() => {
    if (!isBrowser) return null;
    return factory();
  }, [isBrowser, ...deps]);
}
