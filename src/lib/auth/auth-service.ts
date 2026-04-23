
'use client';

import { 
  Auth, 
  User as FirebaseUser
} from 'firebase/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin-init';

/**
 * Service to handle Viewora specific authentication flows.
 */
export const AuthService = {
  /**
   * Checks if user exists in Firestore and creates if not.
   */
  async ensureUserDoc(firestore: Firestore, firebaseUser: FirebaseUser, name?: string, provider: 'google' | 'email' = 'email') {
    const userRef = doc(firestore, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: name || firebaseUser.displayName?.split(' ')[0] || "İsimsiz Sanatçı",
        photoURL: firebaseUser.photoURL || null,
        phone: '',
        instagram: '',
        pix_balance: 20,
        current_xp: 0,
        level_name: 'Neuner',
        tier: 'start',
        total_analyses_count: 0,
        total_mentor_analyses_count: 0,
        total_exhibitions_count: 0,
        total_competitions_count: 0,
        weekly_free_refill_date: now,
        onboarded: false,
        emailVerified: firebaseUser.emailVerified,
        daily_streak: 1,
        last_active_date: now.split('T')[0],
        completed_modules: [],
        interests: [],
        createdAt: now,
        provider: provider
      };
      
      // ÖZEL PROFİL
      await setDoc(userRef, newUser);
      
      // KAMUYA AÇIK PROFİL (GEZİLER İÇİN)
      await setDoc(doc(firestore, 'public_profiles', firebaseUser.uid), { 
        id: firebaseUser.uid, 
        name: newUser.name, 
        email: newUser.email, 
        photoURL: newUser.photoURL, 
        level_name: 'Neuner',
        phone: '',
        instagram: ''
      });
      
      // Başlangıç bildirimi
      const notifRef = doc(firestore, 'users', firebaseUser.uid, 'notifications', 'welcome');
      await setDoc(notifRef, { 
        id: 'welcome', 
        title: "Vizyon Analizi Bekliyor", 
        message: "Luma seni tanımak istiyor. Lütfen anketi doldurun.", 
        type: 'system', 
        createdAt: now 
      });
      
      return newUser;
    }
    
    return userSnap.data() as UserProfile;
  },

  /**
   * 🕵️ Gets the user identity from the server-side session cookie.
   * Use this in layouts, page components (Server Components), or middleware.
   */
  async getUserFromSession() {
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get("session")?.value;
      if (!session) return null;

      const adminAuth = getAdminAuth();
      const decodedClaims = await adminAuth.verifySessionCookie(session, true);
      return decodedClaims;
    } catch (error) {
      console.error("[AuthService] Session verification failed:", error);
      return null;
    }
  },

  /**
   * 🚪 Clear session cookie on logout.
   */
  async logout() {
    try {
      await fetch("/api/session/login", { method: "DELETE" });
      console.log("👋 [AuthService] Session cleared.");
    } catch (error) {
      console.error("[AuthService] Logout error:", error);
    }
  }
};
