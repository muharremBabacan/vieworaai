'use client';

import { useAuth, useFirestore } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
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
      fill="currentColor"
    />
  </svg>
);

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async (providerName: 'google') => {
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        await setDoc(userRef, {
          id: firebaseUser.uid,
          email: firebaseUser.email || `user+${firebaseUser.uid}@viewora.ai`,
          name: firebaseUser.displayName || 'İsimsiz Sanatçı',
          tokenBalance: 10,
          planLevel: 'Temel',
          xp: 0,
          level: 'Yeni Başlayan',
          interests: [],
          onboarded: false,
        });
      }
      router.push('/profile');
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.info('Sign-in popup closed by user.');
        return;
      }
      
      console.error(`Sign in with ${providerName} failed`, error);
      
      let description = 'Giriş yaparken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
      if (error.code === 'auth/operation-not-allowed') {
        description = 'Lütfen Firebase projenizde Google ile girişi etkinleştirdiğinizden emin olun.'
      }
      else if (error.code === 'auth/unauthorized-domain') {
        description = 'Bu domain, Firebase projenizde yetkilendirilmemiş. Lütfen Firebase konsolundan yetkilendirin.';
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Giriş Başarısız',
        description: description,
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
            Devam etmek için Google ile giriş yapın.
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
        </div>
        <p className="px-8 text-center text-xs text-muted-foreground">
          Devam ederek, Hizmet Şartlarımızı kabul etmiş ve Gizlilik Politikamızı okumuş olursunuz.
        </p>
      </div>
    </div>
  );
}
