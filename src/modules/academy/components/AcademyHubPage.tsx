'use client';
import { Award, BarChart3, Diamond } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

const academyLevels = [
  {
    name: 'Temel',
    icon: Award,
    titleKey: 'level_basic_title',
    descriptionKey: 'level_basic_description',
    href: '/academy/temel',
    unlocked: true,
  },
  {
    name: 'Orta',
    icon: BarChart3,
    titleKey: 'level_intermediate_title',
    descriptionKey: 'level_intermediate_description',
    href: '/academy/orta',
    unlocked: false,
  },
  {
    name: 'İleri',
    icon: Diamond,
    titleKey: 'level_advanced_title',
    descriptionKey: 'level_advanced_description',
    href: '/academy/ileri',
    unlocked: false,
  },
];

export default function AcademyHubPage() {
  const t = useTranslations('AcademyPage');

  return (
    <div className="container mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t('main_title')}</h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">{t('main_description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {academyLevels.map((level) => {
          const content = (
            <Card className={`flex flex-col h-full transition-all ${level.unlocked ? 'hover:border-primary hover:shadow-lg' : 'bg-muted/30'}`}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <level.icon className={`h-8 w-8 ${level.unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                  <CardTitle>{t(level.titleKey)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col">
                <CardDescription className="flex-grow">{t(level.descriptionKey)}</CardDescription>
                <Button asChild className="mt-6 w-full" disabled={!level.unlocked}>
                  <Link href={level.href}>{t('button_view_lessons')}</Link>
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

          const tooltipTextKey = level.name === 'Orta' ? 'tooltip_intermediate' : 'tooltip_advanced';

          return (
            <TooltipProvider key={level.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full cursor-not-allowed">
                    {content}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t(tooltipTextKey)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
