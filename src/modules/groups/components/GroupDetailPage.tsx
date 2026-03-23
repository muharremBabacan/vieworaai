
'use client';
import React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter, Link } from "@/navigation";
import { useTranslations } from "next-intl";

import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase
} from "@/lib/firebase";

import {
  doc,
  collection,
  query,
  where,
  documentId,
  orderBy,
  increment,
  writeBatch,
  getDoc,
  setDoc
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import type {
  Group,
  PublicUserProfile,
  User,
  GroupAssignment,
  GroupSubmission,
  GroupPurpose,
  Trip,
  TripParticipant,
  ParticipantStatus,
  AnalysisLog
} from "@/types";

import { useToast } from "@/shared/hooks/use-toast";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";

import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Loader2,
  Users,
  ImageIcon,
  Info,
  GraduationCap,
  Trophy,
  Map,
  MapPin,
  ShieldCheck,
  ArrowLeft,
  X,
  Calendar,
  Clock,
  Hash,
  Camera,
  Coffee,
  Eye,
  Flag
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useDropzone } from "react-dropzone";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

import { evaluateGroupSubmission } from "@/ai/flows/evaluate-group-submission";

import { useAppConfig } from "@/components/AppConfigProvider";
import { Progress } from "@/components/ui/progress";
import { typography } from "@/lib/design/typography";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
const PURPOSE_CONFIG: Record<GroupPurpose, { labelKey: string; icon: any; color: string }> = {
  study: { labelKey: 'purpose_study', icon: GraduationCap, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  challenge: { labelKey: 'purpose_challenge', icon: Trophy, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  walk: { labelKey: 'purpose_walk', icon: Map, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mentor: { labelKey: 'purpose_mentor', icon: ShieldCheck, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

const TYPE_MAP: Record<string, { icon: any, labelKey: string, color: string }> = {
  start: { icon: MapPin, labelKey: "type_start", color: "text-primary" },
  photo_stop: { icon: Camera, labelKey: "type_photo_stop", color: "text-amber-400" },
  break: { icon: Coffee, labelKey: "type_break", color: "text-blue-400" },
  viewpoint: { icon: Eye, labelKey: "type_viewpoint", color: "text-green-400" },
  end: { icon: Flag, labelKey: "type_end", color: "text-primary" },
};

const ISTANBUL_TEMPLATES = [
  { title: "template_galata_title", start_point: "Galata Kulesi", end_point: "Galataport", duration_minutes: 90, distance_km: 1.5, route_points: [{ name: "Galata Kulesi", type: "start" }, { name: "Serdar-ı Ekrem Sokak", type: "photo_stop" }, { name: "Kamondo Merdivenleri", type: "photo_stop" }, { name: "Karaköy Sahil", type: "break" }, { name: "Galataport", type: "end" }] },
  { title: "template_balat_title", start_point: "Balat Renkli Evler", end_point: "Fener Rum Patrikhanesi", duration_minutes: 120, distance_km: 2.0, route_points: [{ name: "Balat Renkli Evler", type: "start" }, { name: "Merdivenli Yokuş", type: "viewpoint" }, { name: "Çıfıt Çarşısı", type: "photo_stop" }, { name: "Balat Sahil", type: "break" }, { name: "Fener Rum Patrikhanesi", type: "end" }] }
];

export default function GroupDetailPage() {
  const { groupId, locale } = useParams();
  const t = useTranslations('GroupDetailPage');
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('assignments');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<GroupSubmission | null>(null);

  // 🪝 ALL HOOKS AT TOP
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
    if (group?.purpose === 'walk' && activeTab === 'assignments') {
      setActiveTab('trips');
    }
  }, [group?.purpose, activeTab]);

  const isCurrentUserOwner = group?.ownerId === user?.uid;

  const handleUploadSubmission = async (assignment: GroupAssignment, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    setIsUploading(true);
    toast({ title: t('toast_analyzing') });
    try {
      const storagePath = `groups/${group.id}/submissions/${assignment.id}/${user.uid}-${Date.now()}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const aiResult = await evaluateGroupSubmission({ photoUrl: url, assignmentTitle: assignment.title, assignmentDescription: assignment.description, language: (locale as string) || "tr" });
      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      batch.set(submissionRef, { id: submissionRef.id, groupId: group.id, assignmentId: assignment.id, userId: user.uid, userName: userProfile?.name || t('anonymous_artist'), userPhotoURL: userProfile?.photoURL || null, photoUrl: url, status: aiResult.isSuccess ? 'approved' : 'pending', likes: [], comments: [], aiFeedback: aiResult, submittedAt: new Date().toISOString() });
      await batch.commit();
      toast({ title: t('assignment_success_title') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); } finally { setIsUploading(false); }
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
    <div className="container mx-auto px-4 pt-8 pb-32 animate-in fade-in duration-700">
      <header className="mb-8 relative">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground hover:text-foreground transition-all cursor-pointer mb-6" onClick={() => router.push('/groups')}>
          <ArrowLeft size={10} /> {t('button_go_back')}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{group.name}</h1>
              <div className="flex gap-2">
                {isCurrentUserOwner && (
                  <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/30 font-black uppercase tracking-widest px-3 h-6 text-[9px]">{t('badge_founder')}</Badge>
                )}
                <Badge variant="secondary" className={cn("px-3 h-6 text-[9px] font-black uppercase tracking-widest border", purpose.color)}>
                  <purpose.icon size={10} className="mr-1.5" /> {t(purpose.labelKey)}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-muted-foreground font-medium text-sm max-w-2xl">{group.description}</p>
              {group.joinCode && (
                <div className="bg-[#121214] border border-white/5 rounded-full px-4 h-8 flex items-center gap-2 shadow-xl cursor-pointer hover:bg-white/5 transition-colors" onClick={() => { navigator.clipboard.writeText(group.joinCode!); toast({ title: t('toast_copied_title') }); }}>
                  <Hash size={10} className="text-primary" />
                  <span className="text-[11px] font-black tracking-[0.2em]">{group.joinCode}</span>
                </div>
              )}
            </div>
          </div>

          <Card className="bg-[#121214]/60 border border-white/5 rounded-3xl p-4 min-w-[160px] shadow-2xl flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
              <Users size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">{t('label_total_members')}</p>
              <p className="text-xl font-black tracking-tighter italic">{group.memberIds.length} / {group.maxMembers}</p>
            </div>
          </Card>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <div className="relative filter-scroll">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x">
            <TabsList className="inline-flex w-max bg-[#121214]/60 backdrop-blur-xl p-1 rounded-2xl h-12 border border-white/5 gap-1 shadow-2xl overflow-hidden">
              <TabsTrigger value="trips" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_trips')}</TabsTrigger>
              <TabsTrigger value="assignments" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_assignments')}</TabsTrigger>
              <TabsTrigger value="gallery" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_gallery')}</TabsTrigger>
              <TabsTrigger value="members" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_members')}</TabsTrigger>
              {isCurrentUserOwner && <TabsTrigger value="admin" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500 data-[state=active]:bg-amber-500/10 transition-all">{t('tab_admin')}</TabsTrigger>}
            </TabsList>
          </div>
        </div>

        <TabsContent value="trips" className="space-y-8">
          {isTripsLoading ? <Skeleton className="h-40 w-full rounded-3xl" /> :
            trips && trips.length > 0 ? (
              <div className="grid gap-8">{trips.filter(t => t.status !== 'cancelled').map(trip => <TripCard key={trip.id} trip={trip} isOwner={isCurrentUserOwner} userId={user?.uid || ''} userProfile={userProfile || null} groupId={group.id} />)}</div>
            ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><Calendar className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" /><h3 className="text-2xl font-black uppercase">{t('trips_empty_title')}</h3></div>}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-8">
          {assignments && assignments.length > 0 ? (
            <div className="grid gap-6">
              {assignments.map(ass => {
                const userSubmission = submissions?.find(s => s.assignmentId === ass.id && s.userId === user?.uid);
                return (
                  <Card key={ass.id} className="rounded-[40px] border-white/5 overflow-hidden bg-[#121214]/40 backdrop-blur-xl shadow-2xl transition-all hover:border-primary/20">
                    <CardHeader className="bg-primary/5 p-10 border-b border-white/5">
                      <CardTitle className="text-2xl font-black uppercase tracking-tighter drop-shadow-lg">{t('tab_assignments')}: {ass.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                      <div className="bg-white/5 p-8 rounded-[32px] border border-dashed border-white/10 italic font-medium text-foreground/90 leading-relaxed text-lg shadow-inner">
                        "{ass.description}"
                      </div>
                      {!userSubmission ? <AssignmentUploader onUpload={(file) => handleUploadSubmission(ass, file)} isUploading={isUploading} /> :
                        <div className="flex flex-col md:flex-row items-center gap-8 p-10 rounded-[32px] bg-green-500/5 border border-green-500/20 shadow-xl">
                          <div className="relative h-32 w-32 rounded-3xl overflow-hidden border-4 border-green-500/20 shadow-2xl shrink-0">
                            <Image src={userSubmission.photoUrl} alt="Teslimatım" fill className="object-cover" unoptimized />
                          </div>
                          <div className="flex-grow text-center md:text-left">
                            <p className="text-2xl font-black tracking-tight text-green-500 uppercase mb-2">{t('assignment_success_title')}</p>
                            <p className="text-muted-foreground font-medium italic">{t('assignment_success_description')}</p>
                          </div>
                          <Button onClick={() => setSelectedSubmission(userSubmission)} className="rounded-2xl h-14 px-10 font-black uppercase tracking-wider shadow-lg">{t('assignment_button_detail')}</Button>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {submissions.map(sub => (
                <Card key={sub.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer border border-white/10 shadow-2xl transition-all hover:scale-[1.02] hover:border-primary/30" onClick={() => setSelectedSubmission(sub)}>
                  <Image src={sub.photoUrl} alt="Teslim" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                    <Avatar className="h-10 w-10 border-2 border-white/50 shadow-xl overflow-hidden">
                      <AvatarImage src={sub.userPhotoURL || ''} />
                      <AvatarFallback className="bg-primary/20 text-[10px] font-black">{sub.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white uppercase tracking-tighter drop-shadow-lg">@{sub.userName}</span>
                      <span className="text-[10px] font-medium text-primary-foreground/70">{new Date(sub.submittedAt).toLocaleDateString('tr')}</span>
                    </div>
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
            <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl"><CardHeader className="bg-primary/5 p-8 border-b border-border/40"><CardTitle className="text-xl font-black flex items-center gap-3"><Map className="text-primary" /> {t('admin_card_title')}</CardTitle></CardHeader><CardContent className="p-8"><EventCreator onCreate={handleCreateTrip} /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl flex flex-col md:flex-row rounded-[48px] shadow-3xl">
            <div className="relative w-full md:w-3/5 h-[45vh] md:h-auto bg-black/60 shrink-0 border-r border-white/5 shadow-2xl overflow-hidden group">
              <Image src={selectedSubmission.photoUrl} alt="Eser" fill className="object-contain transition-transform duration-1000 group-hover:scale-[1.02]" unoptimized />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-10 space-y-8 overflow-y-auto">
              <header className="space-y-6">
                <div className="flex items-center gap-4 py-4 border-y border-white/5 translate-y-2">
                  <Avatar className="h-14 w-14 border-4 border-white/10 shadow-2xl">
                    <AvatarImage src={selectedSubmission.userPhotoURL || ''} />
                    <AvatarFallback className="bg-primary/20">{selectedSubmission.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xl font-black tracking-tighter uppercase mb-0.5">@{selectedSubmission.userName}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{new Date(selectedSubmission.submittedAt).toLocaleString('tr')}</p>
                  </div>
                </div>
              </header>

              <div className="space-y-8 pt-4">
                <div className="text-center space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground/60">{t('dialog_eval_title')}</h3>
                  <div className="relative h-24 w-24 mx-auto flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
                      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={276} strokeDashoffset={276 - (276 * (selectedSubmission.aiFeedback?.score || 0)) / 10} className="text-primary transition-all duration-1000" />
                    </svg>
                    <span className="text-3xl font-black tracking-tighter">{selectedSubmission.aiFeedback?.score}/10</span>
                  </div>
                </div>

                {selectedSubmission.aiFeedback && (
                  <div className="p-8 rounded-[32px] bg-primary/5 border border-primary/20 shadow-inner">
                    <p className="text-base font-medium leading-relaxed italic text-foreground/90 font-serif">
                      "{selectedSubmission.aiFeedback.feedback}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function TripCard({ trip, isOwner, userId, userProfile, groupId }: { trip: Trip, isOwner: boolean, userId: string, userProfile: User | null, groupId: string }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { toast } = useToast();

  const participantsQuery = useMemoFirebase(() => (firestore) ? collection(firestore, 'groups', groupId, 'trips', trip.id, 'participants') : null, [firestore, groupId, trip.id]);
  const { data: participants } = useCollection<TripParticipant>(participantsQuery);
  const mentorRef = useMemoFirebase(() => (firestore && trip.mentorId) ? doc(firestore, 'public_profiles', trip.mentorId) : null, [firestore, trip.mentorId]);
  const { data: mentorProfile } = useDoc<PublicUserProfile>(mentorRef);

  const myStatus = participants?.find(p => p.userId === userId)?.status || 'pending';
  const handleRSVP = async (status: ParticipantStatus) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'groups', groupId, 'trips', trip.id, 'participants', userId), {
        userId,
        userName: userProfile?.name || 'Vizyoner',
        userPhotoURL: userProfile?.photoURL || null,
        status,
        joined_at: new Date().toISOString()
      });
      toast({ title: t('toast_rsvp_updated') });
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast_error') });
    }
  };

  const openNavigation = () => {
    if (!trip.startPoint || !trip.endPoint) {
      toast({ title: t('toast_route_missing') });
      return;
    }
    const origin = encodeURIComponent(trip.startPoint);
    const destination = encodeURIComponent(trip.endPoint);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;

    if (trip.route_points && trip.route_points.length > 2) {
      const waypoints = trip.route_points
        .slice(1, -1)
        .map(p => encodeURIComponent(p.name))
        .join('|');
      url += `&waypoints=${waypoints}`;
    }
    window.open(url, '_blank');
  };

  return (
    <Card className="rounded-[48px] border-white/5 overflow-hidden bg-[#121214]/40 backdrop-blur-3xl shadow-3xl border transition-all hover:bg-[#121214]/60">
      <CardContent className="p-8 md:p-12 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4 flex-1">
            <Badge className="bg-primary/10 text-primary border border-primary/20 font-black uppercase tracking-[0.2em] px-3 h-6 text-[9px]">{t('trip_card_badge')}</Badge>
            <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter drop-shadow-2xl">{trip.title}</h3>

            <div className="flex flex-wrap items-center gap-6 text-muted-foreground/80">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Calendar size={14} className="text-primary" /> {new Date(trip.date).toLocaleDateString('tr')}</div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Clock size={14} className="text-primary" /> {trip.meeting_time || trip.time || '10:00'}</div>
              {trip.duration && <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Clock size={14} className="text-primary" /> {trip.duration}</div>}
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Map size={14} className="text-primary" /> {trip.distance?.toLowerCase().includes('km') ? trip.distance : `${trip.distance || '3.5'} KM`}</div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Users size={14} className="text-primary" /> {participants?.length || 0} / {trip.max_participants}</div>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-auto items-end">
            <Badge className="bg-blue-600 text-white font-black uppercase tracking-widest px-6 h-9 shadow-lg">{t('comp_card_status_active')}</Badge>
            <Button
              onClick={openNavigation}
              variant="outline"
              className="h-11 border-white/10 bg-black/40 rounded-2xl font-black uppercase tracking-widest text-[9px] px-6 shadow-2xl transition-all hover:bg-white/5 active:scale-95 group"
            >
              <MapPin size={14} className="mr-2 text-primary group-hover:scale-110 transition-transform" /> {t('button_open_route')}
            </Button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-10">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Route Info */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{t('trip_card_route_label')}</p>
                <div className="bg-black/40 rounded-[32px] p-8 border border-white/5 space-y-6 shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                  <div className="flex gap-4">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20"><MapPin size={14} className="text-primary" /></div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-primary/70 tracking-widest">{t('type_start')}</p>
                      <p className="font-bold text-lg">{trip.startPoint || t('not_determined')}</p>
                    </div>
                  </div>

                  {trip.route_points && trip.route_points.length > 2 && (
                    <ul className="pl-12 space-y-6 relative">
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/5 border-dashed border-l" />
                      {trip.route_points.slice(1, -1).map((point, idx) => {
                        const config = TYPE_MAP[point.type] || TYPE_MAP.photo_stop;
                        return (
                          <li key={idx} className="relative group/point">
                            <div className="absolute -left-[45px] top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center z-10 shadow-xl transition-all group-hover/point:border-primary/40 group-hover/point:scale-110">
                              <config.icon size={14} className={config.color} />
                            </div>
                            <div className="space-y-1">
                              <p className={cn("text-[9px] font-black uppercase tracking-widest", config.color)}>{t(config.labelKey)}</p>
                              <p className="font-bold text-base text-foreground/90">{point.name}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex gap-4">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20"><Flag size={14} className="text-primary" /></div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-primary/70 tracking-widest">{t('type_end')}</p>
                      <p className="font-bold text-lg">{trip.endPoint || t('not_determined')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meeting Details */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">BULUŞMA DETAYLARI</p>
                <div className="bg-black/40 rounded-[32px] p-8 border border-white/5 space-y-8 shadow-inner relative overflow-hidden">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xl"><MapPin size={18} className="text-blue-400" /></div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">BULUŞMA NOKTASI</p>
                      <p className="font-black text-xl tracking-tight">{trip.meeting_point || trip.startPoint}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xl"><Clock size={18} className="text-amber-400" /></div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">{t('trip_meeting_time')}</p>
                      <p className="font-black text-xl tracking-tight">{trip.meeting_time || trip.time || "10:00"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{t('form_label_comp_description')}</p>
              <p className="text-xl font-medium italic leading-relaxed text-foreground/80 border-l-4 border-primary/20 pl-10 font-serif">
                "{trip.description}"
              </p>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-10">
            <div className="bg-[#0a0a0b]/40 rounded-[40px] border border-white/5 p-8 space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                <ShieldCheck size={120} />
              </div>

              <header className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-4 border-white/10 shadow-2xl">
                  <AvatarImage src={mentorProfile?.photoURL || ''} />
                  <AvatarFallback className="bg-primary/20 font-black">{mentorProfile?.name?.[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">{t('trip_card_mentor_label')}</p>
                  <p className="text-2xl font-black tracking-tighter uppercase">@{mentorProfile?.name || 'Admin'}</p>
                </div>
              </header>

              <div className="space-y-6 pt-6 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mb-2">{t('label_contact_info')}</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm font-bold text-foreground/80 hover:text-primary transition-colors cursor-pointer group/item">
                    <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-primary/30"><Loader2 size={14} className="text-muted-foreground" /></div>
                    {mentorProfile?.phone || "5334697202"}
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold text-foreground/80 hover:text-primary transition-colors cursor-pointer group/item">
                    <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-primary/30"><ImageIcon size={14} className="text-muted-foreground" /></div>
                    @{mentorProfile?.instagram || "muharrembabacan"}
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold text-foreground/80 hover:text-primary transition-colors cursor-pointer group/item">
                    <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-primary/30"><Info size={14} className="text-muted-foreground" /></div>
                    {mentorProfile?.email || "admin@viewora.ai"}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center text-muted-foreground/60">{t('label_participant_status')}</p>
              <div className="flex gap-4">
                <Button onClick={() => handleRSVP('yes')} className={cn("flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl border", myStatus === 'yes' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/10 hover:bg-white/5')}>
                  {t('trip_card_button_yes')}
                </Button>
                <Button onClick={() => handleRSVP('no')} className={cn("flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl border", myStatus === 'no' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-600/80 text-white border-white/10 hover:bg-blue-600 font-bold')}>
                  {t('trip_card_button_no')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCreator({ onCreate }: { onCreate: (data: any) => void }) {
  const t = useTranslations('GroupDetailPage');
  const [formData, setFormData] = useState({ title: '', description: '', startPoint: '', endPoint: '', date: '', max_participants: 15 });
  const handleTemplateSelect = (title: string) => { const t = ISTANBUL_TEMPLATES.find(x => x.title === title); if (t) setFormData({ ...formData, title: t.title, startPoint: t.start_point, endPoint: t.end_point }); };
  return (
    <div className="space-y-4">
      <Select onValueChange={handleTemplateSelect}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t('admin_form_route_placeholder')} /></SelectTrigger><SelectContent>{ISTANBUL_TEMPLATES.map(tmpl => <SelectItem key={tmpl.title} value={tmpl.title}>{t(tmpl.title)}</SelectItem>)}</SelectContent></Select>
      <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder={t('admin_form_title_placeholder')} className="rounded-xl h-11" />
      <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('admin_form_desc_placeholder')} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10" />
        <Input 
          type="number" 
          value={isNaN(formData.max_participants) ? '' : formData.max_participants} 
          onChange={e => {
            const val = e.target.value === '' ? NaN : parseInt(e.target.value);
            setFormData({ ...formData, max_participants: val });
          }} 
          placeholder={t('admin_form_count_placeholder')} 
          className="h-10" 
        />
      </div>
      <Button onClick={() => onCreate(formData)} className="w-full h-12 rounded-xl font-black uppercase">{t('admin_button_publish')}</Button>
    </div>
  );
}

function AssignmentUploader({ onUpload, isUploading }: { onUpload: (file: File) => void, isUploading: boolean }) {
  const t = useTranslations('GroupDetailPage');
  const onDrop = useCallback((files: File[]) => { if (files.length > 0) onUpload(files[0]); }, [onUpload]);
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });
  return (<div {...getRootProps()} className="border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer hover:bg-primary/5"><input {...getInputProps()} /><div className="h-12 w-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-3">{isUploading ? <Loader2 className="animate-spin text-primary" /> : <ImageIcon size={24} />}</div><p className="font-black uppercase text-sm">{t('assignment_button_submit')}</p></div>);
}
