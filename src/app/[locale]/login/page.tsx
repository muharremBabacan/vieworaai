'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, Link } from '@/i18n/navigation'; 
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock, ArrowRight, Send } from 'lucide-react';
import Logo from '@/core/components/logo';
import { AuthService } from '@/lib/auth/auth-service';

/**
 * ✨ MilkyWayEffect - Refined for a more premium look
 */
function MilkyWayEffect() {
  const [mounted, setMounted] = useState(false);
  const [stars, setStars] = useState<{width: string, height: string, top: string, left: string, delay: string, duration: string}[]>([]);

  useEffect(() => {
    setMounted(true);
    // Generate stars only once on the client
    const newStars = Array.from({ length: 50 }).map(() => ({
      width: Math.random() * 2 + 'px',
      height: Math.random() * 2 + 'px',
      top: Math.random() * 100 + '%',
      left: Math.random() * 100 + '%',
      delay: Math.random() * 5 + 's',
      duration: (3 + Math.random() * 4) + 's'
    }));
    setStars(newStars);
  }, []);

  if (!mounted) return null; // 🛡️ Prevent SSR hydration mismatch

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0A0A0B]" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Tiny Stars */}
      <div className="absolute inset-0 opacity-30">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              width: star.width,
              height: star.height,
              top: star.top,
              left: star.left,
              animationDelay: star.delay,
              animationDuration: star.duration
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
  const [emailSent, setEmailSent] = useState(false);

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

  // 🛰️ HANDLE REDIRECT & MAGIC LINK CALLBACK
  useEffect(() => {
    if (!auth || !firestore) return;

    // Handle Google Redirect Result
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setIsLoading(true);
          await AuthService.handlePostLogin(firestore, result.user, 'google');
          console.log("✅ [GoogleAuth] Redirect success.");
          toast({ title: 'Başarılı', description: 'Google ile giriş yapıldı.' });
        }
      } catch (error: any) {
        console.error("Google Redirect Error:", error);
        toast({ variant: 'destructive', title: 'Hata', description: 'Giriş işlemi tamamlanamadı.' });
      } finally {
        setIsLoading(false);
      }
    };

    handleRedirectResult();

    if (isSignInWithEmailLink(auth, window.location.href)) {
      let savedEmail = window.localStorage.getItem('emailForSignIn');
      
      if (!savedEmail) {
        savedEmail = window.prompt('Güvenliğiniz için lütfen e-posta adresinizi doğrulayın:');
      }

      if (savedEmail) {
        setIsLoading(true);
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem('emailForSignIn');
            // Handle post login (sync profile, etc)
            await AuthService.handlePostLogin(firestore, result.user, 'emailLink');
            console.log("✅ [Passwordless] Auth successful. Waiting for AuthGate...");
            toast({ title: 'Başarılı', description: 'Giriş yapıldı.' });
          })
          .catch((error) => {
            console.error("Magic Link Error:", error);
            toast({ variant: 'destructive', title: 'Hata', description: 'Giriş bağlantısı geçersiz veya süresi dolmuş.' });
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [auth, firestore, isStandalone]);

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || isLoading) return;
    setIsLoading(true);

    const actionCodeSettings = {
      // Must be identical to the current page to handle the callback
      url: window.location.origin + '/login',
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setEmailSent(true);
      toast({ title: 'Bağlantı Gönderildi', description: 'Giriş bağlantısı e-posta adresinize gönderildi.' });
    } catch (error: any) {
      console.error("Email Link Error:", error);
      toast({ variant: 'destructive', title: 'Hata', description: 'Bağlantı gönderilemedi. Tekrar deneyin.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore || isLoading) return;
    
    // 🛡️ PWA STANDALONE PROTECTION
    if (isStandalone) {
      console.log("📱 [PWA] Redirecting to browser for safe login...");
      window.location.href = window.location.origin + '/login-web';
      return;
    }

    setIsLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      // On Desktop/Mobile Browser, use Redirect or Popup based on preference
      // We will stick to Redirect for consistency as it's safer for Mobile
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      toast({ variant: 'destructive', title: 'Hata', description: 'Google ile giriş başarısız oldu.' });
    } finally {
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

            <Button 
              type="button" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              variant="outline"
              className="w-full h-14 rounded-2xl font-black uppercase tracking-widest border-white/10 bg-white hover:bg-white/90 text-black transition-all group relative overflow-hidden"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.549L20.0303 3.124C17.9503 1.19 15.2353 0 12.0003 0C7.31028 0 3.25528 2.69 1.28027 6.609L5.27028 9.704C6.21528 6.73 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
                    <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
                    <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
                    <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21538 17.265 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
                  </svg>
                  Google ile Giriş Yap
                </span>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121213] px-2 text-muted-foreground font-black tracking-widest rounded-full border border-white/5 py-1">Veya Email ile</span>
              </div>
            </div>

            <Button 
              type="button" 
              onClick={() => {
                localStorage.setItem('viewora_guest_mode', 'true');
                router.push('/dashboard');
              }}
              variant="ghost"
              className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
            >
              Misafir Olarak Devam Et
            </Button>


            {!emailSent ? (
              <form onSubmit={handleEmailLinkSignIn} className="space-y-4">
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

                <Button 
                  type="submit" 
                  disabled={isLoading || !email} 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_16px_-4px_rgba(var(--primary),0.4)] transition-all group"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <span className="flex items-center">
                      Bana Giriş Linki Gönder
                      <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                  <Send className="h-8 w-8 text-primary animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Posta Kutunu Kontrol Et!</h3>
                  <p className="text-sm text-muted-foreground">
                    Sana sihirli bir giriş bağlantısı gönderdik. Şifreye ihtiyacın yok, sadece e-postandaki bağlantıya tıkla.
                  </p>
                </div>
                <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10" onClick={() => setEmailSent(false)}>
                  Farklı Bir Adres Dene
                </Button>
              </div>
            )}

            <div className="pt-2 text-center space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Hesabın yok mu? <Link href="/signup" className="text-primary font-bold hover:text-primary/80 transition-colors">Üye Ol</Link>
              </p>
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
