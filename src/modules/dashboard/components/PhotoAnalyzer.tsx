
'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo, AnalysisLog, UserTier } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Sparkles, Gem, RefreshCw, Lock, Scan, SearchCode, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useRouter } from '@/navigation';
import { typography } from "@/lib/design/typography";
import { useTranslations } from 'next-intl';

async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { currencyName } = useAppConfig();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('toast_file_size_title'), description: t('toast_file_size_description') });
      return;
    }
    setIsDuplicate(false);
    setAnalysisResult(null);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
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
    if (!file || !user || !firestore || !userProfile) return;
    if (analyze && userProfile.auro_balance < analysisCost) {
      toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_description', { cost: analysisCost }) });
      return;
    }
    setIsLoading(true);
    try {
      const hash = await generateImageHash(file);
      const q = query(collection(firestore, 'users', user.uid, 'photos'), where('imageHash', '==', hash));
      const dupSnap = await getDocs(q);
      if (!dupSnap.empty) {
        const existingPhoto = dupSnap.docs[0].data() as Photo;
        if (existingPhoto.aiFeedback) {
            setAnalysisResult(existingPhoto);
            toast({ title: t('toast_upload_only_title') });
        } else {
            setIsDuplicate(true);
            toast({ variant: 'destructive', title: t('toast_invalid_file_title') });
        }
        setIsLoading(false);
        return;
      }
      const storage = getStorage();
      const filePath = `users/${user.uid}/photos/${hash}.jpg`;
      const storageRef = ref(storage, filePath);
      const uploadTask = await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(uploadTask.ref);
      const batch = writeBatch(firestore);
      const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), crypto.randomUUID());
      const userRef = doc(firestore, 'users', user.uid);
      
      let photoData: Photo = { 
        id: photoDocRef.id, 
        userId: user.uid, 
        imageUrl, 
        filePath, 
        imageHash: hash, 
        createdAt: new Date().toISOString(), 
        aiFeedback: null, 
        tags: [], 
        analysisTier: analyze ? currentTier : undefined 
      };

      if (analyze) {
        const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: userProfile.language || 'tr', tier: currentTier });
        photoData.aiFeedback = analysis;
        photoData.tags = analysis.tags || [];
        const score = getOverallScore(photoData);
        batch.update(userRef, { auro_balance: increment(-analysisCost), total_auro_spent: increment(analysisCost), total_analyses_count: increment(1) });
        const logRef = doc(collection(firestore, 'analysis_logs'));
        batch.set(logRef, { id: logRef.id, userId: user.uid, userName: userProfile.name || 'Sanatçı', type: 'technical', auroSpent: analysisCost, timestamp: new Date().toISOString(), status: 'success' });
        batch.set(photoDocRef, photoData);
        batch.update(userRef, { current_xp: increment(20) });
        await batch.commit();
        await updateUserProfileIndex(user.uid, score);
        setAnalysisResult(photoData);
        toast({ title: t('toast_success_title') });
      } else {
        batch.set(photoDocRef, photoData);
        batch.update(userRef, { current_xp: increment(5) });
        await batch.commit();
        toast({ title: t('toast_upload_only_title') });
        router.push('/gallery');
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: t('toast_analysis_fail_title') });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalyzer = () => {
    setFile(null);
    setPreview(null);
    setAnalysisResult(null);
    setIsDuplicate(false);
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
                <div className="relative aspect-square md:aspect-video">
                  <Image src={analysisResult.imageUrl} alt="Analiz" fill className="object-contain" unoptimized />
                </div>
              </Card>
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/50 space-y-6">
                <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-primary/10 text-primary"><SearchCode size={20} /></div><h3 className="text-lg font-black uppercase tracking-tight">{t('detected_details_title')}</h3></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_genre')}</p><p className="text-sm font-bold capitalize">{analysisResult.aiFeedback!.genre}</p></div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_scene')}</p><p className="text-sm font-bold truncate">{analysisResult.aiFeedback!.scene}</p></div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">{t('detail_subject')}</p><p className="text-sm font-bold truncate">{analysisResult.aiFeedback!.dominant_subject}</p></div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-8 rounded-[40px] border-primary/20 bg-primary/5 shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col items-center text-center space-y-2 mb-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">{t('overall_score')}</p>
                  <div className="text-7xl font-black tracking-tighter text-primary">{getOverallScore(analysisResult).toFixed(1)}</div>
                </div>
                <div className="space-y-6">
                  <RatingBar label={tr('light')} score={normalizeScore(analysisResult.aiFeedback!.light_score)} />
                  <RatingBar label={tr('composition')} score={normalizeScore(analysisResult.aiFeedback!.composition_score)} />
                  <RatingBar label={tr('technical')} score={normalizeScore(analysisResult.aiFeedback!.technical_clarity_score)} />
                  <RatingBar label={tr('storytelling')} score={normalizeScore(analysisResult.aiFeedback!.storytelling_score)} isLocked={analysisResult.analysisTier === 'start'} />
                  <RatingBar label="Cesur Kadraj" score={normalizeScore(analysisResult.aiFeedback!.boldness_score)} isLocked={analysisResult.analysisTier === 'start'} />
                </div>
              </Card>
              <Card className="p-8 rounded-[32px] border-border/40 bg-card/50 space-y-4">
                <div className="flex items-center gap-2"><Lightbulb size={18} className="text-amber-400" /><h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('luma_note_title')}</h4></div>
                <p className="text-base italic text-foreground/90 leading-relaxed font-medium">"{analysisResult.aiFeedback!.short_neutral_analysis}"</p>
              </Card>
            </div>
          </div>
        </div>
      ) : !file ? (
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
        </div>
      ) : (
        <Card className="p-12 text-center rounded-[48px] border-border/40 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          {isLoading && <ScanningOverlay label={t('state_analyzing')} />}
          <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12">
            <Image src={preview!} alt="Preview" fill className="object-cover" unoptimized />
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <Button onClick={() => handleUploadAndOptionalAnalysis(true)} disabled={isDuplicate || isLoading} className="h-16 px-12 rounded-[20px] font-black uppercase shadow-2xl shadow-primary/30">
              {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : <><Sparkles className="mr-3 h-6 w-6 text-yellow-400" /> {t('button_analyze', { cost: analysisCost })}</>}
            </Button>
            <Button onClick={() => handleUploadAndOptionalAnalysis(false)} variant="secondary" disabled={isDuplicate || isLoading} className="h-16 px-12 rounded-[20px] font-black uppercase">
              {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : t('button_upload_only')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
