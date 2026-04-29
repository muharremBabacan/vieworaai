'use client';
import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc, where, writeBatch, increment, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { Competition, User, Photo, CompetitionEntry, ScoringModel, AnalysisLog, Group } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Clock, CheckCircle2, LayoutGrid, Star, Users, Scale, Cpu, Medal, Shield, Loader2, X, Gem, Heart, Lock } from 'lucide-react';
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useRouter } from '@/navigation';
import { useAppConfig } from '@/components/AppConfigProvider';
import { VieworaImage } from '@/core/components/viewora-image';

const COMPETITION_JOIN_COST = 5;

import { normalizeScore } from '@/modules/dashboard/services/photo-flow';

const getOverallScore = (photo: Photo): number => {
  if (!photo.aiFeedback) return 0;
  
  const currentTier = photo.analysisTier || 'start';
  const l = normalizeScore(photo.aiFeedback.light_score);
  const c = normalizeScore(photo.aiFeedback.composition_score);
  const t = normalizeScore(photo.aiFeedback.technical_clarity_score);
  const s = normalizeScore(photo.aiFeedback.storytelling_score);
  const b = normalizeScore(photo.aiFeedback.boldness_score);

  if (currentTier === 'start') {
    return (l + c + t) / 3;
  } else {
    return (l + c + t + s + b) / 5;
  }
};

const getCompetitionStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'active';
};

const StatusBadge = ({ status }: { status: 'active' | 'upcoming' | 'ended' }) => {
    const config = {
        active: { class: 'bg-green-500/20 text-green-400 border-green-500/30', text: 'Aktif' },
        upcoming: { class: 'bg-blue-500/20 text-blue-400 border-blue-500/30', text: 'Yakında' },
        ended: { class: 'bg-secondary text-muted-foreground border-border', text: 'Sona Erdi' },
    };
    return <Badge className={cn("border px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider", config[status].class)}>{config[status].text}</Badge>;
};

const ScoringModelBadge = ({ model }: { model: ScoringModel }) => {
    const config = {
        community: { icon: '🟢', text: 'Topluluk' },
        jury_ai: { icon: '🟣', text: 'Jüri + AI' },
        hybrid: { icon: '🔵', text: 'Hibrit' },
        ai_only: { icon: '🔴', text: 'Sadece AI' },
        custom: { icon: '⚙️', text: 'Stratejik' },
    };
    const c = config[model] || config.hybrid;
    return (
        <Badge variant="outline" className="h-5 px-2 bg-secondary/50 text-[9px] font-bold uppercase tracking-tight border-border/50">
            <span className="mr-1">{c.icon}</span> {c.text}
        </Badge>
    );
};

