'use client';

import { useAuth, useFirestore } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useRouter, Link } from '@/navigation';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.67-4.01 1.67-3.41 0-6.18-2.79-6.18-6.18S6.71 7.64 10.12 7.64c1.78 0 3.03.71 3.73 1.39l2.75-2.75C15.43 5.09 13.01 4 10.12 4A8.25 8.25 0 0 0 1.87 12a8.25 8.25 0 0 0 8.25 8.25c2.43 0 4.58-.81 6.18-2.43a6.92 6.92 0 0 0 2.1-5.01c0-.52-.05-.98-.12-1.42Z"
      fill="currentColor"
    />
  </svg>
);

export default function PageContent() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // ❗ Redirect olmadığı için false başlıyoruz
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!auth || !firestore) return;
    if (isLoading) return;

    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      const result = await signInWithPopup(auth, provider);

      toast({
        title: 'Başarıyla giriş yaptınız. Yönlendiriliyorsunuz...',
      });

      const firebaseUser = result.user;

      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        await setDoc(userRef, {
          id: firebaseUser.uid,
          email: firebaseUser.email || `user+${firebaseUser.uid}@viewora.ai`,
          name: firebaseUser.displayName || 'İsimsiz Sanatçı',
          auro_balance: 20,
          current_xp: 0,
          level_name: 'Neuner',
          is_mentor: false,
          weekly_free_refill_date: new Date().toISOString(),
          completed_modules: [],
          interests: [],
          onboarded: false,
          groups: [],
        });
      }

      const onboarded = docSnap.exists()
        ? (docSnap.data() as any).onboarded
        : false;

      router.push(onboarded ? '/profile' : '/onboarding');
    } catch (error: any) {
      console.error('Popup login error:', error);

      toast({
        variant: 'destructive',
        title: `Giriş Başarısız (${error.code || 'Hata'})`,
        description: 'Google ile giriş yapılamadı.',
      });

      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <main className="flex flex-grow items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Logo />
            <h1 className="text-2xl font-semibold tracking-tight">
              Hesap oluşturun veya giriş yapın
            </h1>
            <p className="text-sm text-muted-foreground">
              Devam etmek için Google ile giriş yapın.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Giriş Yapılıyor...
              </>
            ) : (
              <>
                <GoogleIcon />
                Google ile Giriş Yap
              </>
            )}
          </Button>

          <p className="px-8 text-center text-xs text-muted-foreground">
            Devam ederek{' '}
            <Link href="/terms" className="underline">
              Hizmet Şartlarını
            </Link>{' '}
            kabul etmiş olursunuz.
          </p>
        </div>
      </main>
    </div>
  );
}
