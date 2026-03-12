
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { 
  doc, 
  updateDoc, 
  arrayRemove, 
  collection, 
  query, 
  where, 
  documentId, 
  addDoc, 
  arrayUnion, 
  orderBy, 
  increment, 
  writeBatch, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { 
  Group, 
  PublicUserProfile, 
  User, 
  GroupAssignment, 
  GroupSubmission, 
  GroupComment, 
  GroupPurpose, 
  Trip, 
  TripParticipant, 
  TripStatus, 
  ParticipantStatus, 
  RoutePoint, 
  ContactVisible 
} from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, 
  Crown, 
  Users, 
  CheckCircle2, 
  Send, 
  ImageIcon, 
  Info, 
  PlusCircle, 
  Heart, 
  Star, 
  X, 
  ShieldCheck, 
  GraduationCap, 
  Trophy, 
  Map, 
  Hash, 
  Copy, 
  Calendar, 
  Clock, 
  Ruler, 
  MapPin, 
  Check, 
  UserPlus, 
  Trash2, 
  Archive, 
  CheckCircle, 
  ArrowLeft, 
  ExternalLink, 
  Instagram, 
  Phone, 
  Mail, 
  EyeOff, 
  Zap, 
  Sparkles,
  ArrowLeftRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { evaluateGroupSubmission } from '@/ai/flows/evaluate-group-submission';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppConfig } from '@/components/AppConfigProvider';
import { Progress } from '@/components/ui/progress';
import { typography } from "@/lib/design/typography";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const PURPOSE_CONFIG: Record<GroupPurpose, { label: string; icon: any; color: string }> = {
  study: { label: 'Eğitim', icon: GraduationCap, color: 'bg-blue-500/10 text-blue-400' },
  challenge: { label: 'Yarışma', icon: Trophy, color: 'bg-amber-500/10 text-amber-400' },
  walk: { label: 'Gezi', icon: Map, color: 'bg-green-500/10 text-green-400' },
  mentor: { label: 'Eğitimci', icon: ShieldCheck, color: 'bg-purple-500/10 text-purple-400' },
};

const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  archived: 'Arşivlendi'
};

