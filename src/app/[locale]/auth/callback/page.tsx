'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { getRedirectResult } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/lib/firebase';
import { AuthService } from '@/lib/auth/auth-service';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';

/**
 * 🛰️ Auth Callback Page
 * This page handles the result of a signInWithRedirect operation.
 * It's safer to use a dedicated callback page for PWAs and Mobile browsers.
 */
export default function AuthCallback() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState('Girişiniz tamamlanıyor...');

  useEffect(() => {
    if (!auth || !firestore) return;

    const handleResult = async () => {
      try {
        const result = await getRedirectResult(auth);

        if (result?.user) {
          console.log("✅ [AuthCallback] Success:", result.user.email);
          setStatus('Oturum senkronize ediliyor...');

          // 🚀 Centralized Post-Login Logic
          await AuthService.handlePostLogin(firestore, result.user, 'google');

          setStatus('Yönlendiriliyorsunuz...');
          window.location.href = "/dashboard"; // Full reload for safety
        } else {
          // No result found, redirect back to login
          console.log("📥 [AuthCallback] No result found, returning to login.");
          router.replace('/login');
        }
      } catch (error: any) {
        console.error("❌ [AuthCallback] Error:", error);
        toast({
          variant: 'destructive',
          title: 'Giriş Hatası',
          description: error.message || 'Oturum açılırken bir sorun oluştu.',
        });
        router.replace('/login');
      }
    };

    handleResult();
  }, [auth, firestore, router, toast]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0A0A0B] text-white">
      <div className="space-y-6 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tighter">{status}</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Lütfen pencereyi kapatmayın
          </p>
        </div>
      </div>
    </div>
  );
}
