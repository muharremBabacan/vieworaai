'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Competition } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Sparkles, Check, Clock, ExternalLink } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from '@/navigation';

const localeMap: Record<string, Locale> = { tr, en: enUS };

function CompetitionCard({ competition }: { competition: Competition }) {
  const t = useTranslations('CompetitionsPage');
  const locale = useLocale();
  const dtfLocale = localeMap[locale] || enUS;
  
  const now = new Date();
  const startDate = new Date(competition.startDate);
  const endDate = new Date(competition.endDate);
  
  let status: 'active' | 'upcoming' | 'ended' = 'upcoming';
  if (now >= startDate && now <= endDate) {
    status = 'active';
  } else if (now > endDate) {
    status = 'ended';
  }

  const statusMap = {
    active: { text: t('status_active'), color: 'bg-green-500 hover:bg-green-500/90', icon: Sparkles },
    upcoming: { text: t('status_upcoming'), color: 'bg-blue-500 hover:bg-blue-500/90', icon: Clock },
    ended: { text: t('status_ended'), color: 'bg-gray-500 hover:bg-gray-500/90', icon: Check },
  };
  const currentStatus = statusMap[status];

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="p-0 relative h-48">
        <Image src={competition.imageUrl} alt={competition.title} fill className="object-cover" data-ai-hint={competition.imageHint} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <Badge className={cn("text-white", currentStatus.color)}>
            <currentStatus.icon className="mr-2 h-4 w-4" />
            {currentStatus.text}
          </Badge>
          <CardTitle className="text-white mt-2 font-sans text-xl">{competition.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3 flex-grow">
        <CardDescription>{competition.description}</CardDescription>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> <strong>{t('prize_label')}</strong> {competition.prize}</div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> <strong>{t('date_label')}</strong> {format(startDate, 'd MMMM', { locale: dtfLocale })} - {format(endDate, 'd MMMM yyyy', { locale: dtfLocale })}</div>
        </div>
      </CardContent>
      <CardFooter className="p-4">
        {status === 'active' && <Button className="w-full" asChild><Link href={`/competitions/${competition.id}/join`}>{t('button_join')}</Link></Button>}
        {status === 'upcoming' && <Button className="w-full" disabled>{t('status_upcoming')}</Button>}
        {status === 'ended' && <Button className="w-full" variant="outline" asChild><Link href={`/competitions/${competition.id}/results`}>{t('button_view_entries')}</Link></Button>}
      </CardFooter>
    </Card>
  )
}

export default function CompetitionsPage() {
  const t = useTranslations('CompetitionsPage');
  const firestore = useFirestore();

  const competitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'competitions'), orderBy('startDate', 'desc'));
  }, [firestore]);

  const { data: competitions, isLoading } = useCollection<Competition>(competitionsQuery);

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2 flex-grow">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
              <CardFooter className="p-4">
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto">
      {competitions && competitions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map(comp => (
            <CompetitionCard key={comp.id} competition={comp} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed bg-muted/10">
          <Trophy className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold">{t('no_competitions_title')}</h3>
          <p className="text-muted-foreground mt-2">{t('no_competitions_description')}</p>
        </div>
      )}
    </div>
  );
}
