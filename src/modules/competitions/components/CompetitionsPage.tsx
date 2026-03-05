'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc, where, writeBatch, increment, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Competition, User, Photo, CompetitionEntry, ScoringModel, AnalysisLog } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Clock, CheckCircle2, LayoutGrid, Star, Users, Scale, Cpu, Medal, Shield, Loader2, X, Gem, Heart, Lock } from 'lucide-react';
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

const COMPETITION_JOIN_COST = 2;

const getPrizePercentage = (level: string) => {
    switch (level) {
        case 'Vexer': return 0.75;
        case 'Omner': return 0.60;
        case 'Sytner': return 0.50;
        case 'Viewner': return 0.40;
        case 'Neuner': 
        default: return 0.30;
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

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
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

const Countdown = ({ endDate }: { endDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(endDate);
            if (now > end) { setTimeLeft('Süre Doldu'); return; }
            const d = differenceInDays(end, now);
            const h = differenceInHours(end, now) % 24;
            const m = differenceInMinutes(end, now) % 60;
            setTimeLeft(d > 0 ? `${d}g ${h}s kaldı` : h > 0 ? `${h}s ${m}dk kaldı` : `${m}dk kaldı`);
        };
        calculate();
        const timer = setInterval(calculate, 60000);
        return () => clearInterval(timer);
    }, [endDate]);
    if (!timeLeft) return null;
    return (
        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-400 uppercase tracking-tighter">
            <Clock className="h-3 w-3" /> {timeLeft}
        </div>
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
        if (!userProfile || !firestore || !competition) return;
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

    const isLevelEligibleForAI = (userProfile?.current_xp || 0) >= 101;

    if (!competition) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col">
                    <DialogHeader className="p-6 border-b shrink-0"><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {competition.title} - Katılımlar</DialogTitle></DialogHeader>
                    <ScrollArea className="flex-1 p-6">
                        {isLoading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div> :
                        entries && entries.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {entries.map(e => {
                                    const isLiked = e.votes?.includes(userProfile?.id || '');
                                    return (
                                        <div key={e.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/20 cursor-pointer" onClick={() => setSelectedEntry(e)}>
                                            <Image src={e.photoUrl} alt="Eser" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
                                            
                                            <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-[-5px] group-hover:translate-y-0">
                                                {e.aiScore && (
                                                    <Badge className="bg-black/50 backdrop-blur-md border-white/10 px-1.5 h-6 font-black text-[8px]">
                                                        <Star className="h-2.5 w-2.5 text-yellow-400 mr-1 fill-current" /> {e.aiScore.toFixed(1)}
                                                    </Badge>
                                                )}
                                            </div>

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
                                                    {e.votes && e.votes.length > 0 && (
                                                        <span className="absolute -top-1 -right-1 text-[8px] font-black bg-red-500 text-white px-1 rounded-full border border-black">{e.votes.length}</span>
                                                    )}
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

            {/* Entry Detay Dialog */}
            <Dialog open={!!selectedEntry} onOpenChange={(o) => !o && setSelectedEntry(null)}>
                {selectedEntry && (
                    <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row">
                        <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
                            <Image src={selectedEntry.photoUrl} alt="Eser" fill className="object-contain" unoptimized />
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

                            <div className="space-y-6">
                                {isLevelEligibleForAI ? (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs italic font-medium leading-relaxed">
                                            "Bu yarışma eseri Luma tarafından {selectedEntry.aiScore?.toFixed(1)} genel skorla değerlendirilmiştir."
                                        </div>
                                    </div>
                                ) : (
                                    <Card className="p-8 border-dashed border-border/60 bg-muted/10 text-center space-y-4 rounded-[32px]">
                                        <Lock className="h-8 w-8 mx-auto text-muted-foreground/40" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-black uppercase tracking-tighter">Analiz Verileri Kilitli</p>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">Yarışma eserlerinin analizlerini görmek için <b>Viewner</b> seviyesine ulaşmalısın (101+ XP).</p>
                                        </div>
                                        <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-bold uppercase tracking-widest h-8" onClick={() => { setSelectedEntry(null); onOpenChange(false); router.push('/academy'); }}>Gelişmeye Başla</Button>
                                    </Card>
                                )}

                                <div className="flex items-center gap-4 py-4 border-t border-border/40">
                                    <div className="flex items-center gap-2 text-red-500 bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 shadow-inner">
                                        <Heart className="h-4 w-4 fill-current" />
                                        <span className="text-sm font-black">{selectedEntry.votes?.length || 0} Beğeni</span>
                                    </div>
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

    const userPhotosQuery = useMemoFirebase(() => (userProfile && firestore) ? query(collection(firestore, 'users', userProfile.id, 'photos')) : null, [userProfile, firestore]);
    const { data: userPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(userPhotosQuery);

    const analyzedPhotos = useMemo(() => userPhotos?.filter(p => !!p.aiFeedback).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [], [userPhotos]);

    const handleConfirmJoin = async () => {
        if (!selectedPhotoId || !competition || !userProfile || !firestore) return;
        
        if (userProfile.auro_balance < COMPETITION_JOIN_COST) {
            toast({
                variant: 'destructive',
                title: "Yetersiz Pix",
                description: `Yarışmaya katılmak için ${COMPETITION_JOIN_COST} Pix gereklidir.`,
            });
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
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);

            batch.set(entryRef, {
                id: entryRef.id,
                competitionId: competition.id,
                userId: userProfile.id,
                userName: userProfile.name || 'İsimsiz Sanatçı',
                photoUrl: photo.imageUrl,
                filePath: photo.filePath || '',
                submittedAt: new Date().toISOString(),
                votes: [],
                aiScore: getOverallScore(photo),
                award: 'participant'
            });

            batch.update(compRef, {
                participantCount: increment(1)
            });

            batch.update(userRef, {
                auro_balance: increment(-COMPETITION_JOIN_COST),
                total_auro_spent: increment(COMPETITION_JOIN_COST)
            });

            const log: AnalysisLog = {
                id: logRef.id,
                userId: userProfile.id,
                userName: userProfile.name || 'Sanatçı',
                type: 'competition',
                auroSpent: COMPETITION_JOIN_COST,
                timestamp: new Date().toISOString(),
                status: 'success'
            };
            batch.set(logRef, log);
            
            batch.set(statRef, { 
                date: today,
                auroSpent: increment(COMPETITION_JOIN_COST)
            }, { merge: true });

            await batch.commit();
            toast({ title: "Tebrikler!", description: `Yarışmaya katıldınız ve ${COMPETITION_JOIN_COST} Pix karşılığında Katılım Şilti kazandınız!` });
            setSelectedPhotoId(null);
            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsSubmitting(false); }
    };
    
    if (!competition) return null;
    const status = getCompetitionStatus(competition.startDate, competition.endDate);
    const isEligible = userProfile?.level_name === competition.targetLevel || competition.targetLevel === 'Neuner';

    const currentParticipants = competition.participantCount || 0;
    const poolPercentage = getPrizePercentage(competition.targetLevel);
    const totalCollected = currentParticipants * COMPETITION_JOIN_COST;
    const estimatedPrizePool = Math.floor(totalCollected * poolPercentage);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[95vh] p-0 overflow-hidden border-border/40 shadow-2xl bg-background/95 backdrop-blur-xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>{competition.title}</DialogTitle>
                    <DialogDescription>{competition.description}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[95vh] w-full">
                    <div className="flex flex-col">
                        <div className="relative h-48 w-full shrink-0">
                            <Image src={competition.imageUrl} alt={competition.title} fill className="object-cover" unoptimized />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                            <div className="absolute bottom-4 left-6 right-6">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <StatusBadge status={status} />
                                    <ScoringModelBadge model={competition.scoringModel} />
                                    <Badge variant="outline" className="h-5 px-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase">{competition.targetLevel} SEVİYESİ</Badge>
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{competition.title}</h2>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-7 space-y-6">
                                    <div className="bg-secondary/20 p-4 rounded-xl border border-border/40">
                                        <h3 className="text-xs font-bold mb-2 uppercase tracking-widest text-muted-foreground">Yarışma Hakkında</h3>
                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{competition.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"><Star className="h-4 w-4 text-purple-400" /></div>
                                            <div className="min-w-0"><p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Tema</p><p className="text-xs font-bold truncate">{competition.theme}</p></div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"><Trophy className="h-4 w-4 text-primary" /></div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] text-primary uppercase font-black tracking-tight">Dinamik Ödül</p>
                                                <p className="text-xs font-black truncate text-primary">{estimatedPrizePool} Pix</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-5 space-y-4">
                                    {status === 'active' && isEligible && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Galerimden Seç</h4>
                                            <ScrollArea className="h-48 border rounded-xl p-2 bg-muted/10">
                                                {isPhotosLoading ? <Skeleton className="h-32 w-full" /> : 
                                                 analyzedPhotos.length > 0 ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {analyzedPhotos.map(photo => (
                                                            <button key={photo.id} onClick={() => setSelectedPhotoId(photo.id)} className={cn("relative aspect-square rounded-lg overflow-hidden border-2", selectedPhotoId === photo.id ? "border-primary ring-2 ring-primary/20" : "border-transparent")}>
                                                                <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover" unoptimized />
                                                                {selectedPhotoId === photo.id && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><div className="bg-primary text-white p-1 rounded-full"><CheckCircle2 className="h-4 w-4" /></div></div>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[10px] text-muted-foreground text-center py-10">Analizli fotoğraf bulunamadı.</p>}
                                            </ScrollArea>
                                            <Button onClick={handleConfirmJoin} disabled={!selectedPhotoId || isSubmitting} className="w-full h-10 font-bold">
                                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                                    <div className="flex items-center gap-2">
                                                        <Gem className="h-4 w-4" /> Katılımı Tamamla ({COMPETITION_JOIN_COST} Pix)
                                                    </div>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default function CompetitionsPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEntriesOpen, setIsEntriesOpen] = useState(false);
    const [competitionForEntries, setCompetitionForEntries] = useState<Competition | null>(null);
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);
    const competitionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const { data: competitions, isLoading } = useCollection<Competition>(competitionsQuery);

    return (
        <div className="container mx-auto px-4 pb-12">
            <h1 className="text-4xl font-extrabold tracking-tight mb-10">Yarışmalar</h1>
            {isLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : 
             competitions && competitions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {competitions.map(comp => {
                        const status = getCompetitionStatus(comp.startDate, comp.endDate);
                        const poolPercentage = getPrizePercentage(comp.targetLevel);
                        const estimatedPrize = Math.floor((comp.participantCount || 0) * COMPETITION_JOIN_COST * poolPercentage);

                        return (
                            <Card key={comp.id} className="overflow-hidden flex flex-col group border-border/50 rounded-3xl bg-card/50">
                                <div className="relative h-52 w-full overflow-hidden">
                                    <Image src={comp.imageUrl} alt={comp.title} fill className="object-cover transition-transform group-hover:scale-110" unoptimized />
                                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                                        <div className="flex gap-2"><StatusBadge status={status} /><ScoringModelBadge model={comp.scoringModel} /></div>
                                        {status === 'active' && <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white"><Countdown endDate={comp.endDate} /></div>}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <h2 className="absolute bottom-4 left-5 right-5 text-xl font-bold text-white truncate">{comp.title}</h2>
                                </div>
                                <CardContent className="p-6 flex flex-col flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">{comp.description}</p>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Güncel Ödül</span>
                                            <p className="text-lg font-black text-primary">{estimatedPrize} <span className="text-xs">Pix</span></p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Katılım</span>
                                            <p className="text-sm font-bold">{comp.participantCount || 0} Kişi</p>
                                        </div>
                                    </div>
                                    <div className="mt-auto space-y-3">
                                        <Button className="w-full rounded-xl h-11 font-bold" variant={status === 'active' ? 'default' : 'secondary'} onClick={() => { setSelectedCompetition(comp); setIsDetailOpen(true); }}>{status === 'active' ? 'Hemen Katıl' : 'Detayları Gör'}</Button>
                                        <Button variant="ghost" className="w-full text-xs h-9" onClick={() => { setCompetitionForEntries(comp); setIsEntriesOpen(true); }}><LayoutGrid className="mr-2 h-3.5 w-3.5" /> Katılımları Görüntüle</Button>
                                    </div>
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
