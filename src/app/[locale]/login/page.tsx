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

  // 🔄 Handle Redirect Result on Mount
  useEffect(() => {
    if (!auth || !firestore) return;

    const checkRedirect = async () => {
      try {
        setIsRedirecting(true);
        const result = await getRedirectResult(auth);
        
        if (result) {
          console.log("✅ Redirect Login Success:", result.user.email);
          localStorage.removeItem('pending_login'); // Clear flag on success
          const profile = await AuthService.ensureUserDoc(firestore, result.user, undefined, 'google');
          await updateDoc(doc(firestore, 'users', result.user.uid), { lastLoginAt: new Date().toISOString() });
          await processAuroRefillAndStats(result.user.uid, profile);
          router.push('/dashboard');
        }
      } catch (error: any) {
        console.error("❌ Redirect Auth Error:", error);
        toast({
          variant: 'destructive',
          title: 'Giriş Hatası',
          description: 'Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.',
        });
      } finally {
        setIsRedirecting(false);
      }
    };

    checkRedirect();
  }, [auth, firestore, router, toast]);

  const processAuroRefillAndStats = async (userId: string, existingProfile: UserProfile) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userId);
    
    const publicPhotosSnap = await getDocs(query(collection(firestore, 'public_photos'), where('userId', '==', userId)));
    if (existingProfile.total_exhibitions_count !== publicPhotosSnap.size) {
      batch.update(userRef, { total_exhibitions_count: publicPhotosSnap.size });
    }

    const now = new Date();
    const lastRefillDate = existingProfile.weekly_free_refill_date ? new Date(existingProfile.weekly_free_refill_date) : new Date(0);
    const msInWeek = 7 * 24 * 60 * 60 * 1000;

    if (now.getTime() - lastRefillDate.getTime() >= msInWeek) {
      if (existingProfile.auro_balance < 20) {
        const giftAmount = Math.min(5, 20 - existingProfile.auro_balance);
        if (giftAmount > 0) {
          batch.update(userRef, { auro_balance: increment(giftAmount), weekly_free_refill_date: now.toISOString() });
          const logRef = doc(collection(firestore, 'analysis_logs'));
          batch.set(logRef, { id: logRef.id, userId, userName: existingProfile.name || 'Vizyoner', type: 'gift', auroSpent: -giftAmount, timestamp: now.toISOString(), status: 'success' });
        }
      } else {
        batch.update(userRef, { weekly_free_refill_date: now.toISOString() });
      }
    }
    
    await batch.commit();
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // 📱 Detection logic (PWA + In-App Browsers v3.8.6)
      const isInAppBrowser = /GSA\/|Instagram|FBAN|FBIOS|Line|MicroMessenger|Messenger/i.test(navigator.userAgent);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (navigator as any).standalone || 
                          document.referrer.includes('android-app://') ||
                          isInAppBrowser;
                          
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                       window.innerWidth <= 768;

      console.log(`[Auth] Context: Standalone=${isStandalone}, In-App=${isInAppBrowser}, Mobile=${isMobile}`);

      // 🔐 Enforce Local Persistence (Crucial for PWAs/In-App)
      await setPersistence(auth, browserLocalPersistence);
      
      // 🚩 Set pending flag so Layout knows to wait
      localStorage.setItem('pending_login', 'true');

      // 🚀 UNIFIED FLOW: Use signInWithPopup for ALL platforms (Mobile, PWA, Desktop)
      // This combined with our Session Cookie API avoids redirect loops and session loss.
      console.log("🚀 Initiating Popup login flow...");
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
        emailVerified: true // Google users are pre-verified
      });
      await processAuroRefillAndStats(result.user.uid, profile);

      // Successfully logged in and session cookie set
      router.push('/dashboard');
    } catch (error: any) {
      console.warn("Google Sign-In Error:", error.code, error.message);
      
      let errorMessage = 'Google ile giriş yapılırken bir hata oluştu.';
      if (error.code === 'auth/popup-blocked') errorMessage = 'Giriş penceresi engellendi. Lütfen tarayıcı ayarlarından pop-up pencerelere izin verin.';
      if (error.code === 'auth/popup-closed-by-user') errorMessage = 'Giriş penceresi kapatıldı.';
      if (error.code === 'auth/cancelled-popup-request') errorMessage = 'Önceki giriş isteği iptal edildi.';

      toast({
        variant: 'destructive',
        title: 'Giriş Başarısız',
        description: errorMessage,
      });
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
        toast({
          variant: 'destructive',
          title: 'E-posta Doğrulanmamış',
          description: 'E-posta adresiniz henüz doğrulanmamış. Size yeni bir doğrulama maili gönderdik. Lütfen kutunuzu kontrol edin.',
        });
        await auth.signOut();
        setIsLoading(false);
        return;
      }

      const profile = await AuthService.ensureUserDoc(firestore, result.user);
      
      // 🏷️ GET ID TOKEN
      const idToken = await result.user.getIdToken();
      
      // 🔐 CREATE SESSION COOKIE
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
      console.warn("Email Sign-In Error:", error.code);
      
      if (error.code === 'auth/user-not-found') {
        router.push(`/signup?email=${encodeURIComponent(email)}`);
      } else {
        const messages: Record<string, string> = {
          'auth/wrong-password': 'Şifre hatalı.',
          'auth/invalid-email': 'Geçersiz e-posta formatı.',
          'auth/user-disabled': 'Kullanıcı hesabı askıya alınmış.',
          'auth/invalid-credential': 'E-posta veya şifre hatalı.'
        };
        toast({
          variant: 'destructive',
          title: 'Giriş Hatası',
          description: messages[error.code] || 'Bir hata oluştu. Lütfen tekrar deneyin.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  if (isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-10 w-10 text-primary mx-auto" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
            Giriş Yapılıyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] p-4 items-center justify-center relative overflow-hidden">
      {/* Hero Background with Blur */}
      <div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-screen bg-cover bg-center blur-sm"
        style={{ backgroundImage: 'url("/hero-bg.png")' }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0A0A0B]/80 via-transparent to-[#0A0A0B]" />
      
      {/* Animated Glows - Hidden on Mobile for Performance */}
      <div className="hidden sm:block absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="hidden sm:block absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse delay-700" />
      
      <div className="hidden sm:block">
        <MilkyWayEffect />
      </div>

      <div className="w-full max-w-[400px] space-y-8 sm:animate-in sm:fade-in sm:duration-700 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-90" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
              Türkiye’de geliştirilen; fotoğrafları yapay zekâ ile analiz ederek kullanıcıların öğrenmesini, gelişmesini ve paylaşmasını sağlayan küresel bir fotoğraf platformudur.
            </p>
            <h1 className="text-3xl font-black tracking-tighter uppercase pt-4">Giriş Yap</h1>
          </div>
        </div>

        <Card className="rounded-[32px] border-border/40 bg-card/50 backdrop-blur-md shadow-2xl overflow-hidden">
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
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="ornek@mail.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-border/60" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    autoComplete="current-password"
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-border/60" 
                    required 
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Giriş Yap"}
              </Button>
            </form>
            
            <div className="text-center space-y-4 pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Hesabın yok mu?{' '}
                <Link href="/signup" className="text-primary font-bold hover:underline">Üye Ol</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="px-8 text-center text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-widest">
          Giriş yaparak veya hesap oluşturarak{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-primary">Hizmet Şartları</Link>
          {' '}ve{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">Gizlilik Politikası</Link>
          ’nı kabul etmiş olursunuz.
        </p>

        <div className="text-center pt-4">
          <p className="text-[8px] font-black tracking-widest text-muted-foreground/20 uppercase">
            Build v3.8.7 • Stable
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