const ISTANBUL_TEMPLATES = [
  {
    title: "Galata - Karaköy Mimari Rota",
    city: "istanbul",
    category: "architecture",
    duration_minutes: 90,
    distance_km: 1.5,
    start_point: "Galata Kulesi",
    end_point: "Galataport",
    route_points: [
      { name: "Galata Kulesi", type: "start" },
      { name: "Serdar-ı Ekrem Sokak", type: "photo_stop" },
      { name: "Kamondo Merdivenleri", type: "photo_stop" },
      { name: "Karaköy Sahil", type: "break" },
      { name: "Galataport", type: "end" }
    ]
  },
  {
    title: "Balat Renkli Sokaklar",
    city: "istanbul",
    category: "street",
    duration_minutes: 120,
    distance_km: 2.0,
    start_point: "Balat Renkli Evler",
    end_point: "Fener Rum Patrikhanesi",
    route_points: [
      { name: "Balat Renkli Evler", type: "start" },
      { name: "Merdivenli Yokuş", type: "viewpoint" },
      { name: "Çıfıt Çarşısı", type: "photo_stop" },
      { name: "Balat Sahil", type: "break" },
      { name: "Fener Rum Patrikhanesi", type: "end" }
    ]
  }
];

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const groupRef = useMemoFirebase(() => (firestore && groupId) ? doc(firestore, 'groups', groupId as string) : null, [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading } = useDoc<Group>(groupRef);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const profilesQuery = useMemoFirebase(() => {
    if (!firestore || !group?.memberIds || group.memberIds.length === 0) return null;
    return query(collection(firestore, 'public_profiles'), where(documentId(), 'in', group.memberIds));
  }, [firestore, group?.memberIds]);
  const { data: memberProfiles } = useCollection<PublicUserProfile>(profilesQuery);

  const assignmentsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'assignments'), orderBy('createdAt', 'desc')) : null, [firestore, groupId]);
  const { data: assignments } = useCollection<GroupAssignment>(assignmentsQuery);

  const submissionsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'submissions'), orderBy('submittedAt', 'desc')) : null, [firestore, groupId]);
  const { data: submissions } = useCollection<GroupSubmission>(submissionsQuery);

  const tripsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'trips'), orderBy('created_at', 'desc')) : null, [firestore, groupId]);
  const { data: trips, isLoading: isTripsLoading } = useCollection<Trip>(tripsQuery);

  const [activeTab, setActiveTab] = useState('assignments');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<GroupSubmission | null>(null);

  const isCurrentUserOwner = group?.ownerId === user?.uid;

  useEffect(() => {
    if (group?.purpose === 'walk') {
      setActiveTab('trips');
    }
  }, [group?.purpose]);

  const handleUploadSubmission = async (assignment: GroupAssignment, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    setIsUploading(true);
    toast({ title: "Analiz Ediliyor...", description: "Luma ödevini değerlendiriyor." });
    try {
      const hash = Math.random().toString(36).substring(7);
      const storagePath = `groups/${group.id}/submissions/${assignment.id}/${user.uid}-${hash}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const aiResult = await evaluateGroupSubmission({
        photoUrl: url,
        assignmentTitle: assignment.title,
        assignmentDescription: assignment.description,
        language: "tr"
      });

      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      const userRef = doc(firestore, 'users', user.uid);
      
      batch.set(submissionRef, {
        id: submissionRef.id,
        groupId: group.id,
        assignmentId: assignment.id,
        userId: user.uid,
        userName: userProfile?.name || 'Sanatçı',
        userPhotoURL: userProfile?.photoURL || null,
        photoUrl: url,
        status: aiResult.isSuccess ? 'approved' : 'pending',
        likes: [],
        comments: [],
        aiFeedback: aiResult,
        submittedAt: new Date().toISOString()
      } as GroupSubmission);
      
      batch.update(userRef, { 'profile_index.activity_signals.group_activity_score': increment(10) });
      await batch.commit();
      toast({ title: "Ödev Teslim Edildi!" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAssignment = async (title: string, description: string) => {
    if (!firestore || !group) return;
    try {
      const docRef = await addDoc(collection(firestore, 'groups', group.id, 'assignments'), {
        groupId: group.id,
        title,
        description,
        createdAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Ödev Oluşturuldu" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleCreateTrip = async (tripData: any) => {
    if (!user || !firestore || !group) return;
    const batch = writeBatch(firestore);
    const tripRef = doc(collection(firestore, 'groups', group.id, 'trips'));
    
    try {
      const now = new Date().toISOString();
      batch.set(tripRef, {
        ...tripData,
        id: tripRef.id,
        groupId: group.id,
        mentorId: user.uid,
        status: 'planned',
        created_at: now
      });

      group.memberIds.forEach(memberId => {
        if (memberId !== user.uid) {
          const notifRef = doc(collection(firestore, 'users', memberId, 'notifications'));
          batch.set(notifRef, {
            type: "trip_created",
            tripId: tripRef.id,
            groupId: group.id,
            title: "Yeni Gezi Planı",
            message: `${tripData.title} gezisi planlandı.`,
            createdAt: now,
            read: false
          });
        }
      });

      await batch.commit();
      toast({ title: "Gezi Planı Yayınlandı!" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleUpdateTripStatus = async (tripId: string, newStatus: TripStatus) => {
    if (!user || !isCurrentUserOwner || !firestore || !group) return;
    const batch = writeBatch(firestore);
    const tripRef = doc(firestore, 'groups', group.id, 'trips', tripId);
    
    const now = new Date().toISOString();
    const updates: any = { status: newStatus };
    if (newStatus === 'completed') updates.completed_at = now;
    if (newStatus === 'cancelled') updates.cancelled_at = now;
    
    batch.update(tripRef, updates);

    group.memberIds.forEach(memberId => {
      if (memberId !== user.uid) {
        const notifRef = doc(collection(firestore, 'users', memberId, 'notifications'));
        batch.set(notifRef, {
          type: newStatus === 'cancelled' ? 'trip_cancelled' : 'trip_updated',
          tripId: tripId,
          groupId: group.id,
          title: "Gezi Güncellemesi",
          message: `${newStatus === 'cancelled' ? 'Gezi iptal edildi' : 'Gezi güncellendi'}`,
          createdAt: now,
          read: false
        });
      }
    });

    try {
      await batch.commit();
      toast({ title: "Durum Güncellendi" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleToggleLike = async (submission: GroupSubmission) => {
    if (!user || !firestore || !group) return;
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submission.id);
    const isLiked = submission.likes.includes(user.uid);
    try {
      await updateDoc(subRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch (e) { console.error(e); }
  };

  const copyJoinCode = () => {
    if (group?.joinCode) {
      navigator.clipboard.writeText(group.joinCode);
      toast({ title: "Kopyalandı!", description: "Grup katılım kodu kopyalandı." });
    }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group) return null;

  const purpose = PURPOSE_CONFIG[group.purpose || 'study'];

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-12 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/groups')} className="rounded-xl font-bold text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Gruplarım
        </Button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-5xl font-black tracking-tighter uppercase">{group.name}</h1>
              {isCurrentUserOwner && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black h-6 uppercase tracking-widest px-3">KURUCU</Badge>}
              <Badge variant="secondary" className={cn("px-3 h-6 text-[10px] font-black uppercase tracking-widest border-none", purpose.color)}>
                <purpose.icon size={12} className="mr-1.5" /> {purpose.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-lg font-medium">{group.description}</p>
              <div className="h-px w-4 bg-border mx-2" />
              <div 
                className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-lg border border-border/40 cursor-pointer hover:bg-muted transition-colors group"
                onClick={copyJoinCode}
              >
                <Hash size={14} className="text-primary" />
                <span className="text-sm font-black tracking-widest">{group.joinCode}</span>
                <Copy size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-secondary/30 px-6 py-3 rounded-2xl border border-border/40">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm"><Users size={20} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Toplam Üye</p>
              <p className="text-lg font-black">{group.memberIds.length} / {group.maxMembers}</p>
            </div>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <TabsList className="bg-secondary/30 p-1 rounded-2xl h-12 border border-border/40">
          <TabsTrigger value="trips" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Geziler</TabsTrigger>
          <TabsTrigger value="assignments" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Ödevler</TabsTrigger>
          <TabsTrigger value="gallery" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Galeri</TabsTrigger>
          <TabsTrigger value="members" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Grup Listesi</TabsTrigger>
          {isCurrentUserOwner && <TabsTrigger value="admin" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500">Kurucu Paneli</TabsTrigger>}
        </TabsList>

        <TabsContent value="trips" className="space-y-8">
          {isTripsLoading ? <Skeleton className="h-40 w-full rounded-3xl" /> : 
           trips && trips.length > 0 ? (
            <div className="grid gap-8">
              {trips.filter(t => t.status !== 'cancelled').map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  isOwner={isCurrentUserOwner} 
                  userId={user?.uid || ''} 
                  userProfile={userProfile || null}
                  groupId={group.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5">
              <Calendar className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
              <h3 className="text-2xl font-black tracking-tight uppercase">Planlanmış Gezi Yok</h3>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-8">
          {assignments && assignments.length > 0 ? (
            <div className="grid gap-6">
              {assignments.map(ass => {
                const userSubmission = submissions?.find(s => s.assignmentId === ass.id && s.userId === user?.uid);
                return (
                  <Card key={ass.id} className="rounded-[32px] border-border/40 overflow-hidden bg-card/50">
                    <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-2xl font-black uppercase tracking-tight">{ass.title}</CardTitle>
                          <p className="text-sm font-medium text-muted-foreground">{new Date(ass.createdAt).toLocaleDateString('tr-TR')} tarihinde verildi</p>
                        </div>
                        {userSubmission && (
                          <Badge className="bg-green-500 text-white font-black px-4 h-7 rounded-full uppercase tracking-widest text-[10px]"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Teslim Edildi</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                      <div className="bg-muted/20 p-6 rounded-2xl border border-dashed border-border/60 italic font-medium text-foreground/80 leading-relaxed">
                        "{ass.description}"
                      </div>
                      {!userSubmission ? (
                        <div className="pt-4">
                          <AssignmentUploader onUpload={(file) => handleUploadSubmission(ass, file)} isUploading={isUploading} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-6 p-6 rounded-[24px] bg-green-500/5 border border-green-500/20">
                          <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0">
                            <Image src={userSubmission.photoUrl} alt="Teslimatım" fill className="object-cover" unoptimized />
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-black tracking-tight text-green-500 uppercase">Görevi Başardın!</p>
                            <p className="text-sm text-muted-foreground font-medium">Ödevin başarıyla teslim edildi.</p>
                          </div>
                          <Button onClick={() => setSelectedSubmission(userSubmission)} variant="outline" className="rounded-xl h-10 px-6 font-bold">Detay</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><Info className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" /><h3 className="text-2xl font-black tracking-tight">Henüz Ödev Yok</h3></div>
          )}
        </TabsContent>

        <TabsContent value="gallery" className="space-y-8">
          {submissions && submissions.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {submissions.map(sub => (
                <Card key={sub.id} className="group relative aspect-square rounded-[32px] overflow-hidden border-none shadow-2xl transition-all hover:scale-[1.02] cursor-pointer" onClick={() => setSelectedSubmission(sub)}>
                  <Image src={sub.photoUrl} alt="Teslim" fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm"><AvatarImage src={sub.userPhotoURL || ''} /><AvatarFallback>{sub.userName?.charAt(0)}</AvatarFallback></Avatar>
                      <span className="text-xs font-black text-white">@{sub.userName}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><ImageIcon className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" /><h3 className="text-2xl font-black tracking-tight">Galeri Boş</h3></div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-8">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><Users className="text-primary h-6 w-6" /> Grup Listesi</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {group.memberIds.map(memberId => {
                  const profile = memberProfiles?.find(p => p.id === memberId);
                  const isOwner = memberId === group.ownerId;
                  return (
                    <div key={memberId} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-5">
                        <Avatar className="h-14 w-14 border-2 border-border/60"><AvatarImage src={profile?.photoURL || ''} /><AvatarFallback>{profile?.name?.charAt(0) || '?'}</AvatarFallback></Avatar>
                        <div>
                          <div className="text-lg font-black tracking-tight flex items-center gap-2">{profile?.name || 'Yükleniyor...'}{isOwner && <Crown size={14} className="text-amber-500" />}</div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{profile?.level_name || 'Neuner'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCurrentUserOwner && (
          <TabsContent value="admin" className="space-y-10">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl">
                  <CardHeader className="bg-primary/5 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><Map className="text-primary" /> Gezi Rotaları</CardTitle></CardHeader>
                  <CardContent className="p-8">
                    <EventCreator onCreate={handleCreateTrip} />
                  </CardContent>
                </Card>
                <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl">
                  <CardHeader className="bg-primary/5 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><PlusCircle className="text-primary" /> Yeni Ödev Ver</CardTitle></CardHeader>
                  <CardContent className="p-8">
                    <AssignmentCreator onCreate={handleCreateAssignment} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl">
                  <CardHeader className="bg-amber-500/5 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><Clock className="text-amber-500" /> Gezi Yönetimi</CardTitle></CardHeader>
                  <CardContent className="p-8">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-6">
                        {trips?.filter(t => t.status !== 'cancelled' && t.status !== 'archived').map(trip => (
                          <div key={trip.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-4">
                            <div className="flex justify-between items-center">
                              <p className="font-black uppercase text-sm truncate">{trip.title}</p>
                              <Badge variant="outline">{TRIP_STATUS_LABELS[trip.status]}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {trip.status === 'planned' && (
                                <>
                                  <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" onClick={() => handleUpdateTripStatus(trip.id, 'completed')}><CheckCircle size={14} className="mr-1"/> Bitir</Button>
                                  <Button size="sm" variant="destructive" className="h-8" onClick={() => handleUpdateTripStatus(trip.id, 'cancelled')}><Trash2 size={14} className="mr-1"/> İptal Et</Button>
                                </>
                              )}
                              {trip.status === 'completed' && <Button size="sm" variant="secondary" className="h-8" onClick={() => handleUpdateTripStatus(trip.id, 'archived')}><Archive size={14} className="mr-1"/> Arşivle</Button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0">
              <Image src={selectedSubmission.photoUrl} alt="Eser" fill className="object-contain" unoptimized />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src={selectedSubmission.userPhotoURL || ''} /><AvatarFallback>{selectedSubmission.userName?.charAt(0)}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-lg font-black tracking-tight">@{selectedSubmission.userName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(selectedSubmission.submittedAt).toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
                <DialogTitle className="text-2xl font-black uppercase">Luma Değerlendirmesi</DialogTitle>
              </DialogHeader>
              
              {selectedSubmission.aiFeedback && (
                <div className="space-y-6">
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">ÖDEV PUANI</p>
                      <p className="text-4xl font-black tracking-tighter text-primary">{selectedSubmission.aiFeedback.score}/10</p>
                    </div>
                    <Progress value={selectedSubmission.aiFeedback.score * 10} className="h-1.5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Luma Geri Bildirimi</p>
                    <p className="text-sm font-medium leading-relaxed italic text-foreground/90 bg-muted/20 p-4 rounded-xl border border-border/40">"{selectedSubmission.aiFeedback.feedback}"</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Teknik Kazanımlar</p>
                    <div className="grid gap-2">
                      {selectedSubmission.aiFeedback.technicalPoints.map((point, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 text-xs font-bold"><CheckCircle2 className="h-4 w-4 text-green-500" /> {point}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-6 border-t border-border/40 flex items-center justify-between">
                <Button variant="ghost" onClick={() => handleToggleLike(selectedSubmission)} className={cn("rounded-xl gap-2", selectedSubmission.likes.includes(user?.uid || '') && "text-red-500")}>
                  <Heart size={18} className={cn(selectedSubmission.likes.includes(user?.uid || '') && "fill-current")} />
                  <span className="font-black">{selectedSubmission.likes.length} Beğeni</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HELPER COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function TripCard({ trip, isOwner, userId, userProfile, groupId }: { trip: Trip, isOwner: boolean, userId: string, userProfile: User | null, groupId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const participantsQuery = useMemoFirebase(() => (firestore) ? collection(firestore, 'groups', groupId, 'trips', trip.id, 'participants') : null, [firestore, groupId, trip.id]);
  const { data: participants } = useCollection<TripParticipant>(participantsQuery);
  
  const mentorRef = useMemoFirebase(() => (firestore && trip.mentorId) ? doc(firestore, 'public_profiles', trip.mentorId) : null, [firestore, trip.mentorId]);
  const { data: mentorProfile } = useDoc<PublicUserProfile>(mentorRef);

  const myParticipantDoc = participants?.find(p => p.userId === userId);
  const myStatus = myParticipantDoc?.status || 'pending';

  const isContactVisible = useMemo(() => {
    if (isOwner) return true;
    if (trip.contact_visible === 'none') return false;
    if (trip.contact_visible === 'group_members') return true;
    if (trip.contact_visible === 'participants_only' && myStatus === 'yes') return true;
    return false;
  }, [trip.contact_visible, myStatus, isOwner]);

  const handleRSVP = async (status: ParticipantStatus) => {
    if (!firestore) return;
    const participantRef = doc(firestore, 'groups', groupId, 'trips', trip.id, 'participants', userId);
    try {
      await setDoc(participantRef, {
        userId,
        userName: userProfile?.name || 'Vizyoner',
        userPhotoURL: userProfile?.photoURL || null,
        status,
        joined_at: new Date().toISOString()
      });
      toast({ title: status === 'yes' ? "Geziye Katılıyorsun!" : "Geziden Ayrıldın" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const getGoogleMapsUrl = () => {
    const origin = encodeURIComponent(trip.startPoint);
    const destination = encodeURIComponent(trip.endPoint);
    const waypoints = trip.route_points?.filter(p => p.type !== 'start' && p.type !== 'end').map(p => encodeURIComponent(p.name)).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    return url;
  };

  return (
    <Card className={cn("rounded-[40px] border-border/40 overflow-hidden bg-card/50 shadow-2xl", trip.status === 'completed' && "opacity-80")}>
      <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black h-6 uppercase tracking-widest px-3">GEZİ PLANI</Badge>
            <CardTitle className="text-3xl font-black uppercase tracking-tighter">{trip.title}</CardTitle>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar size={14} className="text-primary" /><span className="text-xs font-bold">{trip.date}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Clock size={14} className="text-primary" /><span className="text-xs font-bold">{trip.time}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Users size={14} className="text-primary" /><span className="text-xs font-bold">{participants?.filter(p => p.status === 'yes').length || 0} / {trip.max_participants}</span></div>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-xl border-primary/20 h-9 text-xs"><a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" /> Rotayı Aç</a></Button>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-muted/20 border border-border/40 flex items-start gap-4">
              <MapPin className="text-primary mt-1 shrink-0" size={24} />
              <div className="space-y-4 w-full">
                <div><p className="text-[9px] font-black uppercase text-primary/70">Güzergah</p><p className="font-bold">{trip.startPoint} ➔ {trip.endPoint}</p></div>
                <div className="flex gap-4"><div className="bg-background/50 px-3 py-1 rounded-lg border border-border/40"><p className="text-[8px] font-black uppercase text-muted-foreground">Mesafe</p><p className="text-xs font-bold">{trip.distance}</p></div><div className="bg-background/50 px-3 py-1 rounded-lg border border-border/40"><p className="text-[8px] font-black uppercase text-muted-foreground">Süre</p><p className="text-xs font-bold">{trip.duration}</p></div></div>
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3"><MapPin size={18} className="text-primary" /><div><p className="text-[9px] font-black uppercase text-primary/70">Buluşma Noktası</p><p className="text-sm font-bold">{trip.meeting_point}</p></div></div>
              <div className="flex items-center gap-3"><Clock size={18} className="text-primary" /><div><p className="text-[9px] font-black uppercase text-primary/70">Saat</p><p className="text-sm font-bold">{trip.meeting_time}</p></div></div>
            </div>
            <p className="text-base italic text-foreground/80 leading-relaxed font-medium">"{trip.description}"</p>
          </div>
          <div className="space-y-6">
            <Card className="rounded-[24px] border-border/40 bg-secondary/10 overflow-hidden">
              <div className="p-4 border-b border-border/40 flex items-center gap-3"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src={mentorProfile?.photoURL || ''} /></Avatar><div><p className="text-[8px] font-black uppercase text-primary">MENTOR</p><p className="font-black">@{mentorProfile?.name}</p></div></div>
              <div className="p-4 space-y-2">
                {isContactVisible ? (
                  <div className="space-y-2 text-xs font-bold text-foreground/80">{mentorProfile?.phone && <div className="flex items-center gap-2"><Phone size={12} className="text-primary" /> {mentorProfile.phone}</div>}{mentorProfile?.instagram && <div className="flex items-center gap-2"><Instagram size={12} className="text-pink-500" /> @{mentorProfile.instagram}</div>}<div className="flex items-center gap-2"><Mail size={12} className="text-blue-400" /> {mentorProfile?.email}</div></div>
                ) : <div className="p-3 rounded-lg bg-muted/20 border border-dashed text-[10px] font-bold text-muted-foreground text-center">İletişim Bilgileri Gizli</div>}
              </div>
            </Card>
            <div className="flex gap-2"><Button onClick={() => handleRSVP('yes')} variant={myStatus === 'yes' ? 'default' : 'outline'} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase">Geliyorum</Button><Button onClick={() => handleRSVP('no')} variant={myStatus === 'no' ? 'default' : 'outline'} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase">Gelemem</Button></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCreator({ onCreate }: { onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({ title: '', description: '', startPoint: '', endPoint: '', meeting_point: '', meeting_time: '', date: '', time: '', duration: '', distance: '', approvalRequired: false, isListPublic: true, contact_visible: 'participants_only' as ContactVisible, max_participants: 15, route_points: [] as RoutePoint[] });
  const handleTemplateSelect = (title: string) => { const t = ISTANBUL_TEMPLATES.find(x => x.title === title); if (t) setFormData({ ...formData, title: t.title, startPoint: t.start_point, endPoint: t.end_point, meeting_point: t.start_point, duration: `${t.duration_minutes}dk`, distance: `${t.distance_km}km`, route_points: t.route_points }); };
  const handleCreate = () => { if (formData.title && formData.date) { onCreate(formData); setFormData({ title: '', description: '', startPoint: '', endPoint: '', meeting_point: '', meeting_time: '', date: '', time: '', duration: '', distance: '', approvalRequired: false, isListPublic: true, contact_visible: 'participants_only', max_participants: 15, route_points: [] }); } };
  return (
    <div className="space-y-4">
      <Select onValueChange={handleTemplateSelect}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rota Şablonu Seç..." /></SelectTrigger><SelectContent>{ISTANBUL_TEMPLATES.map(t => <SelectItem key={t.title} value={t.title}>{t.title}</SelectItem>)}</SelectContent></Select>
      <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Gezi Başlığı" className="rounded-xl h-11" />
      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Açıklama..." className="rounded-xl min-h-[80px]" />
      <div className="grid grid-cols-2 gap-2"><Input value={formData.meeting_point} onChange={e => setFormData({...formData, meeting_point: e.target.value})} placeholder="Buluşma Noktası" className="h-10" /><Input value={formData.meeting_time} onChange={e => setFormData({...formData, meeting_time: e.target.value})} placeholder="Buluşma Saati" className="h-10" /></div>
      <div className="grid grid-cols-2 gap-2"><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-10" /><Input type="number" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: parseInt(e.target.value)})} placeholder="Kişi Sayısı" className="h-10" /></div>
      <Button onClick={handleCreate} className="w-full h-12 rounded-xl font-black uppercase">Geziyi Yayınla</Button>
    </div>
  );
}

function AssignmentCreator({ onCreate }: { onCreate: (title: string, description: string) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const handleAdd = () => { if (title.trim() && desc.trim()) { onCreate(title, desc); setTitle(''); setDesc(''); } };
  return (<div className="space-y-4"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ödev Başlığı" className="rounded-xl h-11" /><Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Kurallar..." className="rounded-xl min-h-[100px]" /><Button onClick={handleAdd} className="w-full h-12 rounded-xl font-black uppercase">Ödevi Yayınla</Button></div>);
}

function AssignmentUploader({ onUpload, isUploading }: { onUpload: (file: File) => void, isUploading: boolean }) {
  const onDrop = useCallback((files: File[]) => { if (files.length > 0) onUpload(files[0]); }, [onUpload]);
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });
  return (<div {...getRootProps()} className="border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer hover:bg-primary/5"><input {...getInputProps()} /><div className="h-12 w-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-3">{isUploading ? <Loader2 className="animate-spin text-primary" /> : <ImageIcon size={24} />}</div><p className="font-black uppercase text-sm">Ödevini Teslim Et</p></div>);
}
