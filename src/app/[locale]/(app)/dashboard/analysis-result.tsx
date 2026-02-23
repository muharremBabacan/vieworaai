'use client';

import Image from 'next/image';
import type { PhotoAnalysis } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const normalizeScore = (score: number | undefined | null): number => {
  if (score === undefined || score === null || !isFinite(score)) return 0;
  return score > 1 ? score : score * 10;
};

const ScoreBar = ({ label, score }: { label: string; score: number }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{score.toFixed(1)}</span>
    </div>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Progress
            value={score * 10}
            className="h-2 [&>div]:bg-primary transition-all duration-1000 ease-out"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{score.toFixed(2)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

export function AnalysisResult({
  analysis,
  feedback,
  photoPreviewUrl,
  onNewAnalysis
}: {
  analysis: PhotoAnalysis,
  feedback: string,
  photoPreviewUrl: string,
  onNewAnalysis: () => void
}) {

  const t = useTranslations('DashboardPage');
  const tRatings = useTranslations('Ratings');

  const lightScore = normalizeScore(analysis.light_score);
  const compositionScore = normalizeScore(analysis.composition_score);

  const technicalScores = [
    normalizeScore(analysis.focus_score),
    normalizeScore(analysis.color_control_score),
    normalizeScore(analysis.background_control_score),
    normalizeScore(analysis.creativity_risk_score),
  ];

  const technicalScore =
    technicalScores.reduce((sum, score) => sum + score, 0) /
    technicalScores.length;

  const mainScores = [lightScore, compositionScore, technicalScore];
  const overallScore =
    mainScores.reduce((sum, score) => sum + score, 0) /
    mainScores.length;

  return (
    <div className="space-y-6">

      <Card className="overflow-hidden backdrop-blur-md bg-background/60 border border-white/5 shadow-xl">

        <div className="md:grid md:grid-cols-2">

          {/* FOTO ALANI */}
          <div className="relative aspect-[4/3] bg-muted/20 rounded-xl overflow-hidden group">

            {/* Glow */}
            <div className="absolute inset-0 pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)] before:blur-3xl"></div>

            <Image
              src={photoPreviewUrl}
              alt="Analyzed photo"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain transition-transform duration-700 group-hover:scale-[1.02]"
            />
          </div>

          {/* SKOR ALANI */}
          <div className="flex flex-col p-6">

            <CardTitle className="font-sans text-xl mb-4">
              {t('rating_card_title')}
            </CardTitle>

            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-semibold">
                {t('overall_score')}
              </span>

              <span className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                {overallScore.toFixed(1)}
              </span>
            </div>

            <div className="space-y-5 flex-grow">
              <ScoreBar label={tRatings('lighting')} score={lightScore} />
              <ScoreBar label={tRatings('composition')} score={compositionScore} />
              <ScoreBar label={tRatings('technical')} score={technicalScore} />
            </div>

          </div>
        </div>

        {/* AI ANALİZ YORUMU */}
        <div className="p-6 border-t border-white/5">

          <h3 className="font-sans text-lg font-semibold flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            {t('ai_analysis_title')}
          </h3>

          <div className="relative pl-4 border-l border-primary/40 text-muted-foreground leading-relaxed whitespace-pre-wrap">
            <div
              dangerouslySetInnerHTML={{
                __html: feedback
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br />')
              }}
            />
          </div>

        </div>
      </Card>

      <Button
        onClick={onNewAnalysis}
        variant="outline"
        className="w-full border-primary/40 hover:bg-primary/10 transition-all"
        size="lg"
      >
        {t('button_new_analysis')}
      </Button>

    </div>
  );
}