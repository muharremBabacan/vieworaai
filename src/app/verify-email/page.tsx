'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/core/components/logo';
import { MailCheck, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background p-4 items-center justify-center">
      <div className="w-full max-w-[450px] space-y-10 animate-in zoom-in duration-500 text-center">
        <div className="flex flex-col items-center space-y-6">
          <Logo className="scale-90" />
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-xl shadow-primary/5">
            <MailCheck size={48} className="animate-bounce" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tighter uppercase">E-posta Gönderildi!</h1>
            <p className="text-muted-foreground font-medium text-lg px-4 leading-relaxed">
              Email adresinize bir doğrulama bağlantısı gönderildi. Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.
            </p>
          </div>
        </div>

        <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
          <CardContent className="p-10 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground/80">Doğrulamadan sonra ne yapmalıyım?</p>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                E-postanızdaki bağlantıya tıkladıktan sonra bu sayfaya geri dönüp giriş yapabilirsiniz.
              </p>
            </div>
            
            <div className="pt-4 space-y-3">
              <Button asChild className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                <Link href="/login">
                  Giriş Yap <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              
              <Button variant="ghost" asChild className="w-full h-12 rounded-2xl font-bold text-muted-foreground">
                <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer">
                  Gelen Kutusunu Aç <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-loose">
          Türkiye’de geliştirilen küresel bir fotoğraf platformu.
        </p>
      </div>
    </div>
  );
}
