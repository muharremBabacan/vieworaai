'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Exhibition, Competition, Group, Photo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Trophy, Users, ArrowLeft, ChevronRight, Camera, Clock, Star } from 'lucide-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const getTechnicalScore = (photo: Photo): number => {
    if (!photo.aiFeedback) return 0;
    const technicalSubScores = [
        normalizeScore(photo.aiFeedback.focus_score),
        normalizeScore(photo.aiFeedback.color_control_score),
        normalizeScore(photo.aiFeedback.background_control_score)
    ];
    return technicalSubScores.reduce((sum, s) => sum + s, 0) / technicalSubScores.length;
};

const getOverallScore = (photo: Photo): number => {
    if (!photo.aiFeedback) return 0;
    const lScore = normalizeScore(photo.aiFeedback.light_score);
    const cScore = normalizeScore(photo.aiFeedback.composition_score);
    const tScore = getTechnicalScore(photo);
    return (lScore + cScore + tScore) / 3;
};

const safeFormatDistance = (dateStr: string | undefined) => {
  if (!dateStr) return 'Süresiz';
  const date = new Date(dateStr);
  if (!isValid(date)) return 'Süresiz';
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: tr });
  } catch (e) {
    return 'Süresiz';
  }
};

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);

  const exhibitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: exhibitions, isLoading: isExLoading } = useCollection<Exhibition>(exhibitionsQuery);

  const competitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: competitions } = useCollection<Competition>(competitionsQuery);

  const groupsQuery = useMemoFirebase(() => 
    (user && firestore) ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid), orderBy('createdAt', 'desc')) : null,
    [user, firestore]
  );
  const { data: myGroups } = useCollection<Group>(groupsQuery);

  const photosQuery = useMemoFirebase(() => {
    if (!firestore || !selectedExhibition || view !== 'exhibition-detail') return null;
    return query(collection(firestore, 'public_photos'), where('exhibitionId', '==', selectedExhibition.id), orderBy('createdAt', 'desc'));
  }, [firestore, selectedExhibition, view]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  if (view === 'hub') {
    return (
      <div className="container mx-auto px-4 pb-24 animate-in fade-in duration-700">
        <header className="mb-12 text-center space-y-4 pt-6">
          <Badge variant="outline" className="px-5 py-1.5 border-primary/30 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full">Keşif Merkezi</Badge>
          <h1 className="text-5xl font-black tracking-tighter">İlhamı Keşfet.</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto text-balance">Topluluğun en iyi eserleri ve küresel etkinlikler.</p>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          {/* SERGİ SALONLARI */}
          <Card className="flex flex-col h-full rounded-[32px] overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 group shadow-lg bg-card/50">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=1000" alt="Exhibition" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-4 left-4 h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg"><Globe className="h-5 w-5 text-white" /></div>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl font-black tracking-tight">Sergi Salonları</CardTitle>
              <CardDescription className="text-sm font-bold text-primary uppercase">{exhibitions?.length || 0} Aktif Salon</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-sm text-muted-foreground leading-relaxed flex-grow">Tematik salonları gez, vizyonunu toplulukla paylaş.</p>
              <Button onClick={() => setView('exhibitions')} className="mt-6 w-full h-11 font-bold shadow-lg shadow-primary/10 transition-all active:scale-95" variant="default">
                Salonları Gez
              </Button>
            </CardContent>
          </Card>

          {/* YARIŞMALAR */}
          <Card className="flex flex-col h-full rounded-[32px] overflow-hidden border-border/40 hover:border-amber-500/30 transition-all duration-300 group shadow-lg bg-card/50">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000" alt="Competitions" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-4 left-4 h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg"><Trophy className="h-5 w-5 text-white" /></div>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl font-black tracking-tight">Global Yarışmalar</CardTitle>
              <CardDescription className="text-sm font-bold text-amber-500 uppercase">{competitions?.length || 0} Büyük Ödül</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-sm text-muted-foreground leading-relaxed flex-grow">Limitlerini zorla, jüri ve topluluk karşısında yarış.</p>
              <Button onClick={() => router.push('/competitions')} className="mt-6 w-full h-11 font-bold shadow-lg shadow-amber-500/10 transition-all active:scale-95" variant="default">
                Yarışmaya Katıl
              </Button>
            </CardContent>
          </Card>

          {/* GRUPLARIM */}
          <Card className="flex flex-col h-full rounded-[32px] overflow-hidden border-border/40 hover:border-blue-500/30 transition-all duration-300 group shadow-lg bg-card/50">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000" alt="Groups" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-4 left-4 h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg"><Users className="h-5 w-5 text-white" /></div>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl font-black tracking-tight">Aktif Gruplarım</CardTitle>
              <CardDescription className="text-sm font-bold text-blue-500 uppercase">{myGroups?.length || 0} Topluluk Üyesi</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-sm text-muted-foreground leading-relaxed flex-grow">Özel topluluklara katıl veya kendi ekibini kur.</p>
              <Button onClick={() => router.push('/groups')} className="mt-6 w-full h-11 font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-95" variant="default">
                Topluluğa Git
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'exhibitions') {
    return (
      <div className="container mx-auto px-4 pb-24 animate-in slide-in-from-bottom-10 duration-700">
        <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 hover:bg-primary/5 rounded-2xl font-bold text-muted-foreground hover:text-primary transition-all">
          <ArrowLeft className="mr-2 h-4 w-4" /> Keşfet Merkezi
        </Button>

        <h1 className="text-5xl font-black tracking-tighter mb-12">Aktif Sergi Salonları</h1>

        {isExLoading ? (
          <div className="grid md:grid-cols-2 gap-10">
            {[...Array(2)].map((_, i) => <Skeleton className="h-80 rounded-[48px]" />)}
          </div>
        ) : exhibitions && exhibitions.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-10">
            {exhibitions.map((ex) => (
              <Card key={ex.id} className="group relative h-96 rounded-[48px] overflow-hidden border-none cursor-pointer shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => { setSelectedExhibition(ex); setView('exhibition-detail'); }}>
                <Image src={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/800/600`} alt={ex.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute top-8 left-8 flex gap-3">
                  <Badge className="bg-primary/20 backdrop-blur-xl text-primary border-primary/20 text-[10px] font-black uppercase px-4 h-7 rounded-full">AÇIK</Badge>
                  <Badge variant="outline" className="bg-black/40 backdrop-blur-xl text-white border-white/10 text-[10px] font-black uppercase px-4 h-7 rounded-full">EN AZ {ex.minLevel}</Badge>
                </div>
                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black text-white leading-tight tracking-tighter">{ex.title}</h2>
                    <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-wider">
                      <Clock className="h-4 w-4" /> {safeFormatDistance(ex.endDate)}
                    </div>
                  </div>
                  <Button className="rounded-xl px-8 h-11 font-black uppercase text-[10px] tracking-widest bg-white text-black hover:bg-white/90 shadow-lg">
                    Salona Gir <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-40 rounded-[64px] border-2 border-dashed border-border/40 bg-muted/5">
            <Globe className="h-20 w-20 mx-auto mb-8 text-muted-foreground/20" />
            <h3 className="text-3xl font-black tracking-tight">Henüz Açık Sergi Yok</h3>
            <p className="text-muted-foreground mt-2">Admin tarafından yeni salonlar eklendiğinde burada göreceksin.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-24 animate-in slide-in-from-right-10 duration-700">
      <Button variant="ghost" onClick={() => setView('exhibitions')} className="mb-8 hover:bg-primary/5 rounded-2xl font-bold text-muted-foreground hover:text-primary transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" /> Salon Listesi
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16">
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tighter">{selectedExhibition?.title}</h1>
          <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">{selectedExhibition?.description}</p>
        </div>
        <div className="flex items-center gap-4 px-8 py-4 bg-secondary/30 rounded-[32px] border border-border/40 shadow-inner">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sanatçı Sayısı</p>
            <p className="text-lg font-black">{photos?.length || 0}</p>
          </div>
        </div>
      </div>

      {isPhotosLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-[32px]" />)}
        </div>
      ) : photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {photos.map((photo) => (
            <Card key={photo.id} className="group relative aspect-square rounded-[40px] overflow-hidden border-none shadow-2xl ring-1 ring-white/5">
              <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                <Badge variant="secondary" className="bg-white/10 backdrop-blur-xl text-white border-white/10 text-[10px] h-8 px-4 rounded-full font-bold">@{photo.userName || 'Sanatçı'}</Badge>
                {photo.aiFeedback && (
                  <Badge className="bg-primary text-white text-[10px] h-8 px-4 rounded-full font-black border-none shadow-lg">
                    <Star className="h-3 w-3 mr-1.5 fill-current" /> {getOverallScore(photo).toFixed(0)}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-40 rounded-[64px] border-2 border-dashed border-border/40 bg-muted/5">
          <Camera className="h-20 w-20 mx-auto mb-8 text-muted-foreground/20" />
          <h3 className="text-3xl font-black tracking-tight">İlk Eseri Sen Paylaş!</h3>
          <p className="text-muted-foreground max-sm mx-auto mt-4 text-lg">Galerinden en iyi fotoğrafını seçip sergiye göndererek bu salonu onurlandırabilirsin.</p>
          <Button onClick={() => router.push('/gallery')} size="lg" className="mt-10 h-14 px-12 rounded-2xl font-bold shadow-2xl shadow-primary/30 active:scale-95 transition-all">
            <ChevronRight className="mr-2 h-5 w-5" /> Galerime Git
          </Button>
        </div>
      )}
    </div>
  );
}
