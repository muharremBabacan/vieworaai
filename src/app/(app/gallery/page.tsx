'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Lightbulb, LayoutPanelLeft, Heart, Star, Loader2, Rocket, CheckCircle, Clock, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getLevelFromXp } from '@/lib/gamification';


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
  
  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

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
    toast({ title: 'Analiz Başlatılıyor...', description: 'Lütfen bekleyin, bu işlem biraz sürebilir.' });

    let dataUri;
    try {
        const response = await fetch(photo.imageUrl);
        if (!response.ok) throw new Error('Resim indirilemedi.');
        const blob = await response.blob();
        dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch(error) {
        console.error("Image fetch/conversion error:", error);
        toast({ variant: 'destructive', title: 'Hata', description: 'Analiz için resim hazırlanamadı.' });
        setIsAnalyzing(false);
        return;
    }

    let analysisResult: AnalyzePhotoAndSuggestImprovementsOutput;
    try {
      analysisResult = await analyzePhotoAndSuggestImprovements({ photoDataUri: dataUri });
      if (!analysisResult?.rating) throw new Error("AI analysis did not return a rating.");
    } catch (error) {
      console.error('Analiz başarısız:', error);
      toast({ variant: 'destructive', title: 'Analiz Başarısız', description: 'YZ analizi sırasında bir hata oluştu.' });
      setIsAnalyzing(false);
      return;
    }

    const originalPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
    
    const xpFromAnalysis = 15;
    const bonusXp = analysisResult.rating.overall >= 8.0 ? 50 : 0;
    const totalXpGained = xpFromAnalysis + bonusXp;
    
    const currentLevel = getLevelFromXp(currentXp);
    const newXp = currentXp + totalXpGained;
    const newLevel = getLevelFromXp(newXp);
    
    const userUpdatePayload: Partial<UserProfile> = {
      auro_balance: currentAuro - analysisCost,
      current_xp: newXp
    };

    if (newLevel.name !== currentLevel.name) {
      userUpdatePayload.level_name = newLevel.name;
      if (newLevel.isMentor) userUpdatePayload.is_mentor = true;
    }

    updateDocumentNonBlocking(userDocRef, userUpdatePayload);
    updateDocumentNonBlocking(originalPhotoRef, { 
        aiFeedback: analysisResult,
        imageHint: analysisResult.imageHint || '',
    });

    toast({ title: 'Analiz Tamamlandı!', description: 'Sonuçlar fotoğrafına eklendi.' });
    toast({ title: 'XP Kazandın!', description: `Analiz için ${xpFromAnalysis} XP kazandın.` });

    if (bonusXp > 0) {
        setTimeout(() => toast({ title: '✨ Bonus!', description: `Yüksek puan için +${bonusXp} bonus XP kazandın!` }), 100);
    }
    if (userUpdatePayload.level_name) {
        setTimeout(() => toast({ title: '🎉 Seviye Atladın!', description: `Tebrikler! Yeni seviyen: ${userUpdatePayload.level_name}` }), 200);
        if (userUpdatePayload.is_mentor) {
            setTimeout(() => toast({ title: '👑 Mentor Oldun!', description: 'Tebrikler! Artık bir Vexer olarak mentorluk yapabilirsin.' }), 300);
        }
    }

    onOpenChange(false);
    setIsAnalyzing(false);
  };


  const handleSubmitToPublic = () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId || !firestore) return;
    
    const submissionCost = 5;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;

    if (currentAuro < submissionCost) {
        toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Sergiye göndermek için ${submissionCost} Auro gereklidir.` });
        return;
    }

    setIsSubmitting(true);

    const publicPhotosCollectionRef = collection(firestore, 'public_photos');
    const { id, isSubmittedToPublic, ...publicPhotoData } = photo;
    addDocumentNonBlocking(publicPhotosCollectionRef, publicPhotoData);

    updateDocumentNonBlocking(userDocRef, {
        auro_balance: currentAuro - submissionCost,
    });

    const originalPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
    updateDocumentNonBlocking(originalPhotoRef, {
        isSubmittedToPublic: true,
    });
    
    toast({ title: 'Başarılı!', description: 'Fotoğrafınız sergiye gönderildi.' });
    onOpenChange(false); 
    setIsSubmitting(false);
  };
  
  if (!photo) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0">
        <div className="md:w-1/2 w-full relative aspect-square md:aspect-auto">
          <Image
            src={photo.imageUrl}
            alt="Analiz edilen fotoğraf"
            fill
            className="object-contain"
            data-ai-hint={photo.imageHint}
          />
        </div>
        <ScrollArea className="md:w-1/2 w-full">
          <div className="p-6 space-y-6">
             <DialogHeader>
              <DialogTitle className="font-sans text-2xl mb-2">YZ Geri Bildirimi</DialogTitle>
              {photo.imageHint && <DialogDescription>Etiket: {photo.imageHint}</DialogDescription>}
            </DialogHeader>
            
            {photo.aiFeedback ? (
              <>
                {photo.aiFeedback.rating && <RatingDisplay rating={photo.aiFeedback.rating} />}
                
                <div>
                  <h4 className="font-semibold text-lg mb-2">Analiz</h4>
                  <DialogDescription>{photo.aiFeedback.analysis}</DialogDescription>
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2">İyileştirme İpuçları</h4>
                  <ul className="space-y-4">
                    {photo.aiFeedback.improvements.map((tip, index) => {
                      const Icon = improvements[index % improvements.length].icon;
                      const color = improvements[index % improvements.length].color;
                      return (
                         <li key={index} className="flex items-start gap-3">
                          <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", color)} />
                          <span className="text-sm text-muted-foreground">{tip}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-6 text-center">
                <h4 className="font-semibold text-lg">Analiz Bekliyor</h4>
                <p className="text-muted-foreground">Bu fotoğraf henüz Viewora YZ Koçu tarafından analiz edilmedi.</p>
                <Button size="lg" onClick={handleAnalyzeNow} disabled={isAnalyzing || !userProfile}>
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Skoru Öğren (2 Auro)
                </Button>
              </div>
            )}
          </div>
          {photo.aiFeedback && !photo.isSubmittedToPublic && (
            <div className="p-6 border-t">
                <Button className="w-full" onClick={handleSubmitToPublic} disabled={isSubmitting || !userProfile}>
                     {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Sergiye Gönder (5 Auro)
                </Button>
            </div>
          )}
           {photo.isSubmittedToPublic && (
               <div className="p-6 text-center text-sm text-green-400 font-semibold border-t">
                   <CheckCircle className="inline-block mr-2 h-4 w-4" /> Bu fotoğraf zaten sergide!
               </div>
           )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function PhotoGrid({ photos, onPhotoClick }: { photos: Photo[], onPhotoClick: (photo: Photo) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {photos.map((photo) => (
        <Card
          key={photo.id}
          className="overflow-hidden cursor-pointer group rounded-md"
          onClick={() => onPhotoClick(photo)}
        >
          <CardContent className="p-0">
            <div className="relative w-full aspect-square min-w-[125px]">
              <Image
                src={photo.imageUrl}
                alt={`Kullanıcı fotoğrafı ${photo.id}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, (max-width: 1024px) 16.6vw, 12.5vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={photo.imageHint}
              />
               {photo.aiFeedback?.rating ? (
                <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/50 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <span>{photo.aiFeedback.rating.overall.toFixed(1)}</span>
                </div>
               ) : (
                 <Badge variant="secondary" className="absolute top-1 left-1">
                    <Clock className="mr-1 h-3 w-3" />
                    Bekliyor
                 </Badge>
               )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-white text-xs font-semibold text-center p-1">Detayları Gör</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


function GallerySkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="aspect-square min-w-[125px]">
                    <Skeleton className="w-full h-full" />
                </div>
            ))}
        </div>
    );
}


