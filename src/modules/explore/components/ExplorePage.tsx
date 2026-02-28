'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/lib/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Exhibition, Competition, Group, Photo } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Trophy, Users, ArrowLeft, ChevronRight, Camera, Clock, Star, Sparkles } from 'lucide-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

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
  const [view, setView] = useState<'hub' | 'exhibitions' | 'exhibition-detail' | 'competitions'>('hub');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);

  // Queries
  const exhibitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'exhibitions'), where('isActive', '==', true), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: exhibitions, isLoading: isExLoading } = useCollection<Exhibition>(exhibitionsQuery);

  const competitionsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'competitions'), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: competitions, isLoading: isCompLoading } = useCollection<Competition>(competitionsQuery);

  const groupsQuery = useMemoFirebase(() => 
    (user && firestore) ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid)) : null,
    [user, firestore]
  );
  const { data: myGroups, isLoading: isGroupsLoading } = useCollection<Group>(groupsQuery);

  const photosQuery = useMemoFirebase(() => {
    if (!firestore || !selectedExhibition || view !== 'exhibition-detail') return null;
    return query(collection(firestore, 'public_photos'), where('exhibitionId', '==', selectedExhibition.id), orderBy('createdAt', 'desc'));
  }, [firestore, selectedExhibition, view]);
  const { data: photos, isLoading: isPhotosLoading } = useCollection<Photo>(photosQuery);

  // 1. HUB VIEW
  if (view === 'hub') {
    return (
      <div className="container mx-auto px-4 pb-20 animate-in fade-in duration-700">
        <header className="mb-12 text-center space-y-4">
          <Badge variant="outline" className="px-4 py-1 border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em]">Viewora Keşif Merkezi</Badge>
          <h1 className="text-5xl font-black tracking-tighter">İlhamı Keşfet.</h1>
          <p className="text-muted-foreground text-lg font-medium max-w-lg mx-auto">Topluluğun en iyi eserleri, küresel yarışmalar ve senin grupların burada.</p>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Sergi Salonları Kartı */}
          <Card className="group relative h-[450px] rounded-[40px] overflow-hidden border-none shadow-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => setView('exhibitions')}>
            <Image src="https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=1000" alt="Exhibition" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"><Globe className="h-6 w-6 text-white" /></div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white tracking-tight">Sergi Salonları</h2>
                <p className="text-white/70 text-sm font-medium">{exhibitions?.length || 0} aktif salon seni bekliyor.</p>
              </div>
              <Button className="rounded-full w-full h-12 bg-white text-black hover:bg-white/90 font-black uppercase text-[10px] tracking-widest">Salonları Gez <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </Card>

          {/* Yarışmalar Kartı */}
          <Card className="group relative h-[450px] rounded-[40px] overflow-hidden border-none shadow-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => router.push('/competitions')}>
            <Image src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000" alt="Competitions" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20"><Trophy className="h-6 w-6 text-white" /></div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white tracking-tight">Yarışmalar</h2>
                <p className="text-white/70 text-sm font-medium">{competitions?.length || 0} büyük ödüllü yarışma aktif.</p>
              </div>
              <Button className="rounded-full w-full h-12 bg-amber-500 text-white hover:bg-amber-600 font-black uppercase text-[10px] tracking-widest">Yarışmaya Katıl <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </Card>

          {/* Gruplarım Kartı */}
          <Card className="group relative h-[450px] rounded-[40px] overflow-hidden border-none shadow-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => router.push('/groups')}>
            <Image src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000" alt="Groups" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20"><Users className="h-6 w-6 text-white" /></div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white tracking-tight">Gruplarım</h2>
                <p className="text-white/70 text-sm font-medium">{myGroups?.length || 0} topluluğa üyesin.</p>
              </div>
              <Button className="rounded-full w-full h-12 bg-blue-500 text-white hover:bg-blue-600 font-black uppercase text-[10px] tracking-widest">Topluluğa Git <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 2. EXHIBITIONS LIST VIEW
  if (view === 'exhibitions') {
    return (
      <div className="container mx-auto px-4 pb-20 animate-in slide-in-from-bottom-10 duration-700">
        <Button variant="ghost" onClick={() => setView('hub')} className="mb-8 hover:bg-primary/5 rounded-xl font-bold text-muted-foreground hover:text-primary transition-all">
          <ArrowLeft className="mr-2 h-4 w-4" /> Keşfet Merkezi
        </Button>

        <h1 className="text-4xl font-black tracking-tighter mb-10">Aktif Sergi Salonları</h1>

        {isExLoading ? (
          <div className="grid md:grid-cols-2 gap-8">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[32px]" />)}
          </div>
        ) : exhibitions && exhibitions.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8">
            {exhibitions.map((ex) => (
              <Card key={ex.id} className="group relative h-80 rounded-[32px] overflow-hidden border-none cursor-pointer shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => { setSelectedExhibition(ex); setView('exhibition-detail'); }}>
                <Image src={ex.imageUrl || `https://picsum.photos/seed/${ex.id}/800/600`} alt={ex.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute top-6 left-6 flex gap-2">
                  <Badge className="bg-primary/20 backdrop-blur-md text-primary border-primary/20 text-[10px] font-black uppercase px-3 h-6">AÇIK</Badge>
                  <Badge variant="outline" className="bg-black/40 backdrop-blur-md text-white border-white/10 text-[10px] font-black uppercase px-3 h-6">EN AZ {ex.minLevel}</Badge>
                </div>
                <div className="absolute bottom-8 left-8 right-8 space-y-3">
                  <h2 className="text-3xl font-black text-white leading-tight">{ex.title}</h2>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary"><Clock className="h-3.5 w-3.5" /> {safeFormatDistance(ex.endDate)}</div>
                    <Button size="sm" className="rounded-full px-6 h-9 font-black uppercase text-[10px] tracking-widest bg-white text-black hover:bg-white/90 ml-auto">Salona Gir <ChevronRight className="ml-1 h-3 w-3" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 rounded-[40px] border-2 border-dashed border-border/40 bg-muted/5">
            <Globe className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
            <h3 className="text-2xl font-bold">Henüz Açık Sergi Yok</h3>
          </div>
        )}
      </div>
    );
  }

  // 3. EXHIBITION DETAIL (GALLERY) VIEW
  return (
    <div className="container mx-auto px-4 pb-20 animate-in slide-in-from-right-10 duration-700">
      <Button variant="ghost" onClick={() => setView('exhibitions')} className="mb-8 hover:bg-primary/5 rounded-xl font-bold text-muted-foreground hover:text-primary transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" /> Salon Listesi
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter">{selectedExhibition?.title}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">{selectedExhibition?.description}</p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 bg-secondary/30 rounded-2xl border border-border/40">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-[10px] font-black uppercase text-muted-foreground">Katılımcı</p><p className="text-sm font-bold">{photos?.length || 0} Sanatçı</p></div>
        </div>
      </div>

      {isPhotosLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      ) : photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {photos.map((photo) => (
            <Card key={photo.id} className="group relative aspect-square rounded-[24px] overflow-hidden border-none shadow-lg">
              <Image src={photo.imageUrl} alt="Sergi" fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <Badge variant="secondary" className="bg-black/50 backdrop-blur-md text-[10px] h-6 border-none">@{photo.userName || 'Sanatçı'}</Badge>
                {photo.aiFeedback && (
                  <Badge className="bg-primary text-[10px] h-6 font-black border-none"><Star className="h-3 w-3 mr-1 fill-current" /> {((photo.aiFeedback.light_score + photo.aiFeedback.composition_score) / 2 * 10).toFixed(0)}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 rounded-[40px] border-2 border-dashed border-border/40 bg-muted/5">
          <Camera className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
          <h3 className="text-2xl font-bold">İlk Eseri Sen Paylaş!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">Galerinden bir fotoğrafı seçip sergiye göndererek bu salonu canlandırabilirsin.</p>
          <Button onClick={() => router.push('/gallery')} className="mt-8 h-12 px-8 rounded-2xl font-bold shadow-xl shadow-primary/20"><Sparkles className="mr-2 h-4 w-4" /> Galerime Git</Button>
        </div>
      )}
    </div>
  );
}
