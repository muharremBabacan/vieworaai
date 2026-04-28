
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
  increment,
  runTransaction
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
    if (!firestore || !firebaseUser) return;

    const userRef = doc(firestore, 'users', firebaseUser.uid);
    
    // ⚡️ LIGHTWEIGHT CHECK FIRST
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      console.debug("✅ [AuthService] User doc exists. Skipping creation.");
      return docSnap.data() as UserProfile;
    }

    const publicRef = doc(firestore, 'public_profiles', firebaseUser.uid);
    const notifRef = doc(firestore, 'users', firebaseUser.uid, 'notifications', 'welcome');

    return await runTransaction(firestore, async (transaction) => {
      const userSnap = await transaction.get(userRef);

      if (userSnap.exists()) {
        console.log("ℹ️ [AuthService] User already exists. Syncing...");
        const existingData = userSnap.data() as UserProfile;
        transaction.update(userRef, { lastLoginAt: new Date().toISOString() });
        return existingData;
      }

      console.log("🆕 [AuthService] Creating NEW atomic user document...");
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: name || firebaseUser.displayName?.split(' ')[0] || "İsimsiz Sanatçı",
        photoURL: firebaseUser.photoURL || null,
        phone: '',
        instagram: '',
        auro_balance: 0,
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
        emailVerified: firebaseUser.emailVerified || false,
        daily_streak: 1,
        last_active_date: now.split('T')[0],
        completed_modules: [],
        interests: [],
        createdAt: now,
        updatedAt: now, // 🔥 Added per requirement
        provider: provider
      };

      transaction.set(userRef, newUser);
      transaction.set(publicRef, { 
        id: firebaseUser.uid, 
        name: newUser.name, 
        email: newUser.email, 
        photoURL: newUser.photoURL, 
        level_name: 'Neuner',
        updatedAt: now
      });
      transaction.set(notifRef, { 
        id: 'welcome', 
        title: "Vizyon Analizi Bekliyor", 
        message: "Luma seni tanımak istiyor. Lütfen anketi doldurun.", 
        type: 'system', 
        createdAt: now 
      });

      return newUser;
    });
  },

  /**
   * 🚀 CENTRALIZED POST-LOGIN LOGIC
   * Handles session creation, profile sync, and daily rewards.
   */
  async handlePostLogin(firestore: Firestore, firebaseUser: FirebaseUser, provider: 'google' | 'email' = 'email') {
    try {
      // 1. Ensure/Sync User Doc in Firestore
      const profile = await this.ensureUserDoc(firestore, firebaseUser, undefined, provider);

      // 2. Daily Refill & Stats Update
      const today = new Date().toISOString().split('T')[0];
      const lastRefill = profile?.last_auro_refill_date;
      const userRef = doc(firestore, 'users', firebaseUser.uid);

      const updateData: any = {
        lastLoginAt: new Date().toISOString(),
        emailVerified: true
      };

      if (lastRefill !== today) {
        updateData.pix_balance = increment(3); // Daily gift
        updateData.last_auro_refill_date = today;
        updateData.daily_streak = (profile?.daily_streak || 0) + 1;
      }

      await updateDoc(userRef, updateData);

      console.log('✅ [AuthService] Post-login sync complete.');
      return profile;
    } catch (error) {
      console.error('❌ [AuthService] handlePostLogin error:', error);
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
