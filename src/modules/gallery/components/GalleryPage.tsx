
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';

import type { Photo, User, Exhibition, UserTier } from '@/types';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, ArrowLeftRight, Star, Lock, ChevronRight, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';

const TIER_COSTS: Record<UserTier, number> = {
  start: 1,
  pro: 2,
  master: 3
};

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const getOverallScore = (photo: Photo): number => {
    if (!photo.aiFeedback) return 0;
    const scores = [
        normalizeScore(photo.aiFeedback.light_score),
        normalizeScore(photo.aiFeedback.composition_score),
        normalizeScore(photo.aiFeedback.technical_clarity_score),
        normalizeScore(photo.aiFeedback.storytelling_score),
        normalizeScore(photo.aiFeedback.boldness_score)
    ].filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
};

const RatingBar = ({ label, score, isLocked }: { label: string; score: number; isLocked?: boolean }) => (
    <div className={cn("relative", isLocked && "opacity-40 grayscale")}>
        <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1">{label} {isLocked && <Lock className="h-2.5 w-2.5" />}</span>
            <span className="text-foreground">{isLocked ? '?' : score.toFixed(1)}</span>
        </div>
        <div className="relative">
          <Progress value={isLocked ? 0 : score * 10} className="h-1.5" />
          {isLocked && <div className="absolute inset-0 bg-muted/20 backdrop-blur-[1px] rounded-full" />}
        </div>
    </div>
);

export default function GalleryPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const { currencyName } = useAppConfig();

    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);

    const photosQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
    const { data: photos, isLoading } = useCollection<Photo>(photosQuery);

    const exhibitionsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true)) : null, [firestore]);
    const { data: activeExhibitions } = useCollection<Exhibition>(exhibitionsQuery);

    const filteredPhotos = useMemo(() => {
        if (!photos) return [];
        let result = [...photos];
        if (activeFilter === 'unanalyzed') result = result.filter(p => !p.aiFeedback);
        else if (activeFilter === 'best_overall') result = result.filter(p => p.aiFeedback).sort((a,b) => getOverallScore(b) - getOverallScore(a));
        else if (activeFilter === 'exhibition') result = result.filter(p => p.isSubmittedToExhibition);
        return result;
    }, [photos, activeFilter]);

    const handleToggleExhibition = async (photo: Photo) => {
      if (!user || !userProfile || !firestore) return;
      
      if (photo.isSubmittedToExhibition) {
          setIsProcessing(true);
          try {
              const batch = writeBatch(firestore);
              batch.delete(doc(firestore, 'public_photos', photo.id));
              batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: false, exhibitionId: null });
              await batch.commit();
              toast({ title: "Sergiden çekildi" });
              setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false, exhibitionId: null } : null);
          } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
          return;
      }

      if (!targetExhibitionId) { toast({ title: "Sergi Seçin" }); return; }
      const SUBMIT_TO_EXHIBITION_COST = 1;

      if (userProfile.auro_balance < SUBMIT_TO_EXHIBITION_COST) {
          toast({ variant: 'destructive', title: `Yetersiz ${currencyName}` });
          return;
      }

      setIsProcessing(true);
      try {
          const batch = writeBatch(firestore);
          const publicData = { ...photo, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId, userName: userProfile.name || 'Sanatçı', userPhotoURL: userProfile.photoURL || null, userLevelName: userProfile.level_name };
          batch.set(doc(firestore, 'public_photos', photo.id), publicData);
          batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: targetExhibitionId });
          batch.update(doc(firestore, 'users', user.uid), { 
            auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST),
            'profile_index.behavioral.exhibition_score': increment(5) // Davranış Katmanı Güncelleme
          });
          await batch.commit();
          toast({ title: "Sergiye gönderildi!" });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
      } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
    };

    if (isLoading) return <div className="container mx-auto px-4 pt-10"><Skeleton className="h-8 w-48 mb-8" /></div>;

    return (
      <div className="container mx-auto px-4 pb-20 pt-10">
        <h1 className="text-3xl font-black mb-8">Galerim</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredPhotos.map((photo) => (
            <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer rounded-[24px]" onClick={() => setSelectedPhoto(photo)}>
                <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover" unoptimized />
            </Card>
          ))}
        </div>

        <Dialog open={!!selectedPhoto} onOpenChange={o => !o && setSelectedPhoto(null)}>
            {selectedPhoto && (
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                    <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40"><Image src={selectedPhoto.imageUrl} alt="Fotoğraf" fill className="object-contain" unoptimized /></div>
                    <div className="md:w-2/5 w-full flex flex-col p-8 space-y-8 overflow-y-auto">
                        <DialogHeader><DialogTitle className="text-2xl font-black">Eser Detayları</DialogTitle></DialogHeader>
                        <div className="pt-8 border-t border-border/40 space-y-4 mt-auto">
                            {!selectedPhoto.isSubmittedToExhibition && activeExhibitions && (
                                <Select onValueChange={setTargetExhibitionId} value={targetExhibitionId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/40"><SelectValue placeholder="Sergi teması seç..." /></SelectTrigger>
                                    <SelectContent>{activeExhibitions.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                            <Button onClick={() => handleToggleExhibition(selectedPhoto)} className="w-full h-12 rounded-xl font-bold" disabled={isProcessing}>
                                {selectedPhoto.isSubmittedToExhibition ? "Sergiden Geri Çek" : "Sergiye Gönder"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
      </div>
    );
}
