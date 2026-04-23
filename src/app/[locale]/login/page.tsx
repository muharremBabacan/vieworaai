'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, Link } from '@/i18n/navigation'; 
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  type UserCredential,
} from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock } from 'lucide-react';
import Logo from '@/core/components/logo';
import { AuthService } from '@/lib/auth/auth-service';
import type { User as UserProfile } from '@/types';

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
    <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-40">
      {stars.map((star) => (
      <div
        key={star.id}
        className="absolute h-[1px] w-[1px] bg-yellow-200/60 rounded-full blur-[0.5px] animate-star-trail"
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

function LoginForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 🔄 Helper: Process post-login logic (Stats, Balance, Firestore)
  const processAuroRefillAndStats = async (uid: string, profile: UserProfile) => {
    if (!firestore) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        const lastRefill = profile.last_auro_refill_date;
        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', uid);

        if (lastRefill !== today) {
            batch.update(userRef, {
                pix_balance: increment(3), // Daily gift
                last_auro_refill_date: today,
                daily_streak: (profile.daily_streak || 0) + 1
            });
        }
        await batch.commit();
    } catch (e) {
        console.error("Stats update failed:", e);
    }
  };

  // 🔥 Catch Redirect Result (CRITICAL for Mobile/PWA)
  useEffect(() => {
    if (!auth || !firestore) return;

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("📥 Redirect login detected, processing session...");
          setIsRedirecting(true);

          // 🏷️ GET ID TOKEN
          const idToken = await result.user.getIdToken();
          
          // 🔐 CREATE SESSION COOKIE
          const sessionRes = await fetch("/api/session/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          if (!sessionRes.ok) throw new Error("Session creation failed");

          const profile = await AuthService.ensureUserDoc(firestore, result.user, undefined, 'google');
          await updateDoc(doc(firestore, 'users', result.user.uid), { 
            lastLoginAt: new Date().toISOString(),
            emailVerified: true 
          });
          await processAuroRefillAndStats(result.user.uid, profile);

          router.push('/dashboard');
        }
      } catch (error: any) {
        console.error("Redirect Result Error:", error);
        toast({ variant: 'destructive', title: 'Giriş Hatası', description: error.message });
      } finally {
        setIsRedirecting(false);
      }
    };

    handleRedirectResult();
  }, [auth, firestore, router, toast]);

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      console.log(`[Auth] Hybrid Flow: Standalone=${isStandalone}, Mobile=${isMobile}`);

      // 🔐 Enforce Local Persistence
      await setPersistence(auth, browserLocalPersistence);
      localStorage.setItem('pending_login', 'true');

      // 🚀 REDIRECT for Mobile/PWA (Most stable on phones)
      if (isStandalone || isMobile) {
        console.log("📱 Mobile/PWA detected, using Redirect flow...");
        await signInWithRedirect(auth, provider);
        return; 
      }

      // 💻 POPUP for Desktop
      console.log("💻 Desktop detected, using Popup flow...");
      const result: UserCredential = await signInWithPopup(auth, provider);
      
      // 🏷️ GET ID TOKEN
      const idToken = await result.user.getIdToken();
      
      // 🔐 CREATE SESSION COOKIE
      const sessionRes = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) throw new Error("Session creation failed");

      const profile = await AuthService.ensureUserDoc(firestore, result.user, undefined, 'google');
      await updateDoc(doc(firestore, 'users', result.user.uid), { 
        lastLoginAt: new Date().toISOString(),
        emailVerified: true
      });
      await processAuroRefillAndStats(result.user.uid, profile);

      router.push('/dashboard');
    } catch (error: any) {
      console.warn("Google Sign-In Error:", error.code, error.message);
      let errorMessage = 'Google ile giriş yapılırken bir hata oluştu.';
      if (error.code === 'auth/popup-blocked') errorMessage = 'Giriş penceresi engellendi. Pop-up ayarlarına izin verin.';
      toast({ variant: 'destructive', title: 'Giriş Başarısız', description: errorMessage });
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || isLoading) return;
    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user);
        toast({ variant: 'destructive', title: 'E-posta Doğrulanmamış', description: 'Size yeni bir doğrulama maili gönderdik.' });
        await auth.signOut();
        setIsLoading(false);
        return;
      }

      const profile = await AuthService.ensureUserDoc(firestore, result.user);
      const idToken = await result.user.getIdToken();
      
      const sessionRes = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) throw new Error("Session creation failed");

      await updateDoc(doc(firestore, 'users', result.user.uid), { 
        lastLoginAt: new Date().toISOString(),
        emailVerified: true
      });
      await processAuroRefillAndStats(result.user.uid, profile);
      router.push('/dashboard');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Giriş Hatası', description: 'E-posta veya şifre hatalı.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-10 w-10 text-primary mx-auto" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Giriş Yapılıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] p-4 items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen bg-cover bg-center blur-sm" style={{ backgroundImage: 'url("/hero-bg.png")' }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0A0A0B]/80 via-transparent to-[#0A0A0B]" />
      <MilkyWayEffect />
      
      <div className="w-full max-w-[400px] space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-90" />
          <h1 className="text-3xl font-black tracking-tighter uppercase pt-4">Giriş Yap</h1>
        </div>

        <Card className="rounded-[32px] border-border/40 bg-card/50 backdrop-blur-md shadow-2xl">
          <CardContent className="p-8 space-y-6">
            <Button variant="outline" className="w-full h-12 rounded-2xl font-bold border-2" onClick={handleGoogleSignIn} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Google ile Devam Et"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-card px-2 text-muted-foreground">Veya E-posta</span></div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-2xl bg-muted/30" required />
              </div>
              <div className="space-y-2">
                <Input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-2xl bg-muted/30" required />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl">
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Giriş Yap"}
              </Button>
            </form>

            <p className="text-center text-sm font-medium text-muted-foreground">
              Hesabın yok mu? <Link href="/signup" className="text-primary font-bold hover:underline">Üye Ol</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0A0A0B]"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
