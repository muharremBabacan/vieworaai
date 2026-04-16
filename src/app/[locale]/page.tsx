'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/core/components/logo';
import { Camera, Brain, Globe, Users, Star, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const t = useTranslations('LandingPage');

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Background Overlay with Image */}
        <div 
          className="absolute inset-0 z-0 opacity-60 mix-blend-screen bg-cover bg-center"
          style={{ backgroundImage: 'url("/hero-bg.png")' }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0A0A0B]/50 to-[#0A0A0B]" />
        
        {/* Animated Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse delay-700" />

        <div className="relative z-10 max-w-4xl space-y-8 animate-fade-in">
          <Logo className="scale-125 mx-auto mb-8 animate-slide-up" />
          
          <div className="space-y-4">
            <Badge variant="outline" className="px-4 py-1 border-primary/30 text-primary bg-primary/5 backdrop-blur-sm animate-slide-up [animation-delay:200ms]">
              VİZYONUNU USTALIĞA TAŞI
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] animate-slide-up [animation-delay:400ms]">
              Görsel Dünyanı <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-progress-fast">
                Yapay Zekâ
              </span> <br />
              İle Keşfet
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium animate-slide-up [animation-delay:600ms]">
              {t('platform_footer')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:800ms]">
            <Button asChild size="lg" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-lg shadow-2xl shadow-primary/20 group">
              <Link href="/login">
                Hemen Başla <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-lg border-2 bg-background/20 backdrop-blur-md">
              <Link href="/explore">Keşfet</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 relative z-10 bg-[#0A0A0B]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase">{t('platform_title')}</h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Brain className="w-8 h-8 text-primary" />}
              title={t('platform_card_1_title')}
              desc={t('platform_card_1_desc')}
            />
            <FeatureCard 
              icon={<Camera className="w-8 h-8 text-accent" />}
              title={t('platform_card_2_title')}
              desc={t('platform_card_2_desc')}
            />
            <FeatureCard 
              icon={<Globe className="w-8 h-8 text-yellow-500" />}
              title={t('platform_card_3_title')}
              desc={t('platform_card_3_desc')}
            />
            <FeatureCard 
              icon={<Users className="w-8 h-8 text-blue-400" />}
              title={t('platform_card_4_title')}
              desc={t('platform_card_4_desc')}
            />
            <FeatureCard 
              icon={<Star className="w-8 h-8 text-primary" />}
              title={t('platform_card_5_title')}
              desc={t('platform_card_5_desc')}
            />
            <div className="hidden lg:flex items-center justify-center p-8 bg-primary/5 rounded-[40px] border border-primary/10 border-dashed">
               <p className="text-sm font-bold text-center opacity-40 uppercase tracking-widest leading-relaxed">
                 Geleceğin Fotoğraf <br /> Platformunda <br /> Yerini Al
               </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/40 text-center opacity-60">
        <Logo className="scale-75 mx-auto mb-4 grayscale" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} VIEWORA AI. TÜM HAKLARI SAKLIDIR.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group p-8 rounded-[40px] border border-border/40 bg-card/30 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5">
      <div className="mb-6 p-4 rounded-2xl bg-background/50 inline-block group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <h3 className="text-xl font-black tracking-tight mb-2 uppercase">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm font-medium">{desc}</p>
    </div>
  );
}