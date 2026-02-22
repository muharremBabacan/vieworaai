'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/navigation';
import type { Photo, PublicUserProfile } from '@/types';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Star, Camera, X, Heart, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

function PublicPhotoDialog({ photo: photoProp, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ExplorePage');
  const tRatings = useTranslations('Ratings');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [photo, setPhoto] = useState(photoProp);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    setPhoto(photoProp);
  }, [photoProp]);


  // Use denormalized data directly from the photo object.
  const profileToShow = photo?.userName ? {
      name: photo.userName,
      photoURL: photo.userPhotoURL,
      level_name: photo.userLevelName
  } : null;

  const hasLiked = useMemo(() => {
    if (!user || !photo?.likes) return false;
    return photo.likes.includes(user.uid);
  }, [photo?.likes, user]);

  const toggleLike = async () => {
    if (!user || !photo || !firestore || isLiking) return;
  
    const originalLikes = photo.likes || [];
  
    // 1. Optimistic UI update
    setIsLiking(true);
    setPhoto(prev => {
      if (!prev) return null;
      const newLikes = hasLiked
        ? originalLikes.filter(id => id !== user.uid)
        : [...originalLikes, user.uid];
      return { ...prev, likes: newLikes };
    });
  
    // 2. Update Firestore in the background
    const photoRef = doc(firestore, 'public_photos', photo.id);
    try {
      await updateDoc(photoRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Like/Unlike error", error);
      // 3. Revert on error
      setPhoto(prev => prev ? { ...prev, likes: originalLikes } : null);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Beğeni güncellenemedi. Lütfen daha sonra tekrar deneyin.",
      });
    } finally {
      setIsLiking(false);
    }
  };


  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden"
      >
        <div className="absolute right-4 top-4 z-10">
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm text-foreground/80 hover:bg-background/80 hover:text-foreground">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Button>
            </DialogClose>
        </div>
        <div className="md:w-3/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image
            src={photo.imageUrl}
            alt="Sergi fotoğrafı"
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-contain"
            unoptimized={true}
            priority
          />
        </div>
        <div className="md:w-2/5 w-full overflow-y-auto p-6 space-y-6">
             <DialogHeader>
              <DialogTitle>{t('dialog_title')}</DialogTitle>
            </DialogHeader>
            {profileToShow ? (
              <div className="flex items-center gap-3 rounded-lg p-2 -ml-2">
                <Avatar className="h-10 w-10">
                  {profileToShow.photoURL && <AvatarImage src={profileToShow.photoURL} alt={profileToShow.name || ''} />}
                  <AvatarFallback>{profileToShow.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{profileToShow.name}</p>
                  <p className="text-xs text-muted-foreground">{profileToShow.level_name}</p>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={toggleLike} disabled={!user || isLiking}>
                  {isLiking ? <Loader2 className="h-4 w-4 animate-spin"/> : <Heart className={cn("h-5 w-5", hasLiked && "fill-red-500 text-red-500")} />}
              </Button>
              <div className="text-sm">
                  <p className="font-semibold text-lg">{photo.likes?.length || 0}</p>
                  <p className="text-muted-foreground -mt-1">{tRatings('likes')}</p>
              </div>
            </div>
            
            {photo.aiFeedback?.short_neutral_analysis && (
                <div>
                    <h4 className="font-semibold text-base mb-2">{t('analysis_summary_title')}</h4>
                    <p className="text-sm text-muted-foreground italic">
                        "{photo.aiFeedback.short_neutral_analysis}"
                    </p>
                </div>
            )}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterUserId = searchParams.get('user');

  const publicPhotosQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    
    let q = query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc'));
    
    if (filterUserId) {
        q = query(q, where('userId', '==', filterUserId));
    }
    
    return q;
  }, [firestore, user, filterUserId]);
  
  const { data: photos, isLoading } = useCollection<Photo>(publicPhotosQuery);
  const { data: filterUser, isLoading: isFilterUserLoading } = useDoc<PublicUserProfile>(useMemoFirebase(() => filterUserId ? doc(firestore, 'public_profiles', filterUserId) : null, [firestore, filterUserId]));


  return (
    <div className="container mx-auto">
        {filterUserId && (
            <div className="mb-6 flex items-center justify-between rounded-lg border p-3 bg-secondary/50">
                {isFilterUserLoading ? <Skeleton className="h-6 w-48" /> : 
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarFallback>{filterUser?.name?.charAt(0)}</AvatarFallback></Avatar>
                    <span className="font-semibold">{t('showing_photos_by', {name: filterUser?.name})}</span>
                </div>
                }
                <Button variant="ghost" onClick={() => router.push('/explore')}>
                    <X className="mr-2 h-4 w-4" />
                    {t('clear_filter')}
                </Button>
            </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {isLoading ? (
                Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)
            ) : photos && photos.length > 0 ? (
                 photos.map((photo) => (
                    <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={() => setSelectedPhoto(photo)}>
                        <Image src={photo.imageUrl} alt="Sergi Fotoğrafı" fill className="object-cover transition-transform group-hover:scale-110" unoptimized={true} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                         {photo.aiFeedback && (() => {
                            const lightScore = normalizeScore(photo.aiFeedback.light_score);
                            const compositionScore = normalizeScore(photo.aiFeedback.composition_score);
                            const technicalScore = normalizeScore(
                              (
                                normalizeScore(photo.aiFeedback.focus_score) +
                                normalizeScore(photo.aiFeedback.color_control_score) +
                                normalizeScore(photo.aiFeedback.background_control_score) +
                                normalizeScore(photo.aiFeedback.creativity_risk_score)
                              ) / 4
                            );
                            const overallScore = (lightScore + compositionScore + technicalScore) / 3;

                            return (
                                <Badge className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                                  <Star className="h-3 w-3 text-yellow-400" />
                                  <span className="text-xs font-bold">{overallScore.toFixed(1)}</span>
                                </Badge>
                            )
                         })()}
                    </Card>
                ))
            ) : (
                <div className="col-span-full text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
                    <Camera className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-2xl font-semibold">{t('no_photos_title')}</h3>
                    <p className="text-muted-foreground mt-2">{t('no_photos_description')}</p>
                </div>
            )}
        </div>

        <PublicPhotoDialog 
            photo={selectedPhoto} 
            isOpen={!!selectedPhoto}
            onOpenChange={(open) => !open && setSelectedPhoto(null)}
        />
    </div>
  );
}
