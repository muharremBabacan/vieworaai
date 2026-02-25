'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Competition, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, AlertCircle, Info, ScrollText, X, Clock } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
    return <Badge className={cn("border", config[status].class)}>{config[status].text}</Badge>;
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
                setTimeLeft(`${days} gün ${hours} saat kaldı`);
            } else if (hours > 0) {
                setTimeLeft(`${hours} saat ${minutes} dak kaldı`);
            } else {
                setTimeLeft(`${minutes} dak kaldı`);
            }
        };

        calculate();
        const timer = setInterval(calculate, 60000);
        return () => clearInterval(timer);
    }, [endDate]);

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <Clock className="h-3.5 w-3.5" />
            {timeLeft}
        </div>
    );
};

function GeneralRulesDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5 text-primary" />
                        VİEWORA YARIŞMALARI – GENEL KURALLAR
                    </DialogTitle>
                    <DialogDescription>Viewora platformunda düzenlenen tüm yarışmalar için geçerli genel katılım ve kullanım şartları.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-6 text-sm leading-relaxed">
                        <section>
                            <h3 className="font-bold text-base mb-2">1. Katılım Koşulları</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Yarışmalar platform üyelerine açıktır.</li>
                                <li>Katılımcı, fotoğrafın kendisine ait olduğunu beyan eder.</li>
                                <li>18 yaş altı katılımcılar yasal temsilci onayı ile katılır.</li>
                                <li>Platform yönetimi gerekli gördüğü durumlarda katılımı reddetme hakkını saklı tutar.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">2. Telif ve Hak Sahipliği</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Fotoğrafın tüm fikri ve sınai hakları katılımcıya aittir.</li>
                                <li>Katılımcı, gönderdiği içeriğin üçüncü kişilerin telif, marka, kişilik veya mülkiyet haklarını ihlal etmediğini kabul eder.</li>
                                <li>İhlal durumunda doğacak tüm hukuki ve cezai sorumluluk katılımcıya aittir.</li>
                                <li>Platform, ihlal şüphesi olan içeriği önceden bildirim yapmaksızın kaldırma hakkını sahipdir.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">3. Kullanım Lisansı</h3>
                            <p className="mb-2">Katılımcı, gönderdiği fotoğrafın Viewora tarafından;</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform içinde sergilenmesine,</li>
                                <li>Sosyal medya ve tanıtım içeriklerinde kullanılmasına,</li>
                                <li>Dijital ve basılı materyallerde yer almasına</li>
                            </ul>
                            <p className="mt-2 font-medium">ücretsiz, süresiz ve dünya çapında lisans verir. Bu lisans, eser sahipliğini devretmez; yalnızca kullanım hakkı sağlar.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">4. İçerik ve Etik Kurallar</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Hakaret, nefret söylemi, ayrımcılık, şiddet, müstehcenlik veya yasa dışı içerik kabul edilmez.</li>
                                <li>Kişilerin açık rızası olmadan çekilmiş ve özel hayatı ihlal eden fotoğraflar diskalifiye edilir.</li>
                                <li>Kamu düzenini veya yürürlükteki mevzuatı ihlal eden içerikler değerlendirme dışı bırakılır.</li>
                                <li>Aşırı manipülasyon veya yarışma temasına aykırı içerikler elenir.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">5. Teknik ve Başvuru Kuralları</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Her yarışmada belirtilen format, çözünürlük ve süre şartlarına uyulmalıdır.</li>
                                <li>Süre bitiminden sonra yapılan başvurular geçersizdir.</li>
                                <li>Aynı fotoğraf birden fazla hesap üzerinden gönderilemez.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">6. Değerlendirme ve Sonuç</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Değerlendirme jüri ve/veya AI analiz sistemi tarafından yapılır.</li>
                                <li>Puanlama sistemi yarışma duyurusunda belirtilir.</li>
                                <li>Jüri kararları kesindir ve itiraza açık değildir.</li>
                                <li>Platform, gerekli gördüğü durumlarda yarışmayı iptal etme veya sonuçları değiştirme hakkını saklı tutar.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-base mb-2">7. Sorumluluk Reddi</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Platform, teknik aksaklıklar, internet kesintileri veya üçüncü taraf hizmet kaynaklı sorunlardan sorumlu değildir.</li>
                                <li>Katılımcı, yarışmaya katılarak bu genel kuralları kabul etmiş sayılır.</li>
                                <li>Doğabilecek hukuki uyuşmazlıklarda Türkiye Cumhuriyeti mevzuatı uygulanır ve İstanbul Mahkemeleri yetkilidir.</li>
                            </ul>
                        </section>
                    </div>
                </ScrollArea>
                <div className="p-4 border-t flex justify-end">
                    <DialogClose asChild>
                        <Button variant="outline">Kapat</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CompetitionDetailDialog({ competition, isOpen, onOpenChange, userProfile }: { competition: Competition | null, isOpen: boolean, onOpenChange: (open: boolean) => void, userProfile: User | null }) {
    const [isRulesOpen, setIsRulesOpen] = useState(false);
    
    if (!competition) return null;

    const status = getCompetitionStatus(competition.startDate, competition.endDate);
    const isEligible = userProfile?.level_name === competition.targetLevel || competition.targetLevel === 'Neuner';

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{competition.title}</DialogTitle>
                        <DialogDescription>Yarışma detayları, kurallar ve katılım şartları.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="absolute top-4 right-4 z-20">
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 border border-white/10">
                                <X className="h-6 w-6" />
                            </Button>
                        </DialogClose>
                    </div>

                    <ScrollArea className="max-h-[95vh] w-full">
                        <div className="flex flex-col">
                            <div className="relative h-64 sm:h-80 w-full shrink-0">
                                <Image src={competition.imageUrl} alt={competition.title} fill className="object-cover" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                                <div className="absolute bottom-6 left-6 right-6">
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <StatusBadge status={status} />
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 backdrop-blur-md">
                                            {competition.targetLevel} Seviyesi
                                        </Badge>
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{competition.title}</h2>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 space-y-8">
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="md:col-span-2 space-y-8">
                                        <div>
                                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                <Info className="h-5 w-5 text-primary" /> Yarışma Hakkında
                                            </h3>
                                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{competition.description}</p>
                                        </div>

                                        <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 backdrop-blur-sm">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                                                <Sparkles className="h-3 w-3" /> Katılım Bilgileri
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                        <Sparkles className="h-5 w-5 text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Tema</p>
                                                        <p className="text-sm font-semibold">{competition.theme}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                                        <Trophy className="h-5 w-5 text-amber-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Büyük Ödül</p>
                                                        <p className="text-sm font-semibold">{competition.prize}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                                        <Calendar className="h-5 w-5 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Başlangıç</p>
                                                        <p className="text-sm font-semibold">{format(new Date(competition.startDate), 'd MMMM yyyy', { locale: tr })}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                                        <Calendar className="h-5 w-5 text-red-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Bitiş</p>
                                                        <p className="text-sm font-semibold">{format(new Date(competition.endDate), 'd MMMM yyyy', { locale: tr })}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {status === 'active' && (
                                            <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-center">
                                                <p className="text-[10px] uppercase font-bold text-orange-400 mb-1">Kalan Süre</p>
                                                <div className="flex justify-center"><Countdown endDate={competition.endDate} /></div>
                                            </div>
                                        )}

                                        <Button variant="outline" className="w-full h-12 flex items-center gap-2 rounded-xl" onClick={() => setIsRulesOpen(true)}>
                                            <ScrollText className="h-4 w-4" />
                                            Genel Kurallar
                                        </Button>

                                        <div className="p-5 rounded-2xl border border-dashed border-border bg-muted/5 text-center space-y-4">
                                            <p className="text-xs text-muted-foreground">Yarışmaya katılmak için galerinizden uygun bir fotoğraf seçmelisiniz.</p>
                                            {!isEligible && status === 'active' && (
                                                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-semibold uppercase text-left border border-amber-500/20">
                                                    <AlertCircle className="h-4 w-4 shrink-0" /> Mevcut seviyeniz bu yarışma için uygun değildir.
                                                </div>
                                            )}
                                            <Button 
                                                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 rounded-xl" 
                                                disabled={status !== 'active' || !isEligible}
                                            >
                                                {status === 'active' ? (isEligible ? 'Fotoğraf Yükle ve Katıl' : 'Uygun Değil') : 'Yarışma Kapalı'}
                                            </Button>
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
        <div className="container mx-auto px-4">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Yarışmalar</h1>
                    <p className="text-muted-foreground mt-2 max-w-md">Luma tarafından düzenlenen haftalık etkinlikler ve global yarışmalarla yeteneklerini sergile.</p>
                </div>
                <Badge variant="secondary" className="w-fit h-8 px-4 text-xs font-medium bg-primary/10 text-primary border-none">
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
                                        <Button className="rounded-xl font-bold px-6 h-11 transition-all" variant={status === 'active' ? 'default' : 'secondary'} onClick={() => handleViewDetail(comp)}>
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