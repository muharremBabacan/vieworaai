'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { Photo } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Lightbulb, LayoutPanelLeft, Heart, Star, Camera } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';


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


function PhotoDetailDialog({ photo, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  if (!photo) return null;

  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0">
        <div className="md:w-1/2 w-full relative aspect-square md:aspect-auto">
          <Image
            src={photo.imageUrl}
            alt="Analiz edilen fotoğraf"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain"
            data-ai-hint={photo.tags?.join(' ')}
          />
        </div>
        <div className="md:w-1/2 w-full overflow-y-auto">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="font-sans text-2xl mb-2">YZ Geri Bildirimi</DialogTitle>
            </DialogHeader>

            {photo.tags && photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photo.tags.map(tag => <Badge key={tag} variant="secondary" className="capitalize">{tag}</Badge>)}
              </div>
            )}
            
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
        </div>
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
                data-ai-hint={photo.tags?.join(' ')}
              />
               {photo.aiFeedback?.rating && (
                <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/50 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <span>{photo.aiFeedback.rating.overall.toFixed(1)}</span>
                </div>
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

function ExploreSkeleton() {
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

export default function ExplorePage() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const firestore = useFirestore();

  const publicPhotosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'public_photos'), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);
  
  const { data: photos, isLoading } = useCollection<Photo>(publicPhotosQuery);

  const openDialog = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const closeDialog = () => {
    setSelectedPhoto(null);
  };
  
  return (
    <div className="container mx-auto">
        <div className="text-left mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Sergi Salonu</h2>
            <p className="text-muted-foreground mt-1">Topluluk tarafından sergiye gönderilen en iyi fotoğraflar.</p>
        </div>

        {isLoading && <ExploreSkeleton />}

        {!isLoading && photos && photos.length > 0 && (
            <PhotoGrid photos={photos} onPhotoClick={openDialog} />
        )}

        {!isLoading && (!photos || photos.length === 0) && (
            <div className="text-center py-20 rounded-lg border border-dashed">
                <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">Sergi Salonu Henüz Boş</h3>
                <p className="text-muted-foreground mt-2">Galerinizden bir fotoğrafı sergiye gönderen ilk kişi siz olun!</p>
            </div>
        )}

        <PhotoDetailDialog 
            photo={selectedPhoto} 
            isOpen={!!selectedPhoto}
            onOpenChange={(open) => !open && closeDialog()}
        />
    </div>
  );
}
