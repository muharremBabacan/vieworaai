
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, where, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { Exhibition, Competition, Group, Photo, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Globe, Trophy, Users, ArrowLeft, ChevronRight, Camera, Clock, Star, Heart, Lock, LayoutGrid, Sparkles, Landmark } from 'lucide-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const safeFormatDistance = (dateStr: string | undefined) => {
  if (!dateStr) return 'Süresiz';
  const date = new Date(dateStr);
  if (!isValid(date)) return 'Süresiz';
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: tr });
  } catch (e) {
    return 'Süresiz';
  }
};

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail' | 'featured'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  // Queries
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
    const userPhotoRef = doc(firestore, 'users', photo.userId, 'photos', photo.id);
    const isLiked = photo.likes?.includes(user.uid);

    try {
      await updateDoc(photoRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
      await updateDoc(userPhotoRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      }).catch(() => {});
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const isLevelEligibleForAI = (userProfile?.current_xp || 0) >= 101;

  if (view === 'hub') {
    return (
      <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
        <header className="mb-10 space-y-1">
          <p className={cn(typography.eyebrow, "ml-1")}>KEŞFET</p>
          <h1 className={cn(typography.h1, "leading-none uppercase")}>İlhamı Keşfet</h1>
          <p className={cn(typography.subtitle, "opacity-80")}>Sergileri, yarışmaları ve fotoğraf topluluklarını keşfet.</p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Sergi Salonları */}
          <Card className="flex flex-col rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-primary/20">
            <div className="relative h-32 w-full overflow-hidden">
              <Image 
                src="https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=600" 
                alt="Sergiler" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute -bottom-5 left-5 h-10 w-10 rounded-xl bg-primary/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
            </div>
            <CardContent className="pt-8 p-5 space-y-4 flex-grow flex flex-col">
              <div>
                <h3 className={cn(typography.cardTitle, "leading-none uppercase")}>Sergi Salonları</h3>
                <p className={cn(typography.meta, "font-bold mt-1 leading-tight")}>Tematik fotoğraf galerilerini keşfet.</p>
              </div>
              <ul className="space-y-1.5 flex-grow">
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-primary" /> 25 aktif sergi
                </li>
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-primary" /> Yeni temalar her hafta
                </li>
              </ul>
              <Button onClick={() => setView('exhibitions')} className={cn(typography.button, "w-full rounded-xl h-10 bg-primary shadow-lg shadow-primary/20")}>Salonları Gör</Button>
            </CardContent>
          </Card>

          {/* Global Yarışmalar */}
          <Card className="flex flex-col rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-amber-500/20">
            <div className="relative h-32 w-full overflow-hidden">
              <Image 
                src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600" 
                alt="Yarışmalar" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute -bottom-5 left-5 h-10 w-10 rounded-xl bg-amber-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <CardContent className="pt-8 p-5 space-y-4 flex-grow flex flex-col">
              <div>
                <h3 className={cn(typography.cardTitle, "leading-none uppercase")}>Global Yarışmalar</h3>
                <p className={cn(typography.meta, "font-bold mt-1 leading-tight")}>Fotoğraflarınla yarış ve ödüller kazan.</p>
              </div>
              <ul className="space-y-1.5 flex-grow">
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-amber-500" /> 3 aktif yarışma
                </li>
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-amber-500" /> Jüri ve topluluk oylaması
                </li>
              </ul>
              <Button onClick={() => router.push('/competitions')} className={cn(typography.button, "w-full rounded-xl h-10 bg-primary shadow-lg shadow-primary/20")}>Yarışmaları Gör</Button>
            </CardContent>
          </Card>

          {/* Fotoğraf Grupları */}
          <Card className="flex flex-col rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-blue-400/20">
            <div className="relative h-32 w-full overflow-hidden">
              <Image 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600" 
                alt="Gruplar" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute -bottom-5 left-5 h-10 w-10 rounded-xl bg-blue-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <CardContent className="pt-8 p-5 space-y-4 flex-grow flex flex-col">
              <div>
                <h3 className={cn(typography.cardTitle, "leading-none uppercase")}>Fotoğraf Grupları</h3>
                <p className={cn(typography.meta, "font-bold mt-1 leading-tight")}>Fotoğraf topluluklarına katıl ve geri bildirim al.</p>
              </div>
              <ul className="space-y-1.5 flex-grow">
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-blue-400" /> 12 aktif grup
                </li>
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-blue-400" /> Mentor destekli topluluklar
                </li>
              </ul>
              <Button onClick={() => router.push('/groups')} className={cn(typography.button, "w-full rounded-xl h-10 bg-primary shadow-lg shadow-primary/20")}>Grupları Keşfet</Button>
            </CardContent>
          </Card>

          {/* Öne Çıkan Fotoğraflar */}
          <Card className="flex flex-col rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-xl group transition-all hover:border-yellow-400/20">
            <div className="relative h-32 w-full overflow-hidden">
              <Image 
                src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=600" 
                alt="Öne Çıkanlar" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute -bottom-5 left-5 h-10 w-10 rounded-xl bg-yellow-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
            <CardContent className="pt-8 p-5 space-y-4 flex-grow flex flex-col">
              <div>
                <h3 className={cn(typography.cardTitle, "leading-none uppercase")}>Öne Çıkan Fotoğraflar</h3>
                <p className={cn(typography.meta, "font-bold mt-1 leading-tight")}>Topluluğun en iyi fotoğrafları.</p>
              </div>
              <ul className="space-y-1.5 flex-grow">
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-yellow-400" /> AI seçimi
                </li>
                <li className={cn(typography.meta, "flex items-center gap-2 font-black uppercase tracking-tighter")}>
                  <div className="h-1 w-1 rounded-full bg-yellow-400" /> Editör seçimi
                </li>
              </ul>
              <Button onClick={() => setView('featured')} className={cn(typography.button, "w-full rounded-xl h-10 bg-primary shadow-lg shadow-primary/20")}>Fotoğrafları Gör</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Exhibition List View ---
  if (view === 'exhibitions') {
    return (
      <div className="container mx-auto px-4 pt-6 pb-24 animate-in slide-in-from-bottom-10 duration-700">
        <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 hover:bg-primary/5 rounded-2xl font-bold text-muted-foreground hover:text-primary transition-all">
          <ArrowLeft className="mr-2 h-4 w-4" /> Keşfet Merkezi
        </Button>

        <h1 className={cn(typography.h1, "mb-12 uppercase")}>Aktif Sergi Salonları</h1>

        {isExLoading ? (
          <div className="grid md:grid-cols-2 gap-10">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-80 rounded-[48px]" />)}
          </div>
        ) : exhibitions && exhibitions.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-10">
            {exhibitions.map((ex) => (
              <Card key={ex.id} className="group relative h-96 rounded-[48px] overflow-hidden border-none cursor-pointer shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => { setSelectedExhibition(ex); setView('exhibition-detail'); }}>
                <Image src={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/800/600`} alt={ex.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute top-8 left-8 flex gap-3">
                  <Badge className="bg-primary/20 backdrop-blur-xl text-primary border-primary/20 text-[10px] font-black uppercase px-4 h-7 rounded-full">AÇIK</Badge>
                  <Badge variant="outline" className="bg-black/40 backdrop-blur-xl text-white border-white/10 text-[10px] font-black uppercase px-4 h-7 rounded-full">EN AZ {ex.minLevel}</Badge>
                </div>
                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                  <div className="space-y-2">
                    <h2 className={cn(typography.h2, "text-white leading-tight uppercase")}>{ex.title}</h2>
                    <div className={cn(typography.meta, "flex items-center gap-2 font-black text-primary uppercase tracking-wider")}>
                      <Clock className="h-4 w-4" /> {safeFormatDistance(ex.endDate)}
                    </div>
                  </div>
                  <Button className={cn(typography.button, "rounded-xl px-8 h-11 bg-white text-black hover:bg-white/90 shadow-lg")}>
                    Salona Gir <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-40 rounded-[64px] border-2 border-dashed border-border/40 bg-muted/5">
            <Globe className="h-20 w-20 mx-auto mb-8 text-muted-foreground/20" />
            <h3 className={cn(typography.h2, "uppercase")}>Henüz Açık Sergi Yok</h3>
            <p className={typography.body}>Admin tarafından yeni salonlar eklendiğinde burada göreceksin.</p>
          </div>
        )}
      </div>
    );
  }

  // --- Photo Stream (Exhibition Detail or Featured) ---
  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in slide-in-from-right-10 duration-700">
      <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 hover:bg-primary/5 rounded-2xl font-bold text-muted-foreground hover:text-primary transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" /> Geri Dön
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16">
        <div className="space-y-4">
          <h1 className={cn(typography.h1, "uppercase")}>
            {view === 'featured' ? 'Öne Çıkan Kareler' : selectedExhibition?.title}
          </h1>
          <p className={cn(typography.subtitle, "max-w-3xl")}>
            {view === 'featured' ? 'Topluluğun en çok beğeni alan ve AI tarafından yüksek puanlanan eserleri.' : selectedExhibition?.description}
          </p>
        </div>
        <div className="flex items-center gap-4 px-8 py-4 bg-secondary/30 rounded-[32px] border border-border/40 shadow-inner">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <p className={typography.eyebrow}>Eser Sayısı</p>
            <p className={cn(typography.cardTitle, "text-lg font-black")}>{photos?.length || 0}</p>
          </div>
        </div>
      </div>

      {isPhotosLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}
        </div>
      ) : photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {photos.map((photo) => {
            const isLiked = photo.likes?.includes(user?.uid || '');
            return (
              <Card key={photo.id} className="group relative aspect-square rounded-[40px] overflow-hidden border-none shadow-2xl ring-1 ring-white/5 cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0">
                   <Badge className="bg-black/50 backdrop-blur-md border-white/10 text-[10px] h-7 px-3 rounded-full font-black">
                      <Star className="h-3 w-3 text-yellow-400 mr-1.5 fill-current" /> {getOverallScore(photo).toFixed(1)}
                   </Badge>
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                  <Badge variant="secondary" className="bg-white/10 backdrop-blur-xl text-white border-white/10 text-[10px] h-8 px-4 rounded-full font-bold">@{photo.userName || 'Sanatçı'}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-10 w-10 rounded-full bg-black/20 backdrop-blur-md transition-all active:scale-75", isLiked ? "text-red-500" : "text-white hover:text-red-400")}
                    onClick={(e) => handleToggleLike(photo, e)}
                  >
                    <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                    <span className="sr-only">Beğen</span>
                    {photo.likes && photo.likes.length > 0 && (
                      <span className="absolute -top-1 -right-1 text-[9px] font-black bg-red-500 text-white px-1.5 rounded-full border border-black">{photo.likes.length}</span>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-40 rounded-[64px] border-2 border-dashed border-border/40 bg-muted/5">
          <Camera className="h-20 w-20 mx-auto mb-8 text-muted-foreground/20" />
          <h3 className={cn(typography.h2, "uppercase")}>Eser Bulunmuyor</h3>
          <p className={cn(typography.body, "mt-4")}>Bu alanda henüz paylaşılan bir fotoğraf yok.</p>
        </div>
      )}

      {/* Fotoğraf Detay Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row">
            <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
              <Image src={selectedPhoto.imageUrl} alt="Eser" fill className="object-contain" unoptimized />
            </div>
            <div className="md:w-2/5 w-full flex flex-col p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={cn(typography.cardTitle, "text-2xl font-black flex items-center justify-between")}>
                  Eser Detayları
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 font-black uppercase text-[10px]">
                    <Star className="h-3 w-3 mr-1 fill-current" /> {getOverallScore(selectedPhoto).toFixed(1)}
                  </Badge>
                </DialogTitle>
                <DialogDescription className={cn(typography.meta, "font-bold uppercase")}>Sanatçı: @{selectedPhoto.userName || 'Sanatçı'}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {isLevelEligibleForAI ? (
                  <>
                    <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-4">
                      <h4 className={cn(typography.eyebrow, "text-primary")}>Luma Analizi</h4>
                      <div className="space-y-3">
                        {selectedPhoto.aiFeedback && (
                          <>
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
                          </>
                        )}
                      </div>
                    </Card>
                    <div className="space-y-2">
                      <span className={typography.eyebrow}>Luma Notu</span>
                      <p className={cn(typography.body, "italic text-foreground/90 bg-muted/30 p-4 rounded-xl border border-border/40")}>
                        "{selectedPhoto.aiFeedback?.short_neutral_analysis}"
                      </p>
                    </div>
                  </>
                ) : (
                  <Card className="p-8 border-dashed border-border/60 bg-muted/10 text-center space-y-4 rounded-[32px]">
                    <Lock className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <div className="space-y-1">
                      <p className={cn(typography.cardTitle, "uppercase")}>Analiz Detayları Kilitli</p>
                      <p className={cn(typography.meta, "leading-relaxed")}>Topluluk eserlerinin derin analizlerini görmek için <b>Viewner</b> seviyesine ulaşmalısın (101+ XP).</p>
                    </div>
                    <Button variant="outline" size="sm" className={cn(typography.button, "rounded-xl h-8")} onClick={() => router.push('/academy')}>Gelişmeye Başla</Button>
                  </Card>
                )}

                <div className="flex items-center gap-4 py-4 border-t border-border/40">
                  <div className="flex items-center gap-2 text-red-500 bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 shadow-inner">
                    <Heart className="h-4 w-4 fill-current" />
                    <span className={cn(typography.meta, "font-black text-red-500")}>{selectedPhoto.likes?.length || 0} Beğeni</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
