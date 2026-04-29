
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, where, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { Exhibition, Photo, User, Group } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, Star, Heart, Lock, Loader2, Award } from 'lucide-react';
import { useRouter } from '@/navigation';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { typography } from "@/lib/design/typography";
import { useTranslations } from 'next-intl';
import { VieworaImage } from '@/core/components/viewora-image';

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

export default function ExplorePage() {
  const t = useTranslations('ExplorePage');
  const tr = useTranslations('Ratings');
  const router = useRouter();
  const { user, uid, isFirebaseReady, profile: userProfile } = useUser();
  const firestore = useFirestore();

  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail' | 'featured'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const exhibitionsQuery = useMemoFirebase(() => 
    (firestore && isFirebaseReady) ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true), orderBy('createdAt', 'desc')) : null,
    [firestore, isFirebaseReady]
  );
  const { data: platformExhibitions, isLoading: isPlatformExLoading } = useCollection<Exhibition>(exhibitionsQuery);

  const publicGroupsQuery = useMemoFirebase(() =>
    (firestore && isFirebaseReady) ? query(collection(firestore, 'groups'), where('isGalleryPublic', '==', true), orderBy('createdAt', 'desc'), limit(10)) : null,
    [firestore, isFirebaseReady]
  );
  const { data: publicGroups, isLoading: isGroupsLoading } = useCollection<Group>(publicGroupsQuery);

  const unifiedExhibitions = useMemo(() => {
    const platform = (platformExhibitions || []).map(ex => ({ ...ex, $type: 'platform' as const }));
    const groups = (publicGroups || []).map(g => ({
        id: g.id,
        title: g.name,
        description: g.description,
        imageUrl: g.photoURL || 'https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=2070&auto=format&fit=crop', // Fallback
        isActive: true,
        createdAt: g.createdAt,
        $type: 'group' as const
    }));
    return [...platform, ...groups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [platformExhibitions, publicGroups]);

  const isExLoading = isPlatformExLoading || isGroupsLoading;

  const photosQuery = useMemoFirebase(() => {
    if (!firestore || !isFirebaseReady || view === 'hub') return null;
    if (view === 'exhibition-detail' && selectedExhibition) {
        return query(collection(firestore, 'public_photos'), where('exhibitionId', '==', selectedExhibition.id), orderBy('createdAt', 'desc'));
    }
    if (view === 'featured') {
        return query(collection(firestore, 'public_photos'), orderBy('createdAt', 'desc'), limit(40));
    }
    return null;
  }, [firestore, isFirebaseReady, selectedExhibition, view]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  const handleToggleLike = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!firestore) return;
    const photoRef = doc(firestore, 'public_photos', photo.id);
    const isLiked = photo.likes?.includes(uid);
    try {
      await updateDoc(photoRef, { likes: isLiked ? arrayRemove(uid) : arrayUnion(uid) });
    } catch (err) { console.error(err); }
  };

  const isLevelEligibleForAI = (userProfile?.current_xp || 0) >= 101;

    const [isAdWatching, setIsAdWatching] = useState(false);
    const [adProgress, setAdProgress] = useState(0);

    const adsData = [
      { id: 'canon', title: 'Canon R5 Mark II', desc: 'Sınırları Zorlayan Performans', brand: 'Canon', image: 'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?q=80&w=2070&auto=format&fit=crop' },
      { id: 'adobe', title: 'Lightroom Pro', desc: 'Renklerin Gücünü Keşfet', brand: 'Adobe', image: 'https://images.unsplash.com/photo-1626908013943-df94de54984c?q=80&w=2073&auto=format&fit=crop' },
      { id: 'nikon', title: 'Nikon Z9', desc: 'Vahşi Yaşamın İzinde', brand: 'Nikon', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2076&auto=format&fit=crop' }
    ];

    const currentAd = useMemo(() => adsData[Math.floor(Math.random() * adsData.length)], []);

    const handleWatchAd = async () => {
      if (!user || !firestore) return;
      
      // Check daily limit (Mock check for now)
      const lastAdDate = localStorage.getItem('last_ad_watch_date');
      const today = new Date().toDateString();
      const watchCount = parseInt(localStorage.getItem('ad_watch_count') || '0', 10);

      if (lastAdDate === today && watchCount >= 3) {
        alert("Günlük reklam limitine ulaştın! Yarın tekrar gel.");
        return;
      }

      setIsAdWatching(true);
      setAdProgress(0);

      // Simulate 10s ad watching
      const interval = setInterval(() => {
        setAdProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1;
        });
      }, 100);

      setTimeout(async () => {
        clearInterval(interval);
        try {
          const userRef = doc(firestore, 'users', uid);
          await updateDoc(userRef, {
            pix_balance: (userProfile?.pix_balance || 0) + 1
          });
          
          // Update limit
          if (lastAdDate !== today) {
            localStorage.setItem('last_ad_watch_date', today);
            localStorage.setItem('ad_watch_count', '1');
          } else {
            localStorage.setItem('ad_watch_count', (watchCount + 1).toString());
          }

          setIsAdWatching(false);
          setAdProgress(0);
          alert("Tebrikler! 1 Pix Kazandın.");
        } catch (err) {
          console.error(err);
          setIsAdWatching(false);
        }
      }, 10000);
    };

    const hubCategories = [
      {
        id: 'exhibitions',
        title: 'Sergiler',
        desc: 'Profesyonel ve küratörlü fotoğraf galerileri.',
        features: ['Küratörlü Seçkiler', 'Yüksek Çözünürlük', 'Sanatçı Odaklı'],
        button: 'SERGİLERİ GEZ',
        image: "https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=2070&auto=format&fit=crop",
        borderColor: "hover:border-primary/30",
        btnColor: "bg-primary shadow-lg shadow-primary/20",
        onClick: () => setView('exhibitions')
      },
      {
        id: 'competitions',
        title: 'Yarışmalar',
        desc: 'Yeteneklerini göster, büyük ödülleri kazan.',
        features: ['Ödüllü Yarışmalar', 'Halk Oylaması', 'AI Skorlama'],
        button: 'KATIL VE KAZAN',
        image: "/competition-fallback.png",
        borderColor: "hover:border-blue-400/30",
        btnColor: "bg-blue-600 shadow-lg shadow-blue-600/20",
        onClick: () => router.push('/competitions')
      },
      {
        id: 'groups',
        title: 'Topluluk Grupları',
        desc: 'Fotoğraf topluluklarının gizli hazineleri.',
        features: ['Kolektif Üretim', 'Üye Galerileri', 'Grup Etkinlikleri'],
        button: 'GRUPLARI KEŞFET',
        image: "https://images.unsplash.com/photo-1543269664-56d93c1b41a6?q=80&w=2070&auto=format&fit=crop",
        borderColor: "hover:border-green-400/30",
        btnColor: "bg-green-600 shadow-lg shadow-green-600/20",
        onClick: () => router.push('/groups')
      }
    ];

  return (
    <div className={cn(
      "container mx-auto px-4 pt-6 pb-24 animate-in duration-700",
      view === 'hub' ? "fade-in" : "slide-in-from-right-10"
    )}>
      {view === 'hub' ? (
        <>
          <header className="mb-10 space-y-2">
            <p className={cn(typography.eyebrow, "ml-1")}>{t('hub_eyebrow')}</p>
            <h1 className={cn(typography.h1, "text-4xl md:text-6xl font-black leading-none uppercase tracking-tighter")}>{t('hub_title')}</h1>
            <p className={cn(typography.subtitle, "opacity-70 text-sm md:text-base")}>{t('description')}</p>
          </header>
  
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hubCategories.map((cat) => (
              <Card 
                key={cat.id} 
                className={cn(
                  "rounded-[40px] overflow-hidden border-border/40 bg-card/40 shadow-2xl group transition-all cursor-pointer flex flex-col h-full",
                  cat.borderColor
                )} 
                onClick={cat.onClick}
              >
                <div className="relative h-48 w-full shrink-0 overflow-hidden">
                  <VieworaImage 
                    variants={null}
                    fallbackUrl={cat.image}
                    type="featureCover"
                    alt={cat.title}
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    containerClassName="w-full h-full transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                  <div className="absolute bottom-4 left-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                     {cat.id === 'exhibitions' && <Camera className="h-5 w-5" />}
                     {cat.id === 'competitions' && <Star className="h-5 w-5" />}
                     {cat.id === 'groups' && <Heart className="h-5 w-5" />}
                     {cat.id === 'featured' && <Award className="h-5 w-5" />}
                  </div>
                </div>
                
                <CardContent className="p-8 pt-6 space-y-6 flex flex-col flex-1">
                  <div className="space-y-2">
                    <h3 className={cn(typography.cardTitle, "text-lg md:text-xl font-black uppercase tracking-tight truncate")}>{cat.title}</h3>
                    <p className={cn(typography.body, "text-[10px] md:text-xs opacity-60 font-medium line-clamp-2")}>{cat.desc}</p>
                  </div>
  
                  <ul className="space-y-2.5 flex-1">
                    {cat.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{feature}</span>
                      </li>
                    ))}
                  </ul>
  
                  <Button className={cn("w-full rounded-[20px] h-12 font-black uppercase tracking-wider text-[10px] md:text-xs transition-all", cat.btnColor)}>
                    {cat.button}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* 🎥 REWARDED ADS SECTION */}
          <div className="mt-16 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-black uppercase tracking-tighter">Haftalık Fırsatlar</h2>
                <p className="text-xs opacity-60 font-bold uppercase tracking-widest">İzle ve Pix Kazan</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[10px]">SPONSORLU</Badge>
            </div>
            
            <Card className="rounded-[40px] overflow-hidden border-primary/20 bg-primary/5 group relative">
              <div className="flex flex-col md:flex-row items-center">
                <div className="relative h-64 md:h-80 w-full md:w-1/2 overflow-hidden">
                   <VieworaImage 
                    variants={null}
                    fallbackUrl={currentAd.image}
                    type="featureCover"
                    alt={currentAd.title}
                    containerClassName="w-full h-full transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5" />
                </div>
                <div className="p-8 md:p-12 flex-1 space-y-6 text-center md:text-left">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{currentAd.brand}</p>
                    <h3 className="text-3xl md:text-5xl font-black uppercase leading-tight tracking-tighter">{currentAd.title}</h3>
                    <p className="text-sm md:text-base font-medium opacity-70 leading-relaxed">{currentAd.desc}</p>
                  </div>
                  <Button 
                    onClick={handleWatchAd} 
                    disabled={isAdWatching}
                    className="rounded-full px-8 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                  >
                    REKLAMI İZLE (+1 PIX)
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* 📺 AD WATCHING OVERLAY */}
          {isAdWatching && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
               <div className="max-w-md w-full space-y-8">
                 <div className="relative aspect-video rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
                    <VieworaImage 
                      variants={null}
                      fallbackUrl={currentAd.image}
                      type="featureCover"
                      alt="Reklam İzleniyor"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                       <div className="relative h-20 w-20 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-white/20 rounded-full" />
                          <div 
                            className="absolute inset-0 border-4 border-primary rounded-full transition-all duration-100" 
                            style={{ clipPath: `inset(0 0 0 0 round 50%)`, strokeDasharray: 251, strokeDashoffset: 251 - (251 * adProgress / 100) }} 
                          />
                          <span className="text-white font-black text-xl">{Math.ceil((100 - adProgress) / 10)}</span>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">{currentAd.title}</h2>
                    <p className="text-sm text-white/60 font-medium tracking-wide">Reklam tamamlandığında 1 Pix hesabına eklenecek...</p>
                 </div>
                 <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-100" style={{ width: `${adProgress}%` }} />
                 </div>
               </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 rounded-2xl font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> {t('clear_filter')}</Button>
          <h1 className={cn(typography.h1, "uppercase mb-10 text-3xl md:text-5xl lg:text-6xl truncate")}>{view === 'featured' ? t('featured_title') : selectedExhibition?.title || t('category_exhibitions')}</h1>

          {view === 'exhibitions' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isExLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[32px]" />) : 
              unifiedExhibitions?.map(ex => {
                const isGroup = ex.$type === 'group';
                return (
                  <Card key={ex.id} className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 group cursor-pointer" onClick={() => { 
                      if (isGroup) {
                          router.push(`/groups/${ex.id}?tab=exhibition`);
                      } else {
                          setSelectedExhibition(ex as unknown as Exhibition); 
                          setView('exhibition-detail'); 
                      }
                  }}>
                    <div className="relative h-48 w-full">
                        <VieworaImage 
                          variants={null}
                          fallbackUrl={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/600/400`}
                          type="featureCover"
                          alt={ex.title}
                          containerClassName="w-full h-full"
                        />
                        {isGroup && (
                            <div className="absolute top-4 right-4">
                                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 backdrop-blur-md px-3 h-6 rounded-full text-[9px] font-black uppercase">
                                    Topluluk Sergisi
                                </Badge>
                            </div>
                        )}
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-lg md:text-xl font-black uppercase truncate">{ex.title}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground mt-2 line-clamp-2">{ex.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : isPhotosLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}</div>
          ) : (photos && photos.length > 0) ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {photos.map((photo) => {
                const isLiked = photo.likes?.includes(uid || '');
                return (
                  <Card key={photo.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <VieworaImage 
                      variants={photo.imageUrls}
                      fallbackUrl={photo.imageUrl}
                      type="smallSquare"
                      alt="Sergi Görseli"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all">
                        <Badge variant="secondary" className="bg-white/10 backdrop-blur-xl text-white text-[9px] md:text-[10px] h-7 md:h-8 px-3 md:px-4 rounded-full font-bold truncate max-w-[120px] md:max-w-none">@{photo.userName || 'Sanatçı'}</Badge>
                      <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full", isLiked ? "text-red-500" : "text-white")} onClick={(e) => handleToggleLike(photo, e)}>
                        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-40 rounded-[64px] border-2 border-dashed bg-muted/5">
              <Camera size={64} className="mx-auto mb-8 text-muted-foreground/20" />
            </div>
          )}
        </>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0">
               <VieworaImage 
                  variants={selectedPhoto.imageUrls}
                  fallbackUrl={selectedPhoto.imageUrl}
                  type="detailView"
                  alt="Eser Detay"
                  containerClassName="w-full h-full"
                />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={cn(typography.cardTitle, "text-2xl font-black flex items-center justify-between")}>{t('dialog_title')}<Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 h-7 rounded-full text-[10px] font-black"><Star className="h-3 w-3 mr-1 fill-current" /> {getOverallScore(selectedPhoto).toFixed(1)}</Badge></DialogTitle>
                <DialogDescription className="font-bold uppercase">{t('dialog_artist_label')}: @{selectedPhoto.userName || 'Sanatçı'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {isLevelEligibleForAI && selectedPhoto?.aiFeedback ? (
                  <>
                    <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-4">
                      <h4 className={cn(typography.eyebrow, "text-primary")}>{t('luma_analysis_title')}</h4>
                      <div className="space-y-3">
                        <div className="space-y-1"><div className="flex justify-between text-[10px] font-bold"><span>{tr('light')}</span><span>{normalizeScore(selectedPhoto.aiFeedback.light_score).toFixed(1)}</span></div><Progress value={normalizeScore(selectedPhoto.aiFeedback.light_score) * 10} className="h-1" /></div>
                        <div className="space-y-1"><div className="flex justify-between text-[10px] font-bold"><span>{tr('composition')}</span><span>{normalizeScore(selectedPhoto.aiFeedback.composition_score).toFixed(1)}</span></div><Progress value={normalizeScore(selectedPhoto.aiFeedback.composition_score) * 10} className="h-1" /></div>
                      </div>
                    </Card>
                    <p className="text-sm italic font-medium leading-relaxed bg-muted/30 p-4 rounded-xl">"{selectedPhoto.aiFeedback.short_neutral_analysis}"</p>
                  </>
                ) : <Card className="p-8 border-dashed text-center space-y-4 rounded-[32px]"><Lock size={32} className="mx-auto text-muted-foreground/40" /><p className="font-black uppercase">{t('analysis_locked_title')}</p></Card>}
                <div className="flex items-center gap-2 text-red-500 bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 w-fit"><Heart className="h-4 w-4 fill-current" /><span className="font-black">{selectedPhoto.likes?.length || 0} {tr('likes')}</span></div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
