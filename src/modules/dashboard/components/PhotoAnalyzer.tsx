
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion } from 'firebase/firestore';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';
import { uploadAndProcessImage } from '@/lib/image/actions';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo, AnalysisLog, UserTier } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Sparkles, Gem, RefreshCw, Lock, Scan, SearchCode, Lightbulb, GraduationCap, Trophy, Users, Brain, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useRouter } from '@/navigation';
import { typography } from "@/lib/design/typography";
import { useTranslations, useLocale } from 'next-intl';
import { VieworaImage } from '@/core/components/viewora-image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = URL.createObjectURL(file);
  });
}

async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function resizeImage(file: File, maxDimension: number = 1600): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const TIER_COSTS: Record<UserTier, number> = {
  start: 1,
  pro: 2,
  master: 3
};

const normalizeScore = (score: number | undefined | null): number => {
  if (score === undefined || score === null || !isFinite(score)) return 0;
  return score > 1 ? score : score * 10;
};

const getOverallScore = (photo: Photo): number => {
  if (!photo.aiFeedback) return 0;
  const scores = [
    normalizeScore(photo.aiFeedback.light_score),
    normalizeScore(photo.aiFeedback.composition_score),
    normalizeScore(photo.aiFeedback.technical_clarity_score),
    normalizeScore(photo.aiFeedback.storytelling_score),
    normalizeScore(photo.aiFeedback.boldness_score)
  ].filter(s => s > 0);
  return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
};

const RatingBar = ({ label, score, isLocked }: { label: string; score: number; isLocked?: boolean }) => (
  <div className={cn("relative", isLocked && "opacity-40 grayscale")}>
    <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      <span className="flex items-center gap-1">{label} {isLocked && <Lock className="h-2.5 w-2.5" />}</span>
      <span className="text-foreground">{isLocked ? '?' : score.toFixed(1)}</span>
    </div>
    <div className="relative">
      <Progress value={isLocked ? 0 : score * 10} className="h-1.5" />
      {isLocked && <div className="absolute inset-0 bg-muted/20 backdrop-blur-[1px] rounded-full" />}
    </div>
  </div>
);

const ScanningOverlay = ({ label }: { label: string }) => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
    <div className="relative w-full max-w-[280px] space-y-6 text-center">
      <div className="relative h-20 w-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Scan className="h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black uppercase tracking-tighter text-white">Luma Taraması</h3>
        <p className="text-xs font-bold text-primary/80 uppercase tracking-[0.2em] animate-pulse">{label}</p>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary animate-progress-fast shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
      </div>
    </div>
  </div>
);

