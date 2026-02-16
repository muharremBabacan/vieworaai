'use client';

import { useAuth, useFirestore } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { useRouter, Link } from '@/navigation';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4">
    <title>Google</title>
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
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true); // Sayfa yüklenirken yönlendirme kontrolü için true başla

  // Yönlendirme URI'sini query parametrelerinden sakla
  useEffect(() => {
    const redirectUri = searchParams.get('redirect_uri');
    if (redirectUri) {
      sessionStorage.setItem('loginRedirectUri', redirectUri);
    }
  }, [searchParams]);

  // Sayfa yüklendiğinde yönlendirme sonucunu işle
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Kullanıcı başarıyla giriş yaptı.
          toast({ title: 'Başarıyla giriş yaptınız. Yönlendiriliyorsunuz...' });
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

          const redirectUri = sessionStorage.getItem('loginRedirectUri');
          if (redirectUri) {
            sessionStorage.removeItem('loginRedirectUri');
            router.push(redirectUri as any);
            return;
          }
          
          const isOnboarded = docSnap.exists() && docSnap.data().onboarded;
          if (isOnboarded) {
            router.push('/profile');
          } else {
            router.push('/onboarding');
          }
        } else {
          // Yönlendirme sonucu yok, normal sayfa yüklemesi
          setIsLoading(false);
        }
      } catch (error: any) {
        // getRedirectResult'tan gelen hataları yakala
        console.error('Yönlendirme ile giriş başarısız', error);
        let description = 'Giriş yaparken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
        if (error.code === 'auth/unauthorized-domain') {
            description = `Bu alan adı, Firebase projenizde kimlik doğrulama için yetkilendirilmemiş. viewora.ai alan adını Firebase Console > Authentication > Settings > Authorized domains bölümüne eklemelisiniz.`;
        }
        toast({
          variant: 'destructive',
          title: `Giriş Başarısız (${error.code || 'Bilinmeyen Hata'})`,
          description: description,
        });
        setIsLoading(false);
      }
    };
    if(auth && firestore) { // Firebase servislerinin hazır olduğundan emin ol
      processRedirect();
    }
  }, [auth, firestore, router, toast]);

  const handleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    await signInWithRedirect(auth, provider);
    // Kullanıcı yönlendirilecek, bu yüzden burada setLoading(false) yapmaya gerek yok
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <main className="flex flex-grow items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Logo className="items-center justify-center" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Hesap oluşturun veya giriş yapın
            </h1>
            <p className="text-sm text-muted-foreground">
              Devam etmek için Google ile giriş yapın.
            </p>
          </div>
          <div className="grid gap-4">
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
          </div>
          <p className="px-8 text-center text-xs text-muted-foreground">
            Devam ederek,{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Hizmet Şartlarımızı
            </Link>{' '}
            kabul etmiş ve{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
              Gizlilik Politikamızı
            </Link>{' '}
            okumuş olursunuz.
          </p>
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="px-2 underline-offset-4 hover:text-primary hover:underline">
          Gizlilik Politikası
        </Link>
        <span className="mx-2 border-r"></span>
        <Link href="/terms" className="px-2 underline-offset-4 hover:text-primary hover:underline">
          Hizmet Şartları
        </Link>
      </footer>
    </div>
  );
}
