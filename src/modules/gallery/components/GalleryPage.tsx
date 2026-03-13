'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import type { Photo, User, Exhibition } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Star, Globe, X, Camera, Layers, Lightbulb, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
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
        normalizeScore(photo.aiFeedback.technical_clarity_score),
        normalizeScore(photo.aiFeedback.storytelling_score),
        normalizeScore(photo.aiFeedback.boldness_score)
    ].filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
};

const STATUS_FILTERS = [
  { id: 'all', label: 'Tümü', icon: Layers },
  { id: 'analyzed', label: 'Analiz Edilenler', icon: Sparkles },
  { id: 'exhibition', label: 'Sergidekiler', icon: Globe },
  { id: 'best', label: 'En İyiler', icon: Star },
];

export default function GalleryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();

  // 1. ALL HOOKS AT TOP
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  const exhibitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'exhibitions'), where('isActive', '==', true));
  }, [firestore]);

  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    let result = [...photos];

    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'analyzed':
          result = result.filter(p => !!p.aiFeedback);
          break;
        case 'exhibition':
          result = result.filter(p => p.isSubmittedToExhibition);
          break;
        case 'best':
          result = result.filter(p => getOverallScore(p) >= 8);
          break;
      }
    }

    if (categoryFilter !== 'all') {
      result = result.filter(p => p.tags?.some(t => t.toLowerCase() === categoryFilter));
    }

    return result;
  }, [photos, statusFilter, categoryFilter]);

  const handleToggleExhibition = async (photo: Photo) => {
    if (!user || !userProfile || !firestore) return;

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);

        if (photo.isSubmittedToExhibition) {
            batch.delete(doc(firestore, 'public_photos', photo.id));
            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: false, exhibitionId: null });
            batch.update(doc(firestore, 'users', user.uid), {
              total_exhibitions_count: increment(-1)
            });

            await batch.commit();
            toast({ title: "Sergiden çekildi" });
            setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false, exhibitionId: null } : null);
        } else {
            if (!targetExhibitionId) {
              toast({ title: "Sergi Seçin" });
              setIsProcessing(false);
              return;
            }

            const cost = 1;
            if (userProfile.auro_balance < cost) {
                toast({ variant: 'destructive', title: `Yetersiz ${currencyName}` });
                setIsProcessing(false);
                return;
            }

            const publicData = {
              ...photo,
              isSubmittedToExhibition: true,
              exhibitionId: targetExhibitionId,
              userName: userProfile.name || 'Sanatçı',
              userPhotoURL: userProfile.photoURL || null,
              userLevelName: userProfile.level_name
            };

            batch.set(doc(firestore, 'public_photos', photo.id), publicData);
            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), {
              isSubmittedToExhibition: true,
              exhibitionId: targetExhibitionId
            });
            batch.update(doc(firestore, 'users', user.uid), {
              auro_balance: increment(-cost),
              total_exhibitions_count: increment(1),
              'profile_index.activity_signals.exhibition_score': increment(5)
            });

            await batch.commit();
            toast({ title: "Sergiye gönderildi!" });
            setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
        }
    } catch (e) {
      toast({ variant: 'destructive', title: "İşlem Başarısız" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
      const storage = getStorage();
      const batch = writeBatch(firestore);
      
      batch.delete(doc(firestore, 'users', user.uid, 'photos', photo.id));
      if (photo.isSubmittedToExhibition) {
        batch.delete(doc(firestore, 'public_photos', photo.id));
        batch.update(doc(firestore, 'users', user.uid), {
          total_exhibitions_count: increment(-1)
        });
      }
      
      await batch.commit();

      if (photo.filePath) {
        try {
          const fileRef = ref(storage, photo.filePath);
          await deleteObject(fileRef);
        } catch (storageError) {
          console.warn("Storage file already deleted or not found.");
        }
      }

      toast({ title: "Fotoğraf Silindi" });
      setSelectedPhoto(null);
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPhotosLoading || isProfileLoading) {
    return <div className="container mx-auto px-4 py-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-10 space-y-4">
        <div className="space-y-1">
          <p className={typography.eyebrow}>GALERİM</p>
          <h1 className={cn(typography.h1, "uppercase")}>Fotoğrafların</h1>
        </div>

        <div className="flex bg-secondary/30 p-1 rounded-2xl border border-border/40 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map(f => (
            <Button key={f.id} variant={statusFilter === f.id ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter(f.id)} className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest whitespace-nowrap">
              <f.icon className="mr-2 h-3 w-3" /> {f.label}
            </Button>
          ))}
        </div>
      </header>

      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {filteredPhotos.map((photo) => (
            <Card key={photo.id} className="group relative aspect-square rounded-[32px] overflow-hidden border-none shadow-2xl transition-all hover:scale-[1.02] cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
              <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <div className="flex gap-1.5">
                  {photo.aiFeedback && (
                    <Badge variant="secondary" className="bg-primary/20 backdrop-blur-md text-primary border-primary/20 font-black h-6 rounded-full text-[9px]">
                      <Star className="h-2.5 w-2.5 mr-1 fill-current text-yellow-400" /> {getOverallScore(photo).toFixed(1)}
                    </Badge>
                  )}
                  {photo.isSubmittedToExhibition && <Badge className="bg-green-500/20 backdrop-blur-md text-green-400 border-green-500/20 font-black h-6 rounded-full text-[9px] uppercase">SERGİDE</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 rounded-[48px] border-2 border-dashed border-border/40 bg-muted/5">
          <Camera className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
          <h3 className={cn(typography.h2, "text-2xl uppercase")}>Henüz Fotoğraf Yok</h3>
          <p className={typography.body}>İlk fotoğrafını yükle ve analiz etmeye başla.</p>
          <Button asChild className="mt-8 rounded-xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
            <a href="/dashboard">Fotoğraf Yükle</a>
          </Button>
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0">
              <Image src={selectedPhoto.imageUrl} alt="Eser" fill className="object-contain" unoptimized />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className={cn(typography.cardTitle, "text-2xl font-black uppercase")}>Fotoğraf Detayı</DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePhoto(selectedPhoto)} className="text-muted-foreground hover:text-destructive h-10 w-10 rounded-full bg-secondary/50">
                    <Trash2 size={18} />
                  </Button>
                </div>
                <DialogDescription className={cn(typography.meta, "font-bold uppercase")}>
                  Yükleme: {new Date(selectedPhoto.createdAt).toLocaleDateString('tr-TR')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {selectedPhoto.aiFeedback ? (
                  <>
                    <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-4">
                      <div className="flex justify-between items-end">
                        <h4 className={cn(typography.eyebrow, "text-primary")}>Luma Analizi</h4>
                        <p className="text-3xl font-black text-primary tracking-tighter">{getOverallScore(selectedPhoto).toFixed(1)}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className={cn(typography.meta, "flex justify-between font-bold")}><span>Işık</span><span>{normalizeScore(selectedPhoto.aiFeedback.light_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.light_score) * 10} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className={cn(typography.meta, "flex justify-between font-bold")}><span>Kompozisyon</span><span>{normalizeScore(selectedPhoto.aiFeedback.composition_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.composition_score) * 10} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className={cn(typography.meta, "flex justify-between font-bold")}><span>Teknik Netlik</span><span>{normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score).toFixed(1)}</span></div>
                          <Progress value={normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score) * 10} className="h-1" />
                        </div>
                      </div>
                    </Card>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/40 space-y-2">
                      <div className="flex items-center gap-2"><Lightbulb size={14} className="text-amber-400" /><span className="text-[10px] font-black uppercase text-muted-foreground">Luma'nın Özeti</span></div>
                      <p className="text-sm italic font-medium leading-relaxed">"{selectedPhoto.aiFeedback.short_neutral_analysis}"</p>
                    </div>
                  </>
                ) : (
                  <Card className="p-8 border-dashed border-border/60 bg-muted/10 text-center space-y-4 rounded-[32px]">
                    <Sparkles className="h-8 w-8 mx-auto text-primary animate-pulse" />
                    <p className={cn(typography.cardTitle, "uppercase")}>Analiz Bekliyor</p>
                    <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl font-black text-[10px] uppercase">Hemen Analiz Et</Button>
                  </Card>
                )}

                <div className="space-y-4 pt-4 border-t border-border/40">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sergi Seçimi</Label>
                    <Select value={targetExhibitionId} onValueChange={setTargetExhibitionId} disabled={selectedPhoto.isSubmittedToExhibition}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30"><SelectValue placeholder="Aktif bir sergi seç..." /></SelectTrigger>
                      <SelectContent>
                        {exhibitions?.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => handleToggleExhibition(selectedPhoto)} 
                    disabled={isProcessing || (!selectedPhoto.isSubmittedToExhibition && !targetExhibitionId)} 
                    className={cn(typography.button, "w-full h-12 rounded-xl shadow-lg")} 
                    variant={selectedPhoto.isSubmittedToExhibition ? 'secondary' : 'default'}
                  >
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : selectedPhoto.isSubmittedToExhibition ? <><X className="mr-2 h-4 w-4" /> Sergiden Çek</> : <><Globe className="mr-2 h-4 w-4" /> Sergiye Gönder (1 {currencyName})</>}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}