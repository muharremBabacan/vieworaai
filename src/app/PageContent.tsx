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

const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.67-4.01 1.67-3.41 0-6.18-2.79-6.18-6.18S6.71 7.64 10.12 7.64c1.78 0 3.03.71 3.73 1.39l2.75-2.75C15.43 5.09 13.01 4 10.12 4A8.25 8.25 0 0 0 1.87 12a8.25 8.25 0 0 0 8.25 8.25c2.43 0 4.58-.81 6.18-2.43a6.92 6.92 0 0 0 2.1-5.01c0-.52-.05-.98-.12-1.42Z"
      fill="currentColor"
    />
  </svg>
);

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

    // 1. TEK SEFERLİK TEST SIFIRLAMASI
    if (!existingProfile.test_balance_reset) {
      const testAuro = Math.floor(Math.random() * 11) + 10;
      finalAuro = testAuro;
      batch.update(userRef, { 
        auro_balance: testAuro, 
        test_balance_reset: true 
      });
      needsUpdate = true;
    }

    // 2. HAFTALIK AURO HEDİYESİ
    const now = new Date();
    const lastRefillDate = existingProfile.weekly_free_refill_date ? new Date(existingProfile.weekly_free_refill_date) : new Date(0);
    const msInWeek = 7 * 24 * 60 * 60 * 1000;

    if (now.getTime() - lastRefillDate.getTime() >= msInWeek) {
      if (finalAuro < 20) {
        const giftAmount = Math.min(5, 20 - finalAuro);
        if (giftAmount > 0) {
          batch.update(userRef, {
            auro_balance: increment(giftAmount),
            weekly_free_refill_date: now.toISOString()
          });

          const logRef = doc(collection(firestore, 'analysis_logs'));
          const log: AnalysisLog = {
            id: logRef.id,
            userId: userId,
            userName: existingProfile.name || 'Vizyoner',
            type: 'gift',
            auroSpent: -giftAmount,
            timestamp: now.toISOString(),
            status: 'success'
          };
          batch.set(logRef, log);

          const notifRef = doc(collection(firestore, 'users', userId, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            title: "Haftalık Hediye!",
            message: `Luma senin için ${giftAmount} Auro bıraktı. Vizyonun hiç bitmesin!`,
            type: 'reward',
            createdAt: now.toISOString()
          });

          needsUpdate = true;
          
          setTimeout(() => {
            setShowStars(true);
            toast({
              title: "Haftalık Auro Hediyesi!",
              description: `${giftAmount} Auro hesabınıza eklendi.`,
            });
            setTimeout(() => setShowStars(false), 3000);
          }, 2000);
        }
      } else {
        batch.update(userRef, { weekly_free_refill_date: now.toISOString() });
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await batch.commit();
    }
  };

  const trackDAU = async (userId: string) => {
    if (!firestore) return;
    const today = new Date().toISOString().split('T')[0];
    const statRef = doc(firestore, 'global_stats', `daily_${today}`);
    
    try {
      const snap = await getDoc(statRef);
      if (!snap.exists()) {
        await setDoc(statRef, {
          date: today,
          dau: 1,
          technicalAnalyses: 0,
          mentorAnalyses: 0,
          photoUploads: 0,
          auroSpent: 0,
          activeUsersList: [userId]
        });
      } else {
        const data = snap.data();
        if (!data.activeUsersList?.includes(userId)) {
          await updateDoc(statRef, {
            dau: increment(1),
            activeUsersList: arrayUnion(userId)
          });
        }
      }
    } catch (e) {
      console.error("DAU tracking error", e);
    }
  };

  const handleSignIn = async () => {
    if (!auth || !firestore) {
      toast({ variant: 'destructive', title: "Sistem Hazır Değil", description: "Firebase servisleri henüz yüklenmedi." });
      return;
    }
    if (isLoading) return;

    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result: UserCredential = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const publicProfileRef = doc(firestore, 'public_profiles', firebaseUser.uid);

      const userSnap = await getDoc(userRef);

      let onboardedStatus = false;
      const now = new Date().toISOString();

      if (!userSnap.exists()) {
        const newUserProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || `user+${firebaseUser.uid}@viewora.ai`,
          name: firebaseUser.displayName?.split(' ')[0] || "İsimsiz Sanatçı",
          photoURL: firebaseUser.photoURL,
          auro_balance: 20,
          total_analyses_count: 0,
          total_auro_spent: 0,
          current_xp: 0,
          level_name: 'Neuner',
          is_mentor: false,
          weekly_free_refill_date: now,
          test_balance_reset: true,
          completed_modules: [],
          interests: [],
          onboarded: false,
          groups: [],
          createdAt: now,
          lastLoginAt: now,
        };

        const newPublicProfile: PublicUserProfile = {
          id: firebaseUser.uid,
          name: newUserProfile.name,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          level_name: 'Neuner',
        };

        await Promise.all([
          setDoc(userRef, newUserProfile),
          setDoc(publicProfileRef, newPublicProfile),
        ]);

        onboardedStatus = false;

      } else {
        const existing = userSnap.data() as UserProfile;
        onboardedStatus = existing.onboarded ?? false;

        const updatedName =
          firebaseUser.displayName?.split(' ')[0] || existing.name;

        await Promise.all([
          updateDoc(userRef, { lastLoginAt: now, name: updatedName }),
          updateDoc(publicProfileRef, { name: updatedName, email: firebaseUser.email, photoURL: firebaseUser.photoURL || null, level_name: existing.level_name })
        ]);

        await processAuroRefillAndTestAdjustment(firebaseUser.uid, existing);
      }

      // Anketi doldurmamışsa bildirim merkezine uyarı gönder
      if (!onboardedStatus) {
        const onboardingNotifRef = doc(collection(firestore, 'users', firebaseUser.uid, 'notifications'), 'onboarding_reminder');
        await setDoc(onboardingNotifRef, {
          id: 'onboarding_reminder',
          title: "Vizyon Analizi Bekliyor",
          message: "Lütfen Anketi doldurun. Luma'nın sizi tanıması için bu analiz çok önemli.",
          type: 'system',
          createdAt: now
        }, { merge: true });
      }

      await trackDAU(firebaseUser.uid);
      
      toast({
        title: "Giriş Başarılı",
        description: "Vizyoner kimliğiniz doğrulanıyor...",
      });

      // Yönlendirme artık tamamen ClientLayout tarafından otomatik yapılacak.
      // Burada sadece isLoading'i kapatmak yeterli (ClientLayout doc snapshot bekleyecek).
      setIsLoading(false);

    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoading(false);
      
      let errorMessage = "Google ile giriş yapılamadı.";
      if (error.code === 'auth/popup-blocked') {
        errorMessage = "Giriş penceresi tarayıcı tarafından engellendi.";
      }

      toast({
        variant: 'destructive',
        title: "Giriş Başarısız",
        description: errorMessage,
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 relative overflow-hidden">
      {showStars && <MilkyWayEffect />}
      <main className="flex flex-grow items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Logo />
            <p className="!mt-3 text-center text-xs text-muted-foreground">
              "Türkiye'de geliştirilen global fotoğrafçılık eğitimi ve koçluğu platformu"
            </p>
            <h1 className="!mt-6 text-2xl font-semibold tracking-tight">
              Hesap oluşturun veya giriş yapın
            </h1>
            <p className="text-sm text-muted-foreground">
              Devam etmek için Google ile giriş yapın.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Giriş Yapılıyor...
              </>
            ) : (
              <>
                <GoogleIcon />
                Google ile Giriş Yap
              </>
            )}
          </Button>

          <p className="px-8 text-center text-xs text-muted-foreground">
            Devam ederek{' '}
            <Link href="/terms" className="underline">
              Hizmet Şartlarını
            </Link>{' '}
            kabul etmiş olursunuz.
          </p>
        </div>
      </main>
    </div>
  );
}