export default function PhotoAnalyzer() {
  const t = useTranslations('DashboardPage');
  const tr = useTranslations('Ratings');
  const locale = useLocale();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { currencyName } = useAppConfig();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingType, setLoadingType] = useState<'upload' | 'analyze'>('analyze');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setIsProcessing(true);
    setAnalysisResult(null);
    setIsDuplicate(false);

    try {
      console.log(`[PhotoAnalyzer] Original file size: ${(selectedFile.size / 1024).toFixed(2)} KB`);
      
      const resizedFile = await resizeImage(selectedFile, 1600);
      console.log(`[PhotoAnalyzer] Resized file size: ${(resizedFile.size / 1024).toFixed(2)} KB`);

      // Eski önizlemeyi temizle
      setPreview(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(resizedFile);
      });
      setFile(resizedFile);
    } catch (error) {
      console.error('[PhotoAnalyzer] Resize error:', error);
      toast({ 
        variant: 'destructive', 
        title: t('toast_analysis_fail_title'), 
        description: 'Görsel işlenirken bir hata oluştu.' 
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, t]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (acceptedFiles) => acceptedFiles.length > 0 && handleFileSelect(acceptedFiles[0]),
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  const currentTier = userProfile?.tier || 'start';
  const analysisCost = TIER_COSTS[currentTier];

  const updateUserProfileIndex = async (userId: string, newOverallScore: number) => {
    if (!firestore) return;
    const photosRef = collection(firestore, 'users', userId, 'photos');
    const q = query(photosRef, where('aiFeedback', '!=', null), orderBy('createdAt', 'desc'), limit(12));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const analyzedPhotos = snap.docs.map(d => d.data() as Photo);
    const count = analyzedPhotos.length;
    const totals = analyzedPhotos.reduce((acc, p) => {
      const f = p.aiFeedback!;
      acc.light += normalizeScore(f.light_score);
      acc.composition += normalizeScore(f.composition_score);
      acc.clarity += normalizeScore(f.technical_clarity_score);
      acc.story += normalizeScore(f.storytelling_score || 0);
      acc.boldness += normalizeScore(f.boldness_score || 0);
      acc.overall.push(getOverallScore(p));
      return acc;
    }, { light: 0, composition: 0, clarity: 0, story: 0, boldness: 0, overall: [] as number[] });
    const technicalMetrics = {
      light: totals.light / count,
      composition: totals.composition / count,
      technical_clarity: totals.clarity / count,
      storytelling: totals.story / count,
      boldness: totals.boldness / count
    };
    const mean = totals.overall.reduce((a, b) => a + b, 0) / count;
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, {
      'profile_index.technical': technicalMetrics,
      'profile_index.profile_index_score': mean * 10,
      score_history: arrayUnion({ score: newOverallScore, date: new Date().toISOString() })
    });
  };

  const handleUploadAndOptionalAnalysis = async (analyze = false) => {
    if (!file || !user || !firestore) {
      console.warn('[PhotoAnalyzer] Missing required context (file, user, or firestore)');
      return;
    }

    // 🔥 Profil yüklenmemişse blokla
    if (!userProfile) {
      toast({ title: t('loading_profile') || "Profil yükleniyor..." });
      return;
    }

    // 🔥 Pix kontrolü (ANALYZE)
    const currentBalance = userProfile.pix_balance || 0;
    if (analyze && currentBalance < analysisCost) {
      console.log(`[PhotoAnalyzer] Insufficient balance. Cost: ${analysisCost}, Current: ${currentBalance}`);
      router.push('/pricing');
      return;
    }

    // 🔥 Loading HER ZAMAN burada başlar
    setLoadingType(analyze ? 'analyze' : 'upload');
    setIsLoading(true);

    try {
      // 1. Adım: Çözünürlük Kontrolü
      console.log('[PhotoAnalyzer] Stage 1: Checking dimensions...');
      const { width, height } = await getImageDimensions(file);
      const maxEdge = Math.max(width, height);

      if (maxEdge < 800) {
        console.warn(`[PhotoAnalyzer] Resolution too low: ${width}x${height}`);
        setDetectedDimensions({ width, height });
        setShowResolutionDialog(true);
        return;
      }

      // 2. Adım: Hash Oluşturma
      console.log('[PhotoAnalyzer] Stage 2: Generating hash...');
      const hash = await generateImageHash(file);

      // 3. Adım: Duplicate Kontrolü
      console.log('[PhotoAnalyzer] Stage 3: Checking for duplicates...');
      const q = query(
        collection(firestore, 'users', user.uid, 'photos'),
        where('imageHash', '==', hash)
      );

      const dupSnap = await getDocs(q);

      if (!dupSnap.empty) {
        const docSnap = dupSnap.docs[0];
        const existingPhoto = docSnap.data() as Photo;
        console.log('[PhotoAnalyzer] Duplicate found:', docSnap.id);

        // Eğer analiz varsa direkt göster
        if (existingPhoto.aiFeedback) {
          setAnalysisResult(existingPhoto);
          toast({ title: t('toast_success_title') });
          return;
        }

        // Daha önce yüklenmiş ama analiz yoksa ve kullanıcı analiz istiyorsa
        if (analyze) {
          console.log('[PhotoAnalyzer] Existing photo found without analysis. Starting analysis...');
          const analysis = await generatePhotoAnalysis({
            photoUrl: existingPhoto.imageUrls?.analysis || existingPhoto.imageUrl,
            language: locale,
            tier: currentTier
          });

          await updateDoc(docSnap.ref, {
            aiFeedback: analysis,
            tags: analysis.tags || [],
            analysisTier: currentTier
          });

          setAnalysisResult({ ...existingPhoto, aiFeedback: analysis });
          return;
        }

        // Sadece upload istiyordu ama zaten var, galeriye yönlendir
        toast({ title: t('toast_upload_only_title'), description: t('toast_already_uploaded') });
        router.push('/gallery');
        return;
      }

      // 4. Adım: Sunucuya Yükleme (Server Action)
      const photoId = crypto.randomUUID();
      console.log(`[PhotoAnalyzer] Stage 4: Uploading to server... (ID: ${photoId})`);
      
      const formData = new FormData();
      formData.append('file', file);

      // Sunucu taraflı yükleme işlemi
      const imageUrls = await uploadAndProcessImage(formData, user.uid, photoId, 'photos').catch(err => {
        console.error('[PhotoAnalyzer] Server Action failed:', err);
        throw new Error('UPLOAD_FAILED');
      });

      console.log('[PhotoAnalyzer] Upload successful. Image URLs received.');

      // 5. Adım: Firestore Kaydı ve Opsiyonel Analiz
      const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
      const userRef = doc(firestore, 'users', user.uid);

      let photoData: Photo = {
        id: photoId,
        userId: user.uid,
        imageUrl: imageUrls.analysis,
        imageUrls,
        imageHash: hash,
        createdAt: new Date().toISOString(),
        aiFeedback: null,
        tags: []
      };

      if (analyze) {
        console.log('[PhotoAnalyzer] Stage 5: Generating AI Analysis...');
        const analysis = await generatePhotoAnalysis({
          photoUrl: imageUrls.analysis,
          language: locale,
          tier: currentTier
        });

        photoData.aiFeedback = analysis;
        photoData.analysisTier = currentTier;

        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(userRef, {
          pix_balance: increment(-analysisCost),
          total_analyses_count: increment(1)
        });

        await batch.commit();
        console.log('[PhotoAnalyzer] Analysis and firestore record completed.');
        
        // Opsiyonel: Profil endeksini güncelle (UI'ı kırmadan arka planda)
        updateUserProfileIndex(user.uid, getOverallScore(photoData)).catch(err => 
          console.error('[PhotoAnalyzer] Background index update failed:', err)
        );

        setAnalysisResult(photoData);
      } else {
        console.log('[PhotoAnalyzer] Stage 5: Saving database record (No Analysis)...');
        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(userRef, {
          current_xp: increment(5)
        });

        await batch.commit();
        console.log('[PhotoAnalyzer] Database record created. Redirecting to gallery.');
        router.push('/gallery');
      }

    } catch (error: any) {
      console.error('[PhotoAnalyzer] Error in flow:', error);
      
      let message = t('toast_analysis_fail_description');
      if (error.message === 'UPLOAD_FAILED') {
        message = t('toast_upload_fail_description');
      } else if (error.code === 'unavailable') {
        message = t('toast_network_error_description');
      }

      toast({
        variant: 'destructive',
        title: t('toast_analysis_fail_title'),
        description: message
      });
    } finally {
      setIsLoading(false); 
      console.log('[PhotoAnalyzer] Flow finished. Loading state reset.');
    }
  };

  const resetAnalyzer = () => {
    setFile(null);
    setPreview(null);
    setAnalysisResult(null);
    setIsDuplicate(false);
    setDetectedDimensions(null);
  };

  if (isProfileLoading)
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      {analysisResult ? (
        <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
          <header className="flex justify-between items-center">
            <div className="space-y-1">
              <Badge variant="outline" className="px-3 h-6 border-primary/30 text-primary font-black uppercase tracking-widest text-[9px] rounded-full">{t('analysis_report_badge')}</Badge>
              <h1 className="text-4xl font-black tracking-tighter uppercase">{t('analysis_report_title')}</h1>
            </div>
            <Button onClick={resetAnalyzer} variant="ghost" className="rounded-xl font-bold text-muted-foreground"><RefreshCw size={16} className="mr-2" /> {t('button_new_analysis')}</Button>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-primary/10 text-primary"><SearchCode size={20} /></div><h3 className="text-lg font-black uppercase tracking-tight">{t('expert_analysis_title')}</h3></div>
                <div className="space-y-6">
                  {analysisResult.aiFeedback!.technical_details && (
                    <>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{t('expert_focus_label')}</p>
                        <p className="text-sm font-medium leading-relaxed">{analysisResult.aiFeedback!.technical_details.focus}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{t('expert_light_label')}</p>
                        <p className="text-sm font-medium leading-relaxed">{analysisResult.aiFeedback!.technical_details.light}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{t('expert_color_label')}</p>
                        <p className="text-sm font-medium leading-relaxed">{analysisResult.aiFeedback!.technical_details.color}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{t('expert_composition_label')}</p>
                        <p className="text-sm font-medium leading-relaxed">{analysisResult.aiFeedback!.technical_details.composition}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{t('expert_quality_label')}</p>
                        <p className="text-sm font-medium leading-relaxed">{analysisResult.aiFeedback!.technical_details.technical_quality}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_genre')}</p><p className="text-sm font-bold capitalize">{analysisResult.aiFeedback!.genre}</p></div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_scene')}</p><p className="text-sm font-bold truncate">{analysisResult.aiFeedback!.scene}</p></div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_subject')}</p><p className="text-sm font-bold truncate">{analysisResult.aiFeedback!.dominant_subject}</p></div>
                </div>
              </Card>
            </div>
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
                  <RatingBar label="Cesur Kadraj" score={normalizeScore(analysisResult.aiFeedback!.boldness_score)} isLocked={analysisResult.analysisTier === 'start'} />
                </div>
              </Card>
              {analysisResult.aiFeedback!.quality_note && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-600 leading-relaxed">{analysisResult.aiFeedback!.quality_note}</p>
                </div>
              )}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/50 space-y-4">
                <div className="flex items-center gap-2"><Lightbulb size={18} className="text-amber-400" /><h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('luma_note_title')}</h4></div>
                <p className="text-base italic text-foreground/90 leading-relaxed font-medium">"{analysisResult.aiFeedback!.short_neutral_analysis}"</p>
              </Card>
            </div>
          </div>
        </div>
      ) : (!file && !isProcessing) ? (
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

          {/* Platform Features Section */}
          <div className="space-y-12 pb-12 mt-16 border-t border-border/20 pt-16">
            <div className="text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t('platform_title')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Card 1: AI */}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Sparkles size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black uppercase tracking-tight text-sm">{t('platform_card_1_title')}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('platform_card_1_desc')}</p>
                </div>
              </Card>

              {/* Card 2: Academy */}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
                <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <GraduationCap size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black uppercase tracking-tight text-sm">{t('platform_card_2_title')}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('platform_card_2_desc')}</p>
                </div>
              </Card>

              {/* Card 3: Exhibitions */}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <Trophy size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black uppercase tracking-tight text-sm">{t('platform_card_3_title')}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('platform_card_3_desc')}</p>
                </div>
              </Card>

              {/* Card 4: Community */}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
                <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                  <Users size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black uppercase tracking-tight text-sm">{t('platform_card_4_title')}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('platform_card_4_desc')}</p>
                </div>
              </Card>

              {/* Card 5: Coaching */}
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/30 hover:bg-card/40 transition-all flex flex-col items-center text-center space-y-4 group">
                <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                  <Brain size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black uppercase tracking-tight text-sm">{t('platform_card_5_title')}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('platform_card_5_desc')}</p>
                </div>
              </Card>
            </div>

            <div className="text-center pt-8 border-t border-border/20">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                {t('platform_footer')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center rounded-[48px] border-border/40 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          {(isLoading || isProcessing) && (
            <ScanningOverlay
              label={isProcessing ? t('state_processing') : loadingType === 'analyze' ? t('state_analyzing') : t('state_uploading')}
            />
          )}
          <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12">
            <img src={preview!} alt="Preview" className="object-cover w-full h-full" />
          </div>
          <div className="flex flex-col items-center gap-6">
            {userProfile && (userProfile.pix_balance < analysisCost) && (
              <p className="text-sm text-red-500 font-black uppercase tracking-widest animate-pulse">
                {t('label_insufficient_balance')}
              </p>
            )}
            <div className="flex flex-col sm:flex-row justify-center gap-5 w-full max-w-2xl">
              <Button
                onClick={() => handleUploadAndOptionalAnalysis(true)}
                disabled={isLoading || isProcessing || !userProfile || userProfile.pix_balance < analysisCost}
                className="flex-1 h-16 rounded-[20px] text-lg font-black uppercase tracking-wider group relative overflow-hidden"
              >
                {isLoading && loadingType === 'analyze' ? (
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-6 w-6 mr-2 group-hover:scale-125 transition-transform" />
                )}
                <span>
                  {userProfile && userProfile.pix_balance < analysisCost 
                    ? t('button_analyze_insufficient', { cost: analysisCost, currency: currencyName })
                    : t('button_analyze', { cost: analysisCost, currency: currencyName })}
                </span>
              </Button>

              <Button
                onClick={() => handleUploadAndOptionalAnalysis(false)}
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
          </div>
        </Card>
      )}

      {/* Resolution Warning Dialog */}
      <Dialog
        open={showResolutionDialog}
        onOpenChange={(open) => {
          setShowResolutionDialog(open);
          if (!open) resetAnalyzer();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[32px] border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl">
          <DialogHeader className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
              {t('error_photo_too_small_dialog_title')}
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground font-medium leading-relaxed">
              {detectedDimensions && (
                <div className="mb-4 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase opacity-50">Genişlik</p>
                    <p className="text-lg font-black text-primary">{detectedDimensions.width}px</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase opacity-50">Yükseklik</p>
                    <p className="text-lg font-black text-primary">{detectedDimensions.height}px</p>
                  </div>
                </div>
              )}
              {t('error_photo_too_small_dialog_description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              onClick={() => {
                setShowResolutionDialog(false);
                resetAnalyzer();
              }}
              className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary shadow-xl"
            >
              {t('button_ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
