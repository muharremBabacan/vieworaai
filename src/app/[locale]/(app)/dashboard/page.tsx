'use client';
import PhotoAnalyzer from './photo-analyzer';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  return (
    <div className="container mx-auto">
      <div className="mx-auto max-w-4xl">
        <PhotoAnalyzer />
      </div>
    </div>
  );
}
