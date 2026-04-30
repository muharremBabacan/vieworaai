import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, SearchCode, AlertTriangle, Lightbulb, Trophy } from 'lucide-react';
import { VieworaImage } from '@/core/components/viewora-image';
import { RatingBar } from './ui-utils';
import { normalizeScore, getOverallScore } from '../../services/photo-flow';

import type { User, Photo } from '@/types';

interface ResultStageProps {
  analysisResult: Photo;
  user: { uid: string } | null;
  userProfile: User | null;
  guestId: string | null;
  resetAnalyzer: () => void;
  t: (key: string, values?: any) => string;
  tr: (key: string, values?: any) => string;
}

export const ResultStage = ({ analysisResult, user, userProfile, guestId, resetAnalyzer, t, tr }: ResultStageProps) => {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <Badge variant="outline" className="px-3 h-6 border-primary/30 text-primary font-black uppercase tracking-widest text-[9px] rounded-full">{t('analysis_report_badge')}</Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter uppercase">{t('analysis_report_title')}</h1>
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
          <Card className="rounded-[40px] border-border/40 overflow-hidden shadow-2xl bg-black/5 relative aspect-square md:aspect-auto md:min-h-[500px]">
            <VieworaImage
              variants={analysisResult.imageUrls}
              fallbackUrl={analysisResult.imageUrl}
              type="detailView"
              alt="Analiz"
              containerClassName="absolute inset-0"
            />
          </Card>

          <Card className="p-5 md:p-8 rounded-[32px] border-border/40 bg-card/50 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><SearchCode size={20} /></div>
              <h3 className="text-lg font-black uppercase tracking-tight">{t('expert_analysis_title')}</h3>
            </div>
            
            <div className="space-y-6">
              {analysisResult.aiFeedback!.technical_details ? (
                <>
                  <DetailSection label={t('expert_focus_label')} content={analysisResult.aiFeedback!.technical_details.focus} />
                  <DetailSection label={t('expert_light_label')} content={analysisResult.aiFeedback!.technical_details.light} />
                  <DetailSection label={t('expert_color_label')} content={analysisResult.aiFeedback!.technical_details.color} />
                  <DetailSection label={t('expert_composition_label')} content={analysisResult.aiFeedback!.technical_details.composition} />
                  <DetailSection label={t('expert_quality_label')} content={analysisResult.aiFeedback!.technical_details.technical_quality} />
                </>
              ) : (
                <DetailSection label={t('expert_analysis_label')} content={analysisResult.aiFeedback!.short_neutral_analysis} />
              )}
            </div>

            <div className="pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <MetadataBox label={t('detail_genre')} value={analysisResult.aiFeedback!.genre || 'Genel'} />
              <MetadataBox label={t('detail_scene')} value={analysisResult.aiFeedback!.scene || 'Bilinmiyor'} />
              <MetadataBox label={t('detail_subject')} value={analysisResult.aiFeedback!.dominant_subject || 'Konu'} />
            </div>

            {/* 🏷️ Tags Section */}
            {analysisResult.aiFeedback!.tags && analysisResult.aiFeedback!.tags.length > 0 && (
              <div className="pt-6 border-t border-white/5 space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('tags_label')}</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.aiFeedback!.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="rounded-lg bg-white/5 hover:bg-white/10 border-none font-bold text-[10px] px-3 py-1 lowercase">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Side: Scores and Insights */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-5 md:p-8 rounded-[40px] border-primary/20 bg-primary/5 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center space-y-4 mb-10">
              <div className="flex flex-col items-center gap-2">
                {userProfile?.level_name && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    <Trophy className="h-3 w-3" /> {userProfile.level_name}
                  </div>
                )}
                <div className="flex gap-2">
                  <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase tracking-widest">{analysisResult.aiFeedback!.general_quality}</Badge>
                  <Badge variant="outline" className="border-primary/30 text-primary font-black text-[9px] uppercase tracking-widest">{analysisResult.aiFeedback!.expert_level}</Badge>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">{t('overall_score')}</p>
                <div className="text-7xl font-black tracking-tighter text-primary">{getOverallScore(analysisResult, analysisResult.analysisTier).toFixed(1)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 px-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Luma Report</h4>
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-60 border-primary/20 text-primary px-2 h-5">
                {analysisResult.analysisTier || 'start'} Tier
              </Badge>
            </div>
            <div className="space-y-6">
              {[
                { label: tr('light'), score: normalizeScore(analysisResult.aiFeedback!.light_score) },
                { label: tr('composition'), score: normalizeScore(analysisResult.aiFeedback!.composition_score) },
                { label: tr('technical'), score: normalizeScore(analysisResult.aiFeedback!.technical_clarity_score) },
                ...(analysisResult.analysisTier !== 'start' ? [
                  { label: tr('storytelling'), score: normalizeScore(analysisResult.aiFeedback!.storytelling_score) },
                  { label: tr('boldness'), score: normalizeScore(analysisResult.aiFeedback!.boldness_score) }
                ] : [])
              ].map(item => (
                <RatingBar key={item.label} label={item.label} score={item.score} />
              ))}
            </div>
          </Card>

          {analysisResult.aiFeedback!.quality_note && !analysisResult.aiFeedback!.quality_note.toLowerCase().includes('uyarısı yok') && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-amber-600 leading-relaxed">{analysisResult.aiFeedback!.quality_note}</p>
            </div>
          )}

          <Card className="p-5 md:p-8 rounded-[32px] border-border/40 bg-card/50 space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-400" />
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('luma_note_title')}</h4>
            </div>
            <p className="text-base italic text-foreground/90 leading-relaxed font-medium">"{analysisResult.aiFeedback!.short_neutral_analysis}"</p>
          </Card>

          {!user && (
            <Card className="p-8 rounded-[40px] border-primary/40 bg-primary/10 shadow-[0_32px_64px_-16px_rgba(var(--primary),0.3)] space-y-6 text-center animate-pulse-slow">
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter">Puanını Kaydetmek İster Misin?</h3>
                <p className="text-xs font-medium text-muted-foreground">Şimdi üye olursan bu analizi profilinde saklayabilir ve <span className="text-primary font-bold">20 Pix Hoş Geldin Hediyesi</span> kazanabilirsin!</p>
              </div>
              <Button asChild className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl">
                <a href="/login">Hemen Üye Ol ve Pix Kazan</a>
              </Button>
            </Card>
          )}
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
