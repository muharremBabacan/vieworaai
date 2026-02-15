'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { analyzePhotoAndSuggestImprovements, type AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { Photo, User as UserProfile } from '@/types';
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
import { Lightbulb, LayoutPanelLeft, Heart, Star, Loader2, Rocket, Clock, Zap, Undo2, Trash2, Camera, Smartphone, HelpCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference, where, getDocs, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getLevelFromXp } from '@/lib/gamification';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function RatingDisplay({ rating }: { rating: NonNullable<Photo['aiFeedback']>['rating'] }) {
  const ratingItems = [
      { label: 'Işık', value: rating.lighting },
      { label: 'Kompozisyon', value: rating.composition },
      { label: 'Duygu', value: rating.emotion },
  ];
  return (
      <div>
          <h4 className="font-semibold text-lg mb-3">Puanlama</h4>
          <div className="flex items-center gap-6 rounded-lg border p-4">
              <div className="text-center">
                  <p className="text-sm text-muted-foreground">Genel</p>
                  <p className="text-4xl font-bold text-primary">{rating.overall.toFixed(1)}</p>
              </div>
              <div className="flex-1 space-y-2">
                  {ratingItems.map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <div className="flex items-center gap-2">
                               <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${item.value * 10}%` }} />
                              </div>
                              <span className="text-sm font-semibold w-6 text-right">{item.value}</span>
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
  const { toast } = useToast();
  const firestore = useFirestore();
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
    
    const { cameraType, cameraMake, cameraModel } = photo.aiFeedback;

    if (!cameraType || cameraType === 'Bilinmiyor') {
        return { icon: HelpCircle, text: 'Kamera Türü Belirlenemedi' };
    }

    const typeText = cameraType === 'Profesyonel' ? 'Profesyonel Kamera' : 'Mobil Cihaz';
    const icon = cameraType === 'Profesyonel' ? Camera : Smartphone;

    let detailText = '';
    if (cameraMake && cameraMake !== 'Bilinmiyor') {
      detailText += cameraMake;
      if (cameraModel && cameraModel !== 'Bilinmiyor') {
        detailText += ` ${cameraModel}`;
      }
    }

    if (detailText) {
      return { icon, text: `${typeText}: ${detailText}` };
    }
    
    return { icon, text: cameraType === 'Profesyonel' ? 'Profesyonel Kamera ile Çekildi' : 'Mobil Cihaz ile Çekildi' };
  };
  
  const CameraInfo = getCameraInfo();


  const handleAnalyzeNow = async () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    const analysisCost = 2;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;

    if (currentAuro < analysisCost) {
        toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Analiz için ${analysisCost} Auro gereklidir.` });
        return;
    }

    setIsAnalyzing(true);
    toast({ title: 'Analiz Başlatılıyor...', description: 'Lütfen bekleyin.' });

    try {
      const analysisResult = await analyzePhotoAndSuggestImprovements({ photoUrl: photo.imageUrl });
      if (!analysisResult?.rating) throw new Error("Rating hatası.");
      
      const originalPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
      const totalXpGained = 15 + (analysisResult.rating.overall >= 8.0 ? 50 : 0);
      const newXp = currentXp + totalXpGained;
      const newLevel = getLevelFromXp(newXp);
      
      const userUpdatePayload: Partial<UserProfile> = { auro_balance: currentAuro - analysisCost, current_xp: newXp };
      if (newLevel.name !== getLevelFromXp(currentXp).name) userUpdatePayload.level_name = newLevel.name;

      updateDocumentNonBlocking(userDocRef, userUpdatePayload);
      updateDocumentNonBlocking(originalPhotoRef, { aiFeedback: analysisResult, tags: analysisResult.tags || [] });

      toast({ title: 'Başarılı!', description: 'Analiz tamamlandı.' });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Hata', description: 'Analiz yapılamadı.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitToPublic = () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    const submissionCost = 5;
    const currentAuro = userProfile.auro_balance || 0;

    if (currentAuro < submissionCost) {
        toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Sergi için ${submissionCost} Auro lazım.` });
        return;
    }

    setIsSubmitting(true);
    const publicPhotosRef = collection(firestore, 'public_photos');
    const { id, ...publicPhotoData } = photo;
    addDocumentNonBlocking(publicPhotosRef, publicPhotoData);
    updateDocumentNonBlocking(userDocRef, { auro_balance: currentAuro - submissionCost });
    updateDocumentNonBlocking(doc(firestore, 'users', photo.userId, 'photos', photo.id), { isSubmittedToPublic: true });
    
    toast({ title: 'Başarılı!', description: 'Sergiye gönderildi.' });
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
        
        toast({ title: 'Başarılı!', description: 'Fotoğrafınız sergiden başarıyla çekildi.' });

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
        toast({ variant: 'destructive', title: 'Hata', description: 'Sergiden çekme işlemi tamamlanamadı.' });
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
        
        toast({ title: 'İşlem Başarılı', description: 'Fotoğrafınız galeriden kalıcı olarak silindi.' });

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
        toast({ variant: 'destructive', title: 'Hata', description: 'Silme işlemi tamamlanamadı.' });
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
        <div className="md:w-1/3 w-full relative aspect-square md:aspect-auto">
          <Image src={photo.imageUrl} alt="Analiz" fill className="object-contain" unoptimized priority />
        </div>
        <div className="md:w-2/3 w-full overflow-y-auto flex flex-col p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">YZ Geri Bildirimi</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {CameraInfo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border bg-secondary/30">
                      <CameraInfo.icon className="h-5 w-5 text-primary" />
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
            </div>

            {photo.aiFeedback ? (
              <>
                <RatingDisplay rating={photo.aiFeedback.rating} />
                <DialogDescription>{photo.aiFeedback.analysis}</DialogDescription>
                <ul className="space-y-4">
                  {photo.aiFeedback.improvements.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                      <Lightbulb className="h-5 w-5 text-amber-400 shrink-0" /> {tip}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="text-center py-10 space-y-4">
                <p>Bu fotoğraf henüz analiz edilmedi.</p>
                <Button onClick={handleAnalyzeNow} disabled={isLoading}>
                    {isAnalyzing ? <Loader2 className="animate-spin"/> : 'Skoru Öğren (2 Auro)'}
                </Button>
              </div>
            )}
          <div className="pt-6 border-t space-y-3">
             {photo.aiFeedback && (
                photo.isSubmittedToPublic ? (
                    <Button type="button" variant="outline" className="w-full" onClick={() => setDialogAction('withdraw')} disabled={isLoading}>
                        {isLoading && dialogAction === 'withdraw' ? <Loader2 className="animate-spin"/> : 'Sergiden Çek'}
                    </Button>
                ) : (
                    <Button type="button" className="w-full" onClick={handleSubmitToPublic} disabled={isLoading}>
                        {isSubmitting ? <Loader2 className="animate-spin"/> : 'Sergiye Gönder (5 Auro)'}
                    </Button>
                )
             )}
             <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setDialogAction('delete')} disabled={isLoading}>
                {isLoading && dialogAction === 'delete' ? <Loader2 className="animate-spin"/> : 'Kalıcı Olarak Sil'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    <AlertDialog open={!!dialogAction} onOpenChange={(open) => !open && setDialogAction(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  {dialogAction === 'delete' 
                    ? "Bu fotoğraf hem galerinizden hem de sergiden (eğer gönderildiyse) kalıcı olarak silinecektir. Bu işlem geri alınamaz."
                    : "Bu fotoğraf herkese açık sergi salonundan kaldırılacaktır. Galerinizde görünmeye devam edecektir."}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDialogAction(null)} disabled={isProcessing}>İptal</AlertDialogCancel>
                <AlertDialogAction 
                  disabled={isProcessing}
                  className={cn(dialogAction === 'delete' && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                  onClick={() => dialogAction === 'withdraw' ? handleWithdrawFromPublic() : handleDeletePhoto()}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : 'Evet, Devam Et'}
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
  if (photos.length === 0) {
    return (
      <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
        <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-2xl font-semibold">Bu filtreyle eşleşen fotoğraf bulunamadı.</h3>
        <p className="text-muted-foreground mt-2">Farklı bir etiket seçin veya tüm fotoğraflarınızı görmek için "Tümü" filtresini kullanın.</p>
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
                <span className="text-xs text-white/80 font-semibold">Analiz Bekliyor</span>
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

          {photo.aiFeedback && (
             <Badge className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
              <Star className="h-3 w-3 text-yellow-400" />
              <span className="text-xs font-bold">{photo.aiFeedback.rating.overall.toFixed(1)}</span>
            </Badge>
          )}
        </Card>
      ))}
    </div>
  );
}


export default function GalleryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedTag, setSelectedTag] = useState('Tümü');
  
  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: userPhotos, isLoading } = useCollection<Photo>(photosQuery);
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const tags = useMemo(() => {
    if (!userPhotos) return [];
    const allTags = userPhotos.flatMap(p => p.tags || []).filter(Boolean);
    const capitalizedTags = allTags.map(tag => tag.charAt(0).toUpperCase() + tag.slice(1));
    return ['Tümü', ...Array.from(new Set(capitalizedTags))];
  }, [userPhotos]);

  const filteredPhotos = useMemo(() => {
    if (!userPhotos) return [];
    if (selectedTag === 'Tümü') {
      return userPhotos;
    }
    return userPhotos.filter(photo => 
      photo.tags?.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
    );
  }, [userPhotos, selectedTag]);

  // Handle case where there are no photos at all to avoid showing filter bar
  if (!isLoading && (!userPhotos || userPhotos.length === 0)) {
    return (
      <div className="container mx-auto">
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">Galerinizde Henüz Fotoğraf Yok</h3>
          <p className="text-muted-foreground mt-2">Yapay zeka koçu ile ilk analizinizi yaparak galeriyi doldurun!</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Analiz Başlat</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      {tags && tags.length > 1 && (
        <div className="mb-8">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex w-max space-x-3">
              {tags.map(tag => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'secondary'}
                  onClick={() => setSelectedTag(tag)}
                  className="shrink-0 rounded-full px-5 py-2 text-sm capitalize"
                >
                  {tag}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
