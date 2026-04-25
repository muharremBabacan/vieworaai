'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, Link } from '@/i18n/navigation'; 
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import Logo from '@/core/components/logo';
import { AuthService } from '@/lib/auth/auth-service';

/**
 * ✨ MilkyWayEffect - Refined for a more premium look
 */
function MilkyWayEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0A0A0B]" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Tiny Stars */}
      <div className="absolute inset-0 opacity-30">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              width: Math.random() * 2 + 'px',
              height: Math.random() * 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: Math.random() * 5 + 's',
              animationDuration: (3 + Math.random() * 4) + 's'
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LoginForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 🛡️ PWA & Standalone Detection (Improved)
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (typeof window !== 'undefined' && (window.navigator as any).standalone) ||
        document.referrer.includes('android-app://');
      setIsStandalone(!!standalone);
    };
    checkStandalone();
  }, []);

  // 🛰️ HANDLE REDIRECT RESULT (Critical for PWA/Mobile)
  useEffect(() => {
    const checkRedirect = async () => {
      if (!auth || !firestore) return;
      
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("📥 [Login] Redirect result captured:", result.user.email);
          setIsLoading(true);
          
          // Use centralized post-login logic
          const profile = await AuthService.handlePostLogin(firestore, result.user, 'google');
          
          toast({ title: 'Giriş Başarılı', description: 'Geri döndüğün için mutluyuz!' });
          
          // Check onboarding status
          if (profile && !profile.onboarded) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        }
      } catch (error: any) {
        console.error("❌ [Login] Redirect Result Error:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
          toast({ variant: 'destructive', title: 'Hata', description: 'Giriş tamamlanamadı (Redirect Error).' });
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkRedirect();
  }, [auth, firestore, router, toast]);

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      console.log(`[Auth] Hybrid Flow: Standalone=${isStandalone}, Mobile=${isMobile}`);

      // 🔐 Enforce Local Persistence
      await setPersistence(auth, browserLocalPersistence);

      // 🚀 REDIRECT for Mobile/PWA
      if (isStandalone || isMobile) {
        console.log("📱 Mobile/PWA detected, using Redirect...");
        await signInWithRedirect(auth, provider);
        return; 
      }

      // 💻 POPUP for Desktop
      console.log("💻 Desktop detected, using Popup...");
      const result = await signInWithPopup(auth, provider);
      
      // 🛰️ Centralized Post-Login Logic
      await AuthService.handlePostLogin(firestore, result.user, 'google');

      toast({ title: 'Giriş Başarılı', description: 'Geri döndüğün için mutluyuz!' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
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

      // 🛰️ Centralized Post-Login Logic
      await AuthService.handlePostLogin(firestore, result.user, 'email');

      toast({ title: 'Giriş Başarılı', description: 'Dashboard\'a yönlendiriliyorsunuz.' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Email Sign-In Error:", error.code, error.message);
      let errorMessage = 'E-posta veya şifre hatalı.';
      
      if (error.code === 'auth/user-disabled') errorMessage = 'Bu hesap devre dışı bırakılmış.';
      if (error.code === 'auth/too-many-requests') errorMessage = 'Çok fazla hatalı deneme. Lütfen biraz bekleyin.';
      
      toast({ variant: 'destructive', title: 'Giriş Hatası', description: errorMessage });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col p-4 items-center justify-center relative overflow-hidden selection:bg-primary/30">
      <MilkyWayEffect />
      
      <div className="w-full max-w-[420px] space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-4 bg-white/5 rounded-[24px] backdrop-blur-xl border border-white/10 mb-2">
            <Logo className="scale-110" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">Tekrar Hoş Geldin</h1>
          <p className="text-sm font-medium text-muted-foreground/80 tracking-wide">
            Sanat dolu dünyana geri dönmek için giriş yap.
          </p>
        </div>

        <Card className="rounded-[40px] border-white/10 bg-white/5 backdrop-blur-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
          <CardContent className="p-8 space-y-6">
            {/* Social Logins */}
            <Button 
              variant="outline" 
              className="w-full h-14 rounded-2xl font-bold border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 group" 
              onClick={handleGoogleSignIn} 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5 group-hover:text-primary transition-colors" />
                  Google ile Devam Et
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator className="bg-white/10" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black">
                <span className="bg-[#121214] px-4 text-muted-foreground/60 rounded-full border border-white/5">Veya E-posta</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-1">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="E-posta Adresin" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="Şifren" 
                    autoComplete="current-password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_16px_-4px_rgba(var(--primary),0.4)] transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <span className="flex items-center">
                    Giriş Yap
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="pt-2 text-center space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Hesabın yok mu? <Link href="/signup" className="text-primary font-bold hover:text-primary/80 transition-colors">Üye Ol</Link>
              </p>
              <Link href="/forgot-password" title="Şifremi Unuttum" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-white transition-colors">
                Şifremi Unuttum
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Footer */}
        <p className="text-center text-[10px] text-muted-foreground/40 font-medium uppercase tracking-[0.2em]">
          Viewora &copy; 2024 &bull; Sınırları Zorla
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="relative">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
