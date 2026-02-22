'use client';

import { useState, useRef, useTransition, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { generatePhotoAnalysis, type PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, X, Loader2, Zap, Upload } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User as UserProfile } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { useLocale, useTranslations } from 'next-intl';
import { AnalysisResult } from './analysis-result';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

export default function PhotoAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisOutput | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false); // For upload-only
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const t = useTranslations('DashboardPage');

  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handleClear = () => {
    setPreview(null);
    setFile(null);
    setAnalysisResult(null);
    setFeedbackResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
         toast({
          variant: 'destructive',
          title: t('toast_file_size_title'),
          description: t('toast_file_size_description'),
        });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setAnalysisResult(null);
      setFeedbackResult(null);
    } else if (selectedFile) {
      toast({
        variant: 'destructive',
        title: t('toast_invalid_file_title'),
        description: t('toast_invalid_file_description'),
      });
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };
  
  const handleUploadOnly = () => {
    if (!file || !userProfile || !userDocRef || !authUser) return;
    setIsUploading(true);
    startTransition(async () => {
      const filePath = `users/${authUser.uid}/uploads/${Date.now()}-${file.name}`;
      const imageRef = ref(storage, filePath);
      let downloadURL;
      try {
        await uploadBytes(imageRef, file);
        downloadURL = await getDownloadURL(imageRef);
      } catch (storageError) {
          toast({ variant: 'destructive', title: t('toast_upload_fail_title'), description: t('toast_upload_fail_description') });
          setIsUploading(false); return;
      }

      const photosCollectionRef = collection(firestore, 'users', authUser.uid, 'photos');
      addDocumentNonBlocking(photosCollectionRef, {
          userId: authUser.uid, imageUrl: downloadURL, filePath: filePath,
          aiFeedback: null, adaptiveFeedback: null, createdAt: new Date().toISOString(), isSubmittedToPublic: false,
      });
      
      toast({ title: t('toast_upload_only_title'), description: t('toast_upload_only_description') });
      handleClear(); setIsUploading(false);
    });
  }

  const handleAnalyze = () => {
    if (!file || !preview || !userProfile || !userDocRef || !authUser) return;
    const analysisCost = 2;
    if ((userProfile.auro_balance || 0) < analysisCost) {
      toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_description', { cost: analysisCost }) });
      return;
    }

    startTransition(async () => {
      const filePath = `users/${authUser.uid}/uploads/${Date.now()}-${file.name}`;
      const imageRef = ref(storage, filePath);
      let downloadURL;
      try {
        await uploadBytes(imageRef, file);
        downloadURL = await getDownloadURL(imageRef);
      } catch (e) { toast({ variant: 'destructive', title: t('toast_upload_fail_title') }); return; }

      const photosCollectionRef = collection(firestore, 'users', authUser.uid, 'photos');
      const photoDocRef = await addDocumentNonBlocking(photosCollectionRef, {
          userId: authUser.uid, imageUrl: downloadURL, filePath,
          aiFeedback: null, adaptiveFeedback: null, createdAt: new Date().toISOString(), isSubmittedToPublic: false,
      });
      if (!photoDocRef) { toast({ variant: 'destructive', title: t('toast_db_fail_title') }); return; }

      let analysisData;
      try {
        analysisData = await generatePhotoAnalysis({ photoUrl: downloadURL, language: locale });
      } catch (e) { toast({ variant: 'destructive', title: t('toast_analysis_fail_title') }); return; }
      
      const scores = [
        analysisData.light_score, analysisData.composition_score, analysisData.focus_score,
        analysisData.color_control_score, analysisData.background_control_score, analysisData.creativity_risk_score,
      ].map(normalizeScore);
      const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      const scoreHistory = userProfile.score_history || [];
      const recentScores = scoreHistory.slice(-5).map(h => h.score);
      const averageScore = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      let scoreTrend: 'improving' | 'stagnant' | 'declining' = 'stagnant';
      if (recentScores.length > 1) {
          if (overallScore > averageScore + 0.5) {
              scoreTrend = 'improving';
          } else if (overallScore < averageScore - 0.5) {
              scoreTrend = 'declining';
          }
      }

      let feedbackData;
      try {
        feedbackData = await generateAdaptiveFeedback({
          userGamificationLevel: userProfile.level_name || 'Neuner',
          language: locale,
          technicalAnalysis: analysisData,
          communicationStyle: userProfile.communication_style,
          scoreTrend: scoreTrend,
          averageScore: averageScore,
          overallScore: overallScore,
        });
      } catch (e) { toast({ variant: 'destructive', title: 'Geri bildirim üretilemedi.' }); return; }

      setAnalysisResult(analysisData);
      setFeedbackResult(feedbackData.feedback);

      const xpFromAnalysis = 15;
      const currentXp = userProfile.current_xp || 0;
      const newXp = currentXp + xpFromAnalysis;
      const currentLevel = getLevelFromXp(currentXp);
      const newLevel = getLevelFromXp(newXp);
      
      const userUpdatePayload: Partial<UserProfile> = {
        auro_balance: (userProfile.auro_balance || 0) - analysisCost,
        current_xp: newXp,
        score_history: [...scoreHistory, { score: overallScore, date: new Date().toISOString() }].slice(-10),
      };
      if (newLevel.name !== currentLevel.name) {
        userUpdatePayload.level_name = newLevel.name;
        if (newLevel.isMentor) userUpdatePayload.is_mentor = true;
      }

      updateDocumentNonBlocking(userDocRef, userUpdatePayload);
      updateDocumentNonBlocking(photoDocRef, { aiFeedback: analysisData, adaptiveFeedback: feedbackData.feedback, tags: [analysisData.genre] });
      
      toast({ title: t('toast_xp_gain_title'), description: t('toast_xp_gain_description', { xp: xpFromAnalysis }) });
      if (userUpdatePayload.level_name) {
          setTimeout(() => toast({ title: t('toast_level_up_title'), description: t('toast_level_up_description', { level: userUpdatePayload.level_name }) }), 100);
          if (userUpdatePayload.is_mentor) setTimeout(() => toast({ title: t('toast_mentor_title'), description: t('toast_mentor_description') }), 200);
      }
    });
  };

  const canInteract = !isPending && !isUploading && !isProfileLoading && !!userProfile;
  const canAnalyze = canInteract && userProfile && userProfile.auro_balance >= 2;

  return (
    <div className="space-y-8">
       {!analysisResult && !preview && (
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">{t('greeting_title', { name: userProfile?.name?.split(' ')[0] })}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('greeting_desc_1')} {t('greeting_desc_2')}
          </p>
          <p className="font-semibold text-foreground">{t('greeting_cta')}</p>
        </div>
      )}
      {analysisResult && feedbackResult && preview ? (
        <AnalysisResult
          analysis={analysisResult}
          feedback={feedbackResult}
          photoPreviewUrl={preview}
          onNewAnalysis={handleClear}
        />
      ) : preview ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-muted/20">
              <Image src={preview} alt="Preview" fill sizes="(max-width: 768px) 100vw, 50vw" className={cn("object-contain transition-all", (isPending || isUploading) && "opacity-50")} />
              {(isPending || isUploading) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-3 font-semibold text-lg">{isPending ? t('state_analyzing') : t('state_uploading')}</p>
                    {isPending && <p className="text-sm mt-1">{t('state_wait')}</p>}
                </div>
              )}
              <Button variant="destructive" size="icon" className="absolute top-4 right-4 h-8 w-8 rounded-full" onClick={handleClear} disabled={isPending || isUploading}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <Button onClick={handleAnalyze} disabled={!canAnalyze || !file || isPending || isUploading} size="lg">
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('state_analyzing')}</> : <><Zap className="mr-2 h-4 w-4" />{t('button_analyze', { cost: 2 })}</>}
              </Button>
               <Button onClick={handleUploadOnly} disabled={!canInteract || !file || isPending || isUploading} variant="secondary" size="lg">
                 {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('button_uploading')}</> : <><Upload className="mr-2 h-4 w-4" />{t('button_upload_only')}</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={cn('relative w-full h-80 rounded-lg border-2 border-dashed border-muted-foreground/50 transition-colors duration-200 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary hover:bg-accent', isDragging && 'border-primary bg-accent')}
          onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}>
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
          <div className="space-y-2">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="font-semibold text-muted-foreground">{t('upload_prompt_main')}</p>
            <p className="text-sm text-muted-foreground/80">{t('upload_prompt_sub')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
