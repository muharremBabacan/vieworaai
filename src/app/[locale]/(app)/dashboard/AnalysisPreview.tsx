"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Props = {
  imageUrl: string;
};

export default function AnalysisPreview({ imageUrl }: Props) {
  const t = useTranslations("DashboardPage");

  const steps = [
    "Işık dengesi analiz ediliyor...",
    "Kompozisyon haritalanıyor...",
    "Netlik ölçülüyor...",
    "Renk dağılımı inceleniyor..."
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 2));
    }, 80);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="analysis-wrapper">

      <div className="image-wrapper">
        <Image
          src={imageUrl}
          alt="Analiz ediliyor"
          width={512}
          height={341}
          className="rounded-2xl analysis-image"
          priority
        />
        <div className="scan-line" />
      </div>

      <div className="analysis-text-container">
        <p className="analysis-text">
          {steps[stepIndex]}
        </p>

        <div className="analysis-progress-bar">
          <div
            className="analysis-progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

    </div>
  );
}