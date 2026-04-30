'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from '@/i18n/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { AuthService } from '@/lib/auth/auth-service';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function LoginWebInternal() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performPopupLogin = async () => {
    if (!auth || !firestore || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        await AuthService.handlePostLogin(firestore, result.user, 'google');
        router.replace('/dashboard');
      }
    } catch (err: any) {
      console.error("Popup Login Error:", err);
      setError(err.message || "Giriş başarısız.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Attempt automatic popup on mount
    performPopupLogin();
  }, [auth, firestore]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] p-4 text-center">
      <div className="space-y-6 max-w-xs w-full">
        <div className="relative">
          {isLoading ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
            </div>
          )}
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Güvenli Giriş</h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">
            {isLoading ? "Pencere Bekleniyor..." : "Giriş Yapmak İçin Hazır"}
          </p>
        </div>

        <div className="pt-4 space-y-4">
          <Button 
            onClick={performPopupLogin} 
            disabled={isLoading}
            className="w-full rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {isLoading ? "Bağlanıyor..." : "Giriş Penceresini Aç"}
          </Button>

          {error && (
            <p className="text-red-500 text-[10px] font-bold uppercase tracking-tight bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          {!isLoading && !error && (
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              Tarayıcı penceresi otomatik açılmazsa yukarıdaki butona tıklayın.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginWebPage() {
  return (
    <Suspense fallback={null}>
      <LoginWebInternal />
    </Suspense>
  );
}
