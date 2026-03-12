
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import type { Photo, User, Exhibition } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Trash2, Star, Lock, ChevronRight, Heart, Globe, X, Camera, Trophy, LayoutGrid, Layers, Lightbulb } from 'lucide-react';
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
  { id: 'competition', label: 'Yarışmadakiler', icon: Trophy },
  { id: 'best', label: 'En İyiler', icon: Star },
];

const CATEGORY_FILTERS = [
  { id: 'all', label: 'Tüm Türler' },
  { id: 'portrait', label: 'Portre' },
  { id: 'street', label: 'Sokak' },
  { id: 'architecture', label: 'Mimari' },
  { id: 'macro', label: 'Makro' },
  { id: 'landscape', label: 'Manzara' },
];

export default function GalleryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const photosQuery = useMemoFirebase(() => (user && firestore) ? query(collection(firestore, 'users', user.uid, 'photos'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  const exhibitionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true)) : null, [firestore]);
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
            if (!targetExhibitionId) { toast({ title: "Sergi Seçin" }); setIsProcessing(false); return; }
            const SUBMIT_TO_EXHIBITION_COST = 1;

            if (userProfile.auro_balance < SUBMIT_TO_EXHIBITION_COST) {
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
            batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: targetExhibitionId });
            batch.update(doc(firestore, 'users', user.uid), { 
              auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST),
              total_exhibitions_count: increment(1),
              'profile_index.activity_signals.exhibition_score': increment(5) 
            });
            await batch.commit();
            toast({ title: "Sergiye gönderildi!" });
            setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
        }
    } catch (e) { 
      console.error(e);
      toast({ variant: 'destructive', title: "İşlem Başarısız" }); 
    } finally { setIsProcessing(false); }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !firestore || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const storage = getStorage();
      const batch = writeBatch(firestore);
      const userPhotoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
      
      // 1. Veritabanı kayıtlarını Batch ile sil
      batch.delete(userPhotoRef);
      
      if (photo.isSubmittedToExhibition) {
        batch.delete(doc(firestore, 'public_photos', photo.id));
        batch.update(doc(firestore, 'users', user.uid), { 
          total_exhibitions_count: increment(-1)
        });
      }
      
      // Firestore işlemini önce bitir (UI hızlı güncellenir)
      await batch.commit();
      
      // 2. Fiziksel dosyayı Storage'dan sil (Arka planda, hata verse de kaydı etkilemez)
      if (photo.filePath) {
        const storageRef = ref(storage, photo.filePath);
        deleteObject(storageRef).catch((err) => {
          console.warn("Dosya depodan silinemedi (zaten yok olabilir):", err);
        });
      }
      
      toast({ title: "Fotoğraf Silindi", description: "Kare galerinden kalıcı olarak kaldırıldı." });
      setSelectedPhoto(null);
    } catch (e: any) { 
      console.error("Delete error:", e);
      toast({ variant: 'destructive', title: "Silme Hatası", description: "Bir sorun oluştu, lütfen tekrar deneyin." }); 
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-10 space-y-1">
        <p className={cn(typography.eyebrow, "ml-1")}>KÜTÜPHANE</p>
        <h1 className={cn(typography.h1, "leading-none uppercase")}>Galerim</h1>
      </header>
      
      <div className="space-y-4 mb-12">
        <div className="relative filter-scroll">
          <div className="flex overflow-x-auto no-scrollbar snap-x gap-2 pb-1 touch-pan-x scroll-smooth">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  typography.button,
                  "shrink-0 snap-start h-10 rounded-xl transition-all px-6",
                  statusFilter === f.id ? "shadow-lg shadow-primary/20" : "bg-secondary/30 border border-border/40 hover:bg-secondary/50"
                )}
              >
                <f.icon className={cn("mr-2 h-3.5 w-3.5", f.id === 'best' && "fill-current text-yellow-400")} />
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="relative filter-scroll">
          <div className="flex overflow-x-auto no-scrollbar snap-x gap-2 pb-2 touch-pan-x scroll-smooth">
            {CATEGORY_FILTERS.map((f) => (
              <Button
                key={f.id}
                variant={categoryFilter === f.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(f.id)}
                className={cn(
                  typography.button,
                  "shrink-0 snap-start h-8 rounded-lg transition-all px-4 text-[9px] tracking-[0.15em]",
                  categoryFilter === f.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {isPhotosLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}
        </div>
      ) : filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredPhotos.map(photo => {
            const overallScore = getOverallScore(photo);
            return (
              <Card 
                key={photo.id} 
                className="group relative aspect-square rounded-[32px] overflow-hidden border-none bg-card/50 cursor-pointer shadow-xl transition-all hover:scale-[1.03]" 
                onClick={() => setSelectedPhoto(photo)}
              >
                <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                  <div className="flex flex-col gap-1.5">
                    {photo.isSubmittedToExhibition && (
                      <div className="h-6 w-6 rounded-full bg-blue-500/80 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                        <Globe className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  {photo.aiFeedback && (
                    <Badge className="bg-black/60 backdrop-blur-md text-white border-white/10 px-2 h-6 font-black text-[10px] rounded-full shadow-lg">
                      <Star className="h-2.5 w-2.5 mr-1 fill-current text-yellow-400" /> {overallScore.toFixed(1)}
                    </Badge>
                  )}
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-500">
                  <div className="flex items-center gap-1.5 text-white/90">
                    <Heart size={14} className={cn(photo.likes?.length ? "fill-red-500 text-red-500" : "text-white")} />
                    <span className="text-[10px] font-black">{photo.likes?.length || 0}</span>
                  </div>
                  <span className={cn(typography.meta, "text-[8px] text-white/60 uppercase tracking-widest")}>{new Date(photo.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-40 rounded-[64px] border-2 border-dashed border-border/40 bg-muted/5 animate-in zoom-in duration-500">
          <div className="h-20 w-20 bg-secondary rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Camera className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className={cn(typography.h2, "uppercase")}>Galeri Boş</h3>
          <p className={cn(typography.body, "mt-2 max-w-xs mx-auto")}>
            {statusFilter === 'all' && categoryFilter === 'all' ? 'Henüz yüklenmiş bir fotoğrafın yok.' : 'Bu kriterlere uygun eser bulunamadı.'}
          </p>
          {(statusFilter !== 'all' || categoryFilter !== 'all') ? (
            <Button onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }} variant="outline" className={cn(typography.button, "mt-8 rounded-xl px-8")}>Filtreleri Temizle</Button>
          ) : (
            <Button onClick={() => router.push('/dashboard')} className={cn(typography.button, "mt-8 rounded-xl px-10 h-12 shadow-xl shadow-primary/20")}>İlk Fotoğrafını Yükle</Button>
          )}
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[48px]">
            <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
              <Image src={selectedPhoto.imageUrl} alt="Galeri" fill className="object-contain" unoptimized />
            </div>
            <div className="md:w-2/5 w-full flex flex-col p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={cn(typography.cardTitle, "text-2xl font-black flex items-center justify-between")}>
                  Detaylar
                  {selectedPhoto.aiFeedback && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 h-7 rounded-full font-black uppercase text-[10px]">
                      <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" /> {getOverallScore(selectedPhoto).toFixed(1)}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className={typography.eyebrow}>
                  {new Date(selectedPhoto.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-2 pr-2">
                <div className="space-y-6">
                  {selectedPhoto.aiFeedback ? (
                    <>
                      <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-5">
                        <h4 className={cn(typography.eyebrow, "text-primary flex items-center gap-2")}>
                          <Sparkles size={12} /> Teknik Analiz Özeti
                        </h4>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className={cn(typography.meta, "flex justify-between font-black uppercase")}><span>Işık</span><span>{normalizeScore(selectedPhoto.aiFeedback.light_score).toFixed(1)}</span></div>
                            <Progress value={normalizeScore(selectedPhoto.aiFeedback.light_score) * 10} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className={cn(typography.meta, "flex justify-between font-black uppercase")}><span>Kompozisyon</span><span>{normalizeScore(selectedPhoto.aiFeedback.composition_score).toFixed(1)}</span></div>
                            <Progress value={normalizeScore(selectedPhoto.aiFeedback.composition_score) * 10} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className={cn(typography.meta, "flex justify-between font-black uppercase")}><span>Teknik Netlik</span><span>{normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score).toFixed(1)}</span></div>
                            <Progress value={normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score) * 10} className="h-1.5" />
                          </div>
                        </div>
                      </Card>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb size={16} className="text-amber-400" />
                          <span className={typography.eyebrow}>Luma Notu</span>
                        </div>
                        <p className={cn(typography.body, "italic text-foreground/90 bg-muted/30 p-4 rounded-xl border border-border/40 leading-relaxed")}>
                          "{selectedPhoto.aiFeedback.short_neutral_analysis}"
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 border-dashed border-border/60 bg-muted/10 rounded-[32px] text-center">
                      <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                      <p className={cn(typography.meta, "font-bold italic")}>Bu kare henüz analiz edilmemiş.</p>
                    </div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="space-y-3">
                      <Label className={cn(typography.eyebrow, "ml-1")}>Sergi İşlemleri</Label>
                      {!selectedPhoto.isSubmittedToExhibition && (
                        <Select value={targetExhibitionId} onValueChange={setTargetExhibitionId}>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                            <SelectValue placeholder="Sergi Salonu Seç..." />
                          </SelectTrigger>
                          <SelectContent>
                            {exhibitions?.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Button onClick={() => handleToggleExhibition(selectedPhoto)} disabled={isProcessing || (!selectedPhoto.isSubmittedToExhibition && !targetExhibitionId)} className={cn(typography.button, "w-full h-12 rounded-xl shadow-lg")} variant={selectedPhoto.isSubmittedToExhibition ? 'secondary' : 'default'}>
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : selectedPhoto.isSubmittedToExhibition ? <><X className="mr-2 h-4 w-4" /> Sergiden Çek</> : <><Globe className="mr-2 h-4 w-4" /> Sergiye Gönder (1 {currencyName})</>}
                      </Button>
                    </div>

                    <Button onClick={() => handleDeletePhoto(selectedPhoto)} disabled={isProcessing} variant="ghost" className={cn(typography.button, "w-full h-12 rounded-xl text-destructive hover:bg-destructive/10")}>
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
