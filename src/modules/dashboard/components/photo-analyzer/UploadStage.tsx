
import { Camera, Sparkles, GraduationCap, Trophy, Users, Brain } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const UploadStage = ({ getRootProps, getInputProps, open, t }: any) => {
  return (
    <div className="max-w-6xl mx-auto space-y-16">
      <div {...getRootProps()} className="relative p-10 md:p-16 border-2 border-dashed border-border/60 rounded-[48px] bg-card/30 hover:bg-card/40 transition-all group shadow-inner">
        <input {...getInputProps()} />
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="text-center md:text-left space-y-4 max-w-md">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">{t('upload_section_title')}</h2>
            <p className="text-xl md:text-2xl font-bold text-muted-foreground">{t('upload_section_subtitle')}</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><Camera className="text-primary" size={40} /></div>
            <Button onClick={open} className="px-12 h-14 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-95">{t('button_select_photo')}</Button>
          </div>
        </div>
      </div>

      <div className="space-y-12 pb-12 mt-16 border-t border-border/20 pt-16">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t('platform_title')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <FeatureCard icon={Sparkles} title={t('platform_card_1_title')} desc={t('platform_card_1_desc')} color="primary" />
          <FeatureCard icon={GraduationCap} title={t('platform_card_2_title')} desc={t('platform_card_2_desc')} color="blue-500" />
          <FeatureCard icon={Trophy} title={t('platform_card_3_title')} desc={t('platform_card_3_desc')} color="amber-500" />
          <FeatureCard icon={Users} title={t('platform_card_4_title')} desc={t('platform_card_4_desc')} color="indigo-500" />
          <FeatureCard icon={Brain} title={t('platform_card_5_title')} desc={t('platform_card_5_desc')} color="rose-500" />
        </div>

        <div className="text-center pt-8 border-t border-border/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {t('platform_footer')}
          </p>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, color }: any) => (
  <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
    <div className={`h-14 w-14 rounded-2xl bg-${color}/10 flex items-center justify-center text-${color} group-hover:scale-110 transition-transform`}>
      <Icon size={28} />
    </div>
    <div className="space-y-2">
      <h3 className="font-black uppercase tracking-tight text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </Card>
);
