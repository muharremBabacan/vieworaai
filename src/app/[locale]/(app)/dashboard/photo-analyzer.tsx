'use client';

import { useState, useRef, useTransition, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { analyzePhotoAndSuggestImprovements } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, X, Loader2, Lightbulb, LayoutPanelLeft, Heart, Zap, Upload } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale, useTranslations } from 'next-intl';

function RatingDisplay({ rating }: { rating: AnalyzePhotoAndSuggestImprovementsOutput['rating'] }) {
  const t = useTranslations('DashboardPage');
  const tRatings = useTranslations('Ratings');
  const ratingItems = [
    { label: tRatings('lighting'), value: rating.lighting },
    { label: tRatings('composition'), value: rating.composition },
    { label: tRatings('emotion'), value: rating.emotion },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-sans text-xl font-semibold">{t('rating_card_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
            <div className="flex flex-col items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('overall_score')}</p>
                <p className="text-5xl font-bold text-primary">{rating.overall.toFixed(1)}</p>
            </div>
            <div className="flex-1 space-y-2">
                {ratingItems.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <div className="flex items-center gap-3 flex-1">
                           <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${item.value * 10}%` }} />
                          </div>
                          <span className="text-sm font-semibold w-4 text-right">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}


function AnalysisResult({ result }: { result: AnalyzePhotoAndSuggestImprovementsOutput }) {
  const t = useTranslations('DashboardPage');
  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {result.rating && <RatingDisplay rating={result.rating} />}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-sans text-xl font-semibold mb-4">{t('ai_analysis_title')}</h3>
          <p className="text-muted-foreground">{result.analysis}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <h3 className="font-sans text-xl font-semibold mb-4">{t('improvements_title')}</h3>
          <ul className="space-y-4">
            {result.improvements.map((tip, index) => {
              const Icon = improvements[index % improvements.length].icon;
              const color = improvements[index % improvements.length].color;
              return (
                <li key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Icon className={cn('h-6 w-6', color)} />
                  </div>
                  <p className="text-muted-foreground">{tip}</p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PhotoAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzePhotoAndSuggestImprovementsOutput | null>(null);
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
    setResult(null);
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
      setResult(null);
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
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleUploadOnly = () => {
    if (!file || !userProfile || !userDocRef || !authUser) return;

    setIsUploading(true);
    startTransition(async () => {
      // 1. Upload to Storage
      const filePath = `users/${authUser.uid}/uploads/${Date.now()}-${file.name}`;
      const imageRef = storageRef(storage, filePath);
      
      let downloadURL;
      try {
        await uploadBytes(imageRef, file);
        downloadURL = await getDownloadURL(imageRef);
      } catch (storageError) {
          console.error("Storage upload failed:", storageError);
          toast({
            variant: 'destructive',
            title: t('toast_upload_fail_title'),
            description: t('toast_upload_fail_description'),
          });
          setIsUploading(false);
          return;
      }

      // 2. Save Photo to Firestore without analysis
      const photosCollectionRef = collection(firestore, 'users', authUser.uid, 'photos');
      const photoData = {
          userId: authUser.uid,
          imageUrl: downloadURL,
          filePath: filePath,
          tags: [], 
          aiFeedback: null,
          createdAt: new Date().toISOString(),
          isSubmittedToPublic: false,
      };
      addDocumentNonBlocking(photosCollectionRef, photoData);
      
      toast({
        title: t('toast_upload_only_title'),
        description: t('toast_upload_only_description'),
      });

      setPreview(null);
      setFile(null);
      setIsUploading(false);
    });
  }

  const handleAnalyze = () => {
    if (!file || !preview || !userProfile || !userDocRef || !authUser) return;

    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;
    const analysisCost = 2;

    if (currentAuro < analysisCost) {
      toast({
        variant: 'destructive',
        title: t('toast_insufficient_auro_title'),
        description: t('toast_insufficient_auro_description', { cost: analysisCost }),
      });
      return;
    }

    startTransition(async () => {
      // 1. Upload to Storage
      const filePath = `users/${authUser.uid}/uploads/${Date.now()}-${file.name}`;
      const imageRef = storageRef(storage, filePath);
      
      let downloadURL;
      try {
        await uploadBytes(imageRef, file);
        downloadURL = await getDownloadURL(imageRef);
      } catch (storageError) {
          console.error("Storage upload failed:", storageError);
          toast({
            variant: 'destructive',
            title: t('toast_upload_fail_title'),
            description: t('toast_upload_fail_description'),
          });
          return;
      }

      // 2. Create initial Firestore document to prevent orphaned files
      const photosCollectionRef = collection(firestore, 'users', authUser.uid, 'photos');
      let photoDocRef;
      try {
        const photoData = {
            userId: authUser.uid,
            imageUrl: downloadURL,
            filePath: filePath,
            tags: [], 
            aiFeedback: null,
            createdAt: new Date().toISOString(),
            isSubmittedToPublic: false,
        };
        photoDocRef = await addDocumentNonBlocking(photosCollectionRef, photoData);
        if (!photoDocRef) {
          throw new Error("Failed to create photo document reference.");
        }
      } catch (dbError) {
        console.error("Firestore document creation failed:", dbError);
        toast({
          variant: 'destructive',
          title: t('toast_db_fail_title'),
          description: t('toast_db_fail_description'),
        });
        return;
      }


      // 3. Analyze with AI
      let analysisResult: AnalyzePhotoAndSuggestImprovementsOutput;
      try {
        analysisResult = await analyzePhotoAndSuggestImprovements({
          photoUrl: downloadURL,
          language: locale,
        });
        if (!analysisResult?.rating) {
            throw new Error("AI analysis did not return a rating.");
        }
      } catch (error) {
        console.error('Analiz başarısız:', error);
        toast({
          variant: 'destructive',
          title: t('toast_analysis_fail_title'),
          description: t('toast_analysis_fail_description'),
        });
        return; // Stop here, photo is already in gallery without analysis
      }
      setResult(analysisResult);

      // 4. Update photo with AI results and handle Gamification
      const xpFromAnalysis = 15;
      const bonusXp = analysisResult.rating.overall >= 8.0 ? 50 : 0;
      const totalXpGained = xpFromAnalysis + bonusXp;

      const currentLevel = getLevelFromXp(currentXp);
      const newXp = currentXp + totalXpGained;
      const newLevel = getLevelFromXp(newXp);
      
      const updatePayload: Partial<UserProfile> = {
        auro_balance: currentAuro - analysisCost,
        current_xp: newXp
      };

      if (newLevel.name !== currentLevel.name) {
        updatePayload.level_name = newLevel.name;
        if (newLevel.isMentor) {
            updatePayload.is_mentor = true;
        }
      }

      // Update the user profile and the photo document simultaneously.
      updateDocumentNonBlocking(userDocRef, updatePayload);
      updateDocumentNonBlocking(photoDocRef, {
        aiFeedback: analysisResult,
        tags: analysisResult.tags || [],
      });
      

      // 5. Gamification Toasts
      toast({
        title: t('toast_xp_gain_title'),
        description: t('toast_xp_gain_description', { xp: xpFromAnalysis }),
      });
      if(bonusXp > 0) {
          setTimeout(() => {
            toast({
              title: t('toast_bonus_title'),
              description: t('toast_bonus_description', { xp: bonusXp }),
            });
          }, 100);
      }
      if (updatePayload.level_name) {
          setTimeout(() => {
            toast({
              title: t('toast_level_up_title'),
              description: t('toast_level_up_description', { level: updatePayload.level_name }),
            });
          }, 200);
           if (updatePayload.is_mentor) {
            setTimeout(() => {
                toast({
                  title: t('toast_mentor_title'),
                  description: t('toast_mentor_description'),
                });
              }, 300);
          }
      }
    });
  };

  const canInteract = !isPending && !isUploading && !isProfileLoading && !!userProfile;
  const canAnalyze = canInteract && userProfile && userProfile.auro_balance >= 2;

  return (
    <div className="space-y-8">
       {!result && !preview && (
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Merhaba, {userProfile?.name?.split(' ')[0] || 'dostum'}.</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ben senin Görsel Koçunum. Fotoğraflarını birlikte geliştireceğiz. Işık, kompozisyon ve teknik detayları analiz eder, güçlü yanlarını gösterir ve zayıf noktalarını net biçimde söylerim. <br/>
            <span className="font-semibold text-foreground">Hazırsan ilk fotoğrafını yükle.</span>
          </p>
        </div>
      )}
      {result ? (
        <>
          <AnalysisResult result={result} />
          <Button onClick={handleClear} variant="outline" className="w-full">
            {t('button_new_analysis')}
          </Button>
        </>
      ) : preview ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-muted/20">
              <Image 
                src={preview} 
                alt="Preview" 
                fill 
                sizes="(max-width: 768px) 100vw, 50vw" 
                className={cn("object-contain transition-all", (isPending || isUploading) && "opacity-50")}
              />
              
              {(isPending || isUploading) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-3 font-semibold text-lg">
                        {isPending ? t('state_analyzing') : t('state_uploading')}
                    </p>
                    {isPending && <p className="text-sm mt-1">{t('state_wait')}</p>}
                </div>
              )}
              
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 right-4 h-8 w-8 rounded-full"
                onClick={handleClear}
                disabled={isPending || isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <Button onClick={handleAnalyze} disabled={!canAnalyze || !file || isPending || isUploading} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('state_analyzing')}
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {t('button_analyze', { cost: 2 })}
                  </>
                )}
              </Button>
               <Button onClick={handleUploadOnly} disabled={!canInteract || !file || isPending || isUploading} variant="secondary" size="lg">
                 {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('button_uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('button_upload_only')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'relative w-full h-80 rounded-lg border-2 border-dashed border-muted-foreground/50 transition-colors duration-200 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary hover:bg-accent',
            isDragging && 'border-primary bg-accent'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*"
          />
          <div className="space-y-4">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-primary">{t('upload_prompt_click')}</span> {t('upload_prompt_drag')}
            </p>
            <p className="text-xs text-muted-foreground">Analiz başlasın.</p>
          </div>
        </div>
      )}
    </div>
  );
}
