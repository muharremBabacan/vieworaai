
'use client';

import { 
  Auth, 
  User as FirebaseUser
} from 'firebase/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import type { User as UserProfile } from '@/types';

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
   * 🚀 CENTRALIZED POST-LOGIN LOGIC
   * Handles session creation, profile sync, and daily rewards.
   */
  async handlePostLogin(firestore: Firestore, firebaseUser: FirebaseUser, provider: 'google' | 'email' = 'email') {
    try {
      // 1. Get ID Token
      const idToken = await firebaseUser.getIdToken();
      
      // 2. Create Server Session
      const sessionRes = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) throw new Error("Oturum açılamadı (Session Error)");

      // 3. Ensure/Sync User Doc
      const profile = await this.ensureUserDoc(firestore, firebaseUser, undefined, provider);
      
      // 4. Daily Refill & Stats Update
      const today = new Date().toISOString().split('T')[0];
      const lastRefill = profile.last_auro_refill_date;
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', firebaseUser.uid);

      const updateData: any = {
        lastLoginAt: new Date().toISOString(),
        emailVerified: true
      };

      if (lastRefill !== today) {
        updateData.pix_balance = increment(3); // Daily gift
        updateData.last_auro_refill_date = today;
        updateData.daily_streak = (profile.daily_streak || 0) + 1;
      }

      await updateDoc(userRef, updateData);
      
      console.log("✅ [AuthService] Post-login sync complete.");
      return profile;
    } catch (error) {
      console.error("❌ [AuthService] handlePostLogin error:", error);
      throw error;
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
