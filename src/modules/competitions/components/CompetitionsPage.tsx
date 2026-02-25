'use client';
import { useMemo } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Competition } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

const getCompetitionStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'active';
};

const StatusBadge = ({ status }: { status: 'active' | 'upcoming' | 'ended' }) => {
    const variants = {
        active: 'bg-green-500/20 text-green-400 border-green-500/30',
        upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        ended: 'bg-secondary text-muted-foreground border-border',
    };
    const text = {
        active: 'Aktif',
        upcoming: 'Yakında',
        ended: 'Sona Erdi',
    };
    return <Badge className={variants[status]}>{text[status]}</Badge>;
};

export default function CompetitionsPage() {
    const firestore = useFirestore();
    
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
            if (statusA === 'upcoming' && statusB === 'ended') return -1;
            if (statusA === 'ended' && statusB === 'upcoming') return 1;
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        });
    }, [competitions]);

    return (
        <div className="container mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Yarışmalar</h1>

            {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                            <Skeleton className="h-48 w-full" />
                            <CardContent className="p-6">
                                <Skeleton className="h-6 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                                <Skeleton className="h-10 w-full mt-6" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : sortedCompetitions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedCompetitions.map(comp => {
                        const status = getCompetitionStatus(comp.startDate, comp.endDate);
                        return (
                            <Card key={comp.id} className="overflow-hidden flex flex-col">
                                <div className="relative h-48 w-full">
                                    <Image src={comp.imageUrl} alt={comp.title} fill className="object-cover" data-ai-hint={comp.imageHint} />
                                    <div className="absolute top-4 right-4">
                                        <StatusBadge status={status} />
                                    </div>
                                </div>
                                <CardContent className="p-6 flex flex-col flex-grow">
                                    <h2 className="text-xl font-semibold mb-2">{comp.title}</h2>
                                    <p className="text-sm text-muted-foreground flex-grow">{comp.description}</p>
                                    
                                    <div className="mt-4 space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Sparkles className="h-4 w-4 text-primary" />
                                            <span className="font-semibold mr-1">Tema:</span>
                                            {comp.theme}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Trophy className="h-4 w-4 text-amber-400" />
                                            <span className="font-semibold mr-1">Ödül:</span>
                                            {comp.prize}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span className="font-semibold mr-1">Tarih:</span>
                                            {format(new Date(comp.startDate), 'dd/MM/yy')} - {format(new Date(comp.endDate), 'dd/MM/yy')}
                                        </div>
                                    </div>

                                    <Button className="w-full mt-6" disabled={status !== 'active'}>
                                        {status === 'active' ? 'Fotoğraf Yükle ve Katıl' : 'Yarışma Sona Erdi'}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
                    <Trophy className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-2xl font-semibold">Aktif Yarışma Bulunmuyor</h3>
                    <p className="text-muted-foreground mt-2">Yeni yarışmalar yakında burada olacak. Takipte kalın!</p>
                </div>
            )}
        </div>
    );
}
