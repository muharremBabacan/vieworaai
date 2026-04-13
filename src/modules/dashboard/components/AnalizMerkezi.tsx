
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo } from '@/types';
import { Loader2, AlertTriangle, Sparkles, Gem, RefreshCw, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { getImageDimensions } from '@/lib/image/image-processing-final';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

// Modular Imports
import { executePhotoAnalysisFlow, TIER_COSTS } from '../services/photo-flow';
import { UploadStage } from './photo-analyzer/UploadStage';
import { ProcessingStage } from './photo-analyzer/ProcessingStage';
import { ResultStage } from './photo-analyzer/ResultStage';

export default function PhotoAnalyzer() {
  const t = useTranslations('DashboardPage');
  const tr = useTranslations('Ratings');
  const locale = useLocale();
  const { toast } = useToast();
  const { user } = useUser();
  
  // 🔥 Final Cache Bust v3.2.5
  useEffect(() => { console.log('Analiz Merkezi v3.2.5 Live (Atomic Fix)'); }, []);

  const firestore = useFirestore();
  const router = useRouter();
  const { currencyName } = useAppConfig();

  // --- Core State ---
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingType, setLoadingType] = useState<'upload' | 'analyze'>('analyze');
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);
  
  // --- Modals State ---
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
  
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestLastUsed, setGuestLastUsed] = useState<number | null>(null);

  const GUEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGuestId(localStorage.getItem('guest_id'));
      const last = localStorage.getItem('guest_last_analysis_at');
      if (last) setGuestLastUsed(parseInt(last, 10));
    }
  }, []);

  const guestUsed = useMemo(() => {
    if (!guestLastUsed) return false;
    return (Date.now() - guestLastUsed) < GUEST_COOLDOWN_MS;
  }, [guestLastUsed]);

  const resetAnalyzer = useCallback(() => {
    setFile(null);
    setPreview(null);
    setAnalysisResult(null);
    setDetectedDimensions(null);
    setIsLoading(false);
  }, []);

  const handleAction = async (analyze = false) => {
    if (!file || !firestore) return;

    setLoadingType(analyze ? 'analyze' : 'upload');
    setIsLoading(true);

    await executePhotoAnalysisFlow({
      file,
      analyze,
      user,
      userProfile,
      firestore,
      locale,
      guestId,
      guestUsed,
      currentTier: userProfile?.tier || 'start',
      onSuccess: (result) => {
        setAnalysisResult(result);
        setIsLoading(false);
      },
      onUploadOnly: () => {
        toast({ title: t('toast_upload_only_title'), description: t('toast_upload_only_description') });
        resetAnalyzer();
        router.push('/gallery');
      },
      onMarketingRequired: () => {
        setShowMarketingModal(true);
        setIsLoading(false);
      },
      onResolutionRequired: (dims) => {
        setDetectedDimensions(dims);
        setShowResolutionDialog(true);
        setIsLoading(false);
      },
      onError: (err) => {
        if (err.message?.includes('GUEST_LIMIT_REACHED')) {
          localStorage.setItem('guest_last_analysis_at', Date.now().toString());
          setGuestLastUsed(Date.now());
          setShowMarketingModal(true);
          setIsLoading(false);
          return;
        }

        if (err.message === 'INSUFFICIENT_BALANCE') {
          router.push('/pricing');
          setIsLoading(false);
          return;
        }

        console.error('[AnalizMerkezi] Flow error:', err);
        setIsLoading(false);
        toast({ 
          variant: 'destructive', 
          title: t('toast_analysis_fail_title'), 
          description: err.message || t('toast_analysis_fail_description') 
        });
      }
    });
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (files) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    },
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  if (isProfileLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  const currentTier = userProfile?.tier || 'start';
  const analysisCost = TIER_COSTS[currentTier];

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      
      {/* 🚀 STAGE 1: Result View */}
      {analysisResult && (
        <ResultStage 
          analysisResult={analysisResult} 
          user={user} 
          guestId={guestId} 
          resetAnalyzer={resetAnalyzer} 
          t={t} 
          tr={tr} 
        />
      )}

      {/* 🚀 STAGE 2: Processing / Preview View */}
      {!analysisResult && file && (
        <ProcessingStage 
          preview={preview}
          isLoading={isLoading}
          isProcessing={isProcessing}
          loadingType={loadingType}
          user={user}
          userProfile={userProfile}
          analysisCost={analysisCost}
          currencyName={currencyName}
          handleAction={handleAction}
          resetAnalyzer={resetAnalyzer}
          open={open}
          t={t}
        />
      )}

      {/* 🚀 STAGE 3: Empty / Upload View */}
      {!analysisResult && !file && (
        <UploadStage 
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          open={open}
          t={t}
        />
      )}

      {/* --- Common Modals --- */}
      <Dialog open={showResolutionDialog} onOpenChange={(v) => { setShowResolutionDialog(v); if(!v) resetAnalyzer(); }}>
        <DialogContent className="sm:max-w-md rounded-[32px] border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl">
          <DialogHeader className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2 border border-amber-500/20"><AlertTriangle className="h-6 w-6 text-amber-500" /></div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">{t('error_photo_too_small_dialog_title')}</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground font-medium leading-relaxed">
              {detectedDimensions && (
                <div className="mb-4 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-4">
                  <div className="text-center"><p className="text-[10px] font-black uppercase opacity-50">Genişlik</p><p className="text-lg font-black text-primary">{detectedDimensions.width}px</p></div>
                  <div className="h-8 w-px bg-white/10" /><div className="text-center"><p className="text-[10px] font-black uppercase opacity-50">Yükseklik</p><p className="text-lg font-black text-primary">{detectedDimensions.height}px</p></div>
                </div>
              )}
              {t('error_photo_too_small_dialog_description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6"><Button onClick={() => { setShowResolutionDialog(false); resetAnalyzer(); }} className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary shadow-xl">{t('button_ok')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMarketingModal} onOpenChange={setShowMarketingModal}>
        <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-0 overflow-hidden shadow-3xl">
          <DialogHeader className="relative h-48 w-full">
            <img src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover opacity-50" alt="Background" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
            <div className="absolute bottom-6 left-8 right-8 text-left">
              <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-primary fill-current" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">SINIRLI SÜRELİ TEKLİF</p></div>
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">İLK 1000 ÜYE ARASINA KATILIN</DialogTitle>
              <DialogDescription className="sr-only">Üye avantajlarını keşfedin.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-10 pt-0 space-y-8">
            <div className="space-y-4 text-left">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">Misafir analiz hakkınız doldu. Şimdi ücretsiz üye olarak bu özel avantajları hemen yakalayabilirsiniz:</p>
              <div className="grid gap-3">
                <MarketingItem icon={Gem} color="text-cyan-400" text="20 Pix Hoş Geldin Bonusu" />
                <MarketingItem icon={RefreshCw} color="text-purple-400" text="Her Hafta Otomatik 5 Pix Yükleme" />
                <MarketingItem icon={Globe} color="text-blue-400" text="1 Adet Kişisel Sergi Oluşturma Hakkı" />
              </div>
            </div>
            <div className="space-y-4 pt-4">
              <Button onClick={() => router.push('/signup')} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm bg-primary text-primary-foreground shadow-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95">Hemen Üye Ol <Sparkles size={18} /></Button>
              <Button onClick={() => setShowMarketingModal(false)} variant="ghost" className="w-full h-10 rounded-xl font-black uppercase tracking-widest text-[9px] text-muted-foreground opacity-50 hover:opacity-100">Belki Daha Sonra</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MarketingItem = ({ icon: Icon, color, text }: any) => (
  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
    <div className={cn("p-2 rounded-xl bg-white/5", color)}><Icon size={18} /></div>
    <span className="text-xs font-black uppercase tracking-tight">{text}</span>
  </div>
);
