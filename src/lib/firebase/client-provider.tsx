'use client';

import { createContext, useContext, useEffect, useState, useMemo, DependencyList } from 'react';
import {
  onAuthStateChanged,
  getAuth,
  getRedirectResult,
  Auth,
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
import { AuthService } from '@/lib/auth/auth-service';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  isProfileLoading: boolean;
  isUserLoading: boolean; // alias for !authReady, kept for backward compat
  auth: Auth;
  firestore: Firestore;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getAuth(app), []);
  const firestore = useMemo(() => getFirestore(app), []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // 🔑 STEP 1: Handle Google Redirect Result
  // This runs once on page load after returning from Google's login page
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          console.log('✅ [Auth] Redirect result captured. User:', result.user.uid);
          // Trigger post-login sync (create/update Firestore doc + server session cookie)
          try {
            await AuthService.handlePostLogin(firestore, result.user, 'google');
            console.log('✅ [Auth] Post-login sync completed for redirect user.');
          } catch (err) {
            console.error('❌ [Auth] Post-login sync failed:', err);
          }
        } else {
          console.log('ℹ️ [Auth] No redirect result (normal page load or non-redirect flow).');
        }
      })
      .catch((err) => {
        console.error('❌ [Auth] getRedirectResult error:', err.code, err.message);
      });
  }, [auth, firestore]);

  // 🔑 STEP 2: Real-time Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔑 [Auth] State Changed: USER:', firebaseUser.uid);
      } else {
        console.log('🔑 [Auth] State Changed: No User');
      }
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setProfile(null);
        setIsProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // 🔑 STEP 3: Firestore Profile Watcher (only runs when we have a user)
  useEffect(() => {
    if (!user) return;

    setIsProfileLoading(true);
    console.log('📡 [Firestore] Starting Profile Watch for UID:', user.uid);

    const unsubscribeProfile = onSnapshot(doc(firestore, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        console.log('📡 [Firestore] Profile received:', {
          uid: user.uid,
          onboarded: data.onboarded,
        });
        setProfile(data);
      } else {
        console.warn('📡 [Firestore] No user document found for UID:', user.uid);
        setProfile(null);
      }
      setIsProfileLoading(false);
    }, (error) => {
      console.error('🔥 [Firestore] Profile Watch ERROR:', error);
      setIsProfileLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, firestore]);

  const value = {
    user,
    profile,
    authReady,
    isProfileLoading,
    isUserLoading: !authReady,
    auth,
    firestore,
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
