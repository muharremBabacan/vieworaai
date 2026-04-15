
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, SearchCode, AlertTriangle, Lightbulb } from 'lucide-react';
import { VieworaImage } from '@/core/components/viewora-image';
import { RatingBar } from './ui-utils';
import { normalizeScore, getOverallScore } from '../../services/photo-flow';

import type { User, Photo } from '@/types';

interface ResultStageProps {
  analysisResult: Photo;
  user: { uid: string } | null;
  guestId: string | null;
  resetAnalyzer: () => void;
  t: (key: string, values?: any) => string;
  tr: (key: string, values?: any) => string;
}

export const ResultStage = ({ analysisResult, user, guestId, resetAnalyzer, t, tr }: ResultStageProps) => {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <Badge variant="outline" className="px-3 h-6 border-primary/30 text-primary font-black uppercase tracking-widest text-[9px] rounded-full">{t('analysis_report_badge')}</Badge>
          <h1 className="text-4xl font-black tracking-tighter uppercase">{t('analysis_report_title')}</h1>
          {!user && guestId && (
              <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">
                Sanal Vizyon: <span className="text-primary">{guestId}</span>
              </p>
          )}
        </div>
        <Button onClick={resetAnalyzer} variant="ghost" className="rounded-xl font-bold text-muted-foreground"><RefreshCw size={16} className="mr-2" /> {t('button_new_analysis')}</Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Photo and Detailed Analysis */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-black/20">
            <VieworaImage
              variants={analysisResult.imageUrls}
              fallbackUrl={analysisResult.imageUrl}
              type="detailView"
              alt="Analiz"
              containerClassName="min-h-[400px]"
            />
          </Card>

          <Card className="p-8 rounded-[32px] border-border/40 bg-card/50 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><SearchCode size={20} /></div>
              <h3 className="text-lg font-black uppercase tracking-tight">{t('expert_analysis_title')}</h3>
            </div>
            
            <div className="space-y-6">
              {analysisResult.aiFeedback!.technical_details && (
                <>
                  <DetailSection label={t('expert_focus_label')} content={analysisResult.aiFeedback!.technical_details.focus} />
                  <DetailSection label={t('expert_light_label')} content={analysisResult.aiFeedback!.technical_details.light} />
                  <DetailSection label={t('expert_color_label')} content={analysisResult.aiFeedback!.technical_details.color} />
                  <DetailSection label={t('expert_composition_label')} content={analysisResult.aiFeedback!.technical_details.composition} />
                  <DetailSection label={t('expert_quality_label')} content={analysisResult.aiFeedback!.technical_details.technical_quality} />
                </>
              )}
            </div>

            <div className="pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetadataBox label={t('detail_genre')} value={analysisResult.aiFeedback!.genre} />
              <MetadataBox label={t('detail_scene')} value={analysisResult.aiFeedback!.scene} />
              <MetadataBox label={t('detail_subject')} value={analysisResult.aiFeedback!.dominant_subject} />
            </div>
          </Card>
        </div>

        {/* Right Side: Scores and Insights */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-8 rounded-[40px] border-primary/20 bg-primary/5 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center space-y-4 mb-10">
              <div className="flex gap-2">
                <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase tracking-widest">{analysisResult.aiFeedback!.general_quality}</Badge>
                <Badge variant="outline" className="border-primary/30 text-primary font-black text-[9px] uppercase tracking-widest">{analysisResult.aiFeedback!.expert_level}</Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">{t('overall_score')}</p>
                <div className="text-7xl font-black tracking-tighter text-primary">{getOverallScore(analysisResult).toFixed(1)}</div>
              </div>
            </div>

            <div className="space-y-6">
              <RatingBar label={tr('light')} score={normalizeScore(analysisResult.aiFeedback!.light_score)} />
              <RatingBar label={tr('composition')} score={normalizeScore(analysisResult.aiFeedback!.composition_score)} />
              <RatingBar label={tr('technical')} score={normalizeScore(analysisResult.aiFeedback!.technical_clarity_score)} />
              <RatingBar label={tr('storytelling')} score={normalizeScore(analysisResult.aiFeedback!.storytelling_score)} isLocked={analysisResult.analysisTier === 'start'} />
              <RatingBar label={tr('boldness')} score={normalizeScore(analysisResult.aiFeedback!.boldness_score)} isLocked={analysisResult.analysisTier === 'start'} />
            </div>
          </Card>

          {analysisResult.aiFeedback!.quality_note && !analysisResult.aiFeedback!.quality_note.toLowerCase().includes('uyarısı yok') && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-amber-600 leading-relaxed">{analysisResult.aiFeedback!.quality_note}</p>
            </div>
          )}

          <Card className="p-8 rounded-[32px] border-border/40 bg-card/50 space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-400" />
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('luma_note_title')}</h4>
            </div>
            <p className="text-base italic text-foreground/90 leading-relaxed font-medium">"{analysisResult.aiFeedback!.short_neutral_analysis}"</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

const DetailSection = ({ label, content }: { label: string; content: string }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{label}</p>
    <p className="text-sm font-medium leading-relaxed">{content}</p>
  </div>
);

const MetadataBox = ({ label, value }: { label: string; value: string | undefined }) => (
  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40">
    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-bold capitalize truncate">{value}</p>
  </div>
);
