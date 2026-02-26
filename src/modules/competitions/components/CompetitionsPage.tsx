
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc, addDoc, where, writeBatch, increment, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Competition, User, Photo, CompetitionEntry } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, AlertCircle, Info, ScrollText, X, Clock, Camera, Upload, Loader2, CheckCircle2, LayoutGrid, Star, Users } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';

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

const Countdown = ({ endDate }: { endDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(endDate);
            if (now > end) {
                setTimeLeft('Süre Doldu');
                return;
            }

            const days = differenceInDays(end, now);
            const hours = differenceInHours(end, now) % 24;
            const minutes = differenceInMinutes(end, now) % 60;

            if (days > 0) {
                setTimeLeft(`${days}g ${hours}s kaldı`);
            } else if (hours > 0) {
                setTimeLeft(`${hours}s ${minutes}dk kaldı`);
            } else {
                setTimeLeft(`${minutes}dk kaldı`);
            }
        };

        calculate();
        const timer = setInterval(calculate, 60000);
        return () => clearInterval(timer);
    }, [endDate]);

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-400 uppercase tracking-tighter">
            <Clock className="h-3 w-3" />
            {timeLeft}
        </div>
    );
};

function CompetitionEntriesDialog({ competition, isOpen, onOpenChange }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();
    const entriesQuery = useMemoFirebase(() => 
        (competition && firestore) ? query(collection(firestore, 'competitions', competition.id, 'entries'), orderBy('submittedAt', 'desc')) : null,
        [competition, firestore]
    );
    const { data: entries, isLoading } = useCollection<CompetitionEntry>(entriesQuery);

    if (!competition) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-6 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {competition.title} - Yarışma Katılımları
                    </DialogTitle>
                    <DialogDescription>Bu yarışmaya gönderilen tüm eserleri buradan inceleyebilirsiniz.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6">
                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                        </div>
                    ) : entries && entries.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {entries.map(entry => (
                                <div key={entry.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                                    <Image src={entry.photoUrl} alt="Katılım" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-[10px] font-bold text-white truncate">@{entry.userName}</p>
                                        <p className="text-[8px] text-white/60">{format(new Date(entry.submittedAt), 'd MMM HH:mm', { locale: tr })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Camera className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground font-medium">Henüz katılım bulunmuyor.</p>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function GeneralRulesDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 border border-border/50">
                <DialogHeader className="p-6 border-b bg-muted/20">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <ScrollText className="h-5 w-5 text-primary" />
                        VİEWORA YARIŞMALARI – GENEL KURALLAR
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">1. Katılım Koşulları</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Yarışmalar platform üyelerine açıktır.</li>
                                <li>Katılımcı, fotoğrafın kendisine ait olduğunu beyan eder.</li>
                                <li>18 yaş altı katılımcılar yasal temsilci onayı ile katılır.</li>
                                <li>Platform yönetimi gerekli gördüğü durumlarda katılımı reddetme hakkını saklı tutar.</li>
                            </ul>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">2. Telif ve Hak Sahipliği</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Fotoğrafın tüm fikri ve sınai hakları katılımcıya aittir.</li>
                                <li>Katılımcı, gönderdiği içeriğin üçüncü kişilerin telif, marka, kişilik veya mülkiyet haklarını ihlal etmediğini kabul eder.</li>
                                <li>İhlal durumunda doğacak tüm hukuki ve cezai sorumluluk katılımcıya aittir.</li>
                                <li>Platform, ihlal şüphesi olan içeriği önceden bildirim yapmaksızın kaldırma hakkına sahiptir.</li>
                            </ul>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">3. Kullanım Lisansı</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform içinde sergilenmesine,</li>
                                <li>Sosyal medya ve tanıtım içeriklerinde kullanılmasına,</li>
                                <li>Dijital ve basılı materyallerde yer almasına</li>
                            </ul>
                            <p className="mt-2 font-medium text-foreground">ücretsiz, süresiz ve dünya çapında lisans verir.</p>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">4. İçerik ve Etik Kurallar</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Hakaret, nefret söylemi, ayrımcılık, şiddet, müstehcenlik veya yasa dışı içerik kabul edilmez.</li>
                                <li>Kamu düzenini veya yürürlükteki mevzuatı ihlal eden içerikler değerlendirme dışı bırakılır.</li>
                            </ul>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">5. Teknik ve Başvuru Kuralları</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Her yarışmada belirtilen format, çözünürlük ve süre şartlarına uyulmalıdır.</li>
                                <li>Süre bitiminden sonra yapılan başvurular geçersizdir.</li>
                            </ul>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">6. Değerlendirme ve Sonuç</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Değerlendirme jüri ve/veya AI analiz sistemi tarafından yapılır.</li>
                                <li>Jüri kararları kesindir ve itiraza açık değildir.</li>
                            </ul>
                        </section>
                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">7. Sorumluluk Reddi</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform, teknik aksaklıklar veya internet kesintilerinden sorumlu değildir.</li>
                                <li>Doğabilecek hukuki uyuşmazlıklarda Türkiye Cumhuriyeti mevzuatı uygulanır.</li>
                            </ul>
                        </section>
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-muted/10 flex justify-end">
                    <DialogClose asChild>
                        <Button variant="ghost">Kapat</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CompetitionDetailDialog({ competition, isOpen, onOpenChange, userProfile }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void, userProfile: User | null }) {
    const [isRulesOpen, setIsRulesOpen] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const userPhotosQuery = useMemoFirebase(() => 
        (userProfile && firestore) ? query(collection(firestore, 'users', userProfile.id, 'photos')) : null,
        [userProfile, firestore]
    );
    const { data: userPhotos, isLoading: isPhotosLoading } = useCollection<Photo>(userPhotosQuery);

    const analyzedPhotos = useMemo(() => {
        if (!userPhotos) return [];
        return userPhotos.filter(p => !!p.aiFeedback).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [userPhotos]);

    const handleConfirmJoin = async () => {
        if (!selectedPhotoId || !competition || !userProfile || !firestore) return;
        
        const photo = analyzedPhotos.find(p => p.id === selectedPhotoId);
        if (!photo) return;

        setIsSubmitting(true);
        toast({ title: "Katılım İşleniyor...", description: "Seçtiğiniz fotoğraf yarışmaya gönderiliyor." });

        try {
            const entryData = {
                competitionId: competition.id,
                userId: userProfile.id,
                userName: userProfile.name || 'İsimsiz Sanatçı',
                photoUrl: photo.imageUrl,
                filePath: photo.filePath || '',
                submittedAt: new Date().toISOString(),
                votes: []
            };

            await addDoc(collection(firestore, 'competitions', competition.id, 'entries'), entryData).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `competitions/${competition.id}/entries`,
                    operation: 'create',
                    requestResourceData: entryData
                }));
                throw err;
            });

            toast({ title: "Tebrikler!", description: "Yarışmaya başarıyla katıldınız." });
            setSelectedPhotoId(null);
            onOpenChange(false);
        } catch (error) {
            console.error("Join error:", error);
            toast({ variant: 'destructive', title: "Hata", description: "Katılım gerçekleştirilemedi." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!competition) return null;

    const status = getCompetitionStatus(competition.startDate, competition.endDate);
    const isEligible = userProfile?.level_name === competition.targetLevel || competition.targetLevel === 'Neuner';

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden border-border/40 shadow-2xl bg-background/95 backdrop-blur-xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{competition.title}</DialogTitle>
                        <DialogDescription>Yarışma detayları ve galeriden fotoğraf seçme alanı.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="absolute top-3 right-3 z-30">
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-white/80 border border-white/10 backdrop-blur-sm">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </div>

                    <ScrollArea className="max-h-[90vh] w-full">
                        <div className="flex flex-col">
                            <div className="relative h-48 w-full shrink-0">
                                <Image src={competition.imageUrl} alt={competition.title} fill className="object-cover" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                                <div className="absolute bottom-4 left-6 right-6">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <StatusBadge status={status} />
                                        <Badge variant="outline" className="h-5 px-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase">
                                            {competition.targetLevel} SEVİYESİ
                                        </Badge>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{competition.title}</h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    <div className="md:col-span-7 space-y-6">
                                        <div className="bg-secondary/20 p-4 rounded-xl border border-border/40">
                                            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                                                <Info className="h-4 w-4 text-primary" /> Yarışma Hakkında
                                            </h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{competition.description}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-purple-400" /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Tema</p>
                                                    <p className="text-xs font-bold truncate">{competition.theme}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Trophy className="h-4 w-4 text-amber-400" /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Ödül</p>
                                                    <p className="text-xs font-bold truncate">{competition.prize}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-5 space-y-4">
                                        <Button variant="outline" size="sm" className="w-full h-9 text-xs flex items-center gap-2 rounded-lg" onClick={() => setIsRulesOpen(true)}>
                                            <ScrollText className="h-3.5 w-3.5" /> Yarışma Genel Kuralları
                                        </Button>

                                        {status === 'active' && isEligible && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                        <LayoutGrid className="h-3 w-3" /> Galerimden Seç
                                                    </h4>
                                                    <span className="text-[10px] text-primary font-bold">Sadece Analizli</span>
                                                </div>
                                                <ScrollArea className="h-48 border rounded-xl p-2 bg-muted/10">
                                                    {isPhotosLoading ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                                                        </div>
                                                    ) : analyzedPhotos.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {analyzedPhotos.map(photo => (
                                                                <button 
                                                                    key={photo.id}
                                                                    onClick={() => setSelectedPhotoId(photo.id)}
                                                                    className={cn(
                                                                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                                                        selectedPhotoId === photo.id ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-transparent hover:border-primary/40"
                                                                    )}
                                                                >
                                                                    <Image src={photo.imageUrl} alt="Galeri" fill className="object-cover" unoptimized />
                                                                    {selectedPhotoId === photo.id && (
                                                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                            <div className="bg-primary text-white p-1 rounded-full"><CheckCircle2 className="h-4 w-4" /></div>
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-10 px-4">
                                                            <AlertCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                                            <p className="text-[10px] text-muted-foreground leading-tight">Yarışmaya katılmak için önce Koç bölümünde bir fotoğrafı analiz etmelisiniz.</p>
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                                <Button 
                                                    onClick={handleConfirmJoin} 
                                                    disabled={!selectedPhotoId || isSubmitting}
                                                    className="w-full h-10 font-bold text-sm bg-primary shadow-lg shadow-primary/20"
                                                >
                                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Seçili Fotoğrafla Katıl"}
                                                </Button>
                                            </div>
                                        )}

                                        {!isEligible && status === 'active' && (
                                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase border border-amber-500/20 leading-tight">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                Seviyeniz bu kategori için uygun değildir.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            <GeneralRulesDialog isOpen={isRulesOpen} onOpenChange={setIsRulesOpen} />
        </>
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

    const competitionsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const { data: competitions, isLoading } = useCollection<Competition>(competitionsQuery);

    const sortedCompetitions = useMemo(() => {
        if (!competitions) return [];
        return [...competitions].sort((a, b) => {
            const statusA = getCompetitionStatus(a.startDate, a.endDate);
            const statusB = getCompetitionStatus(b.startDate, b.endDate);
            if (statusA === 'active' && statusB !== 'active') return -1;
            if (statusA !== 'active' && statusB === 'active') return 1;
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        });
    }, [competitions]);

    const handleViewDetail = (comp: Competition) => {
        setSelectedCompetition(comp);
        setIsDetailOpen(true);
    };

    const handleViewEntries = (comp: Competition) => {
        setCompetitionForEntries(comp);
        setIsEntriesOpen(true);
    };

    return (
        <div className="container mx-auto px-4 pb-12">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Yarışmalar</h1>
                    <p className="text-muted-foreground mt-2 max-w-md">Luma tarafından düzenlenen etkinliklerle yeteneklerini sergile ve topluluğun eserlerini incele.</p>
                </div>
                <Badge variant="secondary" className="w-fit h-8 px-4 text-xs font-medium bg-primary/10 text-primary border-none rounded-full">
                    <Sparkles className="h-3.5 w-3.5 mr-2" /> Toplam {competitions?.length || 0} Yarışma
                </Badge>
            </div>

            {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[420px] rounded-3xl" />)}
                </div>
            ) : sortedCompetitions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedCompetitions.map(comp => {
                        const status = getCompetitionStatus(comp.startDate, comp.endDate);
                        return (
                            <Card key={comp.id} className={cn("overflow-hidden flex flex-col transition-all group border-border/50 hover:border-primary/40 rounded-3xl bg-card/50 backdrop-blur-sm", status === 'active' ? "shadow-2xl shadow-primary/5 ring-1 ring-primary/10" : "opacity-80")}>
                                <div className="relative h-56 w-full overflow-hidden">
                                    <Image src={comp.imageUrl} alt={comp.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                                        <StatusBadge status={status} />
                                        {status === 'active' && (
                                            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-xl">
                                                <Countdown endDate={comp.endDate} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-4 left-5 right-5">
                                        <h2 className="text-2xl font-bold text-white tracking-tight line-clamp-1">{comp.title}</h2>
                                    </div>
                                </div>
                                <CardContent className="p-6 flex flex-col flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-8 h-10 leading-relaxed">{comp.description}</p>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Tema</span>
                                            <p className="text-sm font-semibold flex items-center gap-1.5 truncate"><Sparkles className="h-3.5 w-3.5 text-purple-400" /> {comp.theme}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Ödül</span>
                                            <p className="text-sm font-semibold flex items-center gap-1.5 truncate"><Trophy className="h-3.5 w-3.5 text-amber-400" /> {comp.prize}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Seviye</span>
                                                <Badge variant="outline" className="h-6 mt-1 bg-secondary/50 border-none font-bold text-[11px]">{comp.targetLevel}</Badge>
                                            </div>
                                            <Button className="rounded-xl font-bold px-6 h-11 transition-all" variant={status === 'active' ? 'default' : 'secondary'} onClick={() => handleViewDetail(comp)}>
                                                {status === 'active' ? 'Hemen Katıl' : 'Detayları Gör'}
                                            </Button>
                                        </div>
                                        <Button variant="ghost" className="w-full text-xs h-9 rounded-xl hover:bg-primary/5 text-primary/80 hover:text-primary" onClick={() => handleViewEntries(comp)}>
                                            <LayoutGrid className="mr-2 h-3.5 w-3.5" /> Katılımları Görüntüle
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-32 rounded-[2.5rem] border-2 border-dashed bg-muted/5 border-border/50">
                    <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trophy className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-2xl font-bold">Henüz Yarışma Bulunmuyor</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Yakında başlayacak etkinlikler için takipte kalın.</p>
                </div>
            )}

            <CompetitionDetailDialog 
                competition={selectedCompetition} 
                isOpen={isDetailOpen} 
                onOpenChange={setIsDetailOpen} 
                userProfile={userProfile || null}
            />

            <CompetitionEntriesDialog
                competition={competitionForEntries}
                isOpen={isEntriesOpen}
                onOpenChange={setIsEntriesOpen}
            />
        </div>
    );
}
