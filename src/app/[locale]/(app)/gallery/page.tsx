'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Link } from '@/navigation';
import { generatePhotoAnalysis, type PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { Photo, User as UserProfile, PhotoAnalysis } from '@/types';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Star, Loader2, Eye, Clock, Zap, Trash2, Camera, Smartphone, HelpCircle, Bot, LibrarySquare } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference, where, getDocs, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getLevelFromXp } from '@/lib/gamification';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useLocale, useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

function RatingDisplay({ analysis }: { analysis: PhotoAnalysis }) {
  const t = useTranslations('GalleryPage');
  const tRatings = useTranslations('Ratings');
  
  const lightScore = normalizeScore(analysis.light_score);
  const compositionScore = normalizeScore(analysis.composition_score);
  
  const technicalSubScores = [
    normalizeScore(analysis.focus_score),
    normalizeScore(analysis.color_control_score),
    normalizeScore(analysis.background_control_score),
    normalizeScore(analysis.creativity_risk_score),
  ];
  const technicalScore = technicalSubScores.length > 0 ? technicalSubScores.reduce((sum, score) => sum + score, 0) / technicalSubScores.length : 0;

  const mainScores = [lightScore, compositionScore, technicalScore].filter(s => !isNaN(s));
  const overallScore = mainScores.length > 0 ? mainScores.reduce((sum, score) => sum + score, 0) / mainScores.length : 0;

  const ScoreBar = ({ label, score }: { label: string; score: number }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-bold">{score.toFixed(1)}</span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Progress value={score * 10} className="h-2 [&>div]:bg-primary" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{score.toFixed(2)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
  
  return (
      <div>
        <h4 className="font-semibold text-lg mb-4">{t('rating_card_title')}</h4>
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-semibold">{t('overall_score')}</span>
                <span className="text-3xl font-bold text-primary">{overallScore.toFixed(1)}</span>
            </div>
            <div className="space-y-4 flex-grow">
                <ScoreBar label={tRatings('lighting')} score={lightScore} />
                <ScoreBar label={tRatings('composition')} score={compositionScore} />
                <ScoreBar label={tRatings('technical')} score={technicalScore} />
            </div>
        </div>
      </div>
  )
}

function PhotoDetailDialog({ 
    photo, 
    isOpen, 
    onOpenChange,
    userProfile,
    userDocRef,
}: { 
    photo: Photo | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void 
    userProfile: UserProfile | null,
    userDocRef: DocumentReference | null,
}) {
  const t = useTranslations('GalleryPage');
  const tExplore = useTranslations('ExplorePage');
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogAction, setDialogAction] = useState<'withdrawExhibition' | 'delete' | null>(null);
  const [foyerPhotosCount, setFoyerPhotosCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !firestore || !photo?.userId) return;
    const foyerQuery = query(collection(firestore, 'users', photo.userId, 'photos'), where("isInFoyer", "==", true), limit(11));
    getDocs(foyerQuery).then(snapshot => {
      setFoyerPhotosCount(snapshot.size);
    });
  }, [firestore, photo?.userId, isOpen]);
  
  const canAddToFoyer = foyerPhotosCount < 10;

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setIsAnalyzing(false);
      setIsProcessing(false);
      setDialogAction(null);
    }
  }, [isOpen]);
  
  const handleToggleFoyer = async () => {
    if (!photo || !photo.userId || !firestore || isProcessing) return;
    
    if (!photo.isInFoyer && !canAddToFoyer) {
      toast({ variant: "destructive", title: t('foyer_limit_reached') });
      return;
    }
    
    setIsProcessing(true);
    try {
      const photoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
      await updateDoc(photoRef, { isInFoyer: !photo.isInFoyer });
      toast({ title: t('toast_success_title'), description: photo.isInFoyer ? t('toast_remove_foyer_complete') : t('toast_add_foyer_complete') });
      onOpenChange(false);
    } catch (error) {
      console.error("Foyer toggle error:", error);
      toast({ variant: "destructive", title: t('toast_error_title'), description: t('toast_error_foyer') });
    } finally {
      setIsProcessing(false);
    }
  };


  const getCameraInfo = () => {
    if (!photo?.aiFeedback) return null;
    
    const { device_estimation } = photo.aiFeedback;

    if (!device_estimation || device_estimation === 'unknown') {
        return { icon: HelpCircle, text: t('camera_info_unknown') };
    }

    const typeMap = {
        'pro_dslr': { text: t('camera_type_pro'), icon: Camera},
        'mirrorless': { text: t('camera_type_pro'), icon: Camera},
        'entry_dslr': { text: t('camera_type_pro'), icon: Camera},
        'mobile': { text: t('camera_type_mobile'), icon: Smartphone},
    }

    return typeMap[device_estimation] || { icon: HelpCircle, text: t('camera_info_unknown') };
  };
  
  const CameraInfo = getCameraInfo();


  const handleAnalyzeNow = async () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    const analysisCost = 2;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;

    if (currentAuro < analysisCost) {
        toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_analysis', { cost: analysisCost }) });
        return;
    }

    setIsAnalyzing(true);
    toast({ title: t('toast_analysis_start_title'), description: t('toast_analysis_start_description') });

    try {
      const analysisResult = await generatePhotoAnalysis({ photoUrl: photo.imageUrl });
      
      const originalPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
      
      const scores = [
        analysisResult.light_score,
        analysisResult.composition_score,
        analysisResult.focus_score,
        analysisResult.color_control_score,
        analysisResult.background_control_score,
        analysisResult.creativity_risk_score,
      ];
      const overallScore = scores.reduce((sum, score) => sum + (score || 0), 0) / scores.length;
      
      const totalXpGained = 15 + (overallScore >= 8.0 ? 50 : 0);
      const newXp = currentXp + totalXpGained;
      const newLevel = getLevelFromXp(newXp);
      
      const userUpdatePayload: Partial<UserProfile> = { auro_balance: currentAuro - analysisCost, current_xp: newXp };
      if (newLevel.name !== getLevelFromXp(currentXp).name) userUpdatePayload.level_name = newLevel.name;

      updateDocumentNonBlocking(userDocRef, userUpdatePayload);
      updateDocumentNonBlocking(originalPhotoRef, { aiFeedback: analysisResult, tags: [analysisResult.genre] });

      toast({ title: t('toast_success_title'), description: t('toast_analysis_complete') });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_analysis') });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitToExhibition = () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    const submissionCost = 5;
    const currentAuro = userProfile.auro_balance || 0;

    if (currentAuro < submissionCost) {
        toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_analysis', { cost: submissionCost }) });
        return;
    }

    setIsSubmitting(true);
    const publicPhotosRef = collection(firestore, 'public_photos');
    const { id, ...photoData } = photo;
    
    // Denormalize user data into the public photo document
    const submissionData = {
      ...photoData,
      userName: userProfile.name,
      userPhotoURL: userProfile.photoURL,
      userLevelName: userProfile.level_name,
    };

    addDocumentNonBlocking(publicPhotosRef, submissionData);
    updateDocumentNonBlocking(userDocRef, { auro_balance: currentAuro - submissionCost });
    updateDocumentNonBlocking(doc(firestore, 'users', photo.userId, 'photos', photo.id), { isSubmittedToExhibition: true });
    
    toast({ title: t('toast_success_title'), description: t('toast_submit_exhibition_complete') });
    onOpenChange(false);
    setIsSubmitting(false);
  };
  
  const handleWithdrawFromExhibition = async () => {
    if (!photo || !photo.userId || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
        const publicPhotosQuery = query(collection(firestore, 'public_photos'), where('imageUrl', '==', photo.imageUrl), where('userId', '==', photo.userId), limit(1));
        const querySnapshot = await getDocs(publicPhotosQuery);
        const deletionPromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all([...deletionPromises, updateDoc(doc(firestore, 'users', photo.userId, 'photos', photo.id), { isSubmittedToExhibition: false })]);
        
        toast({ title: t('toast_success_title'), description: t('toast_withdraw_exhibition_complete') });

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDialogAction(null); 

        setTimeout(() => {
          onOpenChange(false);
          setIsProcessing(false);
        }, 200);

    } catch (error) {
        console.error("Withdrawal error:", error);
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_exhibition') });
        setIsProcessing(false);
    }
  };

  const getPathFromStorageUrl = (url: string): string | null => {
      if (!url.includes('firebasestorage.googleapis.com')) return null;
      try {
          const parts = new URL(url).pathname.split('/o/');
          return parts.length < 2 ? null : decodeURIComponent(parts[1].split('?')[0]);
      } catch (e) { return null; }
  };
  
  const handleDeletePhoto = async () => {
    if (!photo || !photo.userId || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
        const deletionPromises: Promise<any>[] = [deleteDoc(doc(firestore, 'users', photo.userId, 'photos', photo.id))];
        const filePath = photo.filePath || getPathFromStorageUrl(photo.imageUrl);
        if (filePath) {
            const storage = getStorage();
            const imageRef = storageRef(storage, filePath);
            deletionPromises.push(deleteObject(imageRef).catch(e => console.warn("Storage deletion failed:", e)));
        }
        
        if (photo.isSubmittedToExhibition) {
            const pubQuery = query(collection(firestore, 'public_photos'), where('imageUrl', '==', photo.imageUrl), where('userId', '==', photo.userId));
            const snap = await getDocs(pubQuery);
            snap.forEach(d => deletionPromises.push(deleteDoc(d.ref)));
        }

        await Promise.all(deletionPromises);
        
        toast({ title: t('toast_success_title'), description: t('toast_delete_complete') });

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDialogAction(null);

        setTimeout(() => {
          onOpenChange(false);
          setIsProcessing(false);
        }, 200);

    } catch (error) {
        console.error("Deletion error:", error);
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_delete') });
        setIsProcessing(false);
    }
  };

  if (!photo) return null;
  const isLoading = isAnalyzing || isSubmitting || isProcessing;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0"
      >
        <div className="md:w-3/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image src={photo.imageUrl} alt="Analiz" fill className="object-contain" unoptimized priority />
        </div>
        <div className="md:w-2/5 w-full overflow-y-auto flex flex-col p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">{t('dialog_title')}</DialogTitle>
            </DialogHeader>

             {CameraInfo && (
                <div className={cn("flex items-center gap-2 text-sm p-3 rounded-lg border bg-secondary/30", CameraInfo.color)}>
                    <CameraInfo.icon className={cn("h-5 w-5", CameraInfo.color ? CameraInfo.color : 'text-primary')} />
                    <span className="font-medium">{CameraInfo.text}</span>
                </div>
            )}
            
            {photo.tags && photo.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {photo.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="capitalize">{tag}</Badge>
                    ))}
                </div>
            )}

            {photo.aiFeedback ? (
              <>
                <RatingDisplay analysis={photo.aiFeedback} />
                 <div>
                  <h4 className="font-semibold text-lg mb-2 flex items-center gap-2"><Bot className="h-5 w-5" /> {tExplore('analysis_summary_title')}</h4>
                   <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: (photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                </div>
              </>
            ) : (
              <div className="text-center py-10 space-y-4">
                <p className="text-muted-foreground">{t('status_awaiting_analysis')}</p>
                <Button onClick={handleAnalyzeNow} disabled={isLoading}>
                    {isAnalyzing ? <Loader2 className="animate-spin"/> : <><Zap className="mr-2 h-4 w-4" />{t('button_get_score', { cost: 2 })}</>}
                </Button>
              </div>
            )}
          <div className="pt-6 border-t space-y-3 !mt-auto">
             {photo.aiFeedback && (
                <div className="space-y-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          {photo.isInFoyer ? (
                            <Button variant="secondary" className="w-full" onClick={handleToggleFoyer} disabled={isLoading}>
                              {isProcessing ? <Loader2 className="animate-spin" /> : <><LibrarySquare className="mr-2 h-4 w-4"/>{t('button_remove_from_foyer')}</>}
                            </Button>
                          ) : (
                            <Button variant="secondary" className="w-full" onClick={handleToggleFoyer} disabled={isLoading || !canAddToFoyer}>
                               {isProcessing ? <Loader2 className="animate-spin" /> : <><LibrarySquare className="mr-2 h-4 w-4"/>{t('button_add_to_foyer')}</>}
                            </Button>
                          )}
                        </div>
                      </TooltipTrigger>
                      {!photo.isInFoyer && !canAddToFoyer && (
                        <TooltipContent><p>{t('foyer_limit_reached')}</p></TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  {photo.isSubmittedToExhibition ? (
                      <Button variant="outline" className="w-full" onClick={() => setDialogAction('withdrawExhibition')} disabled={isLoading}>
                          {isLoading && dialogAction === 'withdrawExhibition' ? <Loader2 className="animate-spin"/> : <><Eye className="mr-2 h-4 w-4"/>{t('button_withdraw_from_exhibition')}</>}
                      </Button>
                  ) : (
                      <Button className="w-full" onClick={handleSubmitToExhibition} disabled={isLoading}>
                          {isSubmitting ? <Loader2 className="animate-spin"/> : <><Eye className="mr-2 h-4 w-4"/>{t('button_submit_to_exhibition', { cost: 5 })}</>}
                      </Button>
                  )}
                </div>
             )}
             <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setDialogAction('delete')} disabled={isLoading}>
                {isLoading && dialogAction === 'delete' ? <Loader2 className="animate-spin"/> : <><Trash2 className="mr-2 h-4 w-4" />{t('button_delete_permanently')}</>}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    <AlertDialog open={!!dialogAction} onOpenChange={(open) => !open && setDialogAction(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t('alert_dialog_title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {dialogAction === 'delete' 
                    ? t('alert_dialog_delete_description')
                    : t('alert_dialog_withdraw_description')}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDialogAction(null)} disabled={isProcessing}>{t('alert_dialog_cancel')}</AlertDialogCancel>
                <AlertDialogAction 
                  disabled={isProcessing}
                  className={cn(dialogAction === 'delete' && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                  onClick={() => dialogAction === 'withdrawExhibition' ? handleWithdrawFromExhibition() : handleDeletePhoto()}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : t('alert_dialog_confirm')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="aspect-square">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function PhotoGrid({ photos, onPhotoClick }: { photos: Photo[], onPhotoClick: (photo: Photo) => void }) {
  const t = useTranslations('GalleryPage');
  if (photos.length === 0) {
    return (
      <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
        <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-2xl font-semibold">{t('no_photos_filtered_title')}</h3>
        <p className="text-muted-foreground mt-2">{t('no_photos_filtered_description')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {photos.map((photo) => (
        <Card 
          key={photo.id} 
          className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" 
          onClick={() => onPhotoClick(photo)}
        >
          <Image src={photo.imageUrl} alt="Kullanıcı fotoğrafı" fill className="object-cover transition-transform group-hover:scale-110" unoptimized />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
            {!photo.aiFeedback && (
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-6 w-6 text-white/80" />
                <span className="text-xs text-white/80 font-semibold">{t('status_awaiting_analysis')}</span>
              </div>
            )}
          </div>
          
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            {photo.isSubmittedToExhibition && (
              <Badge variant="secondary" className="bg-purple-600 text-white border-transparent p-1 backdrop-blur-sm">
                <Eye className="h-3 w-3" />
              </Badge>
            )}
             {photo.isInFoyer && (
              <Badge variant="secondary" className="bg-cyan-500 text-white border-transparent p-1 backdrop-blur-sm">
                <LibrarySquare className="h-3 w-3" />
              </Badge>
            )}
          </div>

          {photo.aiFeedback && (() => {
              const lightScore = normalizeScore(photo.aiFeedback.light_score);
              const compositionScore = normalizeScore(photo.aiFeedback.composition_score);
              const technicalSubScores = [
                normalizeScore(photo.aiFeedback.focus_score),
                normalizeScore(photo.aiFeedback.color_control_score),
                normalizeScore(photo.aiFeedback.background_control_score),
                normalizeScore(photo.aiFeedback.creativity_risk_score),
              ];
              const technicalScore = technicalSubScores.length > 0 ? technicalSubScores.reduce((sum, score) => sum + score, 0) / technicalSubScores.length : 0;
              const mainScores = [lightScore, compositionScore, technicalScore].filter(s => !isNaN(s));
              const overallScore = mainScores.length > 0 ? mainScores.reduce((sum, score) => sum + score, 0) / mainScores.length : 0;
              
              return (
                <Badge className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <span className="text-xs font-bold">{overallScore.toFixed(1)}</span>
                </Badge>
              )
          })()}
        </Card>
      ))}
    </div>
  );
}


export default function GalleryPage() {
  const t = useTranslations('GalleryPage');
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedTag, setSelectedTag] = useState(t('filter_all'));
  
  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: userPhotos, isLoading } = useCollection<Photo>(photosQuery);
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const tags = useMemo(() => {
    if (!userPhotos) return [];

    const specialFilters = [
      t('filter_best_overall'),
      t('filter_best_light'),
      t('filter_best_composition')
    ];

    const allTags = userPhotos.flatMap(p => p.tags || []).filter(Boolean);
    const capitalizedTags = allTags.map(tag => tag.charAt(0).toUpperCase() + tag.slice(1));
    
    return [
      t('filter_all'), 
      ...specialFilters,
      ...Array.from(new Set(capitalizedTags))
    ];
  }, [userPhotos, t]);

  const filteredPhotos = useMemo(() => {
    if (!userPhotos) return [];
    
    const photosToShow = [...userPhotos];
    
    const filter_all = t('filter_all');
    const filter_best_overall = t('filter_best_overall');
    const filter_best_light = t('filter_best_light');
    const filter_best_composition = t('filter_best_composition');

    if (selectedTag === filter_all) {
      return photosToShow;
    }
    
    if (selectedTag === filter_best_overall) {
      return photosToShow
        .filter(p => p.aiFeedback)
        .sort((a, b) => {
            const aScores = [a.aiFeedback!.light_score, a.aiFeedback!.composition_score, a.aiFeedback!.focus_score, a.aiFeedback!.color_control_score, a.aiFeedback!.background_control_score, a.aiFeedback!.creativity_risk_score].filter((s): s is number => typeof s === 'number' && isFinite(s));
            const aOverall = aScores.length > 0 ? aScores.reduce((s, v) => s + (v || 0), 0) / aScores.length : 0;
            const bScores = [b.aiFeedback!.light_score, b.aiFeedback!.composition_score, b.aiFeedback!.focus_score, b.aiFeedback!.color_control_score, b.aiFeedback!.background_control_score, b.aiFeedback!.creativity_risk_score].filter((s): s is number => typeof s === 'number' && isFinite(s));
            const bOverall = bScores.length > 0 ? bScores.reduce((s, v) => s + (v || 0), 0) / bScores.length : 0;
            return bOverall - aOverall;
        });
    }

    if (selectedTag === filter_best_light) {
      return photosToShow
        .filter(p => p.aiFeedback?.light_score)
        .sort((a, b) => (b.aiFeedback!.light_score!) - (a.aiFeedback!.light_score!));
    }
    
    if (selectedTag === filter_best_composition) {
      return photosToShow
        .filter(p => p.aiFeedback?.composition_score)
        .sort((a, b) => (b.aiFeedback!.composition_score!) - (a.aiFeedback!.composition_score!));
    }

    // Default to tag filtering
    return userPhotos.filter(photo => 
      photo.tags?.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
    );
  }, [userPhotos, selectedTag, t]);


  // Handle case where there are no photos at all to avoid showing filter bar
  if (!isLoading && (!userPhotos || userPhotos.length === 0)) {
    return (
      <div className="container mx-auto">
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">{t('no_photos_title')}</h3>
          <p className="text-muted-foreground mt-2">{t('no_photos_description')}</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">{t('button_start_analysis')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      {tags && tags.length > 1 && (
        <div className="mb-8">
          <Carousel
            opts={{
              align: "start",
              dragFree: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {tags.map((tag) => (
                <CarouselItem key={tag} className="basis-auto pl-2">
                  <Button
                    variant={selectedTag === tag ? 'default' : 'secondary'}
                    onClick={() => setSelectedTag(tag)}
                    className="rounded-full px-5 py-2 text-sm capitalize"
                  >
                    {tag}
                  </Button>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      )}

      {isLoading ? <GallerySkeleton /> : <PhotoGrid photos={filteredPhotos || []} onPhotoClick={setSelectedPhoto} />}
      
      <PhotoDetailDialog 
        photo={selectedPhoto} 
        isOpen={!!selectedPhoto}
        onOpenChange={(open) => !open && setSelectedPhoto(null)}
        userProfile={userProfile}
        userDocRef={userDocRef}
      />
    </div>
  );
}
