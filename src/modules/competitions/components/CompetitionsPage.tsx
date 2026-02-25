
'use client';
import { useMemo } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/lib/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Competition, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

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

import { cn } from '@/lib/utils';

export default function CompetitionsPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    
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

    return (
        <div className="container mx-auto px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Yarışmalar</h1>
                <p className="text-muted-foreground">Dünya çapındaki topluluğumuzla yeteneklerini yarıştır.</p>
            </div>

            {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
                </div>
            ) : sortedCompetitions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedCompetitions.map(comp => {
                        const status = getCompetitionStatus(comp.startDate, comp.endDate);
                        const isEligible = userProfile?.level_name === comp.targetLevel || comp.targetLevel === 'Neuner';

                        return (
                            <Card key={comp.id} className={cn("overflow-hidden flex flex-col transition-all", status === 'active' ? "border-primary/50 shadow-lg shadow-primary/5" : "opacity-80")}>
                                <div className="relative h-48 w-full">
                                    <Image src={comp.imageUrl} alt={comp.title} fill className="object-cover" unoptimized />
                                    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                                        <StatusBadge status={status} />
                                        <Badge variant="outline" className="bg-black/60 backdrop-blur-sm text-xs border-primary/20">
                                            {comp.targetLevel} Seviyesi
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-6 flex flex-col flex-grow">
                                    <h2 className="text-xl font-semibold mb-2">{comp.title}</h2>
                                    <p className="text-sm text-muted-foreground flex-grow line-clamp-3 mb-4">{comp.description}</p>
                                    
                                    <div className="space-y-2.5 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Sparkles className="h-4 w-4 text-purple-400" />
                                            <span className="font-medium mr-1 text-foreground">Tema:</span> {comp.theme}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Trophy className="h-4 w-4 text-amber-400" />
                                            <span className="font-medium mr-1 text-foreground">Ödül:</span> {comp.prize}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4 text-blue-400" />
                                            <span className="font-medium mr-1 text-foreground text-xs">
                                                {format(new Date(comp.startDate), 'd MMM', { locale: tr })} - {format(new Date(comp.endDate), 'd MMM yyyy', { locale: tr })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        {!isEligible && status === 'active' && (
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-semibold uppercase">
                                                <AlertCircle className="h-3 w-3" /> Bu seviyeye uygun değilsiniz
                                            </div>
                                        )}
                                        <Button 
                                            className="w-full h-11" 
                                            disabled={status !== 'active' || !isEligible}
                                            variant={status === 'active' && isEligible ? 'default' : 'secondary'}
                                        >
                                            {status === 'active' ? (isEligible ? 'Katıl ve Fotoğraf Yükle' : 'Uygun Değil') : 'Yarışma Kapalı'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
                    <Trophy className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
                    <h3 className="text-2xl font-semibold">Henüz Aktif Yarışma Yok</h3>
                    <p className="text-muted-foreground mt-2">Yönetici tarafından yeni bir yarışma düzenlenmesini bekleyin.</p>
                </div>
            )}
        </div>
    );
}
