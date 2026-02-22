'use client';
import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CompetitionsPage() {
  const t = useTranslations('CompetitionsPage');

  return (
    <div className="container mx-auto">
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
            <Trophy className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-2xl font-semibold">{t('coming_soon_title')}</h3>
            <p className="text-muted-foreground mt-2">{t('coming_soon_description')}</p>
        </div>
    </div>
  );
}