function CompetitionEntriesDialog({ competition, isOpen, onOpenChange, userProfile }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void, userProfile: User | null }) {
    const firestore = useFirestore();
    const router = useRouter();
    const entriesQuery = useMemoFirebase(() => (competition && firestore) ? query(collection(firestore, 'competitions', competition.id, 'entries'), orderBy('submittedAt', 'desc')) : null, [competition, firestore]);
    const { data: entries, isLoading } = useCollection<CompetitionEntry>(entriesQuery);
    
    const [selectedEntry, setSelectedEntry] = useState<CompetitionEntry | null>(null);

    const handleToggleLike = async (entry: CompetitionEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userProfile) {
            router.push('/login');
            return;
        }
        if (!firestore || !competition) return;
        const entryRef = doc(firestore, 'competitions', competition.id, 'entries', entry.id);
        const isLiked = entry.votes?.includes(userProfile.id);

        try {
            await updateDoc(entryRef, {
                votes: isLiked ? arrayRemove(userProfile.id) : arrayUnion(userProfile.id)
            });
        } catch (err) {
            console.error("Entry like error:", err);
        }
    };

    if (!competition) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col">
                    <DialogHeader className="p-6 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {competition.title} - Katılımlar</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-6">
                        {isLoading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div> :
                        entries && entries.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {entries.map(e => {
                                    const isLiked = e.votes?.includes(userProfile?.id || '');
                                    return (
                                        <div key={e.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/20 cursor-pointer" onClick={() => setSelectedEntry(e)}>
                                            <VieworaImage 
                                              variants={e.imageUrls}
                                              fallbackUrl={e.photoUrl}
                                              type="smallSquare"
                                              alt="Yarışma Eseri"
                                              containerClassName="w-full h-full transition-transform group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                                <p className="text-[10px] font-bold text-white truncate drop-shadow-md">@{e.userName}</p>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className={cn("h-7 w-7 rounded-full bg-black/20 backdrop-blur-md transition-all active:scale-75 p-0", isLiked ? "text-red-500" : "text-white hover:text-red-400")}
                                                    onClick={(ev) => handleToggleLike(e, ev)}
                                                >
                                                    <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                        <div className="text-center py-20"><p className="text-muted-foreground font-medium">Henüz katılım bulunmuyor.</p></div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedEntry} onOpenChange={(o) => !o && setSelectedEntry(null)}>
                {selectedEntry && (
                    <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row">
                        <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
                             <VieworaImage 
                                variants={selectedEntry.imageUrls}
                                fallbackUrl={selectedEntry.photoUrl}
                                type="detailView"
                                alt="Eser Detay"
                                containerClassName="w-full h-full"
                              />
                        </div>
                        <div className="md:w-2/5 w-full flex flex-col p-8 space-y-6 overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black tracking-tight flex items-center justify-between">
                                    Eser Detayları
                                    {selectedEntry.aiScore && (
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 font-black uppercase text-[10px]">
                                            <Star className="h-3 w-3 mr-1 fill-current" /> {selectedEntry.aiScore.toFixed(1)}
                                        </Badge>
                                    )}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">Sanatçı: @{selectedEntry.userName}</DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center gap-4 py-4 border-t border-border/40">
                                <div className="flex items-center gap-2 text-red-500 bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 shadow-inner">
                                    <Heart className="h-4 w-4 fill-current" />
                                    <span className="text-sm font-black">{selectedEntry?.votes?.length || 0} Beğeni</span>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}

function CompetitionDetailDialog({ competition, isOpen, onOpenChange, userProfile }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void, userProfile: User | null }) {
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const { currencyName } = useAppConfig();

    const userPhotosQuery = useMemoFirebase(() => (userProfile && firestore) ? query(collection(firestore, 'users', userProfile.id, 'photos')) : null, [userProfile, firestore]);
    const { data: userPhotos } = useCollection<Photo>(userPhotosQuery);

    const analyzedPhotos = useMemo(() => userPhotos?.filter(p => !!p.aiFeedback).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [], [userPhotos]);

    const handleConfirmJoin = async () => {
        if (!selectedPhotoId || !competition || !userProfile || !firestore) return;
        
        if (userProfile.pix_balance < COMPETITION_JOIN_COST) {
            toast({ variant: 'destructive', title: `Yetersiz Pix` });
            return;
        }

        const photo = analyzedPhotos.find(p => p.id === selectedPhotoId);
        if (!photo) return;

        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);
            const entryRef = doc(collection(firestore, 'competitions', competition.id, 'entries'));
            const compRef = doc(firestore, 'competitions', competition.id);
            const logRef = doc(collection(firestore, 'analysis_logs'));
            const userRef = doc(firestore, 'users', userProfile.id);

            batch.set(entryRef, {
                id: entryRef.id,
                competitionId: competition.id,
                userId: userProfile.id,
                userName: userProfile.name || 'İsimsiz Sanatçı',
                photoUrl: photo.imageUrl,
                imageUrls: photo.imageUrls, // <--- New system
                imageProcessing: photo.imageProcessing,
                filePath: photo.filePath || '',
                submittedAt: new Date().toISOString(),
                votes: [],
                aiScore: getOverallScore(photo),
                award: 'participant'
            });

            batch.update(compRef, { participantCount: increment(1) });
            batch.update(userRef, {
                pix_balance: increment(-COMPETITION_JOIN_COST),
                total_competitions_count: increment(1),
                'profile_index.activity_signals.competition_score': increment(10) // Performans Sinyali (Davranış Katmanı)
            });

            batch.set(logRef, {
                id: logRef.id,
                userId: userProfile.id,
                userName: userProfile.name || 'Sanatçı',
                type: 'competition',
                pixSpent: COMPETITION_JOIN_COST,
                timestamp: new Date().toISOString(),
                status: 'success'
            } as any);

            await batch.commit();
            toast({ title: "Tebrikler!", description: "Yarışmaya katıldınız." });
            setSelectedPhotoId(null);
            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsSubmitting(false); }
    };
    
    if (!competition) return null;
    const status = getCompetitionStatus(competition.startDate, competition.endDate);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[95vh] p-0 overflow-hidden border-border/40 shadow-2xl bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-6 border-b shrink-0">
                    <DialogTitle>{competition.title}</DialogTitle>
                    <DialogDescription>Yarışma detayları ve katılım formu.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[95vh] w-full">
                    <div className="flex flex-col">
                        <div className="relative h-48 w-full shrink-0">
                            <img src={competition.imageUrl} alt={competition.title} className="object-cover w-full h-full" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                            <div className="absolute bottom-4 left-6 right-6">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <StatusBadge status={status} />
                                    <ScoringModelBadge model={competition.scoringModel} />
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{competition.title}</h2>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-secondary/20 p-4 rounded-xl border border-border/40">
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{competition.description}</p>
                            </div>
                            {status === 'active' && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Galerimden Seç</h4>
                                    <ScrollArea className="h-48 border rounded-xl p-2 bg-muted/10">
                                        <div className="grid grid-cols-2 gap-2">
                                            {analyzedPhotos.map(photo => (
                                                <button key={photo.id} onClick={() => setSelectedPhotoId(photo.id)} className={cn("relative aspect-square rounded-lg overflow-hidden border-2", selectedPhotoId === photo.id ? "border-primary" : "border-transparent")}>
                                                    <VieworaImage 
                                                      variants={photo.imageUrls}
                                                      fallbackUrl={photo.imageUrl}
                                                      type="smallSquare"
                                                      alt="Galeri Seçim"
                                                      containerClassName="w-full h-full"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <Button onClick={handleConfirmJoin} disabled={!selectedPhotoId || isSubmitting} className="w-full h-10 font-bold">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Katılımı Tamamla (${COMPETITION_JOIN_COST} ${currencyName})`}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default function CompetitionsPage() {
    const t = useTranslations('CompetitionsPage');
    const firestore = useFirestore();
    const { user, uid } = useUser();
    const router = useRouter();
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEntriesOpen, setIsEntriesOpen] = useState(false);
    const [competitionForEntries, setCompetitionForEntries] = useState<Competition | null>(null);
    
    const userDocRef = useMemoFirebase(() => uid ? doc(firestore, 'users', uid) : null, [uid, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);
    
    const competitionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const { data: platformCompetitions, isLoading: isCompLoading } = useCollection<Competition>(competitionsQuery);

    const publicGroupsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'groups'), where('isGalleryPublic', '==', true), orderBy('createdAt', 'desc'), limit(10)) : null, [firestore]);
    const { data: publicGroups, isLoading: isGroupsLoading } = useCollection<Group>(publicGroupsQuery);

    const unifiedList = useMemo(() => {
        const platform = (platformCompetitions || []).map(c => ({ ...c, $type: 'platform' as const }));
        const groups = (publicGroups || []).map(g => ({
            id: g.id,
            title: g.name,
            description: g.description,
            imageUrl: g.photoURL || '/images/placeholders/group-cover.jpg', // Fallback
            startDate: g.startDate || g.createdAt,
            endDate: g.endDate || new Date(Date.now() + 864000000).toISOString(),
            scoringModel: 'hybrid' as ScoringModel,
            createdAt: g.createdAt,
            $type: 'group' as const,
            original: g
        }));
        return [...platform, ...groups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [platformCompetitions, publicGroups]);

    const isLoading = isCompLoading || isGroupsLoading;

    return (
        <div className="container mx-auto px-4 pb-12">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-10 truncate">{t('title')}</h1>
            {isLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : 
             unifiedList.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {unifiedList.map(item => {
                        const status = getCompetitionStatus(item.startDate, item.endDate);
                        const isGroup = item.$type === 'group';
                        
                        return (
                            <Card key={item.id} className="overflow-hidden flex flex-col group border-border/40 rounded-[32px] bg-card/40 shadow-2xl transition-all hover:border-primary/20">
                                <div className="relative h-64 w-full overflow-hidden">
                                    <VieworaImage 
                                      variants={null}
                                      fallbackUrl={item.imageUrl}
                                      type="featureCover"
                                      alt={item.title}
                                      containerClassName="w-full h-full transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                    {isGroup && (
                                        <div className="absolute top-6 left-6">
                                            <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                Topluluk Akımı
                                            </Badge>
                                        </div>
                                    )}
                                    <div className="absolute bottom-6 left-6 right-6">
                                        <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter drop-shadow-2xl truncate">{item.title}</h2>
                                    </div>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <Button 
                                        className="w-full rounded-2xl h-12 md:h-14 font-black uppercase tracking-widest text-xs md:text-sm bg-[#1e1e20] hover:bg-[#2a2a2d] border border-white/5 shadow-xl transition-all active:scale-[0.98]" 
                                        onClick={() => { 
                                            if (isGroup) {
                                                router.push(`/groups/${item.id}`);
                                            } else {
                                                setSelectedCompetition(item as unknown as Competition); 
                                                setIsDetailOpen(true); 
                                            }
                                        }}
                                    >
                                        {t('card_button_details')}
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        className="w-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] h-10 text-muted-foreground hover:text-foreground transition-colors" 
                                        onClick={() => { 
                                            if (isGroup) {
                                                router.push(`/groups/${item.id}?tab=exhibition`);
                                            } else {
                                                setCompetitionForEntries(item as unknown as Competition); 
                                                setIsEntriesOpen(true); 
                                            }
                                        }}
                                    >
                                        <LayoutGrid className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" /> {t('button_view_entries')}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : <div className="text-center py-20 border-2 border-dashed rounded-3xl"><Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" /><h3 className="text-xl font-bold">Henüz Yarışma Bulunmuyor</h3></div>}
            <CompetitionDetailDialog competition={selectedCompetition} isOpen={isDetailOpen} onOpenChange={setIsDetailOpen} userProfile={userProfile || null} />
            <CompetitionEntriesDialog competition={competitionForEntries} isOpen={isEntriesOpen} onOpenChange={setIsEntriesOpen} userProfile={userProfile || null} />
        </div>
    );
}
