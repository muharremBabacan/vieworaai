'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc, addDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Competition, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, AlertCircle, Info, ScrollText, X, Clock, Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
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
                            <p className="mb-2">Katılımcı, gönderdiği fotoğrafın Viewora tarafından;</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform içinde sergilenmesine,</li>
                                <li>Sosyal medya ve tanıtım içeriklerinde kullanılmasına,</li>
                                <li>Dijital ve basılı materyallerde yer almasına</li>
                            </ul>
                            <p className="mt-2 font-medium text-foreground">ücretsiz, süresiz ve dünya çapında lisans verir. Bu lisans, eser sahipliğini devretmez; yalnızca kullanım hakkı sağlar.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">4. İçerik ve Etik Kurallar</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Hakaret, nefret söylemi, ayrımcılık, şiddet, müstehcenlik veya yasa dışı içerik kabul edilmez.</li>
                                <li>Kişilerin açık rızası olmadan çekilmiş ve özel hayatı ihlal eden fotoğraflar diskalifiye edilir.</li>
                                <li>Kamu düzenini veya yürürlükteki mevzuatı ihlal eden içerikler değerlendirme dışı bırakılır.</li>
                                <li>Aşırı manipülasyon veya yarışma temasına aykırı içerikler elenir.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">5. Teknik ve Başvuru Kuralları</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Her yarışmada belirtilen format, çözünürlük ve süre şartlarına uyulmalıdır.</li>
                                <li>Süre bitiminden sonra yapılan başvurular geçersizdir.</li>
                                <li>Aynı fotoğraf birden fazla hesap üzerinden gönderilemez.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">6. Değerlendirme ve Sonuç</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Değerlendirme jüri ve/veya AI analiz sistemi tarafından yapılır.</li>
                                <li>Puanlama sistemi yarışma duyurusunda belirtilir.</li>
                                <li>Jüri kararları kesindir ve itiraza açık değildir.</li>
                                <li>Platform, gerekli gördüğü durumlarda yarışmayı iptal etme veya sonuçları değiştirme hakkını saklı tutar.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-foreground text-base mb-2">7. Sorumluluk Reddi</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform, teknik aksaklıklar, internet kesintileri veya üçüncü taraf hizmet kaynaklı sorunlardan sorumlu değildir.</li>
                                <li>Katılımcı, yarışmaya katılarak bu genel kuralları kabul etmiş sayılır.</li>
                                <li>Doğabilecek hukuki uyuşmazlıklarda Türkiye Cumhuriyeti mevzuatı uygulanır ve İstanbul Mahkemeleri yetkilidir.</li>
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
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = getStorage();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const selected = acceptedFiles[0];
            if (selected.size > 10 * 1024 * 1024) {
                toast({ variant: 'destructive', title: "Dosya Çok Büyük", description: "Lütfen 10MB'dan küçük bir resim seçin." });
                return;
            }
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    }, [toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
        maxFiles: 1,
        disabled: isUploading
    });

    const handleUploadEntry = async () => {
        if (!file || !competition || !userProfile || !firestore) return;
        
        setIsUploading(true);
        toast({ title: "Katılım İşleniyor...", description: "Fotoğrafınız yarışmaya gönderiliyor." });

        try {
            const filePath = `competitions/${competition.id}/entries/${userProfile.id}/${Date.now()}_${file.name}`;
            const fileRef = ref(storage, filePath);
            const uploadResult = await uploadBytes(fileRef, file);
            const photoUrl = await getDownloadURL(uploadResult.ref);

            const entryRef = doc(collection(firestore, 'competitions', competition.id, 'entries'));
            const entryData = {
                id: entryRef.id,
                competitionId: competition.id,
                userId: userProfile.id,
                userName: userProfile.name || 'İsimsiz Sanatçı',
                photoUrl,
                filePath,
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
            setFile(null);
            setPreview(null);
            onOpenChange(false);
        } catch (error) {
            console.error("Upload error:", error);
            toast({ variant: 'destructive', title: "Hata", description: "Katılım gerçekleştirilemedi." });
        } finally {
            setIsUploading(false);
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
                        <DialogDescription>Yarışma detayları ve katılım alanı.</DialogDescription>
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
                            {/* Smaller Hero Image */}
                            <div className="relative h-48 sm:h-56 w-full shrink-0">
                                <Image src={competition.imageUrl} alt={competition.title} fill className="object-cover" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                                <div className="absolute bottom-4 left-6 right-6">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <StatusBadge status={status} />
                                        <Badge variant="outline" className="h-5 px-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase">
                                            {competition.targetLevel} SEVİYESİ
                                        </Badge>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-md">{competition.title}</h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    {/* Left Content */}
                                    <div className="md:col-span-7 space-y-6">
                                        <div className="bg-secondary/20 p-4 rounded-xl border border-border/40">
                                            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                                                <Info className="h-4 w-4 text-primary" /> Yarışma Hakkında
                                            </h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{competition.description}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                                    <Sparkles className="h-4 w-4 text-purple-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Tema</p>
                                                    <p className="text-xs font-bold truncate">{competition.theme}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                                    <Trophy className="h-4 w-4 text-amber-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Ödül</p>
                                                    <p className="text-xs font-bold truncate">{competition.prize}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Sidebar / Upload Area */}
                                    <div className="md:col-span-5 space-y-4">
                                        {status === 'active' && (
                                            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-center">
                                                <Countdown endDate={competition.endDate} />
                                            </div>
                                        )}

                                        <Button variant="outline" size="sm" className="w-full h-9 text-xs flex items-center gap-2 rounded-lg" onClick={() => setIsRulesOpen(true)}>
                                            <ScrollText className="h-3.5 w-3.5" />
                                            Yarışma Genel Kuralları
                                        </Button>

                                        <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 space-y-4">
                                            {preview ? (
                                                <div className="space-y-3">
                                                    <div className="relative aspect-square rounded-lg overflow-hidden border border-border shadow-inner">
                                                        <Image src={preview} alt="Preview" fill className="object-cover" unoptimized />
                                                        <button 
                                                            onClick={() => { setFile(null); setPreview(null); }}
                                                            className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <Button 
                                                        onClick={handleUploadEntry} 
                                                        disabled={isUploading}
                                                        className="w-full h-10 font-bold text-sm bg-primary shadow-lg shadow-primary/20"
                                                    >
                                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                        Katılımı Onayla
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div 
                                                    {...getRootProps()} 
                                                    className={cn(
                                                        "group flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all rounded-lg",
                                                        isDragActive ? "bg-primary/10 border-primary" : "hover:bg-primary/5 border-transparent",
                                                        (status !== 'active' || !isEligible) && "opacity-50 cursor-not-allowed pointer-events-none"
                                                    )}
                                                >
                                                    <input {...getInputProps()} />
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <Upload className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <p className="text-xs font-bold mb-1">Fotoğraf Yükle ve Katıl</p>
                                                    <p className="text-[10px] text-muted-foreground">Max 10MB, JPG/PNG</p>
                                                </div>
                                            )}

                                            {!isEligible && status === 'active' && (
                                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase border border-amber-500/20 leading-tight">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                    Seviyeniz bu kategori için uygun değildir.
                                                </div>
                                            )}
                                        </div>
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

    return (
        <div className="container mx-auto px-4 pb-12">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Yarışmalar</h1>
                    <p className="text-muted-foreground mt-2 max-w-md">Luma tarafından düzenlenen haftalık etkinlikler ve global yarışmalarla yeteneklerini sergile.</p>
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
                            <Card key={comp.id} className={cn("overflow-hidden flex flex-col transition-all group border-border/50 hover:border-primary/40 rounded-3xl bg-card/50 backdrop-blur-sm", status === 'active' ? "shadow-2xl shadow-primary/5 ring-1 ring-primary/10" : "opacity-80 grayscale-[30%]")}>
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

                                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Seviye</span>
                                            <Badge variant="outline" className="h-6 mt-1 bg-secondary/50 border-none font-bold text-[11px]">{comp.targetLevel}</Badge>
                                        </div>
                                        <Button className="rounded-xl font-bold px-6 h-11 transition-all shadow-lg hover:shadow-primary/20" variant={status === 'active' ? 'default' : 'secondary'} onClick={() => handleViewDetail(comp)}>
                                            {status === 'active' ? 'Katıl' : 'Görüntüle'}
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
                    <h3 className="text-2xl font-bold">Henüz Aktif Yarışma Yok</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Luma'nın bu hafta için planlayacağı yeni yarışmayı bekleyin.</p>
                </div>
            )}

            <CompetitionDetailDialog 
                competition={selectedCompetition} 
                isOpen={isDetailOpen} 
                onOpenChange={setIsDetailOpen} 
                userProfile={userProfile || null}
            />
        </div>
    );
}
