'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from '@/i18n/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { AuthService } from '@/lib/auth/auth-service';
import { Loader2 } from 'lucide-react';

function LoginWebInternal() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performPopupLogin = async () => {
      if (!auth || !firestore) return;
      
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        if (result.user) {
          await AuthService.handlePostLogin(firestore, result.user, 'google');
          // Success! Redirect to home/dashboard
          router.replace('/dashboard');
        }
      } catch (err: any) {
        console.error("Popup Login Error:", err);
        setError(err.message || "Giriş başarısız.");
        // If popup fails, maybe redirect back to main login
        setTimeout(() => router.replace('/login'), 2000);
      }
    };

    performPopupLogin();
  }, [auth, firestore, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] p-4 text-center">
      <div className="space-y-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">Güvenli Giriş Yapılıyor</h2>
          <p className="text-sm text-muted-foreground">Lütfen açılan pencerede hesabınızı seçin...</p>
        </div>
        {error && <p className="text-red-500 text-xs mt-4">{error}</p>}
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
