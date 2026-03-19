'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, where, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { Exhibition, Photo, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, Star, Heart, Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { typography } from "@/lib/design/typography";

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const getOverallScore = (photo: Photo): number => {
    if (!photo.aiFeedback) return 0;
    const scores = [
        normalizeScore(photo.aiFeedback.light_score),
        normalizeScore(photo.aiFeedback.composition_score),
        normalizeScore(photo.aiFeedback.storytelling_score),
        normalizeScore(photo.aiFeedback.technical_clarity_score),
        normalizeScore(photo.aiFeedback.boldness_score)
    ].filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
};

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail' | 'featured'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // ALL HOOKS MUST BE AT TOP UNCONDITIONALLY
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const exhibitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: exhibitions, isLoading: isExLoading } = useCollection<Exhibition>(exhibitionsQuery);

  const photosQuery = useMemoFirebase(() => {
    if (!firestore || view === 'hub') return null;
    if (view === 'exhibition-detail' && selectedExhibition) {
        return query(collection(firestore, 'public_photos'), where('exhibitionId', '==', selectedExhibition.id), orderBy('createdAt', 'desc'));
    }
    if (view === 'featured') {
        return query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc'), limit(40));
    }
    return null;
  }, [firestore, selectedExhibition, view]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  const handleToggleLike = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !firestore) return;
    const photoRef = doc(firestore, 'public_photos', photo.id);
    const isLiked = photo.likes?.includes(user.uid);
    try {
      await updateDoc(photoRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch (err) { console.error(err); }
  };

  const isLevelEligibleForAI = (userProfile?.current_xp || 0) >= 101;

  // Conditional rendering happens in return, not before hooks
  if (view === 'hub') {
    return (
      <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
        <header className="mb-10 space-y-1">
          <p className={cn(typography.eyebrow, "ml-1")}>KEŞFET</p>
          <h1 className={cn(typography.h1, "leading-none uppercase")}>İlhamı Keşfet</h1>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-primary/20 cursor-pointer" onClick={() => setView('exhibitions')}>
            <div className="relative h-32 w-full"><Image src="https://picsum.photos/seed/ex/600/400" alt="S" fill className="object-cover" unoptimized data-ai-hint="photography gallery" /><div className="absolute inset-0 bg-black/40" /></div>
            <CardContent className="p-5 space-y-4"><h3 className={cn(typography.cardTitle, "uppercase")}>Sergiler</h3><Button className="w-full rounded-xl">Salonları Gör</Button></CardContent>
          </Card>
          <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-yellow-400/20 cursor-pointer" onClick={() => setView('featured')}>
            <div className="relative h-32 w-full"><Image src="https://picsum.photos/seed/feat/600/400" alt="F" fill className="object-cover" unoptimized data-ai-hint="featured photos" /><div className="absolute inset-0 bg-black/40" /></div>
            <CardContent className="p-5 space-y-4"><h3 className={cn(typography.cardTitle, "uppercase")}>Öne Çıkanlar</h3><Button className="w-full rounded-xl">Hemen Gör</Button></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in slide-in-from-right-10 duration-700">
      <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 rounded-2xl font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Geri Dön</Button>
      <h1 className={cn(typography.h1, "uppercase mb-10")}>{view === 'featured' ? 'Öne Çıkan Kareler' : selectedExhibition?.title || 'Sergiler'}</h1>

      {view === 'exhibitions' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isExLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[32px]" />) : 
           exhibitions?.map(ex => (
             <Card key={ex.id} className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 group cursor-pointer" onClick={() => { setSelectedExhibition(ex); setView('exhibition-detail'); }}>
               <div className="relative h-48 w-full"><Image src={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/600/400`} alt={ex.title} fill className="object-cover" unoptimized /></div>
               <CardContent className="p-6">
                 <h3 className="text-xl font-black uppercase">{ex.title}</h3>
                 <p className="text-sm text-muted-foreground mt-2">{ex.description}</p>
               </CardContent>
             </Card>
           ))}
        </div>
      ) : (
        <>
          {isPhotosLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}</div>
          ) : photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {photos.map((photo) => {
                const isLiked = photo.likes?.includes(user?.uid || '');
                return (
                  <Card key={photo.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all">
                      <Badge variant="secondary" className="bg-white/10 backdrop-blur-xl text-white text-[10px] h-8 px-4 rounded-full font-bold">@{photo.userName || 'Sanatçı'}</Badge>
                      <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full", isLiked ? "text-red-500" : "text-white")} onClick={(e) => handleToggleLike(photo, e)}>
                        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-40 rounded-[64px] border-2 border-dashed bg-muted/5"><Camera size={64} className="mx-auto mb-8 text-muted-foreground/20" /></div>
          )}
        </>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0"><Image src={selectedPhoto.imageUrl} alt="Eser" fill className="object-contain" unoptimized /></div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={cn(typography.cardTitle, "text-2xl font-black flex items-center justify-between")}>Eser Detayları<Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 h-7 rounded-full text-[10px] font-black"><Star className="h-3 w-3 mr-1 fill-current" /> {getOverallScore(selectedPhoto).toFixed(1)}</Badge></DialogTitle>
                <DialogDescription className="font-bold uppercase">Sanatçı: @{selectedPhoto.userName || 'Sanatçı'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {isLevelEligibleForAI && selectedPhoto.aiFeedback ? (
                  <>
                    <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-4">
                      <h4 className={cn(typography.eyebrow, "text-primary")}>Luma Analizi</h4>
                      <div className="space-y-3">
                        <div className="space-y-1"><div className="flex justify-between text-[10px] font-bold"><span>Işık</span><span>{normalizeScore(selectedPhoto.aiFeedback.light_score).toFixed(1)}</span></div><Progress value={normalizeScore(selectedPhoto.aiFeedback.light_score) * 10} className="h-1" /></div>
                        <div className="space-y-1"><div className="flex justify-between text-[10px] font-bold"><span>Kompozisyon</span><span>{normalizeScore(selectedPhoto.aiFeedback.composition_score).toFixed(1)}</span></div><Progress value={normalizeScore(selectedPhoto.aiFeedback.composition_score) * 10} className="h-1" /></div>
                      </div>
                    </Card>
                    <p className="text-sm italic font-medium leading-relaxed bg-muted/30 p-4 rounded-xl">"{selectedPhoto.aiFeedback.short_neutral_analysis}"</p>
                  </>
                ) : <Card className="p-8 border-dashed text-center space-y-4 rounded-[32px]"><Lock size={32} className="mx-auto text-muted-foreground/40" /><p className="font-black uppercase">Analiz Kilitli</p></Card>}
                <div className="flex items-center gap-2 text-red-500 bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 w-fit"><Heart className="h-4 w-4 fill-current" /><span className="font-black">{selectedPhoto.likes?.length || 0} Beğeni</span></div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
