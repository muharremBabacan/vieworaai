'use client';
import {
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';

import { Button } from '@/components/ui/button';
import Logo from '@/core/components/logo';

import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/shared/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/lib/firebase';
import type { User as UserProfile, PublicUserProfile, AnalysisLog } from '@/types';

function MilkyWayEffect() {
  const [stars, setStars] = useState<{ id: number; tx: number; ty: number; delay: number }[]>([]);

  useEffect(() => {
    const newStars = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      tx: 200 + Math.random() * 200,
      ty: -200 - Math.random() * 200,
      delay: Math.random() * 0.8,
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute h-1.5 w-1.5 bg-yellow-400 rounded-full blur-[1px] animate-star-trail"
          style={{
            '--tw-translate-x': `${star.tx}px`,
            '--tw-translate-y': `${star.ty}px`,
            animationDelay: `${star.delay}s`,
          } as any}
        />
      ))}
    </div>
  );
}

export default function PageContent() {
  const { auth, firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showStars, setShowStars] = useState(false);

  const processAuroRefillAndTestAdjustment = async (userId: string, existingProfile: UserProfile) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userId);
    let needsUpdate = false;
    let finalAuro = existingProfile.auro_balance;

    if (!existingProfile.test_balance_reset) {
      const testAuro = Math.floor(Math.random() * 11) + 10;
      finalAuro = testAuro;
      batch.update(userRef, { auro_balance: testAuro, test_balance_reset: true });
      needsUpdate = true;
    }

    const now = new Date();
    const lastRefillDate = existingProfile.weekly_free_refill_date ? new Date(existingProfile.weekly_free_refill_date) : new Date(0);
    const msInWeek = 7 * 24 * 60 * 60 * 1000;

    if (now.getTime() - lastRefillDate.getTime() >= msInWeek) {
      if (finalAuro < 20) {
        const giftAmount = Math.min(5, 20 - finalAuro);
        if (giftAmount > 0) {
          batch.update(userRef, { auro_balance: increment(giftAmount), weekly_free_refill_date: now.toISOString() });
          const logRef = doc(collection(firestore, 'analysis_logs'));
          batch.set(logRef, { id: logRef.id, userId, userName: existingProfile.name || 'Vizyoner', type: 'gift', auroSpent: -giftAmount, timestamp: now.toISOString(), status: 'success' });
          const notifRef = doc(collection(firestore, 'users', userId, 'notifications'));
          batch.set(notifRef, { id: notifRef.id, title: "Haftalık Hediye!", message: `Luma senin için ${giftAmount} Auro bıraktı.`, type: 'reward', createdAt: now.toISOString() });
          needsUpdate = true;
          setTimeout(() => { setShowStars(true); toast({ title: "Haftalık Auro Hediyesi!" }); setTimeout(() => setShowStars(false), 3000); }, 2000);
        }
      } else {
        batch.update(userRef, { weekly_free_refill_date: now.toISOString() });
        needsUpdate = true;
      }
    }
    if (needsUpdate) await batch.commit();
  };

  const handleSignIn = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result: UserCredential = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const userSnap = await getDoc(doc(firestore, 'users', firebaseUser.uid));
      const now = new Date().toISOString();

      if (!userSnap.exists()) {
        const newUser: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName?.split(' ')[0] || "İsimsiz Sanatçı",
          photoURL: firebaseUser.photoURL,
          auro_balance: 20,
          current_xp: 0,
          level_name: 'Neuner',
          tier: 'start',
          weekly_free_refill_date: now,
          onboarded: false,
          completed_modules: [],
          interests: [],
          createdAt: now,
        };
        await setDoc(doc(firestore, 'users', firebaseUser.uid), newUser);
        await setDoc(doc(firestore, 'public_profiles', firebaseUser.uid), { id: firebaseUser.uid, name: newUser.name, email: newUser.email, photoURL: newUser.photoURL, level_name: 'Neuner' });
      } else {
        const existing = userSnap.data() as UserProfile;
        await updateDoc(doc(firestore, 'users', firebaseUser.uid), { lastLoginAt: now });
        await processAuroRefillAndTestAdjustment(firebaseUser.uid, existing);
      }
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 relative overflow-hidden">
      {showStars && <MilkyWayEffect />}
      <main className="flex flex-grow items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Logo />
            <h1 className="!mt-6 text-2xl font-semibold tracking-tight">Hesap oluşturun veya giriş yapın</h1>
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignIn} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Google ile Giriş Yap"}
          </Button>
        </div>
      </main>
    </div>
  );
}
