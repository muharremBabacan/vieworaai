'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, getDocs, orderBy } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';

import type { Photo, User, Exhibition, AnalysisLog, UserTier } from '@/types';
import { levels as gamificationLevels } from '@/lib/gamification';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, ArrowLeftRight, Star, Filter, Lock, HelpCircle, ChevronRight } from 'lucide-react';
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
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
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

    const filters = [
        { id: 'all', label: 'Tümü' },
        { id: 'unanalyzed', label: 'Analiz Bekleyenler' },
        { id: 'best_overall', label: 'En İyilerim' },
        { id: 'exhibition', label: 'Sergilenenler' },
        { id: 'portrait', label: 'Portre' },
        { id: 'landscape', label: 'Manzara' },
        { id: 'street', label: 'Sokak' },
        { id: 'city', label: 'Şehir' },
        { id: 'human', label: 'İnsan' },
        { id: 'animal', label: 'Hayvan' },
        { id: 'still_life', label: 'Natürmort' },
        { id: 'flower', label: 'Çiçek' },
        { id: 'architecture', label: 'Mimari' },
    ];

    const filteredPhotos = useMemo(() => {
        if (!photos) return [];
        let result = [...photos];
        
        if (activeFilter === 'unanalyzed') {
            result = result.filter(p => !p.aiFeedback);
        } else if (activeFilter === 'best_overall') {
            result = result.filter(p => p.aiFeedback).sort((a,b) => getOverallScore(b) - getOverallScore(a));
        } else if (activeFilter === 'exhibition') {
            result = result.filter(p => p.isSubmittedToExhibition);
        } else if (activeFilter !== 'all') {
            result = result.filter(p => {
                if (!p.aiFeedback) return false;
                const genreMatch = p.aiFeedback.genre?.toLowerCase() === activeFilter.toLowerCase();
                const turkishMap: Record<string, string[]> = {
                    portrait: ['portre', 'yüz', 'insan', 'kişi'],
                    landscape: ['manzara', 'doğa', 'dağ', 'deniz'],
                    street: ['sokak', 'cadde', 'yaşam'],
                    city: ['şehir', 'kent', 'meydan'],
                    human: ['insan', 'kişi', 'portre', 'kalabalık'],
                    animal: ['hayvan', 'kedi', 'köpek', 'kuş', 'doğa'],
                    still_life: ['natürmort', 'nesne', 'obje'],
                    flower: ['çiçek', 'bitki', 'makro', 'doğa'],
                    architecture: ['mimari', 'bina', 'yapı', 'iç mekan', 'dış mekan']
                };
                const keywords = turkishMap[activeFilter] || [activeFilter];
                const tagMatch = p.tags?.some(t => keywords.some(k => t.toLowerCase().includes(k.toLowerCase())));
                return genreMatch || tagMatch;
            });
        }
        return result;
    }, [photos, activeFilter]);

    const handleAnalyze = async (photo: Photo) => {
        const tier = userProfile?.tier || 'start';
        const cost = TIER_COSTS[tier];

        if (!user || !userProfile || userProfile.auro_balance < cost) {
            toast({ variant: 'destructive', title: `Yetersiz ${currencyName}` });
            return;
        }
        setIsProcessing(true);
        try {
            const analysis = await generatePhotoAnalysis({ 
              photoUrl: photo.imageUrl, 
              language: 'tr',
              tier: tier
            });
            const batch = writeBatch(firestore);
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);
            const logRef = doc(collection(firestore, 'analysis_logs'));

            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { 
              aiFeedback: analysis, 
              tags: analysis.tags || [],
              analysisTier: tier
            });
            batch.update(doc(firestore, 'users', user.uid), { 
                auro_balance: increment(-cost),
                total_auro_spent: increment(cost),
                total_analyses_count: increment(1)
            });
            batch.set(statRef, { auroSpent: increment(cost), technicalAnalyses: increment(1), date: today }, { merge: true });
            
            batch.set(logRef, {
                id: logRef.id,
                userId: user.uid,
                userName: userProfile.name || 'Sanatçı',
                type: 'technical',
                auroSpent: cost,
                timestamp: new Date().toISOString(),
                status: 'success'
            });

            await batch.commit();
            toast({ title: "Analiz tamamlandı" });
            setSelectedPhoto({ ...photo, aiFeedback: analysis, tags: analysis.tags || [], analysisTier: tier });
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
          batch.update(doc(firestore, 'users', user.uid), { auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST), total_auro_spent: increment(SUBMIT_TO_EXHIBITION_COST) });
          await batch.commit();
          toast({ title: "Sergiye gönderildi!" });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
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

    if (isLoading) return <div className="container mx-auto px-4 pt-10"><Skeleton className="h-8 w-48 mb-8" /><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><Skeleton key={i} className="aspect-square rounded-lg" />)}</div></div>;

    return (
      <div className="container mx-auto px-4 pb-20 pt-10">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black tracking-tight">Galerim</h1>
            <Button size="sm" onClick={() => router.push('/dashboard')} className="rounded-full h-10 px-6 font-bold shadow-lg shadow-primary/20"><Sparkles className="mr-2 h-4 w-4" /> Yeni Analiz</Button>
        </div>

        {photos && photos.length > 0 ? (
          <>
            <div className="relative mb-8 filter-scroll">
                <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x snap-mandatory">
                    <div className="flex w-max gap-3 px-1">
                        {filters.map(f => (
                            <Button 
                                key={f.id} 
                                variant={activeFilter === f.id ? 'default' : 'secondary'} 
                                size="sm" 
                                onClick={() => setActiveFilter(f.id)} 
                                className={cn(
                                    "rounded-full h-10 px-6 font-bold transition-all whitespace-nowrap shrink-0 snap-start",
                                    activeFilter === f.id ? "shadow-md shadow-primary/20 scale-105" : "hover:bg-muted"
                                )}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

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
                <div className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30">
                    <Sparkles className="h-full w-full" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Galeriniz Boş</h3>
                <p className="text-muted-foreground max-sm mx-auto mb-8">Henüz fotoğraf yüklemediniz. Luma ile ilk teknik analizlerinizi yaparak galeriyi doldurmaya başlayın.</p>
                <Button onClick={() => router.push('/dashboard')} size="lg" className="rounded-2xl h-14 px-10 font-bold">Hemen Fotoğraf Yükle</Button>
            </div>
        )}

        <Dialog open={!!selectedPhoto} onOpenChange={o => !o && setSelectedPhoto(null)}>
            {selectedPhoto && (
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                    <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40"><Image src={selectedPhoto.imageUrl} alt="Fotoğraf" fill className="object-contain" unoptimized /></div>
                    <div className="md:w-2/5 w-full flex flex-col p-8 space-y-8 overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black tracking-tight">Eser Detayları</DialogTitle>
                        </DialogHeader>
                        {selectedPhoto.aiFeedback ? (
                            <div className="space-y-6">
                                <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px]">
                                    <div className="flex justify-between items-baseline mb-6">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Genel Puan</span>
                                        <p className="text-4xl font-black text-primary">{getOverallScore(selectedPhoto).toFixed(1)}</p>
                                    </div>
                                    <div className="space-y-4">
                                        <RatingBar label="Işık" score={normalizeScore(selectedPhoto.aiFeedback.light_score)} />
                                        <RatingBar label="Kompozisyon" score={normalizeScore(selectedPhoto.aiFeedback.composition_score)} />
                                        <RatingBar label="Teknik Netlik" score={normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score)} />
                                        <RatingBar label="Hikaye Anlatımı" score={normalizeScore(selectedPhoto.aiFeedback.storytelling_score)} isLocked={selectedPhoto.analysisTier === 'start'} />
                                        <RatingBar label="Cesur Kadraj" score={normalizeScore(selectedPhoto.aiFeedback.boldness_score)} isLocked={selectedPhoto.analysisTier === 'start'} />
                                    </div>
                                    {selectedPhoto.analysisTier === 'start' && (
                                      <Button variant="link" onClick={() => router.push('/pricing')} className="mt-4 p-0 h-auto text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                                        Paketini Yükselt ve Tüm Metrikleri Aç <ChevronRight className="h-3 w-3" />
                                      </Button>
                                    )}
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
                                <Button onClick={() => handleAnalyze(selectedPhoto)} disabled={isProcessing} className="w-full h-12 rounded-xl font-bold">Analiz Et ({TIER_COSTS[userProfile?.tier || 'start']} {currencyName})</Button>
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
                                {selectedPhoto.isSubmittedToExhibition ? "Sergiden Geri Çek" : `Sergiye Gönder (1 ${currencyName})`}
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