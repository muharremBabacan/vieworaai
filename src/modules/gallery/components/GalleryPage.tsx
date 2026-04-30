
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import type { Photo, User, Exhibition, Competition, Group, GroupAssignment } from '@/types';
import { normalizeScore, getOverallScore } from '@/modules/dashboard/services/photo-flow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, Star, Globe, X, Camera, Lightbulb, Loader2, Search, Layers, Trophy, Users, Heart, ShieldCheck, Flag, Filter, LayoutGrid, List, MoreVertical, Calendar, User as UserIcon, Clock, Download, ExternalLink, ChevronRight } from 'lucide-react';
import { VieworaImage } from '@/core/components/viewora-image';
import { useRouter } from '@/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn, safeDate } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { typography } from "@/lib/design/typography";
import { useTranslations, useLocale } from 'next-intl';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';

const TIER_COSTS: Record<string, number> = {
  start: 1,
  pro: 2,
  master: 3
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  portrait: ['portre', 'portrait', 'people', 'insan', 'person', 'yüz', 'face', 'woman', 'erkek', 'kadın', 'model'],
  landscape: ['manzara', 'landscape', 'nature', 'doğa', 'dağ', 'deniz', 'sea', 'mountain', 'lake', 'göl', 'sky', 'gökyüzü'],
  street: ['sokak', 'street', 'şehir', 'city', 'urban', 'cadde', 'pazar', 'market'],
  architecture: ['mimari', 'architecture', 'bina', 'building', 'yapı', 'ev', 'house', 'müze', 'museum'],
  pets: ['evcil hayvan', 'pet', 'kedi', 'cat', 'köpek', 'dog', 'animal', 'hayvan'],
  macro: ['makro', 'macro', 'close-up', 'detay', 'çiçek', 'flower', 'böcek', 'insect', 'yaprak', 'leaf'],
};

// using getOverallScore from photo-flow.ts

