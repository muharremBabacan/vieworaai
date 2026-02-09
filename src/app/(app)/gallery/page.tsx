'use client';
import { useState } from 'react';
import Image from 'next/image';
import { photos } from '@/lib/data';
import type { Photo } from '@/types';
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
import { Lightbulb, LayoutPanelLeft, Heart } from 'lucide-react';

function PhotoDetailDialog({ photo, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  if (!photo) return null;

  const improvements = [
    { icon: Lightbulb, color: 'text-yellow-500' },
    { icon: LayoutPanelLeft, color: 'text-blue-500' },
    { icon: Heart, color: 'text-red-500' },
  ];

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
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl mb-4">YZ Geri Bildirimi</DialogTitle>
            </DialogHeader>
            {photo.aiFeedback ? (
              <div className="space-y-6">
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
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">Bu fotoğraf için analiz mevcut değil.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function GalleryPage() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const openDialog = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const closeDialog = () => {
    setSelectedPhoto(null);
  };

  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card
            key={photo.id}
            className="overflow-hidden cursor-pointer group"
            onClick={() => openDialog(photo)}
          >
            <CardContent className="p-0 aspect-w-1 aspect-h-1">
              <div className="relative w-full h-full">
                <Image
                  src={photo.imageUrl}
                  alt={`Kullanıcı fotoğrafı ${photo.id}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint={photo.imageHint}
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="text-white font-semibold">Detayları Gör</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PhotoDetailDialog 
        photo={selectedPhoto} 
        isOpen={!!selectedPhoto}
        onOpenChange={(open) => !open && closeDialog()}
      />
    </div>
  );
}