export default function GalleryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: userPhotos, isLoading } = useCollection<Photo>(photosQuery);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);


  const openDialog = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const closeDialog = () => {
    setSelectedPhoto(null);
  };

  const photos = userPhotos || [];

  const sortedByRating = useMemo(() => {
    return [...photos].sort((a, b) => {
        const ratingA = a.aiFeedback?.rating.overall ?? 0;
        const ratingB = b.aiFeedback?.rating.overall ?? 0;
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [photos]);
  
  const sortedByDate = photos;

  return (
    <div className="container mx-auto">
      {photos.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <h3 className="text-xl font-semibold">Henüz hiç fotoğraf analiz etmediniz.</h3>
          <p className="text-muted-foreground mt-2">YZ Koçu'nu kullanarak ilk fotoğrafınızı analiz edin ve buraya eklensin!</p>
        </div>
      )}

      {(photos.length > 0 || isLoading) && (
        <Tabs defaultValue="top-rated" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-sm mx-auto">
            <TabsTrigger value="top-rated">Puana Göre</TabsTrigger>
            <TabsTrigger value="newest">Tarihe Göre</TabsTrigger>
          </TabsList>
          {isLoading ? (
            <div className="mt-6">
                <GallerySkeleton />
            </div>
          ) : (
            <>
              <TabsContent value="top-rated" className="mt-6">
                  <PhotoGrid photos={sortedByRating} onPhotoClick={openDialog} />
              </TabsContent>
              <TabsContent value="newest" className="mt-6">
                  <PhotoGrid photos={sortedByDate} onPhotoClick={openDialog} />
              </TabsContent>
            </>
          )}
        </Tabs>
      )}

      <PhotoDetailDialog 
        photo={selectedPhoto} 
        isOpen={!!selectedPhoto}
        onOpenChange={(open) => !open && closeDialog()}
        userProfile={userProfile}
        userDocRef={userDocRef}
      />
    </div>
  );
}
