
'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Photo, PublicUserProfile, Exhibition } from '@/types';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Star, Heart, Loader2, X, Trophy, Sparkles, LayoutGrid, ChevronRight, ArrowLeft, Filter, Layers, Camera, Globe, Clock, Info } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, updateDocumentNonBlocking } from '@/lib/firebase';
import { collection, query, orderBy, doc, where, arrayUnion, arrayRemove, getCountFromServer } from 'firebase/firestore';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

// --- PHOTO DETAIL DIALOG ---
function PublicPhotoDialog({ photo: photoProp, isOpen, onOpenChange }: { photo: Photo | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [photo, setPhoto] = useState(photoProp);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => { setPhoto(photoProp); }, [photoProp]);

  const ownerProfileRef = useMemoFirebase(() => (photo && firestore) ? doc(firestore, 'public_profiles', photo.userId) : null, [photo, firestore]);
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

  const hasLiked = useMemo(() => (user && photo?.likes) ? photo.likes.includes(user.uid) : false, [photo?.likes, user]);

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
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="sr-only">
            <DialogTitle>Fotoğraf Detayı</DialogTitle>
            <DialogDescription>{profileInfo.name} tarafından paylaşılan fotoğraf.</DialogDescription>
        </DialogHeader>
        <div className="absolute right-4 top-4 z-20">
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 border border-white/10"><X className="h-6 w-6" /></Button>
            </DialogClose>
        </div>
        <ScrollArea className="max-h-[95vh] w-full">
            <div className="flex flex-col md:flex-row">
                <div className="md:w-3/5 w-full relative aspect-square md:aspect-auto bg-black shrink-0">
                  <Image src={photo.imageUrl} alt="Sergi" fill className="object-contain" unoptimized priority />
                </div>
                <div className="md:w-2/5 w-full p-6 sm:p-8 space-y-8 bg-background">
                    <div className="flex items-center gap-4 rounded-2xl p-5 bg-secondary/30 border border-border/50 backdrop-blur-sm shadow-sm">
                      <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md">
                        {profileInfo.photoURL && <AvatarImage src={profileInfo.photoURL} alt={profileInfo.name} className="object-cover" />}
                        <AvatarFallback className="text-2xl font-bold">{profileInfo.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg truncate text-foreground">{profileInfo.name}</p>
                        <Badge variant="outline" className="mt-1 bg-primary/5 text-primary border-primary/20 text-[11px] px-2 py-0.5">{profileInfo.level_name}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl" onClick={toggleLike} disabled={!user || isLiking}>
                                {isLiking ? <Loader2 className="h-5 w-5 animate-spin"/> : <Heart className={cn("h-6 w-6", hasLiked && "fill-red-500 text-red-500")} />}
                            </Button>
                            <div><p className="font-bold text-xl leading-none">{photo.likes?.length || 0}</p><p className="text-xs text-muted-foreground mt-1">Beğeni</p></div>
                        </div>
                        {overallScore > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border/50"><Star className="h-6 w-6 text-amber-400" /></div>
                                <div><p className="font-bold text-xl leading-none">{overallScore.toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Puan</p></div>
                            </div>
                        )}
                    </div>
                    {photo.aiFeedback?.short_neutral_analysis && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Sparkles className="h-3 w-3 text-purple-400" /> Analiz Özeti</h4>
                            <p className="text-sm text-foreground/90 italic leading-relaxed bg-muted/20 p-4 rounded-2xl border border-border/50">"{photo.aiFeedback.short_neutral_analysis}"</p>
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// --- EXPLORE HUB (DASHBOARD) ---
function ExploreHub({ exhibitionCount, activeCompCount, onSelect }: { exhibitionCount: number, activeCompCount: number, onSelect: (view: 'gallery' | 'competitions') => void }) {
    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="max-w-2xl">
                <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white to-muted-foreground bg-clip-text text-transparent">Keşfet</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">Topluluğun yeteneklerini keşfedin, en iyi kareleri inceleyin veya resmi yarışmalarda yerinizi alın.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:scale-[1.02]" onClick={() => onSelect('gallery')}>
                    <CardContent className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-12">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"><LayoutGrid className="h-7 w-7 text-primary" /></div>
                            <Badge variant="secondary" className="h-7 px-3 bg-secondary/80 backdrop-blur-md border-border/50 text-xs font-bold uppercase tracking-wider">{exhibitionCount} Eser Yayında</Badge>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight">Sergi Salonu</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px] mt-2">Türkiye'nin dört bir yanından seçkin fotoğraf karelerini inceleyin.</p>
                        <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">İçeri Gir <ChevronRight className="h-4 w-4" /></div>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:scale-[1.02]" onClick={() => onSelect('competitions')}>
                    <CardContent className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-12">
                            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Trophy className="h-7 w-7 text-amber-500" /></div>
                            <Badge className="h-7 px-3 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-bold uppercase tracking-wider">{activeCompCount} Aktif Yarışma</Badge>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight">Yarışmalar</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px] mt-2">Resmi ödüllü yarışmalara katılın, yeteneklerinizi tescilleyin.</p>
                        <div className="mt-8 flex items-center gap-2 text-amber-500 font-bold text-sm group-hover:gap-3 transition-all">Yarışmaları Gör <ChevronRight className="h-4 w-4" /></div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function ExplorePage() {
  const [view, setView] = useState<'hub' | 'gallery'>('hub');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [counts, setCounts] = useState({ exhibition: 0, competitions: 0 });
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  // Fetch all active exhibitions
  const exhibitionsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true)) : null, [firestore, user]);
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

  useEffect(() => {
    if (!firestore || !user) return;
    const fetchCounts = async () => {
        try {
            const exhibitionSnap = await getCountFromServer(collection(firestore, 'public_photos'));
            const compQuery = query(collection(firestore, 'competitions'), where('endDate', '>', new Date().toISOString()));
            const compSnap = await getCountFromServer(compQuery);
            setCounts({ exhibition: exhibitionSnap.data().count, competitions: compSnap.data().count });
        } catch (e) {
            console.error("Count fetch error:", e);
        }
    };
    fetchCounts();
  }, [firestore, user]);

  const publicPhotosQuery = useMemoFirebase(() => {
    if (!firestore || !user || view !== 'gallery') return null;
    let q = query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc'));
    if (activeFilter !== 'all') q = query(q, where('userLevelName', '==', activeFilter));
    if (selectedExhibitionId) q = query(q, where('exhibitionId', '==', selectedExhibitionId));
    return q;
  }, [firestore, user, view, activeFilter, selectedExhibitionId]);
  
  const { data: photos, isLoading } = useCollection<Photo>(publicPhotosQuery);

  if (view === 'hub') {
      return (
          <div className="container mx-auto px-4 pt-8">
              <ExploreHub 
                exhibitionCount={counts.exhibition} 
                activeCompCount={counts.competitions} 
                onSelect={(v) => v === 'competitions' ? router.push('/competitions') : setView('gallery')} 
              />
          </div>
      );
  }

  return (
    <div className="container mx-auto px-4 pt-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-8 mb-10">
            <Button variant="ghost" onClick={() => setView('hub')} className="w-fit -ml-4 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Keşfet Merkezine Dön
            </Button>
            
            {/* Multi-Exhibition Banners */}
            {exhibitions && exhibitions.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {exhibitions.map(ex => {
                        const isSelected = selectedExhibitionId === ex.id;
                        const remainingDays = Math.ceil((new Date(ex.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        return (
                            <Card key={ex.id} className={cn("cursor-pointer border-cyan-500/20 transition-all", isSelected ? "bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/20" : "bg-cyan-500/5 hover:bg-cyan-500/10")} onClick={() => setSelectedExhibitionId(isSelected ? null : ex.id)}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <Badge className="bg-cyan-500 text-white text-[9px] uppercase font-bold">SERGİ</Badge>
                                        {remainingDays > 0 && <span className="text-[9px] font-bold text-cyan-400 uppercase">{remainingDays} GÜN KALDI</span>}
                                    </div>
                                    <h3 className="font-bold text-lg leading-tight">{ex.title}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{ex.description}</p>
                                    <div className="flex items-center gap-2 pt-2"><Badge variant="outline" className="text-[9px] h-4">{ex.minLevel}+</Badge></div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Sergi Salonu</h1>
                    <p className="text-muted-foreground">Topluluğun en ilham verici kareleri burada buluşuyor.</p>
                </div>
                
                <div className="flex items-center gap-2 p-1 bg-secondary/30 border border-border/50 rounded-2xl backdrop-blur-sm overflow-x-auto max-w-full no-scrollbar">
                    {['all', 'Neuner', 'Viewner', 'Sytner', 'Omner', 'Vexer'].map(id => (
                        <Button 
                            key={id} 
                            variant={activeFilter === id ? 'default' : 'ghost'} 
                            size="sm"
                            className={cn("h-9 rounded-xl px-4 text-xs font-bold transition-all", activeFilter === id ? "shadow-lg shadow-primary/20" : "text-muted-foreground")}
                            onClick={() => setActiveFilter(id)}
                        >{id === 'all' ? 'Tümü' : id}</Button>
                    ))}
                </div>
            </div>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[24px]" />)}
            </div>
        ) : photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {photos.map((photo) => (
                    <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer rounded-[24px] border-none shadow-sm hover:shadow-2xl transition-all" onClick={() => setSelectedPhoto(photo)}>
                        <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 border border-white/20"><AvatarImage src={photo.userPhotoURL || ''} className="object-cover" /><AvatarFallback>{photo.userName?.charAt(0)}</AvatarFallback></Avatar>
                                <span className="text-[11px] text-white font-bold truncate">@{photo.userName}</span>
                            </div>
                            {photo.aiFeedback && <Badge className="bg-primary text-white text-[10px] h-6 px-2 rounded-lg border-none"><Star className="h-2.5 w-2.5 text-white mr-1 fill-current" /> {normalizeScore(photo.aiFeedback.light_score).toFixed(1)}</Badge>}
                        </div>
                    </Card>
                ))}
            </div>
        ) : (
            <div className="text-center py-32 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5">
                <h3 className="text-2xl font-bold mb-2">Eser Bulunamadı</h3>
                <p className="text-muted-foreground">Bu kategori veya seviyede henüz paylaşılan bir eser bulunmuyor.</p>
                <Button variant="outline" className="mt-8 rounded-xl" onClick={() => { setActiveFilter('all'); setSelectedExhibitionId(null); }}>Tüm Eserleri Göster</Button>
            </div>
        )}

        <PublicPhotoDialog photo={selectedPhoto} isOpen={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)} />
    </div>
  );
}