export default function GalleryPage() {
  const t = useTranslations('GalleryPage');
  const tDashboard = useTranslations('DashboardPage');
  const tApp = useTranslations('AppLayout');
  const tr = useTranslations('Ratings');
  const locale = useLocale();
  const { user, uid, isFirebaseReady, profile: userProfile, isProfileLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetExhibitionId, setTargetExhibitionId] = useState<string>('');
  const [targetCompetitionId, setTargetCompetitionId] = useState<string>('');

  const photosQuery = useMemoFirebase(() => {
    if (!uid || !firestore || !isFirebaseReady) return null;
    return query(
      collection(firestore, 'users', uid, 'photos'),
      orderBy('createdAt', 'desc')
    );
  }, [uid, firestore, isFirebaseReady]);
  const exhibitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'exhibitions'), where('isActive', '==', true));
  }, [firestore]);
  const competitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'competitions'), orderBy('endDate', 'desc'));
  }, [firestore]);
  const userGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !uid || !isFirebaseReady) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', uid));
  }, [firestore, uid, isFirebaseReady]);

  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery, { requireAuth: true });
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);
  const { data: competitions } = useCollection<Competition>(competitionsQuery);
  const { data: userGroups } = useCollection<Group>(userGroupsQuery, { requireAuth: true });

  const STATUS_FILTERS = [
    { id: 'all', label: t('filter_all'), icon: Layers },
    { id: 'analyzed', label: t('filter_status_analyzed'), icon: Sparkles },
    { id: 'exhibition', label: t('filter_status_exhibition'), icon: Globe },
    { id: 'best', label: t('filter_status_best'), icon: Camera },
  ];

  const CATEGORY_FILTERS = [
    { id: 'all', label: t('filter_category_all') },
    { id: 'portrait', label: t('filter_category_portrait') },
    { id: 'landscape', label: t('filter_category_landscape') },
    { id: 'street', label: t('filter_category_street') },
    { id: 'architecture', label: t('filter_category_architecture') },
    { id: 'pets', label: t('filter_category_pets') },
    { id: 'macro', label: t('filter_category_macro') },
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
      const keywords = CATEGORY_KEYWORDS[categoryFilter] || [categoryFilter];
      result = result.filter(p => {
        const genre = p.aiFeedback?.genre?.toLowerCase() || '';
        const tags = p.aiFeedback?.tags?.map(t => t.toLowerCase()) || [];
        
        const hasTagMatch = tags.some(t => keywords.some(k => t === k));
        const hasGenreMatch = keywords.some(k => {
          if (genre === k) return true;
          return genre.split(/\s+/).includes(k);
        });

        return hasTagMatch || hasGenreMatch;
      });
    }

    return result;
  }, [photos, statusFilter, categoryFilter]);

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !firestore || isProcessing) return;
    setIsProcessing(true);
    try {
      const storage = getStorage();
      const batch = writeBatch(firestore);
      const userPhotoRef = doc(firestore, 'users', uid!, 'photos', photo.id);
      
      batch.delete(userPhotoRef);
      if (photo.isSubmittedToExhibition) {
        batch.delete(doc(firestore, 'public_photos', photo.id));
        batch.update(doc(firestore, 'users', uid!), { total_exhibitions_count: increment(-1) });
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

  const handleToggleCompetition = async (photo: Photo) => {
    if (!user || !firestore || isProcessing || !userProfile || !targetCompetitionId) return;
    const isGlobal = targetCompetitionId.startsWith('global-');
    const compId = targetCompetitionId.replace('global-', '').replace('group-', '');
    
    if (isGlobal && userProfile.pix_balance < 5) {
      toast({ variant: 'destructive', title: tDashboard('toast_insufficient_Pix_title') });
      router.push('/pricing');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', uid!);
      
      if (isGlobal) {

        const entryRef = doc(collection(firestore, 'competitions', compId, 'entries'));
        batch.set(entryRef, {
          id: entryRef.id,
          competitionId: compId,
          userId: uid,
          userName: userProfile.name || 'Sanatçı',
          photoUrl: photo.imageUrl,
          imageUrls: photo.imageUrls,
          filePath: photo.filePath || '',
          submittedAt: new Date().toISOString(),
          votes: [],
          aiScore: getOverallScore(photo),
          award: 'participant'
        });

        batch.update(doc(firestore, 'competitions', compId), { participantCount: increment(1) });
        batch.update(userRef, {
          pix_balance: increment(-5),
          total_competitions_count: increment(1)
        });
      } else {
        const submissionRef = doc(collection(firestore, 'groups', compId, 'submissions'));
        batch.set(submissionRef, {
          id: submissionRef.id,
          groupId: compId,
          assignmentId: 'gallery_submission',
          userId: uid,
          userName: userProfile.name || 'Sanatçı',
          userPhotoURL: userProfile.photoURL || null,
          photoUrl: photo.imageUrl,
          imageUrls: photo.imageUrls,
          status: 'approved',
          likes: [],
          comments: [],
          aiFeedback: { 
            evaluation: { 
              score: Math.round(getOverallScore(photo) * 10),
              feedback: photo.aiFeedback?.short_neutral_analysis || "Başarılı eser."
            },
            analysis: photo.aiFeedback
          },
          submittedAt: new Date().toISOString()
        });
        batch.update(userRef, { total_competitions_count: increment(1) });
      }
      
      const photoRef = doc(firestore, 'users', uid!, 'photos', photo.id);
      batch.update(photoRef, { isSubmittedToCompetition: true, competitionId: compId });

      await batch.commit();
      toast({ title: tDashboard('toast_success_title') });
      setSelectedPhoto(null);
    } catch (e) {
      console.error("[CompetitionSub] Error:", e);
      toast({ variant: 'destructive', title: tDashboard('toast_analysis_fail_title') });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleExhibitionExtended = async (photo: Photo) => {
    if (!user || !firestore || isProcessing || !userProfile || !targetExhibitionId) return;
    const isGlobal = targetExhibitionId.startsWith('global-');
    const exhId = targetExhibitionId.replace('global-', '').replace('group-', '');
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      if (isGlobal) {
        const photoRef = doc(firestore, 'users', uid!, 'photos', photo.id);
        const publicPhotoRef = doc(firestore, 'public_photos', photo.id);
        
        batch.set(publicPhotoRef, {
          ...photo,
          id: photo.id,
          exhibitionId: exhId,
          userId: uid,
          userName: userProfile.name || 'Sanatçı',
          userPhotoURL: userProfile.photoURL || null,
          likes: [],
          createdAt: new Date().toISOString()
        });
        batch.update(photoRef, { isSubmittedToExhibition: true, exhibitionId: exhId });
        batch.update(doc(firestore, 'users', uid!), { 
          pix_balance: increment(-1), 
          total_exhibitions_count: increment(1)
        });
      } else {
        const submissionRef = doc(collection(firestore, 'groups', exhId, 'submissions'));
        batch.set(submissionRef, {
          id: submissionRef.id,
          groupId: exhId,
          assignmentId: 'exhibition_submission',
          userId: uid,
          userName: userProfile.name || 'Sanatçı',
          userPhotoURL: userProfile.photoURL || null,
          photoUrl: photo.imageUrl,
          imageUrls: photo.imageUrls,
          status: 'approved',
          likes: [],
          comments: [],
          aiFeedback: { 
            evaluation: { score: Math.round(getOverallScore(photo) * 10), feedback: "Sergi katılımı." },
            analysis: photo.aiFeedback
          },
          submittedAt: new Date().toISOString()
        });
      }
      await batch.commit();
      toast({ title: t('toast_submit_exhibition_complete') });
      setSelectedPhoto(null);
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast_error_exhibition') });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartAnalysis = async (photo: Photo) => {
    if (!user || !firestore || !userProfile || isProcessing) return;
    const currentTier = userProfile.tier || 'start';
    const analysisCost = TIER_COSTS[currentTier] || 1;

    if (userProfile.pix_balance < analysisCost) {
      toast({ variant: 'destructive', title: tDashboard('toast_insufficient_Pix_title') });
      router.push('/pricing');
      return;
    }

    setIsProcessing(true);
    toast({ title: t('toast_analysis_start_title'), description: t('toast_analysis_start_description') });

    try {
      const analysis = await generatePhotoAnalysis({
        photoUrl: photo.imageUrls?.analysis || photo.imageUrl,
        language: locale,
        tier: currentTier
      });

      const batch = writeBatch(firestore);
      const photoRef = doc(firestore, 'users', uid!, 'photos', photo.id);
      const userRef = doc(firestore, 'users', uid!);

      const updatedPhotoData = {
        ...photo,
        aiFeedback: analysis,
        tags: analysis.tags || [],
        analysisTier: currentTier
      };

      batch.update(photoRef, {
        aiFeedback: analysis,
        tags: analysis.tags || [],
        analysisTier: currentTier
      });

      batch.update(userRef, {
        pix_balance: increment(-analysisCost),
        total_analyses_count: increment(1)
      });

      await batch.commit();
      setSelectedPhoto(updatedPhotoData);
      toast({ title: t('toast_success_title'), description: t('toast_analysis_complete') });

    } catch (error: any) {
      console.error('[Gallery] Analysis error:', error);
      toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_analysis') });
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
                className="group relative aspect-square rounded-[32px] overflow-hidden border-none bg-card/50 cursor-pointer shadow-xl transition-all duration-500 hover:scale-[1.03] transform-gpu isolate will-change-transform" 
                onClick={() => setSelectedPhoto(photo)}
              >
                <VieworaImage 
                  variants={photo.imageUrls}
                  fallbackUrl={photo.imageUrl}
                  type="smallSquare"
                  alt="Galeri Görseli"
                  containerClassName="w-full h-full rounded-[32px] overflow-hidden"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* HUD: Top Status & Score */}
                <div className="absolute top-5 left-5 right-5 z-20 flex justify-between items-start pointer-events-none">
                  <div className="flex flex-col gap-1 items-start">
                    {photo.isSubmittedToExhibition && (
                      <Badge className="bg-primary text-white border-none h-6 px-2 font-black text-[9px] uppercase tracking-tighter shadow-lg">
                        {t('badge_in_exhibition')}
                      </Badge>
                    )}
                    {photo.isSubmittedToCompetition && (
                       <Badge className="bg-amber-500 text-black border-none h-6 px-2 font-black text-[9px] uppercase tracking-tighter shadow-lg">
                          {t('badge_competition_entry') || 'Yarışma'}
                       </Badge>
                    )}
                  </div>

                  {photo.aiFeedback ? (
                    <Badge className="bg-black/60 text-yellow-400 border-white/10 backdrop-blur-md px-2 h-6 font-black text-[10px] rounded-lg shadow-xl">
                      <Star className="h-3.5 w-3.5 mr-1.5 fill-current" /> {overallScore.toFixed(1)}
                    </Badge>
                  ) : (
                    <Badge className="bg-black/60 text-white/40 border-white/10 backdrop-blur-md px-2 h-6 font-black text-[8px] uppercase tracking-wider rounded-lg shadow-sm">
                      {t('status_pending_analysis') || 'Analiz Bekliyor'}
                    </Badge>
                  )}
                </div>

                {/* HUD: Bottom Likes */}
                <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 px-3 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                   <Heart size={12} className={cn(uid && photo.likes?.includes(uid) ? "fill-red-500 text-red-500" : "text-white")} />
                   <span className="text-[10px] font-black">{photo.likes?.length || 0}</span>
                </div>
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
          <DialogContent className="max-w-4xl w-[95vw] lg:w-full max-h-[90vh] lg:max-h-[85vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col lg:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[40vh] md:h-auto bg-black/40 flex items-center justify-center">
               <VieworaImage 
                  variants={selectedPhoto.imageUrls}
                  fallbackUrl={selectedPhoto.imageUrl}
                  type="detailView"
                  alt="Eser Detay"
                  containerClassName="w-full h-full"
                />
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-6 md:p-10 pb-20 space-y-8 overflow-y-auto overflow-x-hidden no-scrollbar">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="truncate max-w-[200px] md:max-w-[300px]">{t('dialog_details_title')}</span>
                    {userProfile?.level_name && (
                      <span className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-1">
                        <Trophy className="h-2.5 w-2.5" /> {userProfile.level_name}
                      </span>
                    )}
                  </div>
                  {selectedPhoto.aiFeedback && (
                    <Badge className="bg-primary/10 text-primary border-none px-4 h-8 rounded-full text-[11px] font-black shrink-0">
                      <Star className="h-3.5 w-3.5 mr-1.5 fill-current" /> {getOverallScore(selectedPhoto).toFixed(1)}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                  {t('dialog_upload_date', { date: safeDate(selectedPhoto.createdAt)?.toLocaleDateString() || '...' })}
                </DialogDescription>
              </DialogHeader>

              {selectedPhoto.aiFeedback ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/20 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <h4 className={cn(typography.eyebrow, "text-primary")}>{t('dialog_luma_report_title')}</h4>
                      <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-60 border-primary/20 text-primary px-2 h-5">
                        {selectedPhoto.analysisTier || 'start'} Tier
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: tr('light'), score: normalizeScore(selectedPhoto.aiFeedback.light_score) },
                        { label: tr('composition'), score: normalizeScore(selectedPhoto.aiFeedback.composition_score) },
                        { label: tr('technical'), score: normalizeScore(selectedPhoto.aiFeedback.technical_clarity_score) },
                        ...(selectedPhoto.analysisTier !== 'start' ? [
                          { label: tr('storytelling'), score: normalizeScore(selectedPhoto.aiFeedback.storytelling_score) },
                          { label: tr('boldness'), score: normalizeScore(selectedPhoto.aiFeedback.boldness_score) }
                        ] : [])
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight"><span>{item.label}</span><span>{item.score.toFixed(1)}</span></div>
                          <Progress value={item.score * 10} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-5 rounded-2xl bg-muted/30 border border-border/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('dialog_luma_note_title')}</span>
                    </div>
                    <p className="text-sm italic font-medium leading-relaxed text-foreground/90">"{selectedPhoto.aiFeedback.short_neutral_analysis}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                      <p className="text-[9px] font-black uppercase opacity-40">{t('dialog_metadata_genre')}</p>
                      <p className="text-sm font-bold truncate">{selectedPhoto.aiFeedback.genre}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                      <p className="text-[9px] font-black uppercase opacity-40">{t('dialog_metadata_scene')}</p>
                      <p className="text-sm font-bold truncate">{selectedPhoto.aiFeedback.scene}</p>
                    </div>
                  </div>

                  {selectedPhoto.aiFeedback.tags && selectedPhoto.aiFeedback.tags.length > 0 && (
                    <div className="space-y-2">
                       <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">{t('dialog_metadata_tags')}</p>
                       <div className="flex flex-wrap gap-2">
                          {selectedPhoto.aiFeedback.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="rounded-full bg-muted/30 text-muted-foreground border-border/40 px-3 py-1 text-[10px] font-bold">
                              #{tag}
                            </Badge>
                          ))}
                       </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80 flex items-center gap-2">
                        <Trophy className="h-3 w-3" /> {tDashboard('ai_analysis_title')}
                      </Label>
                      <div className="flex gap-2">
                        <Select value={targetCompetitionId} onValueChange={setTargetCompetitionId}>
                          <SelectTrigger className="flex-1 rounded-2xl h-12 bg-white/5 border-white/10 font-bold hover:bg-white/10 transition-colors text-xs overflow-hidden">
                            <SelectValue placeholder={t('dialog_select_competition')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/10 bg-[#121214] backdrop-blur-3xl shadow-2xl">
                            {competitions?.filter(c => new Date(c.endDate) > new Date()).map(c => (
                              <SelectItem key={c.id} value={`global-${c.id}`} className="font-medium focus:bg-primary/20 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3 w-3 text-primary/60" />
                                  <span>{c.title}</span>
                                </div>
                              </SelectItem>
                            ))}
                            {userGroups?.filter(g => g.purpose === 'challenge' || g.competitionSubject).map(g => (
                              <SelectItem key={g.id} value={`group-${g.id}`} className="font-medium focus:bg-primary/20 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-amber-500/60" />
                                  <span>{g.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => handleToggleCompetition(selectedPhoto)} 
                          disabled={!targetCompetitionId || isProcessing}
                          className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/10 shrink-0 text-[10px]"
                        >
                          {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : t('button_join_competition')}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
                        <Globe className="h-3 w-3" /> {t('filter_status_exhibition')}
                      </Label>
                      <div className="flex gap-2">
                        <Select value={targetExhibitionId} onValueChange={setTargetExhibitionId}>
                          <SelectTrigger className="flex-1 rounded-2xl h-12 bg-white/5 border-white/10 font-bold text-xs hover:bg-white/10 transition-colors overflow-hidden">
                            <SelectValue placeholder={t('dialog_select_exhibition')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/10 bg-[#121214] backdrop-blur-3xl shadow-2xl">
                            {exhibitions?.map(exh => (
                              <SelectItem key={exh.id} value={`global-${exh.id}`} className="font-medium focus:bg-primary/20 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3 w-3 text-primary/60" />
                                  <span>{exh.title}</span>
                                </div>
                              </SelectItem>
                            ))}
                            {userGroups?.map(g => (
                              <SelectItem key={g.id} value={`group-${g.id}`} className="font-medium focus:bg-primary/20 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-indigo-500/60" />
                                  <span>{g.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => handleToggleExhibitionExtended(selectedPhoto)} 
                          disabled={!targetExhibitionId || isProcessing}
                          className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest bg-primary shadow-lg shadow-primary/10 shrink-0 text-[10px]"
                        >
                          {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : t('button_submit_short')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground/40"><Search size={32} /></div>
                  <div className="space-y-1">
                    <p className="font-black uppercase text-sm">{t('dialog_not_analyzed_title')}</p>
                    <p className="text-xs text-muted-foreground">{t('dialog_not_analyzed_desc')}</p>
                  </div>
                  <Button 
                    className="rounded-xl h-12 px-10 font-black uppercase tracking-widest shadow-xl shadow-primary/20" 
                    disabled={isProcessing}
                    onClick={() => handleStartAnalysis(selectedPhoto)}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {t('button_start_analysis')}
                  </Button>
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
