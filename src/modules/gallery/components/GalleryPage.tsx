
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import type { Photo, User, Exhibition } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Star, Lock, ChevronRight, Heart, Globe, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';

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

export default function GalleryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  const exhibitionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true)) : null, [firestore]);
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

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
        const publicData = { 
          ...photo, 
          isSubmittedToExhibition: true, 
          exhibitionId: targetExhibitionId, 
          userName: userProfile.name || 'Sanatçı', 
          userPhotoURL: userProfile.photoURL || null, 
          userLevelName: userProfile.level_name 
        };
        batch.set(doc(firestore, 'public_photos', photo.id), publicData);
        batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: targetExhibitionId });
        batch.update(doc(firestore, 'users', user.uid), { 
          auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST),
          'profile_index.activity_signals.exhibition_score': increment(5) // Sanatsal Güven Sinyali (Davranış Katmanı)
        });
        await batch.commit();
        toast({ title: "Sergiye gönderildi!" });
        setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
      const storage = getStorage();
      if (photo.filePath) await deleteObject(ref(storage, photo.filePath)).catch(() => {});
      
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', user.uid, 'photos', photo.id));
      if (photo.isSubmittedToExhibition) batch.delete(doc(firestore, 'public_photos', photo.id));
      
      await batch.commit();
      toast({ title: "Fotoğraf Silindi" });
      setSelectedPhoto(null);
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <h1 className="text-4xl font-black mb-10 tracking-tight">Galerim</h1>
      
      {isPhotosLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      ) : photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {photos.map(photo => (
            <Card key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden border-border/40 bg-card/50 cursor-pointer shadow-sm hover:shadow-xl transition-all" onClick={() => setSelectedPhoto(photo)}>
              <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
              {photo.aiFeedback && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-black/50 backdrop-blur-md text-white border-white/10 px-1.5 h-5 font-black text-[9px]">
                    <Star className="h-2.5 w-2.5 mr-1 fill-current text-yellow-400" /> {getOverallScore(photo).toFixed(1)}
                  </Badge>
                </div>
              )}
              {photo.isSubmittedToExhibition && <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary/80 flex items-center justify-center border border-white/20"><Globe className="h-3 w-3 text-white" /></div>}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 rounded-[40px] border-2 border-dashed bg-muted/5">
          <p className="text-muted-foreground font-medium">Galeriniz henüz boş.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-6 rounded-xl font-bold">İlk Fotoğrafını Yükle</Button>
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row">
            <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
              <Image src={selectedPhoto.imageUrl} alt="Galeri" fill className="object-contain" unoptimized />
            </div>
            <div className="md:w-2/5 w-full flex flex-col p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight flex items-center justify-between">
                  Detaylar
                  {selectedPhoto.aiFeedback && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 font-black uppercase text-[10px]">
                      <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" /> {getOverallScore(selectedPhoto).toFixed(1)}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">{new Date(selectedPhoto.createdAt).toLocaleDateString('tr-TR')}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-2 pr-2">
                <div className="space-y-6">
                  {selectedPhoto.aiFeedback ? (
                    <Card className="p-5 border-primary/20 bg-primary/5 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Teknik Analiz Özeti</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold"><span>Işık</span><span>{normalizeScore(selectedPhoto.aiFeedback.light_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.light_score) * 10} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold"><span>Kompozisyon</span><span>{normalizeScore(selectedPhoto.aiFeedback.composition_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.composition_score) * 10} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold"><span>Teknik Netlik</span><span>{normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score) * 10} className="h-1" />
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <div className="p-6 border-dashed border-border/60 bg-muted/10 rounded-2xl text-center">
                      <Sparkles className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-xs font-bold text-muted-foreground italic">Bu kare henüz analiz edilmemiş.</p>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sergi Durumu</Label>
                      {!selectedPhoto.isSubmittedToExhibition && (
                        <Select value={targetExhibitionId} onValueChange={setTargetExhibitionId}>
                          <SelectTrigger className="h-10 rounded-xl bg-muted/30"><SelectValue placeholder="Sergi Salonu Seç..." /></SelectTrigger>
                          <SelectContent>{exhibitions?.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.title}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      <Button onClick={() => handleToggleExhibition(selectedPhoto)} disabled={isProcessing || (!selectedPhoto.isSubmittedToExhibition && !targetExhibitionId)} className="w-full h-11 rounded-xl font-bold" variant={selectedPhoto.isSubmittedToExhibition ? 'secondary' : 'default'}>
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : selectedPhoto.isSubmittedToExhibition ? <><X className="mr-2 h-4 w-4" /> Sergiden Çek</> : <><Globe className="mr-2 h-4 w-4" /> Sergiye Gönder (1 {currencyName})</>}
                      </Button>
                    </div>

                    <Button onClick={() => handleDeletePhoto(selectedPhoto)} disabled={isProcessing} variant="ghost" className="w-full h-11 rounded-xl text-destructive hover:bg-destructive/10 font-bold">
                      <Trash2 className="mr-2 h-4 w-4" /> Fotoğrafı Sil
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
