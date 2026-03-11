
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
        auro_balance: 20,
        current_xp: 0,
        level_name: 'Neuner',
        tier: 'start',
        total_analyses_count: 0,
        total_mentor_analyses_count: 0,
        total_exhibitions_count: 0,
        total_competitions_count: 0,
        weekly_free_refill_date: now,
        onboarded: false,
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
  }
};
