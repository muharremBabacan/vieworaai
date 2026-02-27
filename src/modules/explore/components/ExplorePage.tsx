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
import { Star, Heart, Loader2, X, Trophy, Sparkles, LayoutGrid, ChevronRight, ArrowLeft, Users, Globe, Clock, Calendar } from 'lucide-react';
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

// --- EXPLORE HUB ---
function ExploreHub({ counts, onSelect }: { counts: { exhibition: number, competitions: number, groups: number }, onSelect: (view: 'halls' | 'competitions' | 'groups') => void }) {
    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="max-w-2xl">
                <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white to-muted-foreground bg-clip-text text-transparent">Keşfet</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">Topluluğun yeteneklerini keşfedin, tematik sergilere göz atın veya gruplarda yerinizi alın.</p>
            </div>

            <div className="grid gap-6">
                <Card className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:scale-[1.01]" onClick={() => onSelect('halls')}>
                    <CardContent className="p-8 relative z-10 flex items-center gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0"><Globe className="h-8 w-8 text-cyan-500" /></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold tracking-tight">Sergi Salonu</h3>
                            <p className="text-muted-foreground text-sm mt-1">{counts.exhibition} aktif sergi salonu ziyarete açık.</p>
                        </div>
                        <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-cyan-500 transition-all group-hover:translate-x-1" />
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:scale-[1.01]" onClick={() => onSelect('competitions')}>
                    <CardContent className="p-8 relative z-10 flex items-center gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0"><Trophy className="h-8 w-8 text-amber-500" /></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold tracking-tight">Yarışmalar</h3>
                            <p className="text-muted-foreground text-sm mt-1">{counts.competitions} aktif etkinlik ve ödül fırsatı.</p>
                        </div>
                        <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-amber-500 transition-all group-hover:translate-x-1" />
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:scale-[1.01]" onClick={() => onSelect('groups')}>
                    <CardContent className="p-8 relative z-10 flex items-center gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0"><Users className="h-8 w-8 text-purple-500" /></div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold tracking-tight">Gruplar</h3>
                            <p className="text-muted-foreground text-sm mt-1">{counts.groups} topluluk ile etkileşime geçin.</p>
                        </div>
                        <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-purple-500 transition-all group-hover:translate-x-1" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// --- EXHIBITION HALL LIST ---
function ExhibitionHallList({ exhibitions, onSelect, onBack }: { exhibitions: Exhibition[] | null, onSelect: (ex: Exhibition) => void, onBack: () => void }) {
    if (!exhibitions || exhibitions.length === 0) {
        return (
            <div className="space-y-10">
                <Button variant="ghost" onClick={onBack} className="-ml-4 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Geri</Button>
                <div className="text-center py-32 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5">
                    <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-xl font-bold">Şu an aktif bir sergi yok</h3>
                    <p className="text-muted-foreground mt-2">Admin tarafından yeni sergiler açıldığında burada görünecek.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="-ml-4 text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Keşfet</Button>
                <Badge variant="outline" className="text-[10px] font-black tracking-widest uppercase py-1 px-3 border-cyan-500/30 text-cyan-500 bg-cyan-500/5">Aktif Salonlar</Badge>
            </div>
            <div className="max-w-2xl">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Sergi Salonları</h1>
                <p className="text-muted-foreground">İlham verici temalara göre düzenlenmiş galerileri ziyaret edin.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {exhibitions.map(ex => {
                    const timeLeft = new Date(ex.endDate).getTime() - new Date().getTime();
                    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
                    
                    return (
                        <Card key={ex.id} className="group relative overflow-hidden border-border/40 bg-card/50 rounded-[32px] cursor-pointer transition-all hover:border-cyan-500/30 shadow-lg" onClick={() => onSelect(ex)}>
                            <div className="relative h-56 w-full overflow-hidden">
                                <Image src={ex.imageUrl || 'https://picsum.photos/seed/exhibition/800/600'} alt={ex.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 backdrop-blur-md">AKTİF</Badge>
                                    <Badge variant="outline" className="bg-black/40 text-white border-white/10 backdrop-blur-md text-[10px] uppercase font-bold">{ex.minLevel}+</Badge>
                                </div>
                                <div className="absolute bottom-4 left-5 right-5">
                                    <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{ex.title}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-400 uppercase tracking-tighter">
                                            <Clock className="h-3 w-3" /> {daysLeft > 0 ? `${daysLeft} gün kaldı` : 'Son saatler'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-6">{ex.description}</p>
                                <Button className="w-full rounded-xl h-11 font-bold bg-secondary hover:bg-secondary/80 text-foreground group-hover:bg-cyan-500 group-hover:text-white transition-all">Salona Giriş Yap</Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

export default function ExplorePage() {
  const [view, setView] = useState<'hub' | 'halls' | 'gallery'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [counts, setCounts] = useState({ exhibition: 0, competitions: 0, groups: 0 });
  
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!firestore || !user) return;
    const fetchCounts = async () => {
        try {
            const exhibitionSnap = await getCountFromServer(collection(firestore, 'exhibitions'));
            const groupsSnap = await getCountFromServer(collection(firestore, 'groups'));
            const compQuery = query(collection(firestore, 'competitions'), where('endDate', '>', new Date().toISOString()));
            const compSnap = await getCountFromServer(compQuery);
            setCounts({ 
                exhibition: exhibitionSnap.data().count, 
                competitions: compSnap.data().count,
                groups: groupsSnap.data().count
            });
        } catch (e) {}
    };
    fetchCounts();
  }, [firestore, user]);

  // Sergileri çek
  const exhibitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: exhibitions, isLoading: isHallsLoading } = useCollection<Exhibition>(exhibitionsQuery);

  // Fotoğrafları çek (Seçili sergiye göre filtrele)
  const publicPhotosQuery = useMemoFirebase(() => {
    if (!firestore || !user || view !== 'gallery' || !selectedExhibition) return null;
    return query(
        collection(firestore, 'public_photos'), 
        where('exhibitionId', '==', selectedExhibition.id),
        orderBy('createdAt', 'desc')
    );
  }, [firestore, user, view, selectedExhibition]);
  
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(publicPhotosQuery);

  // Görünüm Değişimi
  if (view === 'hub') {
      return (
          <div className="container mx-auto px-4 pt-8">
              <ExploreHub 
                counts={counts} 
                onSelect={(v) => {
                    if (v === 'competitions') router.push('/competitions');
                    else if (v === 'groups') router.push('/groups');
                    else setView('halls');
                }} 
              />
          </div>
      );
  }

  if (view === 'halls') {
      return (
          <div className="container mx-auto px-4 pt-8">
              <ExhibitionHallList 
                exhibitions={exhibitions} 
                onBack={() => setView('hub')} 
                onSelect={(ex) => {
                    setSelectedExhibition(ex);
                    setView('gallery');
                }} 
              />
          </div>
      );
  }

  return (
    <div className="container mx-auto px-4 pt-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-8 mb-10">
            <Button variant="ghost" onClick={() => setView('halls')} className="w-fit -ml-4 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Salon Listesine Dön
            </Button>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-border/40 pb-8">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black tracking-widest uppercase">Sergi Salonu</Badge>
                        <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">{selectedExhibition?.minLevel}+ Seviye</Badge>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2 truncate">{selectedExhibition?.title}</h1>
                    <p className="text-muted-foreground max-w-2xl">{selectedExhibition?.description}</p>
                </div>
                
                <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl border border-border/50 shrink-0">
                    <div className="text-center px-4 border-r border-border/50">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Eserler</p>
                        <p className="text-xl font-black">{photos?.length || 0}</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Bitiş</p>
                        <p className="text-sm font-bold">{selectedExhibition && formatDistanceToNow(new Date(selectedExhibition.endDate), { addSuffix: true, locale: tr })}</p>
                    </div>
                </div>
            </div>
        </div>

        {isPhotosLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[24px]" />)}
            </div>
        ) : photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {photos.map((photo) => (
                    <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer rounded-[24px] border-none shadow-md" onClick={() => setSelectedPhoto(photo)}>
                        <Image src={photo.imageUrl} alt="Eser" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 border border-white/20"><AvatarImage src={photo.userPhotoURL || ''} className="object-cover" /><AvatarFallback>{photo.userName?.charAt(0)}</AvatarFallback></Avatar>
                                <span className="text-[11px] text-white font-bold truncate">@{photo.userName}</span>
                            </div>
                            {photo.aiFeedback && <Badge className="bg-primary text-white text-[10px] h-6 px-2 rounded-lg border-none shadow-lg"><Star className="h-2.5 w-2.5 text-white mr-1 fill-current" /> {normalizeScore(photo.aiFeedback.light_score).toFixed(1)}</Badge>}
                        </div>
                    </Card>
                ))}
            </div>
        ) : (
            <div className="text-center py-32 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-xl font-bold">Henüz Eser Paylaşılmadı</h3>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Bu sergi salonu yeni açıldı. İlk eseri senin paylaşmanı bekliyoruz!</p>
                <Button variant="outline" onClick={() => router.push('/gallery')} className="mt-6 rounded-xl border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/5">Galerime Git</Button>
            </div>
        )}

        <PublicPhotoDialog photo={selectedPhoto} isOpen={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)} />
    </div>
  );
}
