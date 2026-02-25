'use client';
import { Award, BarChart3, Diamond } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';

const academyLevels = [
  {
    name: 'Temel',
    icon: Award,
    title: 'Temel Seviye',
    description: 'Kameranızın temellerini öğrenin, pozlamayı anlayın ve temel kompozisyon kurallarında ustalaşın.',
    href: '/academy/temel',
    unlocked: true,
  },
  {
    name: 'Orta',
    icon: BarChart3,
    title: 'Orta Seviye',
    description: 'Farklı türlerde çekim yapın, gelişmiş teknikleri uygulayın ve ışığı bilinçli bir şekilde yönetin.',
    href: '/academy/orta',
    unlocked: false,
  },
  {
    name: 'İleri',
    icon: Diamond,
    title: 'İleri Seviye',
    description: 'Kendi sanatsal tarzınızı yaratın, profesyonel ışık kurulumlarını öğrenin ve fotoğrafçılıkta uzmanlaşın.',
    href: '/academy/ileri',
    unlocked: false,
  },
];

export default function AcademyHubPage() {
  return (
    <div className="container mx-auto px-4">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Viewora Akademi</h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">Fotoğrafçılık bilginizi temelden ustalığa taşıyın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {academyLevels.map((level) => {
          const content = (
            <Card className={`flex flex-col h-full transition-all ${level.unlocked ? 'hover:border-primary hover:shadow-lg' : 'bg-muted/30'}`}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <level.icon className={`h-8 w-8 ${level.unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                  <CardTitle>{level.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col">
                <CardDescription className="flex-grow">{level.description}</CardDescription>
                <Button asChild className="mt-6 w-full" disabled={!level.unlocked}>
                  <Link href={level.href}>Dersleri Gör</Link>
                </Button>
              </CardContent>
            </Card>
          );

          if (level.unlocked) {
            return (
              <div key={level.name} className="h-full">
                {content}
              </div>
            );
          }

          const tooltipText = level.name === 'Orta' ? 'Orta Seviye — İlerlemeye devam et, kilit açılıyor.' : 'İleri Seviye için Uzman içerik. Kilidi açmak için gelişimine devam et.';

          return (
            <TooltipProvider key={level.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full cursor-not-allowed">
                    {content}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltipText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
