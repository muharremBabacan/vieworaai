
'use client';
import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, increment, deleteDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { useLocale, useTranslations } from 'next-intl';

import type { Photo, PhotoAnalysis, User } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Globe, Loader2, ArrowLeftRight, Star } from 'lucide-react';
import { useRouter } from '@/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const ANALYSIS_COST = 1;
const SUBMIT_TO_EXHIBITION_COST = 1;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const RatingBar = ({ label, score }: { label: string; score: number }) => (
    <div>
        <div className="flex justify-between items-center mb-1 text-sm">
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className="font-semibold">{score.toFixed(1)}</span>
        </div>
        <Progress value={score * 10} className="h-2" />
    </div>
);

const PhotoDetailDialog = ({
  photo,
  isOpen,
  onClose,
  onAnalyze,
  onToggleExhibition,
  onDelete,
  isProcessing
}: {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (photo: Photo) => void;
  onToggleExhibition: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  isProcessing: boolean;
}) => {
  const t = useTranslations('GalleryPage');
  const tRatings = useTranslations('Ratings');
  const tDashboard = useTranslations('DashboardPage');

  const { overallScore, lightScore, compositionScore, technicalScore } = useMemo(() => {
    if (!photo?.aiFeedback) return { overallScore: 0, lightScore: 0, compositionScore: 0, technicalScore: 0 };
    
    const lScore = normalizeScore(photo.aiFeedback.light_score);
    const cScore = normalizeScore(photo.aiFeedback.composition_score);
    const techScore = (normalizeScore(photo.aiFeedback.focus_score) + normalizeScore(photo.aiFeedback.color_control_score) + normalizeScore(photo.aiFeedback.background_control_score)) / 3;
    const ovScore = (lScore + cScore + techScore) / 3;

    return {
      overallScore: ovScore,
      lightScore: lScore,
      compositionScore: cScore,
      technicalScore: techScore
    };
  }, [photo?.aiFeedback]);
  

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0">
          <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/50 shrink-0">
              <Image src={photo.imageUrl} alt="User photo" fill className="object-contain" />
          </div>
          <div className="md:w-2/5 w-full flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {photo.aiFeedback ? (
                      <>
                          <Card>
                              <CardHeader>
                                  <CardTitle>{t('rating_card_title')}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="flex justify-between items-baseline">
                                      <h3 className="font-semibold text-lg">{tRatings('overall')}</h3>
                                      <p className="text-4xl font-bold tracking-tighter text-blue-400">{overallScore.toFixed(1)}</p>
                                  </div>
                                  <hr className="border-border" />
                                  <div className="space-y-4">
                                      <RatingBar label={tRatings('light')} score={lightScore} />
                                      <RatingBar label={tRatings('composition')} score={compositionScore} />
                                      <RatingBar label={tRatings('technical')} score={technicalScore} />
                                  </div>
                              </CardContent>
                          </Card>

                          <div>
                              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                                  <Sparkles className="h-5 w-5 text-primary" />
                                  {tDashboard('ai_analysis_title')}
                              </h3>
                              <div
                                  className="prose prose-sm dark:prose-invert"
                                  dangerouslySetInnerHTML={{ __html: (photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis).replace(/\n/g, '<br />') }}
                              />
                          </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg bg-muted/50 h-full">
                          <p className="text-muted-foreground font-semibold">{t('status_awaiting_analysis')}</p>
                          <Button onClick={() => onAnalyze(photo)} className="mt-4" disabled={isProcessing}>
                              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              {t('button_get_score', { cost: ANALYSIS_COST })}
                          </Button>
                      </div>
                  )}
              </div>
              <div className="p-6 border-t flex flex-col gap-2 shrink-0">
                  <Button onClick={() => onToggleExhibition(photo)} variant="outline" disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      {photo.isSubmittedToExhibition ? t('button_withdraw_from_exhibition') : t('button_submit_to_exhibition', { cost: SUBMIT_TO_EXHIBITION_COST })}
                  </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isProcessing}>
                              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              <Trash2 className="mr-2 h-4 w-4" /> {t('button_delete_permanently')}
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>{t('alert_dialog_title')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('alert_dialog_delete_description')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>İptal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(photo)}>{t('alert_dialog_confirm')}</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          </div>
      </DialogContent>
    </Dialog>
  );
};


