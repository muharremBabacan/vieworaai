'use client';
import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, increment, deleteDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';

import type { Photo, PhotoAnalysis, User } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Globe, Loader2, ArrowLeftRight, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden">
          <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black shrink-0">
              <Image src={photo.imageUrl} alt="Kullanıcı fotoğrafı" fill className="object-contain" unoptimized />
          </div>
          <div className="md:w-2/5 w-full flex flex-col overflow-hidden min-h-0">
              <DialogHeader className="p-6 pb-4 shrink-0 border-b">
                  <DialogTitle>YZ Geri Bildirimi</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {photo.aiFeedback ? (
                      <>
                          <Card>
                              <CardHeader className="pb-4">
                                  <CardTitle className="text-sm font-medium">Puanlama</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="flex justify-between items-baseline">
                                      <h3 className="font-semibold text-lg">Genel</h3>
                                      <p className="text-4xl font-bold tracking-tighter text-blue-400">{overallScore.toFixed(1)}</p>
                                  </div>
                                  <hr className="border-border" />
                                  <div className="space-y-4">
                                      <RatingBar label="Işık" score={lightScore} />
                                      <RatingBar label="Kompozisyon" score={compositionScore} />
                                      <RatingBar label="Teknik" score={technicalScore} />
                                  </div>
                              </CardContent>
                          </Card>

                          {photo.tags && photo.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                  {photo.tags.map((tag, i) => (
                                      <Badge key={i} variant="secondary" className="bg-secondary/50 text-[10px] font-bold uppercase tracking-wider">
                                          {tag}
                                      </Badge>
                                  ))}
                              </div>
                          )}

                          <div>
                              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                                  <Sparkles className="h-5 w-5 text-primary" />
                                  YZ Analizi
                              </h3>
                              <div
                                  className="prose prose-sm dark:prose-invert"
                                  dangerouslySetInnerHTML={{ __html: (photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis).replace(/\n/g, '<br />') }}
                              />
                          </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg bg-muted/50 h-full">
                          <p className="text-muted-foreground font-semibold">Analiz Bekliyor</p>
                          <Button onClick={() => onAnalyze(photo)} className="mt-4" disabled={isProcessing}>
                              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Skoru Öğren ({ANALYSIS_COST} Auro)
                          </Button>
                      </div>
                  )}
              </div>
              <div className="p-6 border-t flex flex-col gap-2 shrink-0 bg-background">
                  <Button onClick={() => onToggleExhibition(photo)} variant="outline" disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      {photo.isSubmittedToExhibition ? "Sergi'den Çek" : `Sergi'ye Gönder (${SUBMIT_TO_EXHIBITION_COST} Auro)`}
                  </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isProcessing}>
                              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              <Trash2 className="mr-2 h-4 w-4" /> Kalıcı Olarak Sil
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitleComponent>Emin misiniz?</AlertDialogTitleComponent>
                              <AlertDialogDescription>Bu fotoğraf galerinizden kalıcı olarak silinecektir. Bu işlem geri alınamaz.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>İptal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(photo)}>Evet, Devam Et</AlertDialogAction>
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
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();

    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);

    const photosQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'photos')) : null, [user, firestore]);
    const { data: photos, isLoading } = useCollection<Photo>(photosQuery);

    const filters = [
      { id: 'all', label: "Tümü" },
      { id: 'unanalyzed', label: "Analiz Bekleyenler" },
      { id: 'best_overall', label: "En İyilerim" },
      { id: 'best_light', label: "En İyi Işık" },
      { id: 'best_composition', label: "En İyi Kompozisyon" },
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
        if (!user || !userProfile || userProfile.auro_balance < ANALYSIS_COST) {
            toast({ variant: 'destructive', title: "Yetersiz Auro", description: `Analiz için ${ANALYSIS_COST} Auro gereklidir.` });
            return;
        }
        setIsProcessing(true);
        toast({ title: "Analiz Başlatılıyor...", description: "Lütfen bekleyin." });

        try {
            const analysis = await generatePhotoAnalysis({ photoUrl: photo.imageUrl, language: 'tr' });
            
            const photoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
            const userRef = doc(firestore, 'users', user.uid);
            
            const batch = writeBatch(firestore);
            batch.update(photoRef, { aiFeedback: analysis, tags: analysis.tags || [] });
            batch.update(userRef, { auro_balance: increment(-ANALYSIS_COST) });
            
            batch.commit().catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'photos-update-batch',
                    operation: 'update'
                }));
            });

            toast({ title: "Başarılı!", description: "Analiz tamamlandı." });
            setSelectedPhoto({ ...photo, aiFeedback: analysis, tags: analysis.tags || [] });
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata", description: "Analiz yapılamadı." });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (photo: Photo) => {
        if (!user || !firestore) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const photoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
            const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
            
            batch.delete(photoRef);
            // Only attempt to delete from public exhibition if it was submitted
            if (photo.isSubmittedToExhibition) {
                batch.delete(publicPhotoRef);
            }
            
            batch.commit().catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: photoRef.path,
                    operation: 'delete'
                }));
            });

            if (photo.filePath) {
                const storageRef = ref(storage, photo.filePath);
                await deleteObject(storageRef).catch(() => {});
            }

            toast({ title: "Başarılı!", description: "Fotoğrafınız galeriden kalıcı olarak silinecektir." });
            onCloseDialog();
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata", description: "Silme işlemi tamamlanamadı." });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleToggleExhibition = async (photo: Photo) => {
      if (!user || !userProfile || !firestore) return;
      setIsProcessing(true);
  
      const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
      const userPhotoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
  
      try {
        if (photo.isSubmittedToExhibition) {
          deleteDoc(publicPhotoRef).catch(async (err) => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: publicPhotoRef.path,
                  operation: 'delete'
              }));
          });
          updateDoc(userPhotoRef, { isSubmittedToExhibition: false }).catch(async (err) => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: userPhotoRef.path,
                  operation: 'update'
              }));
          });
          toast({ title: "Başarılı!", description: "Fotoğrafınız Sergi'den geri çekildi." });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false } : null);
        } else {
          if (!photo.aiFeedback) {
             toast({ variant: 'destructive', title: 'Analiz Gerekli', description: 'Sergiye göndermeden önce fotoğrafı analiz etmelisiniz.' });
             setIsProcessing(false);
             return;
          }
          const publicPhotoData = {
            ...photo,
            isSubmittedToExhibition: true,
            userName: userProfile.name || "İsimsiz Sanatçı",
            userPhotoURL: userProfile.photoURL || null,
            userLevelName: userProfile.level_name,
          };
          setDoc(publicPhotoRef, publicPhotoData).catch(async (err) => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: publicPhotoRef.path,
                  operation: 'create',
                  requestResourceData: publicPhotoData
              }));
          });
          updateDoc(userPhotoRef, { isSubmittedToExhibition: true }).catch(async (err) => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: userPhotoRef.path,
                  operation: 'update'
              }));
          });
          toast({ title: "Başarılı!", description: "Fotoğrafınız Sergi'ye gönderildi." });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true } : null);
        }
      } catch (error) {
        console.error("Exhibition toggle error:", error);
        toast({ variant: 'destructive', title: "Hata", description: "İşlem sırasında bir hata oluştu." });
      } finally {
        setIsProcessing(false);
      }
    };

    const onCloseDialog = () => setSelectedPhoto(null);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4">
                <Skeleton className="h-8 w-48 mb-8" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                </div>
            </div>
        );
    }
    
    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Galerim</h1>
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
                    <Image src={photo.imageUrl} alt="User submission" fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    {photo.aiFeedback && (
                        <Badge variant="secondary" className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                            <Star className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs font-bold">{getOverallScore(photo).toFixed(1)}</span>
                        </Badge>
                    )}

                    {!photo.aiFeedback && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <p className="text-white font-semibold text-sm">Analiz Bekliyor</p>
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
            <h3 className="text-2xl font-semibold">Galerinizde Henüz Fotoğraf Yok</h3>
            <p className="text-muted-foreground mt-2">Yapay zeka koçu ile ilk analizinizi yaparak galeriyi doldurun!</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-6">
                <Sparkles className="mr-2 h-4 w-4" />
                Analiz Başlat
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
