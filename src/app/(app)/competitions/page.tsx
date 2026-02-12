'use client';
import Image from 'next/image';
import { competitions } from '@/lib/data';
import type { Competition } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trophy, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

function CompetitionCard({ competition }: { competition: Competition }) {
  const isActive = new Date() >= new Date(competition.startDate) && new Date() <= new Date(competition.endDate);

  return (
    <Card className="flex flex-col overflow-hidden h-full">
        <CardHeader className="p-0 relative h-56">
            <Image
                src={competition.imageUrl}
                alt={competition.title}
                fill
                className="object-cover"
                data-ai-hint={competition.imageHint}
            />
             <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 w-full">
                <Badge variant="secondary" className="mb-2">{competition.theme}</Badge>
                <CardTitle className="font-sans text-2xl text-white">{competition.title}</CardTitle>
            </div>
             {isActive && (
                <Badge className="absolute top-4 right-4 bg-green-500 text-white">
                    <Sparkles className="mr-2 h-4 w-4"/>
                    Aktif
                </Badge>
            )}
        </CardHeader>
        <CardContent className="p-6 flex-grow">
            <CardDescription>{competition.description}</CardDescription>
            <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span className="font-semibold">Ödül:</span>
                    <span>{competition.prize}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">Tarih:</span>
                    <span>
                       {format(new Date(competition.startDate), 'd MMMM', { locale: tr })} - {format(new Date(competition.endDate), 'd MMMM yyyy', { locale: tr })}
                    </span>
                </div>
            </div>
        </CardContent>
        <CardFooter className="p-6">
            <Button className="w-full" disabled={!isActive}>
                {isActive ? 'Fotoğraf Yükle ve Katıl' : 'Yarışma Sona Erdi'}
            </Button>
        </CardFooter>
    </Card>
  );
}


export default function CompetitionsPage() {
  return (
    <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {competitions.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
            ))}
        </div>
    </div>
  );
}
