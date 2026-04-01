
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, where, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { Exhibition, Photo, User } from '@/types';
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
  const { user } = useUser();
  const firestore = useFirestore();

  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail' | 'featured'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

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
    const isLiked = photo.likes?.includes(user.uid);
    try {
      await updateDoc(photoRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch (err) { console.error(err); }
  };

  const isLevelEligibleForAI = (userProfile?.current_xp || 0) >= 101;

    const hubCategories = [
      {
        id: 'exhibitions',
        title: t('category_exhibitions'),
        desc: t('category_exhibitions_desc'),
        features: t('category_exhibitions_features').split(','),
        button: t('category_exhibitions_button'),
        image: "https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=2070&auto=format&fit=crop",
        borderColor: "hover:border-primary/30",
        btnColor: "bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30",
        onClick: () => setView('exhibitions')
      },
      {
        id: 'competitions',
        title: t('category_competitions'),
        desc: t('category_competitions_desc'),
        features: t('category_competitions_features').split(','),
        button: t('category_competitions_button'),
        image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?q=80&w=1964&auto=format&fit=crop",
        borderColor: "hover:border-blue-400/30",
        btnColor: "bg-blue-600 shadow-lg shadow-blue-600/20 hover:bg-blue-700",
        onClick: () => router.push('/competitions')
      },
      {
        id: 'groups',
        title: t('category_groups'),
        desc: t('category_groups_desc'),
        features: t('category_groups_features').split(','),
        button: t('category_groups_button'),
        image: "https://images.unsplash.com/photo-1543269664-56d93c1b41a6?q=80&w=2070&auto=format&fit=crop",
        borderColor: "hover:border-green-400/30",
        btnColor: "bg-green-600 shadow-lg shadow-green-600/20 hover:bg-green-700",
        onClick: () => router.push('/groups')
      },
      {
        id: 'featured',
        title: t('category_featured'),
        desc: t('category_featured_desc'),
        features: t('category_featured_features').split(','),
        button: t('category_featured_button'),
        image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=1974&auto=format&fit=crop",
        borderColor: "hover:border-yellow-400/30",
        btnColor: "bg-yellow-600 shadow-lg shadow-yellow-600/20 hover:bg-yellow-700",
        onClick: () => setView('featured')
      }
    ];

    if (view === 'hub') {
      return (
        <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
          <header className="mb-10 space-y-2">
            <p className={cn(typography.eyebrow, "ml-1")}>{t('hub_eyebrow')}</p>
            <h1 className={cn(typography.h1, "text-4xl md:text-6xl font-black leading-none uppercase tracking-tighter")}>{t('hub_title')}</h1>
            <p className={cn(typography.subtitle, "opacity-70 text-sm md:text-base")}>{t('description')}</p>
          </header>
  
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>
      );
    }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in slide-in-from-right-10 duration-700">
      <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 rounded-2xl font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> {t('clear_filter')}</Button>
      <h1 className={cn(typography.h1, "uppercase mb-10 text-3xl md:text-5xl lg:text-6xl truncate")}>{view === 'featured' ? t('featured_title') : selectedExhibition?.title || t('category_exhibitions')}</h1>

      {view === 'exhibitions' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isExLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[32px]" />) : 
           exhibitions?.map(ex => (
             <Card key={ex.id} className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 group cursor-pointer" onClick={() => { setSelectedExhibition(ex); setView('exhibition-detail'); }}>
               <div className="relative h-48 w-full">
                  <VieworaImage 
                    variants={null}
                    fallbackUrl={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/600/400`}
                    type="featureCover"
                    alt={ex.title}
                    containerClassName="w-full h-full"
                  />
               </div>
               <CardContent className="p-6">
                 <h3 className="text-lg md:text-xl font-black uppercase truncate">{ex.title}</h3>
                 <p className="text-xs md:text-sm text-muted-foreground mt-2 line-clamp-2">{ex.description}</p>
               </CardContent>
             </Card>
           ))}
        </div>
      ) : (
        <>
          {isPhotosLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}</div>
            ) : (photos && photos.length > 0) ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {photos.map((photo) => {
                  const isLiked = photo.likes?.includes(user?.uid || '');
                  return (
                    <Card key={photo.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                      <VieworaImage 
                        variants={photo.imageUrls}
                        fallbackUrl={photo.imageUrl}
                        type="smallSquare"
                        alt="Sergi Görseli"
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
            <div className="text-center py-40 rounded-[64px] border-2 border-dashed bg-muted/5"><Camera size={64} className="mx-auto mb-8 text-muted-foreground/20" /></div>
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
