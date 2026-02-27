
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, getDocs } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';

import type { Photo, User, Exhibition, AnalysisLog } from '@/types';
import { levels as gamificationLevels } from '@/lib/gamification';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, ArrowLeftRight, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
        else if (activeFilter === 'exhibition') result = result.filter(p => p.isSubmittedToExhibition);
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
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);
            const logRef = doc(collection(firestore, 'analysis_logs'));

            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { aiFeedback: analysis, tags: analysis.tags || [] });
            batch.update(doc(firestore, 'users', user.uid), { 
                auro_balance: increment(-ANALYSIS_COST),
                total_auro_spent: increment(ANALYSIS_COST)
            });
            batch.set(statRef, { auroSpent: increment(ANALYSIS_COST), technicalAnalyses: increment(1), date: today }, { merge: true });
            
            const log: AnalysisLog = {
                id: logRef.id,
                userId: user.uid,
                userName: userProfile.name || 'Sanatçı',
                type: 'technical',
                auroSpent: ANALYSIS_COST,
                timestamp: new Date().toISOString(),
                status: 'success'
            };
            batch.set(logRef, log);

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
              setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false, exhibitionId: null } : null);
          } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
          return;
      }

      if (!targetExhibitionId) { toast({ title: "Sergi Seçin", description: "Lütfen bir sergi teması seçin." }); return; }
      
      // EXHIBITION LIMIT CHECK: One photo per user per exhibition
      const existingQuery = query(collection(firestore, 'public_photos'), where('userId', '==', user.uid), where('exhibitionId', '==', targetExhibitionId));
      const existingSnap = await getDocs(existingQuery);
      
      if (!existingSnap.empty) {
          toast({ variant: 'destructive', title: "Katılım Reddedildi", description: "Bu sergi salonuna zaten bir eserinizle katılmışsınız. Yeni bir tane göndermek için eskisini geri çekmelisiniz." });
          return;
      }

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
          const publicData = { 
              ...photo, 
              isSubmittedToExhibition: true, 
              exhibitionId: selectedEx.id, 
              userName: userProfile.name || 'Sanatçı', 
              userPhotoURL: userProfile.photoURL || null, 
              userLevelName: userProfile.level_name 
          };
          const today = new Date().toISOString().split('T')[0];
          const statRef = doc(firestore, 'global_stats', `daily_${today}`);
          const logRef = doc(collection(firestore, 'analysis_logs'));

          batch.set(doc(firestore, 'public_photos', photo.id), publicData);
          batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: selectedEx.id });
          batch.update(doc(firestore, 'users', user.uid), { 
              auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST),
              total_auro_spent: increment(SUBMIT_TO_EXHIBITION_COST)
          });
          batch.set(statRef, { auroSpent: increment(SUBMIT_TO_EXHIBITION_COST), date: today }, { merge: true });

          const log: AnalysisLog = {
              id: logRef.id,
              userId: user.uid,
              userName: userProfile.name || 'Sanatçı',
              type: 'exhibition',
              auroSpent: SUBMIT_TO_EXHIBITION_COST,
              timestamp: new Date().toISOString(),
              status: 'success'
          };
          batch.set(logRef, log);

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

    const filters = [
        { id: 'all', label: 'Tümü' },
        { id: 'unanalyzed', label: 'Analiz Bekleyenler' },
        { id: 'best_overall', label: 'En İyilerim' },
        { id: 'exhibition', label: 'Sergilenenler' },
    ];

    return (
      <div className="container mx-auto px-4 pb-20">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black tracking-tight">Galerim</h1>
            <Button size="sm" onClick={() => router.push('/dashboard')} className="rounded-full h-10 px-6 font-bold shadow-lg shadow-primary/20"><Sparkles className="mr-2 h-4 w-4" /> Yeni Analiz</Button>
        </div>

        {photos && photos.length > 0 ? (
          <>
            <ScrollArea className="w-full whitespace-nowrap mb-8 pb-4">
                <div className="flex w-max gap-3 px-1">
                    {filters.map(f => (
                        <Button 
                            key={f.id} 
                            variant={activeFilter === f.id ? 'default' : 'secondary'} 
                            size="sm" 
                            onClick={() => setActiveFilter(f.id)} 
                            className={cn(
                                "rounded-full h-10 px-6 font-bold transition-all",
                                activeFilter === f.id ? "shadow-md shadow-primary/20 scale-105" : "hover:bg-muted"
                            )}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredPhotos.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer rounded-[24px] border-none shadow-md transition-all hover:scale-[1.02] active:scale-95" onClick={() => setSelectedPhoto(photo)}>
                    <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {photo.aiFeedback && (
                        <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                            <Badge className="bg-black/50 backdrop-blur-md border-white/10 px-2 h-7 font-black">
                                <Star className="h-3 w-3 text-yellow-400 mr-1 fill-current" /> {getOverallScore(photo).toFixed(1)}
                            </Badge>
                        </div>
                    )}
                    {photo.isSubmittedToExhibition && (
                        <div className="absolute bottom-3 left-3 animate-in slide-in-from-bottom-2">
                            <Badge className="bg-primary/20 backdrop-blur-md text-primary border-primary/20 px-2 h-6 text-[9px] font-black uppercase tracking-wider">SERGİDE</Badge>
                        </div>
                    )}
                </Card>
              ))}
            </div>
          </>
        ) : (
            <div className="text-center py-32 rounded-[40px] border-2 border-dashed border-border/40 bg-muted/5 animate-in zoom-in duration-500">
                <Camera className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
                <h3 className="text-2xl font-bold mb-2">Galeriniz Boş</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-8">Henüz fotoğraf yüklemediniz. Luma ile ilk teknik analizinizi yaparak galeriyi doldurmaya başlayın.</p>
                <Button onClick={() => router.push('/dashboard')} size="lg" className="rounded-2xl h-14 px-10 font-bold">Hemen Fotoğraf Yükle</Button>
            </div>
        )}

        <Dialog open={!!selectedPhoto} onOpenChange={o => !o && setSelectedPhoto(null)}>
            {selectedPhoto && (
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                    <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40"><Image src={selectedPhoto.imageUrl} alt="Fotoğraf" fill className="object-contain" unoptimized /></div>
                    <div className="md:w-2/5 w-full flex flex-col p-8 space-y-8 overflow-y-auto">
                        <DialogTitle className="text-2xl font-black tracking-tight">Eser Detayları</DialogTitle>
                        {selectedPhoto.aiFeedback ? (
                            <div className="space-y-6">
                                <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px]">
                                    <div className="flex justify-between items-baseline mb-6">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teknik Skor</span>
                                        <p className="text-4xl font-black text-primary">{getOverallScore(selectedPhoto).toFixed(1)}</p>
                                    </div>
                                    <div className="space-y-5">
                                        <RatingBar label="Işık" score={normalizeScore(selectedPhoto.aiFeedback.light_score)} />
                                        <RatingBar label="Kompozisyon" score={normalizeScore(selectedPhoto.aiFeedback.composition_score)} />
                                    </div>
                                </Card>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Luma Notu</span>
                                    <p className="text-sm italic text-foreground/90 leading-relaxed font-medium bg-muted/30 p-4 rounded-xl border border-border/40">
                                        "{selectedPhoto.adaptiveFeedback || selectedPhoto.aiFeedback.short_neutral_analysis}"
                                    </p>
                                </div>
                                {selectedPhoto.tags && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {selectedPhoto.tags.map((t, i) => <Badge key={i} variant="secondary" className="text-[9px] bg-secondary/50 uppercase font-black px-3 h-6 border-none">{t}</Badge>)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 py-10 text-center">
                                <Sparkles className="h-12 w-12 text-primary mx-auto mb-2 opacity-50" />
                                <p className="text-sm text-muted-foreground font-medium">Bu fotoğraf henüz teknik olarak analiz edilmedi.</p>
                                <Button onClick={() => handleAnalyze(selectedPhoto)} disabled={isProcessing} className="w-full h-12 rounded-xl font-bold">Analiz Et ({ANALYSIS_COST} Auro)</Button>
                            </div>
                        )}
                        
                        <div className="pt-8 border-t border-border/40 space-y-4 mt-auto">
                            {!selectedPhoto.isSubmittedToExhibition && activeExhibitions && activeExhibitions.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Sergi Salonu Seçin</Label>
                                    <Select onValueChange={setTargetExhibitionId} value={targetExhibitionId}>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/40"><SelectValue placeholder="Sergi teması seç..." /></SelectTrigger>
                                        <SelectContent>{activeExhibitions.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            <Button onClick={() => handleToggleExhibition(selectedPhoto)} variant="outline" className="w-full h-12 rounded-xl font-bold border-border/60" disabled={isProcessing}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" />
                                {selectedPhoto.isSubmittedToExhibition ? "Sergiden Geri Çek" : "Sergiye Gönder (1 Auro)"}
                            </Button>
                            <Button variant="ghost" className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold" onClick={() => handleDelete(selectedPhoto)} disabled={isProcessing}>
                                <Trash2 className="mr-2 h-4 w-4" /> Kalıcı Olarak Sil
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
      </div>
    );
}
