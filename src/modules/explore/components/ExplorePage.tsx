
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
import { Star, Heart, Loader2, X, Trophy } from 'lucide-react';
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

  const ownerProfileRef = useMemoFirebase(() => 
    (photo && firestore) ? doc(firestore, 'public_profiles', photo.userId) : null, 
    [photo, firestore]
  );
  const { data: ownerProfile } = useDoc<PublicUserProfile>(ownerProfileRef);

  const overallScore = useMemo(() => {
    if (!photo?.aiFeedback) return 0;
    const lScore = normalizeScore(photo.aiFeedback.light_score);
    const cScore = normalizeScore(photo.aiFeedback.composition_score);
    const techScore = (normalizeScore(photo.aiFeedback.focus_score) + normalizeScore(photo.aiFeedback.color_control_score) + normalizeScore(photo.aiFeedback.background_control_score)) / 3;
    return (lScore + cScore + techScore) / 3;
  }, [photo]);

  const profileInfo = {
      name: ownerProfile?.name || photo?.userName || "İsimsiz Sanatçı",
      photoURL: ownerProfile?.photoURL || photo?.userPhotoURL || null,
      level_name: ownerProfile?.level_name || photo?.userLevelName || "Neuner"
  };

  const hasLiked = useMemo(() => {
    if (!user || !photo?.likes) return false;
    return photo.likes.includes(user.uid);
  }, [photo?.likes, user]);

  const toggleLike = async () => {
    if (!user || !photo || !firestore || isLiking) return;
    const originalLikes = photo.likes || [];
    const newLikes = hasLiked ? originalLikes.filter(id => id !== user.uid) : [...originalLikes, user.uid];
    setIsLiking(true);
    setPhoto(prev => prev ? { ...prev, likes: newLikes } : null);
    try {
      updateDocumentNonBlocking(doc(firestore, 'public_photos', photo.id), {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      setPhoto(prev => prev ? { ...prev, likes: originalLikes } : null);
    } finally { setIsLiking(false); }
  };

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden">
        <div className="absolute right-4 top-4 z-10">
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm text-foreground/80">
                    <X className="h-5 w-5" />
                </Button>
            </DialogClose>
        </div>
        <div className="md:w-3/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image src={photo.imageUrl} alt="Sergi" fill className="object-contain" unoptimized priority />
        </div>
        <div className="md:w-2/5 w-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-3 rounded-xl p-4 bg-gradient-to-br from-secondary/50 to-background border border-border/50 shadow-sm">
              <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-md">
                {profileInfo.photoURL && <AvatarImage src={profileInfo.photoURL} alt={profileInfo.name} />}
                <AvatarFallback className="text-xl font-bold">{profileInfo.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate text-foreground">{profileInfo.name}</p>
                <Badge variant="outline" className="mt-1 bg-primary/5 text-primary border-primary/20 text-[11px] px-2 py-0.5">{profileInfo.level_name}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={toggleLike} disabled={!user || isLiking}>
                        {isLiking ? <Loader2 className="h-4 w-4 animate-spin"/> : <Heart className={cn("h-5 w-5", hasLiked && "fill-red-500 text-red-500")} />}
                    </Button>
                    <div><p className="font-semibold text-lg">{photo.likes?.length || 0}</p><p className="text-xs text-muted-foreground -mt-1">Beğeni</p></div>
                </div>
                {overallScore > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><Star className="h-5 w-5 text-amber-400" /></div>
                        <div><p className="font-semibold text-lg">{overallScore.toFixed(1)}</p><p className="text-xs text-muted-foreground -mt-1">Puan</p></div>
                    </div>
                )}
            </div>
            {photo.aiFeedback?.short_neutral_analysis && (
                <div className="space-y-2">
                    <h4 className="font-semibold text-sm uppercase text-muted-foreground">Analiz Özeti</h4>
                    <p className="text-sm text-foreground/90 italic leading-relaxed bg-muted/30 p-3 rounded-lg">"{photo.aiFeedback.short_neutral_analysis}"</p>
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
    if (filterUserId) q = query(q, where('userId', '==', filterUserId));
    return q;
  }, [firestore, user, filterUserId]);
  
  const { data: photos, isLoading } = useCollection<Photo>(publicPhotosQuery);

  return (
    <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Sergi Salonu</h1>
                <p className="text-muted-foreground text-sm">Topluluğun en ilham verici kareleri burada buluşuyor.</p>
            </div>
            <Button variant="secondary" onClick={() => router.push('/competitions')} className="w-full sm:w-auto">
                <Trophy className="mr-2 h-4 w-4 text-amber-400" /> Yarışmaları Gör
            </Button>
        </div>

        {filterUserId && (
            <div className="mb-6 flex items-center justify-between rounded-lg border p-3 bg-secondary/50">
                <span className="text-sm font-medium italic">Seçili kullanıcının fotoğrafları gösteriliyor</span>
                <Button variant="ghost" size="sm" onClick={() => router.push('/explore')}><X className="mr-2 h-4 w-4" /> Temizle</Button>
            </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {isLoading ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />) : 
             photos?.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white font-medium truncate">@{photo.userName}</span>
                        {photo.aiFeedback && <Badge className="bg-black/50 text-[10px] h-5 px-1"><Star className="h-2 w-2 text-amber-400 mr-1" /> {normalizeScore(photo.aiFeedback.light_score).toFixed(1)}</Badge>}
                    </div>
                </Card>
            ))}
        </div>

        <PublicPhotoDialog photo={selectedPhoto} isOpen={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)} />
    </div>
  );
}
