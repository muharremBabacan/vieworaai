
'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import type { Photo, User, Exhibition } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Star, Globe, X, Camera, Trophy, Layers, Lightbulb, Loader2, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { typography } from "@/lib/design/typography";
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('GalleryPage');
  const tr = useTranslations('Ratings');
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
  const photosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'photos'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);
  const exhibitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'exhibitions'), where('isActive', '==', true));
  }, [firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

  const STATUS_FILTERS = [
    { id: 'all', label: t('filter_all'), icon: Layers },
    { id: 'analyzed', label: t('filter_status_analyzed'), icon: Sparkles },
    { id: 'exhibition', label: t('filter_status_exhibition'), icon: Globe },
    { id: 'best', label: t('filter_status_best'), icon: Trophy },
  ];

  const CATEGORY_FILTERS = [
    { id: 'all', label: t('filter_category_all') },
    { id: 'portrait', label: 'Portre' },
    { id: 'landscape', label: 'Manzara' },
    { id: 'street', label: 'Sokak' },
    { id: 'architecture', label: 'Mimari' },
    { id: 'pets', label: 'Evcil Hayvanlar' },
    { id: 'macro', label: 'Makro' },
  ];

  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    let result = [...photos];
    
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'analyzed': result = result.filter(p => !!p.aiFeedback); break;
        case 'exhibition': result = result.filter(p => p.isSubmittedToExhibition); break;
        case 'best': result = result.filter(p => getOverallScore(p) >= 8); break;
      }
    }

    if (categoryFilter !== 'all') {
      result = result.filter(p => p.aiFeedback?.genre?.toLowerCase().includes(categoryFilter.toLowerCase()));
    }

    return result;
  }, [photos, statusFilter, categoryFilter]);

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
      const storage = getStorage();
      const batch = writeBatch(firestore);
      const userPhotoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
      
      batch.delete(userPhotoRef);
      if (photo.isSubmittedToExhibition) {
        batch.delete(doc(firestore, 'public_photos', photo.id));
        batch.update(doc(firestore, 'users', user.uid), { total_exhibitions_count: increment(-1) });
      }
      
      await batch.commit();
      
      if (photo.filePath) {
        const storageRef = ref(storage, photo.filePath);
        try { await deleteObject(storageRef); } catch (e) { console.warn("Storage file not found"); }
      }
      
      toast({ title: t('toast_delete_complete') });
      setSelectedPhoto(null);
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast_error_delete') });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleExhibition = async (photo: Photo) => {
    if (!user || !firestore || isProcessing || !userProfile) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const photoRef = doc(firestore, 'users', user.uid, 'photos', photo.id);
      const isSubmitting = !photo.isSubmittedToExhibition;

      if (isSubmitting) {
        if (!targetExhibitionId) {
          toast({ variant: 'destructive', title: t('dialog_select_exhibition_placeholder') });
          setIsProcessing(false);
          return;
        }
        if (userProfile.auro_balance < 1) {
          toast({ variant: 'destructive', title: t('toast_insufficient_auro_title') });
          setIsProcessing(false);
          return;
        }
        const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
        batch.set(publicPhotoRef, {
          ...photo,
          exhibitionId: targetExhibitionId,
          isSubmittedToExhibition: true,
          userName: userProfile.name || 'Sanatçı',
          userPhotoURL: userProfile.photoURL || null,
          likes: [],
          createdAt: new Date().toISOString()
        });
        batch.update(photoRef, { isSubmittedToExhibition: true, exhibitionId: targetExhibitionId });
        batch.update(doc(firestore, 'users', user.uid), { 
          auro_balance: increment(-1), 
          total_exhibitions_count: increment(1),
          'profile_index.activity_signals.exhibition_score': increment(10)
        });
        toast({ title: t('toast_submit_exhibition_complete') });
      } else {
        batch.delete(doc(firestore, 'public_photos', photo.id));
        batch.update(photoRef, { isSubmittedToExhibition: false, exhibitionId: null });
        batch.update(doc(firestore, 'users', user.uid), { total_exhibitions_count: increment(-1) });
        toast({ title: t('toast_withdraw_exhibition_complete') });
      }
      await batch.commit();
      setSelectedPhoto(null);
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast_error_exhibition') });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPhotosLoading || isProfileLoading) {
    return (
      <div className="container mx-auto px-4 pt-6 pb-24">
        <Skeleton className="h-12 w-48 mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-10 space-y-1">
        <p className={cn(typography.eyebrow, "ml-1")}>{t('eyebrow')}</p>
        <h1 className={cn(typography.h1, "leading-none uppercase")}>{t('title')}</h1>
      </header>

      <div className="space-y-6 mb-10">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <Button 
              key={f.id} 
              variant={statusFilter === f.id ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setStatusFilter(f.id)} 
              className="rounded-full h-9 px-4 text-[10px] font-black uppercase tracking-widest"
            >
              <f.icon className="mr-2 h-3.5 w-3.5" /> {f.label}
            </Button>
          ))}
        </div>

        <div className="relative filter-scroll">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 flex gap-2 snap-x">
            {CATEGORY_FILTERS.map(f => (
              <Button
                key={f.id}
                variant={categoryFilter === f.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full h-8 px-4 text-[9px] font-black uppercase tracking-wider transition-all",
                  categoryFilter === f.id ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground"
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {filteredPhotos.map(photo => {
            const overallScore = getOverallScore(photo);
            return (
              <Card 
                key={photo.id} 
                className="group relative aspect-square rounded-[32px] overflow-hidden border-none bg-card/50 cursor-pointer shadow-xl transition-all hover:scale-[1.02]" 
                onClick={() => setSelectedPhoto(photo)}
              >
                <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-3 right-3">
                  {photo.aiFeedback && (
                    <Badge className="bg-black/60 text-white border-white/10 backdrop-blur-md px-2 h-6 font-black text-[10px]">
                      <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" /> {overallScore.toFixed(1)}
                    </Badge>
                  )}
                </div>
                {photo.isSubmittedToExhibition && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary text-white border-none h-6 px-2 font-black text-[9px] uppercase tracking-tighter">{t('badge_in_exhibition')}</Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-40 rounded-[48px] border-2 border-dashed bg-muted/5 animate-in zoom-in duration-500">
          <Camera className="mx-auto h-16 w-16 text-muted-foreground/20 mb-6" />
          <h3 className="text-2xl font-black uppercase tracking-tight">{t('empty_gallery_title')}</h3>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto font-medium text-sm">{t('empty_gallery_desc')}</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-8 rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20">{t('empty_gallery_button')}</Button>
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0">
              <Image src={selectedPhoto.imageUrl} alt="photo" fill className="object-contain" unoptimized />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center justify-between">
                  {t('dialog_details_title')}
                  {selectedPhoto.aiFeedback && <Badge className="bg-primary/10 text-primary border-none px-3 h-7 rounded-full text-[10px] font-black"><Star className="h-3 w-3 mr-1 fill-current" /> {getOverallScore(selectedPhoto).toFixed(1)}</Badge>}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('dialog_upload_date', { date: new Date(selectedPhoto.createdAt).toLocaleDateString() })}
                </DialogDescription>
              </DialogHeader>

              {selectedPhoto.aiFeedback ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/20 space-y-4 shadow-inner">
                    <h4 className={cn(typography.eyebrow, "text-primary")}>{t('dialog_luma_report_title')}</h4>
                    <div className="space-y-3">
                      {[
                        { label: tr('light'), score: normalizeScore(selectedPhoto.aiFeedback.light_score) },
                        { label: tr('composition'), score: normalizeScore(selectedPhoto.aiFeedback.composition_score) },
                        { label: tr('technical'), score: normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score) }
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight"><span>{item.label}</span><span>{item.score.toFixed(1)}</span></div>
                          <Progress value={item.score * 10} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/30 border border-border/40 space-y-3">
                    <div className="flex items-center gap-2"><Lightbulb size={16} className="text-amber-400" /><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('dialog_luma_note_title')}</span></div>
                    <p className="text-sm italic font-medium leading-relaxed text-foreground/90">"{selectedPhoto.aiFeedback.short_neutral_analysis}"</p>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border/40">
                    {!selectedPhoto.isSubmittedToExhibition && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('dialog_select_exhibition')}</Label>
                        <Select value={targetExhibitionId} onValueChange={setTargetExhibitionId}>
                          <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/60"><SelectValue placeholder={t('dialog_select_exhibition_placeholder')} /></SelectTrigger>
                          <SelectContent>
                            {exhibitions?.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button 
                      onClick={() => handleToggleExhibition(selectedPhoto)} 
                      disabled={isProcessing || (!selectedPhoto.isSubmittedToExhibition && !targetExhibitionId)} 
                      className={cn(typography.button, "w-full h-12 rounded-xl shadow-lg")} 
                      variant={selectedPhoto.isSubmittedToExhibition ? 'secondary' : 'default'}
                    >
                      {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : selectedPhoto.isSubmittedToExhibition ? <><X className="mr-2 h-4 w-4" /> {t('dialog_button_withdraw')}</> : <><Globe className="mr-2 h-4 w-4" /> {t('dialog_button_submit', { cost: 1, currency: currencyName })}</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground/40"><Search size={32} /></div>
                  <div className="space-y-1">
                    <p className="font-black uppercase text-sm">{t('dialog_not_analyzed_title')}</p>
                    <p className="text-xs text-muted-foreground">{t('dialog_not_analyzed_desc')}</p>
                  </div>
                  <Button variant="outline" className="rounded-xl h-10 px-6 font-bold" onClick={() => router.push('/dashboard')}>{t('button_start_analysis')}</Button>
                </div>
              )}

              <div className="pt-6 border-t border-border/40">
                <Button onClick={() => handleDeletePhoto(selectedPhoto)} variant="ghost" disabled={isProcessing} className="w-full h-12 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive font-black uppercase text-[10px] tracking-widest">
                  {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />} {t('button_delete_permanently')}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
