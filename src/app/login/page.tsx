'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import Logo from '@/core/components/logo';
import Link from 'next/link';
import { AuthService } from '@/lib/auth/auth-service';
import type { User as UserProfile } from '@/types';

function LoginForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const processAuroRefillAndStats = async (userId: string, existingProfile: UserProfile) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userId);
    
    // Stats Reconciliation
    const publicPhotosSnap = await getDocs(query(collection(firestore, 'public_photos'), where('userId', '==', userId)));
    if (existingProfile.total_exhibitions_count !== publicPhotosSnap.size) {
      batch.update(userRef, { total_exhibitions_count: publicPhotosSnap.size });
    }

    // Weekly Refill Logic
    const now = new Date();
    const lastRefillDate = existingProfile.weekly_free_refill_date ? new Date(existingProfile.weekly_free_refill_date) : new Date(0);
    const msInWeek = 7 * 24 * 60 * 60 * 1000;

    if (now.getTime() - lastRefillDate.getTime() >= msInWeek) {
      if (existingProfile.auro_balance < 20) {
        const giftAmount = Math.min(5, 20 - existingProfile.auro_balance);
        if (giftAmount > 0) {
          batch.update(userRef, { auro_balance: increment(giftAmount), weekly_free_refill_date: now.toISOString() });
          const logRef = doc(collection(firestore, 'analysis_logs'));
          batch.set(logRef, { id: logRef.id, userId, userName: existingProfile.name || 'Vizyoner', type: 'gift', auroSpent: -giftAmount, timestamp: now.toISOString(), status: 'success' });
        }
      } else {
        batch.update(userRef, { weekly_free_refill_date: now.toISOString() });
      }
    }
    
    await batch.commit();
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result: UserCredential = await signInWithPopup(auth, provider);
      const profile = await AuthService.ensureUserDoc(firestore, result.user, undefined, 'google');
      
      await updateDoc(doc(firestore, 'users', result.user.uid), { lastLoginAt: new Date().toISOString() });
      await processAuroRefillAndStats(result.user.uid, profile);
      
      router.push('/dashboard');
    } catch (error: any) {
      console.warn("Google Sign-In Error:", error.code);
      toast({
        variant: 'destructive',
        title: 'Giriş Başarısız',
        description: error.code === 'auth/popup-blocked' ? 'Pop-up pencerelere izin verin.' : 'Google ile giriş yapılırken bir hata oluştu.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      if (!result.user.emailVerified) {
        toast({
          variant: 'destructive',
          title: 'E-posta Doğrulanmamış',
          description: 'Lütfen e-posta adresinizi doğrulamadan giriş yapamazsınız.',
        });
        await auth.signOut();
        setIsLoading(false);
        return;
      }

      const profile = await AuthService.ensureUserDoc(firestore, result.user);
      await updateDoc(doc(firestore, 'users', result.user.uid), { lastLoginAt: new Date().toISOString() });
      await processAuroRefillAndStats(result.user.uid, profile);
      
      router.push('/dashboard');
    } catch (error: any) {
      console.warn("Email Sign-In Error:", error.code);
      
      if (error.code === 'auth/user-not-found') {
        router.push(`/signup?email=${encodeURIComponent(email)}`);
      } else {
        const messages: Record<string, string> = {
          'auth/wrong-password': 'Şifre hatalı.',
          'auth/invalid-email': 'Geçersiz e-posta formatı.',
          'auth/user-disabled': 'Kullanıcı hesabı askıya alınmış.',
          'auth/invalid-credential': 'E-posta veya şifre hatalı.'
        };
        toast({
          variant: 'destructive',
          title: 'Giriş Hatası',
          description: messages[error.code] || 'Bir hata oluştu. Lütfen tekrar deneyin.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 items-center justify-center">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-90" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
              Türkiye’de geliştirilen; fotoğrafları yapay zekâ ile analiz ederek kullanıcıların öğrenmesini, gelişmesini ve paylaşmasını sağlayan küresel bir fotoğraf platformudur.
            </p>
            <h1 className="text-3xl font-black tracking-tighter uppercase pt-4">Giriş Yap</h1>
          </div>
        </div>

        <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <Button variant="outline" className="w-full h-12 rounded-2xl font-bold border-2" onClick={handleGoogleSignIn} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Google ile Devam Et"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-background px-2 text-muted-foreground">Veya E-posta</span></div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest ml-1">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="ornek@mail.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="pl-10 h-12 rounded-2xl bg-muted/30" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest ml-1">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="pl-10 h-12 rounded-2xl bg-muted/30" 
                    required 
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Giriş Yap"}
              </Button>
            </form>
            
            <div className="text-center space-y-4 pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Hesabın yok mu?{' '}
                <Link href="/signup" className="text-primary font-bold hover:underline">Üye Ol</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="px-8 text-center text-[10px] text-muted-foreground leading-relaxed">
          Giriş yaparak veya hesap oluşturarak{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-primary font-bold">Hizmet Şartları</Link>
          {' '}ve{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-primary font-bold">Gizlilik Politikası</Link>
          ’nı kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
