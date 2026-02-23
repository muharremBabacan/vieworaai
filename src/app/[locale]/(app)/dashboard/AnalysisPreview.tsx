"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
  imageUrl: string;
};

// As per user request, texts to cycle through
const analysisSteps = [
  "Işık dengesi analiz ediliyor...",
  "Kompozisyon haritalanıyor...",
  "Netlik ölçülüyor...",
  "Renk dağılımı inceleniyor..."
];

export default function AnalysisPreview({ imageUrl }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Cycle through steps every 2 seconds
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % analysisSteps.length);
    }, 2000);

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Image container as per design - size updated to be more minimal */}
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-black">
        <Image 
          src={imageUrl} 
          alt="Analiz ediliyor" 
          width={720} 
          height={480} 
          className="w-full h-auto block" 
          priority
        />
        {/* The scanning line animated via CSS */}
        <div className="scan-line" />
      </div>

      {/* Dynamic text area */}
      <div className="h-7 text-base text-white/75 font-medium text-center">
        {/* Using key to re-trigger animation on text change */}
        <p key={currentStep} className="analysis-text">
          {analysisSteps[currentStep]}
        </p>
      </div>
    </div>
  );
}
