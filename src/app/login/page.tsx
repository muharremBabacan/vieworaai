'use client';

import { useAuth, useFirestore } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4">
    <title>Google</title>
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.67-4.01 1.67-3.41 0-6.18-2.79-6.18-6.18S6.71 7.64 10.12 7.64c1.78 0 3.03.71 3.73 1.39l2.75-2.75C15.43 5.09 13.01 4 10.12 4A8.25 8.25 0 0 0 1.87 12a8.25 8.25 0 0 0 8.25 8.25c2.43 0 4.58-.81 6.18-2.43a6.92 6.92 0 0 0 2.1-5.01c0-.52-.05-.98-.12-1.42Z"
      fill="#4285F4"
    />
  </svg>
);

const MicrosoftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="mr-2 h-4 w-4">
        <title>Microsoft</title>
        <path fill="#f25022" d="M1 1h9v9H1z"/>
        <path fill="#00a4ef" d="M1 11h9v9H1z"/>
        <path fill="#7fba00" d="M11 1h9v9h-9z"/>
        <path fill="#ffb900" d="M11 11h9v9h-9z"/>
    </svg>
);


export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async (providerName: 'google' | 'microsoft') => {
    const provider =
      providerName === 'google'
        ? new GoogleAuthProvider()
        : new OAuthProvider('microsoft.com');

    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check for user profile and create if not exists
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        await setDoc(userRef, {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          tokenBalance: 10, // Initial free tokens
          planLevel: 'Temel',
          xp: 0,
        });
      }
      router.push('/dashboard');
    } catch (error) {
      console.error(`Sign in with ${providerName} failed`, error);
      toast({
        variant: 'destructive',
        title: 'Giriş Başarısız',
        description: 'Giriş yaparken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
         <div className="flex flex-col space-y-2 text-center">
           <Logo className="mx-auto mb-4 justify-center" />
           <h1 className="text-2xl font-semibold tracking-tight">
            Hesap oluşturun veya giriş yapın
           </h1>
           <p className="text-sm text-muted-foreground">
            Devam etmek için bir sağlayıcı seçin.
           </p>
         </div>
        <div className="grid gap-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSignIn('google')}
          >
            <GoogleIcon />
            Google ile Giriş Yap
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSignIn('microsoft')}
          >
            <MicrosoftIcon />
            Microsoft ile Giriş Yap
          </Button>
        </div>
        <p className="px-8 text-center text-xs text-muted-foreground">
          Devam ederek, Hizmet Şartlarımızı kabul etmiş ve Gizlilik Politikamızı okumuş olursunuz.
        </p>
      </div>
    </div>
  );
}
