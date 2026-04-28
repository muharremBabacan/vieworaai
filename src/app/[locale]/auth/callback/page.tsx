'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { AuthService } from '@/lib/auth/auth-service';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';

function AuthCallbackContent() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState('Oturumunuz doğrulanıyor...');

  useEffect(() => {
    if (!auth || !firestore) return;

    const handleCustomToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        console.log("📥 [AuthCallback] No token found, returning to login.");
        router.replace('/login');
        return;
      }

      try {
        setStatus('Güvenli giriş yapılıyor...');
        // 1. 🔥 Silent Sign-in with Custom Token
        const result = await signInWithCustomToken(auth, token);
        
        console.log("✅ [AuthCallback] Custom token sign-in success:", result.user.email);
        setStatus('Profiliniz senkronize ediliyor...');

        // 2. 🚀 Centralized Post-Login Logic (Sessions, daily rewards, etc.)
        await AuthService.handlePostLogin(firestore, result.user, 'google');

        setStatus('Giriş başarılı!');
      } catch (error: any) {
        console.error("❌ [AuthCallback] Error:", error);
        toast({
          variant: 'destructive',
          title: 'Giriş Hatası',
          description: 'Oturum açılırken bir sorun oluştu.',
        });
      }
    };

    handleCustomToken();
  }, [auth, firestore, router, searchParams, toast]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0A0A0B] text-white">
      <div className="space-y-6 text-center">
        <div className="relative">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tighter">{status}</h2>
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] animate-pulse">
            Güvenli Bağlantı Kuruluyor
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="bg-[#0A0A0B] h-screen w-full" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
