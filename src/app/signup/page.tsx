'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { useFirebase } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft } from 'lucide-react';
import Logo from '@/core/components/logo';
import Link from 'next/link';
import { AuthService } from '@/lib/auth/auth-service';

function SignupForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || isLoading) return;

    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifreler eşleşmiyor.' });
      return;
    }

    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create user
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Ensure Firestore doc
      await AuthService.ensureUserDoc(firestore, result.user, name, 'email');
      
      // 3. Send verification
      await sendEmailVerification(result.user);
      
      // 4. Sign out (as they need to verify first)
      await signOut(auth);
      
      router.push('/verify-email');
    } catch (error: any) {
      console.error(error);
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
        'auth/invalid-email': 'Geçersiz e-posta formatı.',
        'auth/operation-not-allowed': 'E-posta kaydı şu an kapalı.',
        'auth/weak-password': 'Şifre çok zayıf.'
      };
      toast({
        variant: 'destructive',
        title: 'Kayıt Hatası',
        description: messages[error.code] || 'Hesap oluşturulurken bir hata oluştu.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 items-center justify-center">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-90" />
          <h1 className="text-3xl font-black tracking-tighter uppercase">Hesap Oluştur</h1>
          <p className="text-sm text-muted-foreground font-medium">Luma ile fotoğraf yolculuğuna başla.</p>
        </div>

        <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest ml-1">Adın</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" placeholder="Adınız" value={name} onChange={e => setName(e.target.value)} className="pl-10 h-12 rounded-2xl bg-muted/30" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest ml-1">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="ornek@mail.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12 rounded-2xl bg-muted/30" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest ml-1">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-12 rounded-2xl bg-muted/30" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest ml-1">Şifre Tekrar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-10 h-12 rounded-2xl bg-muted/30" required />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Üye Ol"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" asChild className="rounded-xl font-bold text-muted-foreground hover:text-primary transition-all">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Giriş Sayfasına Dön
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
