
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, documentId, addDoc, arrayUnion, orderBy, increment, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Group, PublicUserProfile, User, GroupAssignment, GroupSubmission, GroupPurpose, Trip, TripParticipant, ParticipantStatus, AnalysisLog } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, ImageIcon, Info, Heart, GraduationCap, Trophy, Map, MapPin, Calendar, Instagram, Phone, ShieldCheck, ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { evaluateGroupSubmission } from '@/ai/flows/evaluate-group-submission';
import { useAppConfig } from '@/components/AppConfigProvider';
import { Progress } from '@/components/ui/progress';
import { typography } from "@/lib/design/typography";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PURPOSE_CONFIG: Record<GroupPurpose, { label: string; icon: any; color: string }> = {
  study: { label: 'Eğitim', icon: GraduationCap, color: 'bg-blue-500/10 text-blue-400' },
  challenge: { label: 'Yarışma', icon: Trophy, color: 'bg-amber-500/10 text-amber-400' },
  walk: { label: 'Gezi', icon: Map, color: 'bg-green-500/10 text-green-400' },
  mentor: { label: 'Eğitimci', icon: ShieldCheck, color: 'bg-purple-500/10 text-purple-400' },
};

const ISTANBUL_TEMPLATES = [
  { title: "Galata - Karaköy Mimari Rota", start_point: "Galata Kulesi", end_point: "Galataport", duration_minutes: 90, distance_km: 1.5, route_points: [{ name: "Galata Kulesi", type: "start" }, { name: "Serdar-ı Ekrem Sokak", type: "photo_stop" }, { name: "Kamondo Merdivenleri", type: "photo_stop" }, { name: "Karaköy Sahil", type: "break" }, { name: "Galataport", type: "end" }] },
  { title: "Balat Renkli Sokaklar", start_point: "Balat Renkli Evler", end_point: "Fener Rum Patrikhanesi", duration_minutes: 120, distance_km: 2.0, route_points: [{ name: "Balat Renkli Evler", type: "start" }, { name: "Merdivenli Yokuş", type: "viewpoint" }, { name: "Çıfıt Çarşısı", type: "photo_stop" }, { name: "Balat Sahil", type: "break" }, { name: "Fener Rum Patrikhanesi", type: "end" }] }
];

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('assignments');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<GroupSubmission | null>(null);

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

  useEffect(() => {
    if (group?.purpose === 'walk') setActiveTab('trips');
  }, [group?.purpose]);

  const isCurrentUserOwner = group?.ownerId === user?.uid;

  const handleUploadSubmission = async (assignment: GroupAssignment, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    setIsUploading(true);
    toast({ title: "Analiz Ediliyor..." });
    try {
      const storagePath = `groups/${group.id}/submissions/${assignment.id}/${user.uid}-${Date.now()}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const aiResult = await evaluateGroupSubmission({ photoUrl: url, assignmentTitle: assignment.title, assignmentDescription: assignment.description, language: "tr" });
      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      batch.set(submissionRef, { id: submissionRef.id, groupId: group.id, assignmentId: assignment.id, userId: user.uid, userName: userProfile?.name || 'Sanatçı', userPhotoURL: userProfile?.photoURL || null, photoUrl: url, status: aiResult.isSuccess ? 'approved' : 'pending', likes: [], comments: [], aiFeedback: aiResult, submittedAt: new Date().toISOString() });
      await batch.commit();
      toast({ title: "Ödev Teslim Edildi!" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsUploading(false); }
  };

  const handleCreateTrip = async (tripData: any) => {
    if (!user || !firestore || !group) return;
    try {
      const tripRef = doc(collection(firestore, 'groups', group.id, 'trips'));
      await setDoc(tripRef, { ...tripData, id: tripRef.id, groupId: group.id, mentorId: user.uid, status: 'planned', created_at: new Date().toISOString() });
      toast({ title: "Gezi Planı Yayınlandı!" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 py-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group) return null;

  const purpose = PURPOSE_CONFIG[group.purpose || 'study'];

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-12 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/groups')} className="rounded-xl font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplarım</Button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-5xl font-black tracking-tighter uppercase">{group.name}</h1>
              <Badge variant="secondary" className={cn("px-3 h-6 text-[10px] font-black uppercase tracking-widest border-none", purpose.color)}><purpose.icon size={12} className="mr-1.5" /> {purpose.label}</Badge>
            </div>
            <p className="text-muted-foreground text-lg font-medium">{group.description}</p>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <div className="relative filter-scroll">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth">
            <TabsList className="inline-flex w-max bg-secondary/30 p-1 rounded-2xl h-12 border border-border/40 gap-1 px-1">
              <TabsTrigger value="trips" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Geziler</TabsTrigger>
              <TabsTrigger value="assignments" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Ödevler</TabsTrigger>
              <TabsTrigger value="gallery" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Galeri</TabsTrigger>
              <TabsTrigger value="members" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Üyeler</TabsTrigger>
              {isCurrentUserOwner && <TabsTrigger value="admin" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500">Yönetim</TabsTrigger>}
            </TabsList>
          </div>
        </div>

        <TabsContent value="trips" className="space-y-8">
          {isTripsLoading ? <Skeleton className="h-40 w-full rounded-3xl" /> : 
           trips && trips.length > 0 ? (
            <div className="grid gap-8">{trips.filter(t => t.status !== 'cancelled').map(trip => <TripCard key={trip.id} trip={trip} isOwner={isCurrentUserOwner} userId={user?.uid || ''} userProfile={userProfile || null} groupId={group.id} />)}</div>
          ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><Calendar className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" /><h3 className="text-2xl font-black uppercase">Planlanmış Gezi Yok</h3></div>}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-8">
          {assignments && assignments.length > 0 ? (
            <div className="grid gap-6">
              {assignments.map(ass => {
                const userSubmission = submissions?.find(s => s.assignmentId === ass.id && s.userId === user?.uid);
                return (
                  <Card key={ass.id} className="rounded-[32px] border-border/40 overflow-hidden bg-card/50">
                    <CardHeader className="bg-secondary/20 p-8 border-b border-border/40"><CardTitle className="text-2xl font-black uppercase tracking-tight">{ass.title}</CardTitle></CardHeader>
                    <CardContent className="p-8 space-y-8">
                      <div className="bg-muted/20 p-6 rounded-2xl border border-dashed border-border/60 italic font-medium text-foreground/80">"{ass.description}"</div>
                      {!userSubmission ? <AssignmentUploader onUpload={(file) => handleUploadSubmission(ass, file)} isUploading={isUploading} /> : 
                        <div className="flex items-center gap-6 p-6 rounded-[24px] bg-green-500/5 border border-green-500/20">
                          <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0"><Image src={userSubmission.photoUrl} alt="Teslimatım" fill className="object-cover" unoptimized /></div>
                          <div className="flex-1"><p className="text-lg font-black tracking-tight text-green-500 uppercase">Ödev Teslim Edildi!</p></div>
                          <Button onClick={() => setSelectedSubmission(userSubmission)} variant="outline" className="rounded-xl h-10 px-6 font-bold">Detay</Button>
                        </div>
                      }
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><Info size={64} className="mx-auto mb-6 text-muted-foreground/20" /></div>}
        </TabsContent>

        <TabsContent value="gallery" className="space-y-8">
          {submissions && submissions.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {submissions.map(sub => (
                <Card key={sub.id} className="group relative aspect-square rounded-[32px] overflow-hidden cursor-pointer" onClick={() => setSelectedSubmission(sub)}>
                  <Image src={sub.photoUrl} alt="Teslim" fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <Avatar className="h-6 w-6"><AvatarImage src={sub.userPhotoURL || ''} /></Avatar><span className="text-[10px] font-black text-white">@{sub.userName}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><ImageIcon size={64} className="mx-auto mb-6 text-muted-foreground/20" /></div>}
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberProfiles?.map(profile => (
              <Card key={profile.id} className="p-4 rounded-2xl border-border/40 bg-card/50 flex items-center gap-4">
                <Avatar><AvatarImage src={profile.photoURL || ''} /></Avatar>
                <div><p className="font-bold">@{profile.name}</p><p className="text-[10px] uppercase font-black text-primary">{profile.level_name}</p></div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {isCurrentUserOwner && (
          <TabsContent value="admin" className="space-y-10">
            <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl"><CardHeader className="bg-primary/5 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><Map className="text-primary" /> Gezi Planla</CardTitle></CardHeader><CardContent className="p-8"><EventCreator onCreate={handleCreateTrip} /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-4xl max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row rounded-[32px] md:rounded-[48px]">
            <div className="relative w-full md:w-3/5 h-[35vh] md:h-auto bg-black/40 shrink-0"><Image src={selectedSubmission.photoUrl} alt="Eser" fill className="object-contain" unoptimized /></div>
            <div className="flex-1 md:w-2/5 flex flex-col p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-4"><Avatar className="h-10 w-10"><AvatarImage src={selectedSubmission.userPhotoURL || ''} /></Avatar><div><p className="text-lg font-black tracking-tight">@{selectedSubmission.userName}</p></div></div>
                <DialogTitle className="text-2xl font-black uppercase">Değerlendirme</DialogTitle>
              </DialogHeader>
              {selectedSubmission.aiFeedback && (
                <div className="space-y-6">
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/20 space-y-4 shadow-inner">
                    <div className="flex justify-between items-end"><p className="text-[10px] font-black uppercase text-primary tracking-widest">PUAN</p><p className="text-4xl font-black tracking-tighter text-primary">{selectedSubmission.aiFeedback.score}/10</p></div>
                    <Progress value={selectedSubmission.aiFeedback.score * 10} className="h-1.5" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed italic text-foreground/90 bg-muted/20 p-4 rounded-xl">"{selectedSubmission.aiFeedback.feedback}"</p>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function TripCard({ trip, isOwner, userId, userProfile, groupId }: { trip: Trip, isOwner: boolean, userId: string, userProfile: User | null, groupId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const participantsQuery = useMemoFirebase(() => (firestore) ? collection(firestore, 'groups', groupId, 'trips', trip.id, 'participants') : null, [firestore, groupId, trip.id]);
  const { data: participants } = useCollection<TripParticipant>(participantsQuery);
  const mentorRef = useMemoFirebase(() => (firestore && trip.mentorId) ? doc(firestore, 'public_profiles', trip.mentorId) : null, [firestore, trip.mentorId]);
  const { data: mentorProfile } = useDoc<PublicUserProfile>(mentorRef);
  
  const myStatus = participants?.find(p => p.userId === userId)?.status || 'pending';
  
  const handleRSVP = async (status: ParticipantStatus) => {
    if (!firestore) return;
    try { await setDoc(doc(firestore, 'groups', groupId, 'trips', trip.id, 'participants', userId), { userId, userName: userProfile?.name || 'Vizyoner', userPhotoURL: userProfile?.photoURL || null, status, joined_at: new Date().toISOString() }); toast({ title: "RSVP Güncellendi" }); } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };
  
  return (
    <Card className="rounded-[40px] border-border/40 overflow-hidden bg-card/50 shadow-2xl">
      <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2"><Badge variant="outline" className="text-primary font-black uppercase tracking-widest px-3">GEZİ PLANI</Badge><CardTitle className="text-3xl font-black uppercase tracking-tighter">{trip.title}</CardTitle></div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-muted/20 border border-border/40 flex items-start gap-4"><MapPin className="text-primary mt-1" /><div className="space-y-4"><div><p className="text-[9px] font-black uppercase text-primary/70">Güzergah</p><p className="font-bold">{trip.startPoint} ➔ {trip.endPoint}</p></div></div></div>
            <p className="text-base font-medium">"{trip.description}"</p>
          </div>
          <div className="space-y-6">
            <Card className="rounded-[24px] border-border/40 bg-secondary/10 p-4 flex items-center gap-3"><Avatar><AvatarImage src={mentorProfile?.photoURL || ''} /></Avatar><div><p className="text-[8px] font-black uppercase text-primary">MENTOR</p><p className="font-black">@{mentorProfile?.name}</p></div></Card>
            <div className="flex gap-2"><Button onClick={() => handleRSVP('yes')} variant={myStatus === 'yes' ? 'default' : 'outline'} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase">Geliyorum</Button><Button onClick={() => handleRSVP('no')} variant={myStatus === 'no' ? 'default' : 'outline'} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase">Gelemem</Button></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCreator({ onCreate }: { onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({ title: '', description: '', startPoint: '', endPoint: '', date: '', max_participants: 15 });
  const handleTemplateSelect = (title: string) => { const t = ISTANBUL_TEMPLATES.find(x => x.title === title); if (t) setFormData({ ...formData, title: t.title, startPoint: t.start_point, endPoint: t.end_point }); };
  return (
    <div className="space-y-4">
      <Select onValueChange={handleTemplateSelect}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rota Şablonu Seç..." /></SelectTrigger><SelectContent>{ISTANBUL_TEMPLATES.map(t => <SelectItem key={t.title} value={t.title}>{t.title}</SelectItem>)}</SelectContent></Select>
      <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Gezi Başlığı" className="rounded-xl h-11" />
      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Açıklama..." className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2"><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-10" /><Input type="number" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: parseInt(e.target.value)})} placeholder="Kişi Sayısı" className="h-10" /></div>
      <Button onClick={() => onCreate(formData)} className="w-full h-12 rounded-xl font-black uppercase">Geziyi Yayınla</Button>
    </div>
  );
}

function AssignmentUploader({ onUpload, isUploading }: { onUpload: (file: File) => void, isUploading: boolean }) {
  const onDrop = useCallback((files: File[]) => { if (files.length > 0) onUpload(files[0]); }, [onUpload]);
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });
  return (<div {...getRootProps()} className="border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer hover:bg-primary/5"><input {...getInputProps()} /><div className="h-12 w-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-3">{isUploading ? <Loader2 className="animate-spin text-primary" /> : <ImageIcon size={24} />}</div><p className="font-black uppercase text-sm">Ödevini Teslim Et</p></div>);
}
