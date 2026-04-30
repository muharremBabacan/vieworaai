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
import type { User as UserProfile } from '@/types';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthContextType {
  user: any | null; // NextAuth user
  profile: UserProfile | null;
  authReady: boolean;
  isProfileLoading: boolean;
  isUserLoading: boolean;
  firestore: Firestore;
  auth: Auth;
  uid: string | null;
  isSuspended: boolean;
  isFirebaseReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firestore = useMemo(() => getFirestore(app), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setIsFirebaseReady(true);
    const unsubscribe = firebaseAuth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const uid = user?.uid || null;

  // 🔑 Global Profile Listener (Stable Manual Implementation)
  useEffect(() => {
    if (!uid || !firestore || !isFirebaseReady) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);

    const unsubscribe = onSnapshot(doc(firestore, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setIsProfileLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('🔥 [Firestore] Profile Watch ERROR:', error);
      }
      setIsProfileLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [uid, firestore, isFirebaseReady]);

  const value = useMemo(() => ({
    user,
    profile,
    authReady,
    isProfileLoading,
    isUserLoading: !authReady || !isFirebaseReady,
    firestore,
    auth: firebaseAuth,
    uid,
    isSuspended: profile?.isSuspended || false,
    isFirebaseReady,
  }), [user, authReady, profile, isProfileLoading, isFirebaseReady, uid, firestore]);

  return (
    <AuthContext.Provider value={value}>
      {profile?.isSuspended ? (
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="max-w-md space-y-6">
            <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield size={40} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-tight">
              HESABINIZ DONDURULDU
            </h1>
            <p className="text-muted-foreground font-medium">
              Hesabınız bir kural ihlali veya güvenlik incelemesi nedeniyle dondurulmuştur. Sorularınız için destek ekibiyle iletişime geçebilirsiniz.
            </p>
            <div className="pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                   // Force logout
                   window.location.href = '/api/auth/signout';
                }}
                className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest border-border/60"
              >
                Çıkış Yap
              </Button>
            </div>
          </div>
        </div>
      ) : children}
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
  const { firestore, user, authReady, uid, auth, isFirebaseReady } = useUser();
  return {
    firestore,
    storage: getStorage(app),
    firebaseApp: app,
    user,
    uid,
    auth,
    isUserLoading: !authReady || !isFirebaseReady,
    isFirebaseReady
  };
};

export function useMemoFirebase<T>(factory: () => T, deps: any[]): T | null {
  const isBrowser = typeof window !== 'undefined';
  return useMemo(() => {
    if (!isBrowser) return null;
    return factory();
  }, [isBrowser, ...deps]);
}
