
'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc, addDoc, where, writeBatch, increment, getDocs, collectionGroup } from 'firebase/firestore';
import type { Competition, User, Photo, CompetitionEntry, ScoringModel } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, AlertCircle, Info, ScrollText, X, Clock, Camera, Upload, Loader2, CheckCircle2, LayoutGrid, Star, Users, Scale, Cpu, Medal, Shield } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

function CompetitionEntriesDialog({ competition, isOpen, onOpenChange }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();
    const entriesQuery = useMemoFirebase(() => (competition && firestore) ? query(collection(firestore, 'competitions', competition.id, 'entries'), orderBy('submittedAt', 'desc')) : null, [competition, firestore]);
    const { data: entries, isLoading } = useCollection<CompetitionEntry>(entriesQuery);
    
    if (!competition) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-6 border-b shrink-0"><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {competition.title} - Katılımlar</DialogTitle></DialogHeader>
                <ScrollArea className="flex-1 p-6">
                    {isLoading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div> :
                     entries && entries.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {entries.map(e => (
                                <div key={e.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                                    <Image src={e.photoUrl} alt="Eser" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
                                    
                                    {/* Award Badge Overlay */}
                                    {e.award && (
                                        <div className="absolute top-2 left-2 z-10">
                                            {e.award === 'winner' && (
                                                <Badge className="bg-amber-500 text-white border-none shadow-lg px-1.5 h-6">
                                                    <Medal className="h-3 w-3 mr-1" /> <span className="text-[9px] font-bold">BİRİNCİ</span>
                                                </Badge>
                                            )}
                                            {e.award === 'honorable_mention' && (
                                                <Badge className="bg-purple-500 text-white border-none shadow-lg px-1.5 h-6">
                                                    <Star className="h-3 w-3 mr-1" /> <span className="text-[9px] font-bold">MANSİYON</span>
                                                </Badge>
                                            )}
                                            {e.award === 'participant' && (
                                                <Badge className="bg-blue-500 text-white border-none shadow-lg px-1.5 h-6">
                                                    <Shield className="h-3 w-3 mr-1" /> <span className="text-[9px] font-bold">ŞİLT</span>
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                        <p className="text-[10px] font-bold text-white truncate drop-shadow-md">@{e.userName}</p>
                                        {e.aiScore && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-black/40 text-white border-none">{e.aiScore.toFixed(1)}</Badge>}
                                    </div>
                                </div>
                            ))}
                        </div>
                     ) : (
                     <div className="text-center py-20"><p className="text-muted-foreground font-medium">Henüz katılım bulunmuyor.</p></div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
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
        const photo = analyzedPhotos.find(p => p.id === selectedPhotoId);
        if (!photo) return;
        setIsSubmitting(true);
        try {
            // Automatically assign participation shield award
            await addDoc(collection(firestore, 'competitions', competition.id, 'entries'), {
                competitionId: competition.id,
                userId: userProfile.id,
                userName: userProfile.name || 'İsimsiz Sanatçı',
                photoUrl: photo.imageUrl,
                filePath: photo.filePath || '',
                submittedAt: new Date().toISOString(),
                votes: [],
                award: 'participant' // Default award for participation
            });
            toast({ title: "Tebrikler!", description: "Yarışmaya katıldınız ve Katılım Şilti kazandınız!" });
            setSelectedPhotoId(null);
            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Hata" });
        } finally { setIsSubmitting(false); }
    };
    
    if (!competition) return null;
    const status = getCompetitionStatus(competition.startDate, competition.endDate);
    const isEligible = userProfile?.level_name === competition.targetLevel || competition.targetLevel === 'Neuner';

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
                                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-purple-400" /></div>
                                            <div className="min-w-0"><p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Tema</p><p className="text-xs font-bold truncate">{competition.theme}</p></div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Trophy className="h-4 w-4 text-amber-400" /></div>
                                            <div className="min-w-0"><p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Ödül</p><p className="text-xs font-bold truncate">{competition.prize}</p></div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                                        <h4 className="text-[10px] text-primary uppercase font-bold tracking-widest flex items-center gap-2"><Scale className="h-3 w-3" /> Değerlendirme Stratejisi</h4>
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="flex flex-col items-center gap-1"><Users className="h-4 w-4 text-blue-400" /><span>Jüri: %{competition.juryWeight}</span></div>
                                            <div className="flex flex-col items-center gap-1"><Cpu className="h-4 w-4 text-purple-400" /><span>AI: %{competition.aiWeight}</span></div>
                                            <div className="flex flex-col items-center gap-1"><Star className="h-4 w-4 text-amber-400" /><span>Topluluk: %{competition.communityWeight}</span></div>
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
                                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-2">
                                                <p className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-1">
                                                    <Shield className="h-3 w-3" /> Katılım Hediyesi
                                                </p>
                                                <p className="text-[11px] text-foreground/80 mt-1">Yarışmaya katıldığın an profilin için "Katılım Şilti" kazanırsın.</p>
                                            </div>
                                            <Button onClick={handleConfirmJoin} disabled={!selectedPhotoId || isSubmitting} className="w-full h-10 font-bold">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Katılımı Tamamla"}</Button>
                                        </div>
                                    )}
                                    {!isEligible && status === 'active' && <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase border border-amber-500/20">Bu kategori için seviyeniz uygun değil.</div>}
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
                                        <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Ağırlıklar</span><p className="text-xs font-mono">J:%{comp.juryWeight} A:%{comp.aiWeight} T:%{comp.communityWeight}</p></div>
                                        <div className="space-y-1 text-right"><span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Seviye</span><Badge variant="secondary" className="block text-[10px] font-bold">{comp.targetLevel}</Badge></div>
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
            <CompetitionEntriesDialog competition={competitionForEntries} isOpen={isEntriesOpen} onOpenChange={setIsEntriesOpen} />
        </div>
    );
}
