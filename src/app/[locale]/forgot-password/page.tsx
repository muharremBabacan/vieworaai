'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, Link } from '@/i18n/navigation'; 
import { sendPasswordResetEmail } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, Send } from 'lucide-react';
import Logo from '@/core/components/logo';

/**
 * ✨ MilkyWayEffect - Shared design language
 */
function MilkyWayEffect() {
  const [mounted, setMounted] = useState(false);
  const [stars, setStars] = useState<{width: string, height: string, top: string, left: string, delay: string, duration: string}[]>([]);

  useEffect(() => {
    setMounted(true);
    const newStars = Array.from({ length: 40 }).map(() => ({
      width: Math.random() * 2 + 'px',
      height: Math.random() * 2 + 'px',
      top: Math.random() * 100 + '%',
      left: Math.random() * 100 + '%',
      delay: Math.random() * 5 + 's',
      duration: (3 + Math.random() * 4) + 's'
    }));
    setStars(newStars);
  }, []);

  if (!mounted) return null;

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

function ForgotPasswordForm() {
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || isLoading) return;
    
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin + '/login',
      });
      setIsSent(true);
      toast({ 
        title: 'Bağlantı Gönderildi', 
        description: 'Şifre sıfırlama bağlantısı e-posta adresine gönderildi.' 
      });
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      let message = 'Bir hata oluştu. Lütfen e-posta adresini kontrol et.';
      if (error.code === 'auth/user-not-found') message = 'Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı.';
      
      toast({ variant: 'destructive', title: 'Hata', description: message });
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
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">Şifremi Unuttum</h1>
          <p className="text-sm font-medium text-muted-foreground/80 tracking-wide">
            E-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.
          </p>
        </div>

        <Card className="rounded-[40px] border-white/10 bg-white/5 backdrop-blur-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
          <CardContent className="p-8 space-y-6">
            {!isSent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
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
                  disabled={isLoading} 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_16px_-4px_rgba(var(--primary),0.4)] transition-all group"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <span className="flex items-center">
                      Bağlantı Gönder
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
                  <h3 className="text-xl font-bold text-white">Kontrol Et!</h3>
                  <p className="text-sm text-muted-foreground">
                    Şifre sıfırlama mailini gönderdik. Lütfen gelen kutunu (ve gereksiz kutusunu) kontrol et.
                  </p>
                </div>
                <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10" onClick={() => setIsSent(false)}>
                  E-postayı Tekrar Gir
                </Button>
              </div>
            )}

            <div className="pt-2 text-center">
              <Button variant="ghost" asChild className="rounded-xl font-bold text-muted-foreground/60 hover:text-white transition-all group">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Giriş Sayfasına Dön
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Footer */}
        <p className="text-center text-[10px] text-muted-foreground/40 font-medium uppercase tracking-[0.2em]">
          Viewora &copy; 2024 &bull; Sanat ve Teknoloji
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="relative">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
