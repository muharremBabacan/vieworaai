'use client';

import { useState, useRef, useTransition, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { generatePhotoAnalysis, type PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback, type AdaptiveFeedbackOutput } from '@/ai/flows/generate-adaptive-feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, X, Loader2, Zap, Upload, AlertTriangle, CheckCircle, Lightbulb, Bot } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { doc, collection, ref as firestoreRef } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User as UserProfile, PhotoAnalysis } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';


function RatingDisplay({ analysis }: { analysis: PhotoAnalysis }) {
  const t = useTranslations('DashboardPage');
  const tRatings = useTranslations('Ratings');

  const scores = [
    analysis.light_score,
    analysis.composition_score,
    analysis.focus_score,
    analysis.color_control_score,
    analysis.background_control_score,
    analysis.creativity_risk_score,
  ].filter((score): score is number => typeof score === 'number' && isFinite(score));

  const overallScore = scores.length > 0
    ? (scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  const ratingItems = [
      { label: tRatings('lighting'), value: analysis.light_score ?? 0 },
      { label: tRatings('composition'), value: analysis.composition_score ?? 0 },
      { label: tRatings('focus'), value: analysis.focus_score ?? 0 },
  ];
  return (
      <div>
          <h4 className="font-semibold text-lg mb-3">{t('rating_card_title')}</h4>
          <div className="flex items-center gap-6 rounded-lg border p-4">
              <div className="flex flex-col items-center justify-center">
                  <p className="text-sm text-muted-foreground">{t('overall_score')}</p>
                  <p className="text-5xl font-bold text-primary">{(overallScore * 10).toFixed(0)}</p>
              </div>
              <div className="flex-1 space-y-2">
                  {ratingItems.map(item => (
                      <div key={item.label} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex w-full h-1.5 items-center gap-0.5">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={cn(
                                            "h-full flex-1 rounded-sm",
                                            i < Math.round(item.value ?? 0) ? 'bg-primary' : 'bg-muted'
                                        )}
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-semibold w-8 text-right">{((item.value ?? 0) * 10).toFixed(0)}</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  )
}

function AnalysisResult({ analysis, feedback, photoPreviewUrl }: { analysis: PhotoAnalysis, feedback: string, photoPreviewUrl: string }) {
  const t = useTranslations('DashboardPage');

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
           <CardTitle className="font-sans text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary"/> {t('ai_analysis_title')}
            </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{feedback}</p>
        </CardContent>
      </Card>
      
       <RatingDisplay analysis={analysis} />

       <div className="space-y-4">
          <h4 className="font-semibold text-lg">{t('improvements_title')}</h4>
           <div className="space-y-2">
                {Object.entries(analysis.error_flags).filter(([_, value]) => value === true).map(([key]) => (
                    <div key={key} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                            <p className="font-semibold text-destructive">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                            <p className="text-sm text-destructive/80">Bu alanda gelişim için fırsat bulunuyor.</p>
                        </div>
                    </div>
                ))}
                {Object.values(analysis.error_flags).every(v => v === false) && (
                     <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="font-medium text-green-400">Bu analizde kritik bir teknik hataya rastlanmadı.</p>
                    </div>
                )}
            </div>
      </div>
    </div>
  );
}

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

      let analysisData: PhotoAnalysisOutput;
      try {
        analysisData = await generatePhotoAnalysis({ photoUrl: downloadURL });
      } catch (e) { toast({ variant: 'destructive', title: t('toast_analysis_fail_title') }); return; }

      let feedbackData: AdaptiveFeedbackOutput;
      try {
        feedbackData = await generateAdaptiveFeedback({
          userXpLevel: userProfile.level_name || 'Neuner',
          profileLevel: analysisData.technical_level_estimation,
          tone: 'gentle', // Defaulting to gentle for now
          language: locale,
          photoData: analysisData
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
        current_xp: newXp
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
          <h1 className="text-3xl font-bold tracking-tight">{t('greeting_title', { name: userProfile?.name?.split(' ')[0] })}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('greeting_desc_1')} {t('greeting_desc_2')}
          </p>
          <p className="font-semibold text-foreground">{t('greeting_cta')}</p>
        </div>
      )}
      {analysisResult && feedbackResult && preview ? (
        <>
          <AnalysisResult 
            analysis={analysisResult} 
            feedback={feedbackResult} 
            photoPreviewUrl={preview}
          />
          <Button onClick={handleClear} variant="outline" className="w-full">
            {t('button_new_analysis')}
          </Button>
        </>
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
