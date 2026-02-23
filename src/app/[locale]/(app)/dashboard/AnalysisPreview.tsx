"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

type Props = {
  imageUrl: string;
};

export default function AnalysisPreview({ imageUrl }: Props) {
  const t = useTranslations('DashboardPage');
  
  return (
    <div className="analysis-wrapper">
      <div className="image-wrapper">
        <Image 
            src={imageUrl} 
            alt="Analiz ediliyor" 
            width={512} 
            height={341}
            className="rounded-2xl"
            priority
        />
      </div>

      <div className="analysis-text-container">
        <p className="analysis-text">{t('state_analyzing')}</p>
        <div className="analysis-progress-bar">
            <div className="analysis-progress-bar-fill"></div>
        </div>
      </div>
    </div>
  );
}
