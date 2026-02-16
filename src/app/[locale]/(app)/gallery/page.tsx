'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Link } from '@/navigation';
import { generatePhotoAnalysis, type PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { Photo, User as UserProfile, PhotoAnalysis } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Lightbulb, LayoutPanelLeft, Heart, Star, Loader2, Rocket, Clock, Zap, Undo2, Trash2, Camera, Smartphone, HelpCircle, Bot } from 'lucide-react';
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

function RatingDisplay({ analysis }: { analysis: PhotoAnalysis }) {
  const t = useTranslations('GalleryPage');
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
                  <p className="text-5xl font-bold text-primary">{overallScore.toFixed(0)}</p>
              </div>
              <div className="flex-1 space-y-2">
                  {ratingItems.map(item => (
                      <div key={item.label} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{ width: `${(item.value ?? 0) * 10}%` }}
                                />
                            </div>
                            <span className="text-sm font-semibold w-8 text-right">{((item.value ?? 0)).toFixed(0)}</span>
                          </div>
                      </div>
                  ))}
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
  const { toast } = useToast();
  const firestore = useFirestore();
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogAction, setDialogAction] = useState<'withdraw' | 'delete' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setIsAnalyzing(false);
      setIsProcessing(false);
      setDialogAction(null);
    }
  }, [isOpen]);

  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

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

  const handleSubmitToPublic = () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    const submissionCost = 5;
    const currentAuro = userProfile.auro_balance || 0;

    if (currentAuro < submissionCost) {
        toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_submit', { cost: submissionCost }) });
        return;
    }

    setIsSubmitting(true);
    const publicPhotosRef = collection(firestore, 'public_photos');
    const { id, ...publicPhotoData } = photo;
    addDocumentNonBlocking(publicPhotosRef, publicPhotoData);
    updateDocumentNonBlocking(userDocRef, { auro_balance: currentAuro - submissionCost });
    updateDocumentNonBlocking(doc(firestore, 'users', photo.userId, 'photos', photo.id), { isSubmittedToPublic: true });
    
    toast({ title: t('toast_success_title'), description: t('toast_submit_complete') });
    onOpenChange(false);
    setIsSubmitting(false);
  };
  
  const handleWithdrawFromPublic = async () => {
    if (!photo || !photo.userId || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
        const publicPhotosQuery = query(collection(firestore, 'public_photos'), where('imageUrl', '==', photo.imageUrl), where('userId', '==', photo.userId), limit(1));
        const querySnapshot = await getDocs(publicPhotosQuery);
        const deletionPromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all([...deletionPromises, updateDoc(doc(firestore, 'users', photo.userId, 'photos', photo.id), { isSubmittedToPublic: false })]);
        
        toast({ title: t('toast_success_title'), description: t('toast_withdraw_complete') });

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDialogAction(null); 

        setTimeout(() => {
          onOpenChange(false);
          setIsProcessing(false);
        }, 200);

    } catch (error) {
        console.error("Çekme hatası:", error);
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_withdraw') });
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
            deletionPromises.push(deleteObject(imageRef).catch(e => console.warn("Storage silinemedi:", e)));
        }
        
        if (photo.isSubmittedToPublic) {
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
        console.error("Silme hatası:", error);
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
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="md:w-2/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image src={photo.imageUrl} alt="Analiz" fill className="object-contain" unoptimized priority />
        </div>
        <div className="md:w-3/5 w-full overflow-y-auto flex flex-col p-6 space-y-6">
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
                <DialogDescription className="text-base leading-relaxed text-foreground/80">
                  {photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis}
                </DialogDescription>
              </>
            ) : (
              <div className="text-center py-10 space-y-4">
                <p>Bu fotoğraf henüz analiz edilmedi.</p>
                <Button onClick={handleAnalyzeNow} disabled={isLoading}>
                    {isAnalyzing ? <Loader2 className="animate-spin"/> : t('button_get_score', { cost: 2 })}
                </Button>
              </div>
            )}
          <div className="pt-6 border-t space-y-3">
             {photo.aiFeedback && (
                photo.isSubmittedToPublic ? (
                    <Button type="button" variant="outline" className="w-full" onClick={() => setDialogAction('withdraw')} disabled={isLoading}>
                        {isLoading && dialogAction === 'withdraw' ? <Loader2 className="animate-spin"/> : t('button_withdraw_from_public')}
                    </Button>
                ) : (
                    <Button type="button" className="w-full" onClick={handleSubmitToPublic} disabled={isLoading}>
                        {isSubmitting ? <Loader2 className="animate-spin"/> : t('button_submit_to_public', { cost: 5 })}
                    </Button>
                )
             )}
             <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setDialogAction('delete')} disabled={isLoading}>
                {isLoading && dialogAction === 'delete' ? <Loader2 className="animate-spin"/> : t('button_delete_permanently')}
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
                  onClick={() => dialogAction === 'withdraw' ? handleWithdrawFromPublic() : handleDeletePhoto()}>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
          
          <div className="absolute top-2 left-2">
            {photo.isSubmittedToPublic && (
              <Badge variant="secondary" className="bg-purple-600 text-white border-transparent p-1 backdrop-blur-sm">
                <Rocket className="h-3 w-3" />
              </Badge>
            )}
          </div>

          {photo.aiFeedback && (() => {
              const scores = [photo.aiFeedback.light_score, photo.aiFeedback.composition_score, photo.aiFeedback.focus_score, photo.aiFeedback.color_control_score, photo.aiFeedback.background_control_score, photo.aiFeedback.creativity_risk_score];
              const validScores = scores.filter((score): score is number => typeof score === 'number' && isFinite(score));
              const overallScore = validScores.length > 0 ? (validScores.reduce((s, v) => s + v, 0) / validScores.length) : 0;
              return (
                <Badge className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <span className="text-xs font-bold">{overallScore.toFixed(0)}</span>
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
