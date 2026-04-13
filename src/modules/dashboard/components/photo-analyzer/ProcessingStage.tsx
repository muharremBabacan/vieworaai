import Image from 'next/image';
import { RefreshCw, Loader2, Sparkles, Camera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanningOverlay } from './ui-utils';

export const ProcessingStage = ({ 
  preview, isLoading, isProcessing, loadingType, user, userProfile, 
  analysisCost, currencyName, handleAction, resetAnalyzer, open, t 
}: any) => {
  return (
    <Card className="p-12 text-center rounded-[48px] border-border/40 bg-card/50 backdrop-blur-sm relative overflow-hidden">
      {(isLoading || isProcessing) && (
        <ScanningOverlay
          label={isProcessing ? t('state_processing') : loadingType === 'analyze' ? t('state_analyzing') : t('state_uploading')}
        />
      )}
      
      <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12 bg-black/5">
        <div className="absolute inset-0 scale-125 blur-3xl opacity-30 select-none pointer-events-none">
          <Image src={preview!} alt="" fill sizes="10vw" className="object-cover" />
        </div>
        <Image src={preview!} alt="Preview" fill sizes="(max-width: 1024px) 100vw, 800px" className="relative z-10 object-contain transition-all duration-700" />
        
        <button 
          onClick={resetAnalyzer}
          className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-all"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-6">
        {userProfile && (userProfile.pix_balance < analysisCost) && (
          <p className="text-sm text-red-500 font-black uppercase tracking-widest animate-pulse">
            {t('label_insufficient_balance')}
          </p>
        )}
        
        <div className="flex flex-col sm:flex-row justify-center gap-5 w-full max-w-2xl">
          <Button
            onClick={() => handleAction(true)}
            disabled={!!(isLoading || isProcessing || (user && (!userProfile || userProfile.pix_balance < analysisCost)))}
            className="flex-1 h-16 rounded-[20px] text-lg font-black uppercase tracking-wider group relative overflow-hidden"
          >
            {isLoading && loadingType === 'analyze' ? (
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-6 w-6 mr-2 group-hover:scale-125 transition-transform" />
            )}
            <span>
              {(user && userProfile && userProfile.pix_balance < analysisCost)
                ? t('button_analyze_insufficient', { cost: analysisCost, currency: currencyName })
                : t('button_analyze', { cost: analysisCost, currency: currencyName })}
            </span>
          </Button>

          <Button
            onClick={() => handleAction(false)}
            disabled={isLoading || isProcessing}
            variant="outline"
            className="flex-1 h-16 rounded-[20px] text-lg font-black uppercase tracking-wider border-2"
          >
            {isLoading && loadingType === 'upload' ? (
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
            ) : (
              <Camera className="h-6 w-6 mr-2" />
            )}
            <span>{t('button_upload_only')}</span>
          </Button>
        </div>

        <button 
          onClick={() => {
            resetAnalyzer();
            setTimeout(() => open(), 100);
          }}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-primary transition-colors mt-4"
        >
          {t('button_change_photo') || "Fotoğrafı Değiştir"}
        </button>
      </div>
    </Card>
  );
};
