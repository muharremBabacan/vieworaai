'use client';
import {
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';

import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useRouter, Link } from '@/navigation';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth, useFirestore } from '@/firebase';
import type { User as UserProfile, PublicUserProfile } from '@/types';

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
  const t = useTranslations('LoginPage');

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

      const result: UserCredential = await signInWithPopup(auth, provider);

      toast({
        title: t('toast_success'),
      });

      const firebaseUser = result.user;
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const publicProfileRef = doc(firestore, 'public_profiles', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        const newUserProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || `user+${firebaseUser.uid}@viewora.ai`,
          name: firebaseUser.displayName || t('anonymous_artist'),
          photoURL: firebaseUser.photoURL,
          auro_balance: 20,
          current_xp: 0,
          level_name: 'Neuner',
          is_mentor: false,
          weekly_free_refill_date: new Date().toISOString(),
          completed_modules: [],
          interests: [],
          onboarded: false,
          groups: [],
        };
        const publicProfile: PublicUserProfile = {
            name: newUserProfile.name,
            photoURL: newUserProfile.photoURL,
            level_name: newUserProfile.level_name,
        };
        
        await setDoc(userRef, newUserProfile);
        await setDoc(publicProfileRef, publicProfile);
      } else {
         const existingProfile = docSnap.data() as UserProfile;
         const publicProfileUpdate: PublicUserProfile = {
            name: firebaseUser.displayName || existingProfile.name,
            photoURL: firebaseUser.photoURL || existingProfile.photoURL,
            level_name: existingProfile.level_name
         };
         await setDoc(publicProfileRef, publicProfileUpdate, { merge: true });
      }

      const onboarded = docSnap.exists() ? (docSnap.data() as any).onboarded : false;

      router.push(onboarded ? '/profile' : '/onboarding', { locale: auth.currentUser?.languageCode || undefined });

    } catch (error: any) {
      console.error('Popup login error:', error);
      toast({
        variant: 'destructive',
        title: t('toast_error_title', { code: error.code || 'Hata' }),
        description: t('toast_error_description'),
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
            <p className="!mt-3 text-center text-xs text-muted-foreground">
              "Türkiye'de geliştirilen global fotoğrafçılık eğitimi ve koçluğu
              platformu"
            </p>
            <h1 className="!mt-6 text-2xl font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('description')}
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
                {t('button_loading')}
              </>
            ) : (
              <>
                <GoogleIcon />
                {t('button_google')}
              </>
            )}
          </Button>

          <p className="px-8 text-center text-xs text-muted-foreground">
            {t('terms_prefix')}{' '}
            <Link href="/terms" className="underline">
              {t('terms_link')}
            </Link>{' '}
            {t('terms_suffix')}
          </p>
        </div>
      </main>
    </div>
  );
}

    