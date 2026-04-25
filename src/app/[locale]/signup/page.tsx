'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, Link } from '@/i18n/navigation'; 
import { useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import Logo from '@/core/components/logo';
import { AuthService } from '@/lib/auth/auth-service';
import { ToastAction } from '@/components/ui/toast';

/**
 * ✨ MilkyWayEffect - Matching the premium login style
 */
function MilkyWayEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0A0A0B]" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Tiny Stars */}
      <div className="absolute inset-0 opacity-30">
        {Array.from({ length: 40 }).map((_, i) => (
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

function SignupForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || isLoading) return;

    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifreler eşleşmiyor.' });
      return;
    }

    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // 🔥 Ensure profile exists before verification
      await AuthService.ensureUserDoc(firestore, result.user, name, 'email');
      await sendEmailVerification(result.user);
      
      // Clear Firebase session to force verification on login
      await signOut(auth);
      
      toast({ 
        title: 'Kayıt Başarılı!', 
        description: 'Lütfen e-posta kutunu kontrol et ve hesabını doğrula.' 
      });
      router.push('/verify-email');
    } catch (error: any) {
      console.warn("Signup error:", error.code);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: 'destructive',
          title: 'Zaten Kayıtlı',
          description: 'Bu e-posta ile daha önce hesap oluşturulmuş.',
          action: (
            <ToastAction altText="Giriş Yap" onClick={() => router.push('/login')}>Giriş Yap</ToastAction>
          ),
        });
      } else {
        toast({ variant: 'destructive', title: 'Kayıt Hatası', description: 'Bilgilerinizi kontrol edip tekrar deneyin.' });
      }
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
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">Aramıza Katıl</h1>
          <p className="text-sm font-medium text-muted-foreground/80 tracking-wide flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            Luma ile fotoğraf yolculuğuna başla.
          </p>
        </div>

        <Card className="rounded-[40px] border-white/10 bg-white/5 backdrop-blur-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Adın ve Soyadın" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
              </div>

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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="Şifre" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all text-xs" 
                    required 
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="Tekrar" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all text-xs" 
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
                    Kaydol
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="pt-2 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Zaten hesabın var mı? <Link href="/login" className="text-primary font-bold hover:text-primary/80 transition-colors">Giriş Yap</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" asChild className="rounded-xl font-bold text-muted-foreground/60 hover:text-white transition-all group">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Giriş Sayfasına Dön
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="relative">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}