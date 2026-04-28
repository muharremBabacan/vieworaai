'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/core/components/logo';
import { MailCheck, ArrowRight, ExternalLink, RefreshCcw, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useFirebase } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/shared/hooks/use-toast';

export default function VerifyEmailPage() {
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    console.log("🚀 [VerifyEmail] Butona basıldı!");
    
    if (!auth) {
      alert("Hata: Firebase Auth henüz hazır değil!");
      return;
    }

    if (!auth.currentUser) {
      console.error("❌ [VerifyEmail] Kullanıcı oturumu bulunamadı!", auth);
      alert("Hata: Oturum bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    setIsResending(true);
    try {
      console.log("📨 [VerifyEmail] Doğrulama maili gönderiliyor:", auth.currentUser.email);
      
      await sendEmailVerification(auth.currentUser);
      
      console.log("✅ [VerifyEmail] Mail başarıyla tetiklendi!");
      alert(`Başarılı! Doğrulama e-postası ${auth.currentUser.email} adresine gönderildi. Lütfen kutunuzu kontrol edin.`);
      
      toast({
        title: 'Başarılı',
        description: 'Doğrulama e-postası tekrar gönderildi.',
      });
    } catch (error: any) {
      console.error("❌ [VerifyEmail] Firebase Hatası:", error);
      alert("Firebase Hatası: " + (error.message || "Bilinmeyen hata"));
      
      let msg = 'E-posta gönderilirken bir hata oluştu.';
      if (error.code === 'auth/too-many-requests') {
        msg = 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.';
      }
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: msg,
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 items-center justify-center">
      <div className="w-full max-w-[450px] space-y-10 animate-in zoom-in duration-500 text-center">

        {/* Logo ve başlık */}
        <div className="flex flex-col items-center space-y-6">
          <Logo className="scale-90" />

          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-xl shadow-primary/5">
            <MailCheck size={48} className="animate-bounce" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              E-posta Gönderildi!
            </h1>

            <p className="text-muted-foreground font-medium text-lg px-4 leading-relaxed">
              <span className="text-foreground font-bold">{auth?.currentUser?.email}</span> adresinize bir doğrulama bağlantısı gönderildi.
              Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.
            </p>
          </div>
        </div>

        {/* Kart */}
        <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
          <CardContent className="p-10 space-y-6">

            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground/80">
                Doğrulamadan sonra ne yapmalıyım?
              </p>

              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                E-postanızdaki bağlantıya tıkladıktan sonra bu sayfaya geri dönüp giriş yapabilirsiniz.
              </p>
            </div>

            <div className="pt-4 space-y-3">

              {/* LOGIN BUTONU */}
              <Button
                asChild
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                <Link href="/login">
                  Giriş Yap
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              {/* TEKRAR GÖNDER BUTONU */}
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={isResending}
                className="w-full h-12 rounded-2xl font-bold border-primary/20 hover:bg-primary/5 transition-all"
              >
                {isResending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                Tekrar Gönder
              </Button>

              {/* MAIL AÇ */}
              <Button
                variant="ghost"
                asChild
                className="w-full h-12 rounded-2xl font-bold text-muted-foreground"
              >
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gelen Kutusunu Aç
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>

            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-loose">
          Türkiye’de geliştirilen küresel bir fotoğraf platformu.
        </p>

      </div>
    </div>
  );
}