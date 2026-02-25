'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Photo, PublicUserProfile } from '@/types';
import { Card } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/shared/ui/dialog';
import { Star, Heart, Loader2, X } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, updateDocumentNonBlocking } from '@/lib/firebase';
import { collection, query, orderBy, doc, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

function PublicPhotoDialog({ photo: photoProp, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [photo, setPhoto] = useState(photoProp);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    setPhoto(photoProp);
  }, [photoProp]);

  const overallScore = useMemo(() => {
    if (!photo?.aiFeedback) return 0;
    const lScore = normalizeScore(photo.aiFeedback.light_score);
    const cScore = normalizeScore(photo.aiFeedback.composition_score);
    const technicalScores = [
      normalizeScore(photo.aiFeedback.focus_score),
      normalizeScore(photo.aiFeedback.color_control_score),
      normalizeScore(photo.aiFeedback.background_control_score),
    ];
    const tScore = technicalScores.reduce((sum, score) => sum + score, 0) / technicalScores.length;
    const mainScores = [lScore, cScore, tScore];
    return mainScores.reduce((sum, score) => sum + score, 0) / mainScores.length;
  }, [photo]);


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
    const newLikes = hasLiked
        ? originalLikes.filter(id => id !== user.uid)
        : [...originalLikes, user.uid];
  
    setIsLiking(true);
    setPhoto(prev => {
        if (!prev) return null;
        return { ...prev, likes: newLikes };
    });
  
    const photoRef = doc(firestore, 'public_photos', photo.id);
    try {
      updateDocumentNonBlocking(photoRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Like/Unlike error", error);
      setPhoto(prev => prev ? { ...prev, likes: originalLikes } : null);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Beğeni güncellenemedi.",
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
                    <span className="sr-only">Kapat</span>
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
              <DialogTitle>Fotoğraf Detayı</DialogTitle>
            </DialogHeader>
            
            {/* Mini Profil Bilgisi */}
            {profileToShow ? (
              <div className="flex items-center gap-3 rounded-lg p-3 bg-secondary/30 border border-border/50">
                <Avatar className="h-12 w-12 border-2 border-background">
                  {profileToShow.photoURL && <AvatarImage src={profileToShow.photoURL} alt={profileToShow.name || ''} />}
                  <AvatarFallback>{profileToShow.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{profileToShow.name}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                    {profileToShow.level_name}
                  </Badge>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={toggleLike} disabled={!user || isLiking}>
                        {isLiking ? <Loader2 className="h-4 w-4 animate-spin"/> : <Heart className={cn("h-5 w-5", hasLiked && "fill-red-500 text-red-500")} />}
                    </Button>
                    <div>
                        <p className="font-semibold text-lg">{photo.likes?.length || 0}</p>
                        <p className="text-xs text-muted-foreground -mt-1">Beğeni</p>
                    </div>
                </div>

                {overallScore > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                              <Star className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-lg">{overallScore.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground -mt-1">Genel Puan</p>
                        </div>
                    </div>
                )}
            </div>
            
            {photo.aiFeedback?.short_neutral_analysis && (
                <div>
                    <h4 className="font-semibold text-base mb-2">Analiz Özeti</h4>
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
    <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Sergi Salonu</h1>
        {filterUserId && (
            <div className="mb-6 flex items-center justify-between rounded-lg border p-3 bg-secondary/50">
                {isFilterUserLoading ? <Skeleton className="h-6 w-48" /> : 
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        {filterUser?.photoURL && <AvatarImage src={filterUser.photoURL} alt={filterUser.name || ''} />}
                        <AvatarFallback>{filterUser?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{filterUser?.name} kullanıcısının fotoğrafları gösteriliyor</span>
                </div>
                }
                <Button variant="ghost" onClick={() => router.push('/explore')}>
                    <X className="mr-2 h-4 w-4" />
                    Filtreyi Temizle
                </Button>
            </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
            {isLoading ? (
                Array.from({ length: 18 }).map((_, i) => (
                    <div key={i}>
                        <Skeleton className="aspect-square rounded-lg" />
                        <div className="mt-2 space-y-1">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                ))
            ) : photos && photos.length > 0 ? (
                 photos.map((photo) => (
                    <div key={photo.id}>
                        <Card className="group relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                            <Image src={photo.imageUrl} alt="Sergi Fotoğrafı" fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized={true} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                            
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
                                {photo.aiFeedback && (() => {
                                    const lScore = normalizeScore(photo.aiFeedback.light_score);
                                    const cScore = normalizeScore(photo.aiFeedback.composition_score);
                                    const techScore = (normalizeScore(photo.aiFeedback.focus_score) + normalizeScore(photo.aiFeedback.color_control_score) + normalizeScore(photo.aiFeedback.background_control_score)) / 3;
                                    const ovScore = (lScore + cScore + techScore) / 3;

                                    return (
                                        <Badge className="flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                                          <Star className="h-3 w-3 text-yellow-400" />
                                          <span className="text-xs font-bold">{ovScore.toFixed(1)}</span>
                                        </Badge>
                                    )
                                 })()}
                                 {(photo.likes?.length ?? 0) > 0 && (
                                    <Badge variant="secondary" className="flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                                        <Heart className="h-3 w-3 text-red-400 fill-red-400" />
                                        <span className="text-xs font-bold">{photo.likes!.length}</span>
                                    </Badge>
                                 )}
                            </div>
                        </Card>
                        {photo.userName && (
                           <div className="mt-2 flex justify-between items-center px-1">
                                <Link href={`/explore?user=${photo.userId}`} className="text-xs font-medium text-muted-foreground hover:text-primary truncate mr-2" scroll={false} title={photo.userName}>
                                    @{photo.userName}
                                </Link>
                                {photo.userLevelName && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 font-semibold shrink-0">
                                        {photo.userLevelName}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <div className="col-span-full text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
                    <Star className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-2xl font-semibold">Henüz kimse eserini paylaşmadı</h3>
                    <p className="text-muted-foreground mt-2">Kendi galerinizden bir fotoğrafı Sergi'ye göndererek burayı canlandırın!</p>
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
