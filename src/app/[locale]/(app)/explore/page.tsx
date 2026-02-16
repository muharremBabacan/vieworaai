'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { Photo, PhotoAnalysis } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Lightbulb, LayoutPanelLeft, Heart, Star, Camera, Smartphone, HelpCircle, Bot } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

function RatingDisplay({ analysis }: { analysis: PhotoAnalysis }) {
  const t = useTranslations('ExplorePage');
  const tRatings = useTranslations('Ratings');
  
  // Safely collect scores, filtering out any that are not numbers.
  const scores = [
    analysis.light_score,
    analysis.composition_score,
    analysis.focus_score,
    analysis.color_control_score,
    analysis.background_control_score,
    analysis.creativity_risk_score,
  ].filter((score): score is number => typeof score === 'number' && isFinite(score));

  // Calculate average only if there are valid scores to avoid division by zero.
  const overallScore = scores.length > 0
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;

  // Ensure rating items have a default value of 0.
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
                             <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                {/* Use item.value directly as it's guaranteed to be a number now */}
                                <div className="h-full bg-primary" style={{ width: `${(item.value ?? 0) * 10}%` }} />
                            </div>
                            <span className="text-sm font-semibold w-8 text-right">{(item.value ?? 0).toFixed(0)}</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  )
}

function PhotoDetailDialog({ photo, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ExplorePage');
  const tGallery = useTranslations('GalleryPage');

  if (!photo) return null;

  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];
  
  const getCameraInfo = () => {
    if (!photo?.aiFeedback) return null;
    
    const { device_estimation } = photo.aiFeedback;

    if (!device_estimation || device_estimation === 'unknown') {
        return { icon: HelpCircle, text: tGallery('camera_info_unknown') };
    }

    const typeMap = {
        'pro_dslr': { text: tGallery('camera_type_pro'), icon: Camera},
        'mirrorless': { text: tGallery('camera_type_pro'), icon: Camera},
        'entry_dslr': { text: tGallery('camera_type_pro'), icon: Camera},
        'mobile': { text: tGallery('camera_type_mobile'), icon: Smartphone},
    }

    return typeMap[device_estimation] || { icon: HelpCircle, text: tGallery('camera_info_unknown') };
  };
  
  const CameraInfo = getCameraInfo();


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="md:w-2/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image
            src={photo.imageUrl}
            alt="Viewora Sergi Fotoğrafı"
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-contain"
            unoptimized={true}
            priority
          />
        </div>
        <div className="md:w-3/5 w-full overflow-y-auto">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="font-sans text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                {t('dialog_title')}
              </DialogTitle>
            </DialogHeader>

            {CameraInfo && (
                <div className={cn("flex items-center gap-2 text-sm p-3 rounded-lg border bg-secondary/30", CameraInfo.color)}>
                    <CameraInfo.icon className={cn("h-5 w-5", CameraInfo.color ? CameraInfo.color : 'text-primary')} />
                    <span className="font-medium">{CameraInfo.text}</span>
                </div>
            )}

            {photo.tags && photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photo.tags.map(tag => <Badge key={tag} variant="secondary" className="capitalize px-3 py-1">{tag}</Badge>)}
              </div>
            )}
            
            {photo.aiFeedback ? (
              <>
                <RatingDisplay analysis={photo.aiFeedback} />
                <div>
                  <h4 className="font-semibold text-lg mb-2">{t('analysis_summary_title')}</h4>
                  <DialogDescription className="text-base leading-relaxed text-foreground/80">
                    {photo.adaptiveFeedback || photo.aiFeedback.short_neutral_analysis}
                  </DialogDescription>
                </div>
              </>
            ) : (
              <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
                <p className="text-muted-foreground">{t('loading_analysis')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExplorePage() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const t = useTranslations('ExplorePage');

  const publicPhotosQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  
  const { data: photos, isLoading } = useCollection<Photo>(publicPhotosQuery);

  return (
    <div className="container mx-auto">
        <div className="text-left mb-10">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent inline-block">
                {t('title')}
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
                {t('description')}
            </p>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
        ) : photos && photos.length > 0 ? (
             <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {photos.map((photo) => (
                    <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={() => setSelectedPhoto(photo)}>
                        <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform group-hover:scale-110" unoptimized={true} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                         {photo.aiFeedback && (() => {
                            const scores = [photo.aiFeedback.light_score, photo.aiFeedback.composition_score, photo.aiFeedback.focus_score, photo.aiFeedback.color_control_score, photo.aiFeedback.background_control_score, photo.aiFeedback.creativity_risk_score];
                            const validScores = scores.filter((score): score is number => typeof score === 'number' && isFinite(score));
                            const overallScore = validScores.length > 0 ? validScores.reduce((s, v) => s + v, 0) / validScores.length : 0;
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
        ) : (
            <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
                <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-2xl font-semibold">{t('no_photos_title')}</h3>
                <p className="text-muted-foreground mt-2">{t('no_photos_description')}</p>
            </div>
        )}

        <PhotoDetailDialog 
            photo={selectedPhoto} 
            isOpen={!!selectedPhoto}
            onOpenChange={(open) => !open && setSelectedPhoto(null)}
        />
    </div>
  );
}
