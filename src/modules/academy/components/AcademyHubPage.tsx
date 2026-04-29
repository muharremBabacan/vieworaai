
'use client';
import { Award, BarChart3, Diamond, Lock, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { typography } from "@/lib/design/typography";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';
import { canAccess } from '@/lib/auth/canAccess';
import { useTranslations } from 'next-intl';

export default function AcademyHubPage() {
  const t = useTranslations('AcademyPage');
  const { user, uid } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (uid && firestore) ? doc(firestore, 'users', uid) : null, [uid, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const academyLevels = [
    {
      name: 'Ortaokul',
      id: 'temel',
      code: 'V-101',
      gate: 'joinGroup',
      icon: Award,
      title: t('level_basic_title'),
      subtitle: 'TEMEL EĞİTİM',
      description: t('level_basic_description'),
      href: '/academy/temel',
      imageUrl: '/temel12a.jpg',
      features: ['Kamera Temelleri', 'Pozlama 101', 'Bakış Açısı']
    },
    {
      name: 'Lise',
      id: 'orta',
      code: 'V-201',
      gate: 'academy',
      icon: BarChart3,
      title: t('level_intermediate_title'),
      subtitle: 'TEKNİK UZMANLIK',
      description: t('level_intermediate_description'),
      href: '/academy/orta',
      imageUrl: '/temel13a.jpg',
      features: ['Tür Bazlı Çekim', 'Işık Yönetimi', 'Görsel Dil']
    },
    {
      name: 'Üniversite',
      id: 'ileri',
      code: 'V-301',
      gate: 'challenge',
      icon: Diamond,
      title: t('level_advanced_title'),
      subtitle: 'SANATSAL GELİŞİM',
      description: t('level_advanced_description'),
      href: '/academy/ileri',
      imageUrl: '/temel15a.jpg',
      features: ['Profesyonel Işık', 'Sanatsal Üslup', 'Küratörlük']
    },
  ];

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-10 space-y-1">
        <p className={cn(typography.eyebrow, "ml-1")}>AKADEMİ</p>
        <h1 className={cn(typography.h1, "leading-none uppercase")}>{t('main_title')}</h1>
        <p className={cn(typography.subtitle, "opacity-80")}>{t('main_description')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {academyLevels.map((level) => {
          const unlocked = !user ? level.id === 'temel' : canAccess(userProfile, level.gate);

          const content = (
            <Card className={cn(
              "flex flex-col h-full rounded-[40px] overflow-hidden border-border/40 bg-card/40 backdrop-blur-sm shadow-2xl group transition-all duration-500",
              unlocked
                ? "hover:border-primary/40 hover:shadow-primary/10 hover:-translate-y-1"
                : "opacity-60 grayscale-[0.5] cursor-default"
            )}>
              <div className="relative h-44 w-full overflow-hidden">
                <img 
                  src={level.imageUrl}
                  alt={level.title}
                  className={cn(
                    "object-cover w-full h-full transition-transform duration-1000",
                    unlocked && "group-hover:scale-105"
                  )}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                   <span className="text-[10px] font-black tracking-widest text-primary">{(level as any).code}</span>
                </div>

                {!unlocked && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 border border-white/10">
                        <Lock className="h-5 w-5" />
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="pt-6 p-6 space-y-4 flex-grow flex flex-col">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <level.icon className={cn("h-4 w-4", unlocked ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{level.subtitle}</span>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{level.title}</h3>
                </div>

                <p className="text-xs font-semibold text-muted-foreground leading-relaxed line-clamp-2">
                  {level.description}
                </p>

                <div className="space-y-2 flex-grow pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Kazanımlar:</p>
                  <ul className="space-y-1.5">
                    {level.features.map((feature, idx) => (
                      <li key={idx} className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight", unlocked ? "text-foreground" : "text-muted-foreground")}>
                        <div className={cn("h-1 w-1 rounded-full", unlocked ? "bg-primary" : "bg-muted-foreground")} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  asChild={unlocked}
                  className={cn(
                    "w-full rounded-2xl h-11 font-black uppercase tracking-widest text-[10px] transition-all duration-500",
                    unlocked
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40"
                      : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
                  )}
                  disabled={!unlocked}
                >
                  {unlocked ? (
                    <Link href={level.href}>{t('button_view_lessons')}</Link>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" /> Seviye Yetersiz
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          );

          if (unlocked) {
            return (
              <div key={level.id} className="h-full">
                {content}
              </div>
            );
          }

          const tooltipText = level.id === 'orta'
            ? t('tooltip_intermediate')
            : t('tooltip_advanced');

          return (
            <TooltipProvider key={level.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full">
                    {content}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl border-border/40 bg-background/95 backdrop-blur-xl">
                  <p className={cn(typography.meta, "font-bold uppercase tracking-widest p-1")}>{tooltipText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      <div className="mt-16 p-8 rounded-[40px] border-2 border-dashed border-border/40 bg-muted/5 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-bottom-4 duration-1000 delay-200">
        <div className="space-y-2 text-center md:text-left">
          <h4 className={cn(typography.cardTitle, "text-2xl font-black uppercase")}>{t('journey_title')}</h4>
          <p className={cn(typography.body, "max-w-md")}>{t('journey_desc')}</p>
        </div>
        <div className="flex items-center gap-4 bg-background/50 p-6 rounded-3xl border border-border/40 shadow-inner">
          <GraduationCap className="h-10 w-10 text-primary" />
          <div>
            <p className={typography.eyebrow}>{t('status_label')}</p>
            <p className={cn(typography.cardTitle, "text-lg font-black uppercase")}>{t('status_value')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
