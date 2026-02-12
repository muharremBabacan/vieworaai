'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
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
import { Lightbulb, LayoutPanelLeft, Heart, Star, Loader2, Rocket, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

  if (!photo) {
    return null;
  }

  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

  const handleSubmitToPublic = () => {
    if (!photo || !userProfile || !userDocRef || !photo.userId) return;
    
    const submissionCost = 5;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;

    if (currentAuro < submissionCost) {
        toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Sergiye göndermek için ${submissionCost} Auro gereklidir.` });
        return;
    }

    setIsSubmitting(true);

    // 1. Copy photo to public_photos, excluding unnecessary fields
    const publicPhotosCollectionRef = collection(firestore, 'public_photos');
    const { id, isSubmittedToPublic, ...publicPhotoData } = photo;
    addDocumentNonBlocking(publicPhotosCollectionRef, publicPhotoData);

    // 2. Update user's Auro balance
    updateDocumentNonBlocking(userDocRef, {
        auro_balance: currentAuro - submissionCost,
    });

    // 3. Mark the original photo as submitted
    const originalPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
    updateDocumentNonBlocking(originalPhotoRef, {
        isSubmittedToPublic: true,
    });
    
    toast({ title: 'Başarılı!', description: 'Fotoğrafınız sergiye gönderildi.' });
    onOpenChange(false); 
    setIsSubmitting(false);
  };

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
              <div className="text-center py-10">
                <p className="text-muted-foreground">Bu fotoğraf için analiz mevcut değil.</p>
              </div>
            )}
          </div>
          {photo.aiFeedback && !photo.isSubmittedToPublic && (
            <div className="p-6 border-t">
                <Button className="w-full" onClick={handleSubmitToPublic} disabled={isSubmitting || !userProfile}>
                     {isSubmitting ? <Loader2 className="animate-spin" /> : <Rocket />}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <Card
          key={photo.id}
          className="overflow-hidden cursor-pointer group"
          onClick={() => onPhotoClick(photo)}
        >
          <CardContent className="p-0 aspect-w-1 aspect-h-1">
            <div className="relative w-full h-full aspect-square">
              <Image
                src={photo.imageUrl}
                alt={`Kullanıcı fotoğrafı ${photo.id}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={photo.imageHint}
              />
               {photo.aiFeedback?.rating && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <span>{photo.aiFeedback.rating.overall.toFixed(1)}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-white font-semibold">Detayları Gör</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square">
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
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: userPhotos, isLoading } = useCollection<Photo>(photosQuery);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
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
  
  const sortedByDate = photos; // Already sorted by query

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