export default function GalleryPage() {
    const t = useTranslations('GalleryPage');
    const tLogin = useTranslations('LoginPage');
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const locale = useLocale();

    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);

    const photosQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'photos'), where('userId', '==', user.uid)) : null, [user, firestore]);
    const { data: photos, isLoading } = useCollection<Photo>(photosQuery);

    const filters = [
      { id: 'all', label: t('filter_all') },
      { id: 'unanalyzed', label: t('status_awaiting_analysis') },
      { id: 'best_overall', label: t('filter_best_overall') },
      { id: 'best_light', label: t('filter_best_light') },
      { id: 'best_composition', label: t('filter_best_composition') },
    ];
    
    const getOverallScore = (photo: Photo): number => {
        if (!photo.aiFeedback) return 0;
        const lScore = normalizeScore(photo.aiFeedback.light_score);
        const cScore = normalizeScore(photo.aiFeedback.composition_score);
        const techScore = (normalizeScore(photo.aiFeedback.focus_score) + normalizeScore(photo.aiFeedback.color_control_score) + normalizeScore(photo.aiFeedback.background_control_score)) / 3;
        return (lScore + cScore + techScore) / 3;
    };

    const filteredPhotos = useMemo(() => {
        if (!photos) return [];
    
        switch (activeFilter) {
            case 'all':
                return [...photos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            case 'unanalyzed':
                return photos.filter(p => !p.aiFeedback).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            case 'best_overall':
                return photos
                    .filter(p => p.aiFeedback)
                    .sort((a, b) => getOverallScore(b) - getOverallScore(a));
    
            case 'best_light':
                return photos
                    .filter(p => p.aiFeedback)
                    .sort((a, b) => normalizeScore(b.aiFeedback?.light_score) - normalizeScore(a.aiFeedback?.light_score));
    
            case 'best_composition':
                return photos
                    .filter(p => p.aiFeedback)
                    .sort((a, b) => normalizeScore(b.aiFeedback?.composition_score) - normalizeScore(a.aiFeedback?.composition_score));
            
            default:
                return [...photos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
    }, [photos, activeFilter]);

    const handleAnalyze = async (photo: Photo) => {
        if (!userProfile || userProfile.auro_balance < ANALYSIS_COST) {
            toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_analysis', { cost: ANALYSIS_COST }) });
            return;
        }
        setIsProcessing(true);
        toast({ title: t('toast_analysis_start_title'), description: t('toast_analysis_start_description') });

        try {
            const analysis = await generatePhotoAnalysis({ photoUrl: photo.imageUrl, language: locale });
            const photoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
            const userRef = doc(firestore, 'users', user.uid);
            
            const batch = writeBatch(firestore);
            batch.update(photoRef, { aiFeedback: analysis });
            batch.update(userRef, { auro_balance: increment(-ANALYSIS_COST) });
            await batch.commit();

            toast({ title: t('toast_success_title'), description: t('toast_analysis_complete') });
            setSelectedPhoto({ ...photo, aiFeedback: analysis });
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_analysis') });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (photo: Photo) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const photoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
            const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
            
            batch.delete(photoRef);
            batch.delete(publicPhotoRef); // Also delete from public collection
            
            await batch.commit();

            if (photo.filePath) {
                const storageRef = ref(storage, photo.filePath);
                await deleteObject(storageRef);
            }

            toast({ title: t('toast_success_title'), description: t('toast_delete_complete') });
            onCloseDialog();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_delete') });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleToggleExhibition = async (photo: Photo) => {
      if (!user || !userProfile) return;
      setIsProcessing(true);
  
      const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
      const userPhotoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
  
      try {
        if (photo.isSubmittedToExhibition) {
          // Withdraw from exhibition
          await deleteDoc(publicPhotoRef);
          await updateDoc(userPhotoRef, { isSubmittedToExhibition: false });
          toast({ title: t('toast_success_title'), description: t('toast_withdraw_exhibition_complete') });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false } : null);
        } else {
          // Submit to exhibition
          if (!photo.aiFeedback) {
             toast({ variant: 'destructive', title: 'Analiz Gerekli', description: 'Sergiye göndermeden önce fotoğrafı analiz etmelisiniz.' });
             setIsProcessing(false);
             return;
          }
          const publicPhotoData = {
            ...photo,
            isSubmittedToExhibition: true,
            userName: userProfile.name || tLogin('anonymous_artist'),
            userPhotoURL: userProfile.photoURL || null,
            userLevelName: userProfile.level_name,
          };
          await setDoc(publicPhotoRef, publicPhotoData);
          await updateDoc(userPhotoRef, { isSubmittedToExhibition: true });
          toast({ title: t('toast_success_title'), description: t('toast_submit_exhibition_complete') });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true } : null);
        }
      } catch (error) {
        console.error("Exhibition toggle error:", error);
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_exhibition') });
      } finally {
        setIsProcessing(false);
      }
    };

    const onCloseDialog = () => setSelectedPhoto(null);

    if (isLoading) {
        return (
            <div className="container mx-auto">
                <Skeleton className="h-8 w-48 mb-8" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                </div>
            </div>
        );
    }
    
    return (
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{t('title')}</h1>
        {photos && photos.length > 0 ? (
          <>
            <div className="mb-6">
                 <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                    {filters.map((filter) => (
                        <Button
                            key={filter.id}
                            variant={activeFilter === filter.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveFilter(filter.id)}
                            className="shrink-0"
                        >
                            {filter.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredPhotos.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <Image src={photo.imageUrl} alt="User submission" fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    {photo.aiFeedback && (
                        <Badge variant="secondary" className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                            <Star className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs font-bold">{getOverallScore(photo).toFixed(1)}</span>
                        </Badge>
                    )}

                    {!photo.aiFeedback && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <p className="text-white font-semibold text-sm">{t('status_awaiting_analysis')}</p>
                        </div>
                    )}
                    {photo.isSubmittedToExhibition && (
                        <div className="absolute top-2 left-2 p-1.5 bg-background/70 rounded-full backdrop-blur-sm">
                            <Globe className="h-4 w-4 text-primary" />
                        </div>
                    )}
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
            <h3 className="text-2xl font-semibold">{t('no_photos_title')}</h3>
            <p className="text-muted-foreground mt-2">{t('no_photos_description')}</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-6">
                <Sparkles className="mr-2 h-4 w-4" />
                {t('button_start_analysis')}
            </Button>
          </div>
        )}
        <PhotoDetailDialog 
            photo={selectedPhoto} 
            isOpen={!!selectedPhoto} 
            onClose={onCloseDialog}
            onAnalyze={handleAnalyze}
            onToggleExhibition={handleToggleExhibition}
            onDelete={handleDelete}
            isProcessing={isProcessing}
        />
      </div>
    );
}
