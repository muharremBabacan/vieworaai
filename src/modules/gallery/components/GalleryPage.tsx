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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Globe, Eye, Loader2, ArrowLeftRight } from 'lucide-react';
import { useRouter } from '@/navigation';

const ANALYSIS_COST = 1;
const SUBMIT_TO_EXHIBITION_COST = 0; // Or some other value

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

  const overallScore = useMemo(() => {
    if (!photo?.aiFeedback) return 0;
    const scores = [
      photo.aiFeedback.light_score,
      photo.aiFeedback.composition_score,
      photo.aiFeedback.focus_score,
      photo.aiFeedback.color_control_score,
      photo.aiFeedback.background_control_score,
      photo.aiFeedback.creativity_risk_score,
    ];
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [photo?.aiFeedback]);

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] grid grid-rows-[auto_1fr] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{t('dialog_title')}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6 overflow-hidden p-6 pt-2">
          <div className="relative rounded-lg overflow-hidden aspect-square -mx-6 -mt-4 md:m-0">
            <Image src={photo.imageUrl} alt="User photo" fill className="object-cover" />
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            {photo.aiFeedback ? (
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Özet</TabsTrigger>
                  <TabsTrigger value="scores">Detaylı Puanlar</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="prose prose-sm dark:prose-invert">
                  <p>{photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis}</p>
                </TabsContent>
                <TabsContent value="scores">
                  <p>Overall: {overallScore.toFixed(1)}</p>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg bg-muted/50 h-full">
                <p className="text-muted-foreground font-semibold">{t('status_awaiting_analysis')}</p>
                <Button onClick={() => onAnalyze(photo)} className="mt-4" disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {t('button_get_score', { cost: ANALYSIS_COST })}
                </Button>
              </div>
            )}

            <div className="flex-grow" />

            <div className="flex flex-col gap-2 pt-4 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default function GalleryPage() {
    const t = useTranslations('GalleryPage');
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

    const filteredPhotos = useMemo(() => {
        if (!photos) return [];
        let sorted = [...photos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (activeFilter === 'all') return sorted;
        if (activeFilter === 'analyzed') return sorted.filter(p => p.aiFeedback);
        if (activeFilter === 'unanalyzed') return sorted.filter(p => !p.aiFeedback);
        return sorted;
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
            userName: userProfile.name,
            userPhotoURL: userProfile.photoURL,
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
                 <Tabs value={activeFilter} onValueChange={setActiveFilter}>
                    <TabsList>
                        <TabsTrigger value="all">{t('filter_all')}</TabsTrigger>
                        <TabsTrigger value="analyzed">Analiz Edilenler</TabsTrigger>
                        <TabsTrigger value="unanalyzed">{t('status_awaiting_analysis')}</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredPhotos.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                  <Image src={photo.imageUrl} alt="User submission" fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
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
