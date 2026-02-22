
'use client';
import PhotoAnalyzer from './photo-analyzer';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t('main_title')}</h1>
      <div className="mx-auto max-w-4xl">
        <PhotoAnalyzer />
      </div>
    </div>
  );
}
