
'use client';
import { Award, BarChart3, Diamond, Lock, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Link } from '@/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { typography } from "@/lib/design/typography";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';
import { canAccess } from '@/lib/auth/canAccess';
import { useTranslations } from 'next-intl';

export default function AcademyHubPage() {
  const t = useTranslations('AcademyPage');
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const academyLevels = [
    {
      name: 'Temel',
      id: 'temel',
      gate: 'joinGroup',
      icon: Award,
      title: t('level_basic_title'),
      subtitle: 'Kameranızın temellerini öğrenin.',
      description: t('level_basic_description'),
      href: '/academy/temel',
      imageUrl: '/temel12a.jpg',
      features: ['Kamera temelleri', 'Pozlama üçgeni', 'Temel kompozisyon']
    },
    {
      name: 'Orta',
      id: 'orta',
      gate: 'academy',
      icon: BarChart3,
      title: t('level_intermediate_title'),
      subtitle: 'Tekniğinizi profesyonelleştirin.',
      description: t('level_intermediate_description'),
      href: '/academy/orta',
      imageUrl: '/temel13a.jpg',
      features: ['Tür bazlı çekim', 'Işık yönetimi', 'Görsel hikaye anlatımı']
    },
    {
      name: 'İleri',
      id: 'ileri',
      gate: 'challenge',
      icon: Diamond,
      title: t('level_advanced_title'),
      subtitle: 'Kendi sanatsal tarzınızı yaratın.',
      description: t('level_advanced_description'),
      href: '/academy/ileri',
      imageUrl: '/temel15a.jpg',
      features: ['Profesyonel ışık', 'Sanatsal stil', 'Marka konumlandırma']
    },
  ];

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-10 space-y-1">
        <p className={cn(typography.eyebrow, "ml-1")}>AKADEMİ</p>
        <h1 className={cn(typography.h1, "leading-none uppercase")}>{t('main_title')}</h1>
        <p className={cn(typography.subtitle, "opacity-80")}>{t('main_description')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {academyLevels.map((level) => {
          const unlocked = canAccess(userProfile, level.gate);

          const content = (
            <Card className={cn(
              "flex flex-col h-full rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all",
              unlocked
                ? "hover:border-primary/20"
                : "opacity-60 grayscale-[0.5] cursor-default"
            )}>
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src={level.imageUrl}
                  alt={level.title}
                  fill
                  className={cn(
                    "object-cover transition-transform duration-700",
                    unlocked && "group-hover:scale-110"
                  )}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className={cn(
                  "absolute -bottom-5 left-5 h-10 w-10 rounded-xl backdrop-blur-xl border border-white/10 flex items-center justify-center",
                  unlocked ? "bg-primary/20 text-primary" : "bg-muted/20 text-muted-foreground"
                )}>
                  <level.icon className="h-5 w-5" />
                </div>
                {!unlocked && (
                  <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60">
                    <Lock className="h-4 w-4" />
                  </div>
                )}
              </div>

              <CardContent className="pt-8 p-6 space-y-5 flex-grow flex flex-col">
                <div>
                  <h3 className={cn(typography.cardTitle, "uppercase leading-none")}>{level.title}</h3>
                  <p className={cn(typography.meta, "mt-1.5 leading-tight uppercase")}>{level.subtitle}</p>
                </div>

                <p className={typography.body}>
                  {level.description}
                </p>

                <ul className="space-y-2 flex-grow">
                  {level.features.map((feature, idx) => (
                    <li key={idx} className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                      <div className={cn("h-1 w-1 rounded-full", unlocked ? "bg-primary" : "bg-muted-foreground")} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild={unlocked}
                  className={cn(
                    typography.button,
                    "w-full rounded-xl h-11 transition-all",
                    unlocked
                      ? "bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30"
                      : "bg-secondary text-muted-foreground hover:bg-secondary"
                  )}
                  disabled={!unlocked}
                >
                  {unlocked ? (
                    <Link href={level.href}>{t('button_view_lessons')}</Link>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="h-3 w-3" /> Seviye Yetersiz
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
