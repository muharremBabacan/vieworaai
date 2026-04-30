
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppConfig } from '@/components/AppConfigProvider';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { useRouter } from '@/navigation';

// Hooks
import { usePhotoAnalyzer } from '../../hooks/usePhotoAnalyzer';

// Components
import { UploadStage } from './UploadStage';
import { ProcessingStage } from './ProcessingStage';
import { ResultStage } from './ResultStage';
import { ResolutionDialog } from './ResolutionDialog';
import { MarketingModal } from './MarketingModal';
import { usePush } from '@/components/providers/PushProvider';
import { Bell, ShieldCheck } from 'lucide-react';
import { NotificationOnboarding } from '@/components/notifications/NotificationOnboarding';

// Constants
import { TIER_COSTS } from '../../services/photo-flow';

export type ModalType = 'none' | 'resolution' | 'marketing';

export default function PhotoAnalyzer() {
  const t = useTranslations('DashboardPage');
  const tr = useTranslations('Ratings');
  const { toast } = useToast();
  const router = useRouter();
  const { currencyName } = useAppConfig();
  const { permission, requestPermission } = usePush();
  
  const {
    status,
    file,
    preview,
    analysisResult,
    user,
    userProfile,
    isProfileLoading,
    guestId,
    guestPix,
    setGuestLastUsed,
    getRootProps,
    getInputProps,
    open,
    handleAction,
    reset
  } = usePhotoAnalyzer();

  const [modal, setModal] = useState<ModalType>('none');
  const [errorDims, setErrorDims] = useState<{ width: number; height: number } | null>(null);

  const analysisCost = TIER_COSTS[userProfile?.tier || 'start'] || 1;

  const onHandleAction = async (analyze: boolean) => {
    const result = await handleAction(analyze);
    if (!result) return;

    switch (result.type) {
      case 'success':
        // Status handled by hook ('done')
        break;
      
      case 'upload_only':
        toast({ title: t('toast_upload_only_title'), description: t('toast_upload_only_description') });
        router.push('/gallery');
        break;
      
      case 'marketing_required':
        setModal('marketing');
        break;
      
      case 'resolution_error':
        setErrorDims(result.dims);
        setModal('resolution');
        break;
      
      case 'error':
        if (result.code === 'INSUFFICIENT_BALANCE') {
          router.push('/pricing');
          break;
        }
        if (result.code === 'GUEST_LIMIT_REACHED') {
          setModal('marketing');
          break;
        }
        toast({ 
          variant: 'destructive', 
          title: t('toast_analysis_fail_title'), 
          description: t('toast_analysis_fail_description') 
        });
        break;
    }
  };

  if (isProfileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      
      <NotificationOnboarding />

      {status === 'done' && analysisResult && (
        <ResultStage 
          analysisResult={analysisResult} 
          user={user} 
          userProfile={userProfile}
          guestId={guestId}
          resetAnalyzer={reset} 
          t={t} 
          tr={tr} 
        />
      )}

      {status !== 'done' && file && (
        <ProcessingStage 
          preview={preview}
          status={status}
          user={user}
          userProfile={userProfile}
          guestPix={guestPix}
          analysisCost={analysisCost}
          currencyName={currencyName}
          handleAction={onHandleAction}
          resetAnalyzer={reset}
          open={open}
          t={t}
        />
      )}

      {status !== 'done' && !file && (
        <UploadStage 
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          open={open}
          t={t}
        />
      )}

      <ResolutionDialog 
        open={modal === 'resolution'}
        onOpenChange={(v) => !v && setModal('none')}
        dimensions={errorDims}
        onClose={() => { setModal('none'); reset(); }}
        t={t}
      />

      <MarketingModal 
        open={modal === 'marketing'}
        onOpenChange={(v) => !v && setModal('none')}
      />
    </div>
  );
}
