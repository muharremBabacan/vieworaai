
'use client';
import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';

import type { Photo, User, Exhibition } from '@/types';
import { levels as gamificationLevels } from '@/lib/gamification';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Globe, Loader2, ArrowLeftRight, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ANALYSIS_COST = 1;
const SUBMIT_TO_EXHIBITION_COST = 1;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const RatingBar = ({ label, score }: { label: string; score: number }) => (
    <div>
        <div className="flex justify-between items-center mb-1 text-sm">
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className="font-semibold">{score.toFixed(1)}</span>
        </div>
        <Progress value={score * 10} className="h-2" />
    </div>
);

export default function GalleryPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();

    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);

    const photosQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'photos')) : null, [user, firestore]);
    const { data: photos, isLoading } = useCollection<Photo>(photosQuery);

    const exhibitionsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true)) : null, [firestore]);
    const { data: activeExhibitions } = useCollection<Exhibition>(exhibitionsQuery);

    const filteredPhotos = useMemo(() => {
        if (!photos) return [];
        let result = [...photos];
        if (activeFilter === 'unanalyzed') result = result.filter(p => !p.aiFeedback);
        else if (activeFilter === 'best_overall') result = result.filter(p => p.aiFeedback).sort((a,b) => getOverallScore(b) - getOverallScore(a));
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [photos, activeFilter]);

    const getOverallScore = (photo: Photo): number => {
        if (!photo.aiFeedback) return 0;
        const lScore = normalizeScore(photo.aiFeedback.light_score);
        const cScore = normalizeScore(photo.aiFeedback.composition_score);
        const tScore = (normalizeScore(photo.aiFeedback.focus_score) + normalizeScore(photo.aiFeedback.color_control_score) + normalizeScore(photo.aiFeedback.background_control_score)) / 3;
        return (lScore + cScore + tScore) / 3;
    };

    const handleAnalyze = async (photo: Photo) => {
        if (!user || !userProfile || userProfile.auro_balance < ANALYSIS_COST) {
            toast({ variant: 'destructive', title: "Yetersiz Auro" });
            return;
        }
        setIsProcessing(true);
        try {
            const analysis = await generatePhotoAnalysis({ photoUrl: photo.imageUrl, language: 'tr' });
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { aiFeedback: analysis, tags: analysis.tags || [] });
            batch.update(doc(firestore, 'users', user.uid), { auro_balance: increment(-ANALYSIS_COST) });
            await batch.commit();
            toast({ title: "Analiz tamamlandı" });
            setSelectedPhoto({ ...photo, aiFeedback: analysis, tags: analysis.tags || [] });
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
    };

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
              setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false, exhibitionId: undefined } : null);
          } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
          return;
      }

      if (!targetExhibitionId) { toast({ title: "Sergi Seçin", description: "Lütfen bir sergi teması seçin." }); return; }
      const selectedEx = activeExhibitions?.find(e => e.id === targetExhibitionId);
      if (!selectedEx) return;

      const currentLevelIndex = gamificationLevels.findIndex(l => l.name === userProfile.level_name);
      const minLevelIndex = gamificationLevels.findIndex(l => l.name === selectedEx.minLevel);
      if (currentLevelIndex < minLevelIndex) {
          toast({ variant: 'destructive', title: "Seviye Yetersiz", description: `En az ${selectedEx.minLevel} olmalısınız.` });
          return;
      }

      if (userProfile.auro_balance < SUBMIT_TO_EXHIBITION_COST) {
          toast({ variant: 'destructive', title: "Yetersiz Auro" });
          return;
      }

      setIsProcessing(true);
      try {
          const batch = writeBatch(firestore);
          const publicData = { ...photo, isSubmittedToExhibition: true, exhibitionId: selectedEx.id, userName: userProfile.name || 'Sanatçı', userPhotoURL: userProfile.photoURL || null, userLevelName: userProfile.level_name };
          batch.set(doc(firestore, 'public_photos', photo.id), publicData);
          batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: selectedEx.id });
          batch.update(doc(firestore, 'users', user.uid), { auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST) });
          await batch.commit();
          toast({ title: "Sergiye gönderildi!" });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: selectedEx.id } : null);
      } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
    };

    const handleDelete = async (photo: Photo) => {
        if (!user || !firestore) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            batch.delete(doc(firestore, 'users', user.uid, 'photos', photo.id));
            if (photo.isSubmittedToExhibition) batch.delete(doc(firestore, 'public_photos', photo.id));
            await batch.commit();
            if (photo.filePath) await deleteObject(ref(storage, photo.filePath)).catch(() => {});
            toast({ title: "Silindi" });
            setSelectedPhoto(null);
        } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
    };

    if (isLoading) return <div className="container mx-auto px-4"><Skeleton className="h-8 w-48 mb-8" /><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><Skeleton key={i} className="aspect-square rounded-lg" />)}</div></div>;

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Galerim</h1>
        {photos && photos.length > 0 ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {['all', 'unanalyzed', 'best_overall'].map(f => (
                    <Button key={f} variant={activeFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(f)} className="capitalize">{f === 'all' ? 'Tümü' : f.replace('_', ' ')}</Button>
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredPhotos.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {photo.aiFeedback && <Badge className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm"><Star className="h-3 w-3 text-yellow-400 mr-1" /> {getOverallScore(photo).toFixed(1)}</Badge>}
                    {photo.isSubmittedToExhibition && <div className="absolute top-2 left-2 p-1 bg-primary rounded-full"><Globe className="h-3 w-3 text-white" /></div>}
                </Card>
              ))}
            </div>
          </>
        ) : <div className="text-center py-20 border-2 border-dashed rounded-2xl"><Button onClick={() => router.push('/dashboard')}>Fotoğraf Yükle</Button></div>}

        <Dialog open={!!selectedPhoto} onOpenChange={o => !o && setSelectedPhoto(null)}>
            {selectedPhoto && (
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden">
                    <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black"><Image src={selectedPhoto.imageUrl} alt="Fotoğraf" fill className="object-contain" unoptimized /></div>
                    <div className="md:w-2/5 w-full flex flex-col p-6 space-y-6 overflow-y-auto">
                        <DialogTitle>Detaylar</DialogTitle>
                        {selectedPhoto.aiFeedback ? (
                            <div className="space-y-4">
                                <Card className="p-4"><p className="text-2xl font-bold text-blue-400 mb-4">{getOverallScore(selectedPhoto).toFixed(1)}</p>
                                <div className="space-y-2">
                                    <RatingBar label="Işık" score={normalizeScore(selectedPhoto.aiFeedback.light_score)} />
                                    <RatingBar label="Kompozisyon" score={normalizeScore(selectedPhoto.aiFeedback.composition_score)} />
                                </div></Card>
                                <div className="prose prose-sm dark:prose-invert"><p>{selectedPhoto.adaptiveFeedback || selectedPhoto.aiFeedback.short_neutral_analysis}</p></div>
                            </div>
                        ) : <Button onClick={() => handleAnalyze(selectedPhoto)} disabled={isProcessing}>Analiz Et ({ANALYSIS_COST} Auro)</Button>}
                        
                        <div className="pt-6 border-t space-y-4">
                            {!selectedPhoto.isSubmittedToExhibition && activeExhibitions && activeExhibitions.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold">Sergi Seçin</Label>
                                    <Select onValueChange={setTargetExhibitionId} value={targetExhibitionId}>
                                        <SelectTrigger><SelectValue placeholder="Sergi teması seç..." /></SelectTrigger>
                                        <SelectContent>{activeExhibitions.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            <Button onClick={() => handleToggleExhibition(selectedPhoto)} variant="outline" className="w-full" disabled={isProcessing}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" />
                                {selectedPhoto.isSubmittedToExhibition ? "Sergiden Geri Çek" : "Sergiye Gönder"}
                            </Button>
                            <Button variant="destructive" className="w-full" onClick={() => handleDelete(selectedPhoto)} disabled={isProcessing}>Sil</Button>
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
      </div>
    );
}
