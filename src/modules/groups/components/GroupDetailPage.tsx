'use client';
import React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter, Link } from "@/navigation";
import { useTranslations, useLocale } from 'next-intl';
import { VieworaImage } from '@/core/components/viewora-image';

import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase
} from "@/lib/firebase";

import { doc, collection, query, where, documentId, orderBy, increment, writeBatch, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { uploadAndProcessImage } from '@/lib/image/actions';
import { moderateSubmission } from '@/ai/flows/moderate-submission';
import { evaluateGroupSubmission } from '@/ai/flows/evaluate-group-submission';
import { runAiJury } from '@/ai/flows/run-ai-jury';

import type {
  Group,
  PublicUserProfile,
  User,
  GroupAssignment,
  GroupSubmission,
  GroupPurpose,
  Trip
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
  Flag,
  CheckCircle2,
  Medal,
  Award,
  Star,
  Check,
  Trash2,
  AlertTriangle,
  Cpu
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useDropzone } from "react-dropzone";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

type ParticipantStatus = 'yes' | 'no' | 'pending';
interface TripParticipant {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  status: ParticipantStatus;
  updatedAt: string;
}

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

function AssignmentUploader({ onUpload, isUploading }: { onUpload: (file: File) => void, isUploading: boolean }) {
  const t = useTranslations('GroupDetailPage');
  const onDrop = useCallback((files: File[]) => { if (files.length > 0) onUpload(files[0]); }, [onUpload]);
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });
  return (
    <div {...getRootProps()} className="border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer hover:bg-primary/5 transition-colors">
      <input {...getInputProps()} />
      <div className="h-12 w-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-3">
        {isUploading ? <Loader2 className="animate-spin text-primary" /> : <ImageIcon size={24} />}
      </div>
      <p className="font-black uppercase text-sm">{t('assignment_button_submit')}</p>
    </div>
  );
}

export default function GroupDetailPage() {
  const { groupId, locale } = useParams();
  const t = useTranslations('GroupDetailPage');
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('assignments');
  const [isUploading, setIsUploading] = useState(false);
  const [isJuryRunning, setIsJuryRunning] = useState(false);
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

  const isCurrentUserAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['admin@viewora.ai', 'babacan.muharrem@gmail.com'];
    const adminUids = ['01DT86bQwWUVmrewnEb8c6bd8H43', 'BLxfoAPsRyOMTkrKD9EoLtt47Fo1'];
    return adminEmails.includes(user.email || '') || adminUids.includes(user.uid);
  }, [user]);

  const isCurrentUserOwner = group?.ownerId === user?.uid;
  const isCurrentUserJury = group?.juryIds?.includes(user?.uid || '');
  const isMember = group?.memberIds.includes(user?.uid || '');
  const canViewGallery = isMember || group?.isGalleryPublic;
  const canManageGroup = isCurrentUserOwner || isCurrentUserAdmin;

  const handleUploadSubmission = async (assignment: GroupAssignment, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    setIsUploading(true);
    toast({ title: t('toast_analyzing') });
    try {
      const photoId = crypto.randomUUID();
      const formData = new FormData();
      formData.append('file', file);
      
      // 🔄 Server Action ile Türevleri Üret ve Yükle
      const imageUrls = await uploadAndProcessImage(formData, user.uid, photoId, 'submissions');
      
      // 🆕 Layer 1: AI Moderation & Curation Gatekeeper (gpt-4o)
      toast({ title: "Moderasyon yapılıyor..." });
      const modResult = await moderateSubmission({
        photoUrl: imageUrls.analysis,
        assignmentTitle: assignment.title || group.name || "Task",
        assignmentDescription: assignment.description || group.description || "",
        language: (locale as string) || "tr"
      });

      if (!modResult.should_analyze) {
        setIsUploading(false);
        toast({ variant: 'destructive', title: "Eser Reddedildi", description: modResult.message });
        return;
      }

      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      
      // 🆕 Layer 2: Deep Analysis & Evaluation (gpt-4o)
      toast({ title: t('toast_analyzing') });
      const aiResult = await evaluateGroupSubmission({ 
        photoUrl: imageUrls.analysis, 
        assignmentTitle: assignment.title || group.name || "Task", 
        assignmentDescription: assignment.description || group.description || "", 
        language: (locale as string) || "tr" 
      });
      
      batch.set(submissionRef, { 
        id: submissionRef.id, 
        groupId: group.id, 
        assignmentId: assignment.id, 
        userId: user.uid, 
        userName: userProfile?.name || t('anonymous_artist'), 
        userPhotoURL: userProfile?.photoURL || null, 
        photoUrl: imageUrls.analysis,
        imageUrls,
        status: aiResult.evaluation.isSuccess ? 'approved' : 'pending', 
        likes: [], 
        comments: [], 
        moderation: { ...modResult, verifiedAt: new Date().toISOString() },
        aiFeedback: aiResult, 
        submittedAt: new Date().toISOString() 
      });
      await batch.commit();
      toast({ title: t('assignment_success_title') });
    } catch (e: any) { 
      console.error("Upload Submission Error:", e);
      if (e.message === 'PHOTO_TOO_SMALL') {
        toast({ 
          variant: 'destructive', 
          title: t('error_photo_too_small_title'),
          description: t('error_photo_too_small_description') 
        });
      } else if (e.message === 'Failed to fetch' || (e instanceof TypeError && e.message.includes('fetch'))) {
        toast({ 
          variant: 'destructive', 
          title: t('toast_network_error_title'), 
          description: t('toast_network_error_description') 
        });
      } else {
        toast({ variant: 'destructive', title: t('toast_error') }); 
      }
    } finally { setIsUploading(false); }
  };

  const handleCreateJuryReview = async (submissionId: string, review: any) => {
    if (!user || !group || !firestore) return;
    try {
      const submissionRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      const subSnap = await getDoc(submissionRef);
      if (!subSnap.exists()) return;
      
      const subData = subSnap.data() as GroupSubmission;
      const reviews = subData.juryReviews || [];
      const existingIdx = reviews.findIndex(r => r.userId === user.uid);
      
      const newReview = {
        userId: user.uid,
        userName: userProfile?.name || t('anonymous_artist'),
        score: review.score,
        feedback: review.feedback,
        criteria: review.criteria,
        createdAt: new Date().toISOString()
      };

      if (existingIdx >= 0) reviews[existingIdx] = newReview;
      else reviews.push(newReview);

      await updateDoc(submissionRef, { juryReviews: reviews });
      toast({ title: t('jury_button_submit') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleAssignAward = async (submissionId: string, award: string) => {
    if (!isCurrentUserOwner || !firestore || !group) return;
    try {
      const submissionRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      await updateDoc(submissionRef, { award });
      toast({ title: t('toast_award_success') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleModeration = async (submissionId: string, status: 'approved' | 'rejected') => {
    if (!isCurrentUserOwner || !firestore || !group) return;
    try {
      const submissionRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      await updateDoc(submissionRef, { status });
      toast({ title: status === 'approved' ? t('toast_approved_success') : t('toast_rejected_success') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleAddJury = async (memberId: string) => {
    if (!isCurrentUserOwner || !firestore || !group) return;
    try {
      const juryIds = group.juryIds || [];
      if (juryIds.includes(memberId)) return;
      await updateDoc(groupRef!, { juryIds: [...juryIds, memberId] });
      toast({ title: t('toast_profile_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleToggleAiJury = async () => {
    if (!isCurrentUserOwner || !firestore || !group) return;
    try {
      await updateDoc(groupRef!, { isAiJuryEnabled: !group.isAiJuryEnabled });
      toast({ title: t('toast_profile_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleRunAiJury = async () => {
    if (!firestore || !group || !submissions || submissions.length === 0) return;
    setIsJuryRunning(true);
    toast({ title: "AI Jüri değerlendirmesi başlıyor...", description: "Bias düşürmek için çift hesaplama yapılıyor." });
    try {
      const approvedSubs = submissions.filter(s => s.status === 'approved');
      if (approvedSubs.length === 0) {
        toast({ variant: 'destructive', title: "Hata", description: "Değerlendirilecek onaylı eser bulunamadı." });
        return;
      }
      const juryInput = {
        photos: approvedSubs.map(s => ({ id: s.id, url: s.photoUrl })),
        theme: group.competitionSubject || group.name,
        description: group.description || "",
        language: (locale as string) || "tr"
      };
      const result = await runAiJury(juryInput);
      const batch = writeBatch(firestore);
      result.evaluations.forEach(ev => {
        const subRef = doc(firestore, 'groups', group.id, 'submissions', ev.photo_id);
        batch.update(subRef, {
          juryResult: { score: ev.score, comment: ev.comment, evaluatedAt: new Date().toISOString() }
        });
      });
      result.ranking.forEach(rank => {
        const subRef = doc(firestore, 'groups', group.id, 'submissions', rank.photo_id);
        const awardMap: Record<number, string> = { 1: 'winner', 2: 'honorable_mention', 3: 'participant' };
        batch.update(subRef, { award: awardMap[rank.position] || 'none', 'juryResult.finalRank': rank.position });
      });
      await batch.commit();
      toast({ title: "AI Jüri tamamlandı!", description: "Kazananlar ve puanlar güncellendi." });
    } catch (e: any) {
      console.error("AI Jury error:", e);
      toast({ variant: 'destructive', title: "AI Jüri Hatası", description: e.message });
    } finally { setIsJuryRunning(false); }
  };

  const handleCreateTrip = async (tripData: any) => {
    if (!user || !firestore || !group) return;
    try {
      const tripRef = doc(collection(firestore, 'groups', group.id, 'trips'));
      await setDoc(tripRef, { ...tripData, id: tripRef.id, groupId: group.id, mentorId: user.uid, status: 'planned', created_at: new Date().toISOString() });
      toast({ title: t('toast_trip_publish_success') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleDeleteGroup = async () => {
    if (!canManageGroup || !firestore || !group) return;
    try {
      await deleteDoc(doc(firestore, 'groups', group.id));
      toast({ title: t('toast_delete_success') });
      router.push('/groups');
    } catch (e) { toast({ variant: 'destructive', title: t('toast_delete_error') }); }
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
                {group.organizerType && (
                  <Badge variant="outline" className="px-3 h-6 text-[9px] font-black uppercase tracking-widest bg-white/5 border-white/10">
                    {t(`form_organizer_${group.organizerType}`)}
                  </Badge>
                )}
              </div>
            </div>
            
            {group.purpose === 'challenge' && (
                <div className="flex flex-wrap items-center gap-6 p-6 rounded-[32px] bg-amber-500/5 border border-amber-500/10 shadow-inner">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.2em]">{t('form_label_comp_subject')}</p>
                        <p className="text-lg font-black uppercase tracking-tight">{group.competitionSubject || t('not_determined')}</p>
                    </div>
                    <div className="h-10 w-px bg-white/5 hidden md:block" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.2em]">{t('comp_card_dates_label')}</p>
                        <p className="text-sm font-bold">{group.startDate} — {group.endDate}</p>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <p className="text-muted-foreground font-medium text-sm max-w-2xl">{group.description}</p>
              {group.joinCode && isMember && (
                <div className="bg-[#121214] border border-white/5 rounded-full px-4 h-8 flex items-center gap-2 shadow-xl cursor-pointer hover:bg-white/5 transition-colors" onClick={() => { navigator.clipboard.writeText(group.joinCode!); toast({ title: t('toast_copied_title') }); }}>
                  <Hash size={10} className="text-primary" />
                  <span className="text-[11px] font-black tracking-[0.2em]">{group.joinCode}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isMember && (
              <Button 
                onClick={() => router.push(`/groups/join/${group.joinCode}`)} 
                className="h-12 px-8 rounded-2xl font-black uppercase tracking-wider bg-primary shadow-xl hover:scale-105 transition-all"
              >
                {t('button_join')}
              </Button>
            )}
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
        </div>
      </header>

      {group.purpose === 'challenge' ? (
        <ChallengeGroupView 
          group={group} 
          user={user} 
          submissions={submissions || []} 
          isOwner={isCurrentUserOwner} 
          isMember={isMember} 
          isUploading={isUploading}
          onUpload={(file: File) => handleUploadSubmission({ 
            id: 'challenge_entry', 
            title: group.competitionSubject || group.name, 
            description: group.description,
            groupId: group.id,
            ownerId: group.ownerId,
            createdAt: new Date().toISOString()
          } as GroupAssignment, file)}
          onSelectSubmission={setSelectedSubmission}
          t={t}
          userProfile={userProfile}
          memberProfiles={memberProfiles || []}
          onAssignAward={handleAssignAward}
          onRunAiJury={handleRunAiJury}
          isJuryRunning={isJuryRunning}
          onModeration={handleModeration}
          onAddJury={handleAddJury}
          onToggleAiJury={handleToggleAiJury}
          onDeleteGroup={handleDeleteGroup}
          canManageGroup={canManageGroup}
        />
      ) : (
        <StandardGroupView 
          group={group}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          trips={trips || []}
          isTripsLoading={isTripsLoading}
          isOwner={isCurrentUserOwner}
          userId={user?.uid || ''}
          userProfile={userProfile || null}
          assignments={assignments || []}
          submissions={submissions || []}
          handleUploadSubmission={handleUploadSubmission}
          isUploading={isUploading}
          setSelectedSubmission={setSelectedSubmission}
          canViewGallery={canViewGallery}
          memberProfiles={memberProfiles || []}
          handleAssignAward={handleAssignAward}
          handleRunAiJury={handleRunAiJury}
          isJuryRunning={isJuryRunning}
          handleAddJury={handleAddJury}
          handleCreateTrip={handleCreateTrip}
          handleDeleteGroup={handleDeleteGroup}
          canManageGroup={canManageGroup}
          t={t}
        />
      )}

      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl flex flex-col md:flex-row rounded-[48px] shadow-3xl">
            <div className="relative w-full md:w-3/5 h-[45vh] md:h-auto bg-black/60 shrink-0 border-r border-white/5 shadow-2xl overflow-hidden group">
              <VieworaImage 
                variants={selectedSubmission.imageUrls}
                fallbackUrl={selectedSubmission.photoUrl}
                type="detailView"
                alt="Eser"
                containerClassName="w-full h-full"
              />
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
                      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={276} strokeDashoffset={276 - (276 * (selectedSubmission.aiFeedback?.evaluation?.score || 0)) / 100} className="text-primary transition-all duration-1000" />
                    </svg>
                    <span className="text-3xl font-black tracking-tighter">{selectedSubmission.aiFeedback?.evaluation?.score || 0}%</span>
                  </div>
                </div>

                {selectedSubmission.aiFeedback?.evaluation && (
                  <div className="p-8 rounded-[32px] bg-primary/5 border border-primary/20 shadow-inner">
                    <p className="text-base font-medium leading-relaxed italic text-foreground/90 font-serif">
                      "{selectedSubmission.aiFeedback.evaluation.feedback}"
                    </p>
                  </div>
                )}

                {selectedSubmission.aiFeedback?.analysis && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                      <p className="text-[8px] font-black uppercase opacity-50 mb-1">Işık</p>
                      <p className="text-lg font-black">{selectedSubmission.aiFeedback.analysis.light_score}/10</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                      <p className="text-[8px] font-black uppercase opacity-50 mb-1">Komp.</p>
                      <p className="text-lg font-black">{selectedSubmission.aiFeedback.analysis.composition_score}/10</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                      <p className="text-[8px] font-black uppercase opacity-50 mb-1">Teknik</p>
                      <p className="text-lg font-black">{selectedSubmission.aiFeedback.analysis.technical_clarity_score}/10</p>
                    </div>
                  </div>
                )}

                {/* Jury Reviews */}
                {((group?.showJury || isCurrentUserOwner) && selectedSubmission.juryReviews && selectedSubmission.juryReviews.length > 0) && (
                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t('jury_list_title')}</h3>
                        {selectedSubmission.juryReviews.map(rev => (
                            <div key={rev.userId} className="p-6 rounded-[32px] bg-white/5 border border-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-sm uppercase tracking-tighter">@{rev.userName}</span>
                                    <Badge className="bg-primary/20 text-primary border-none">{rev.score} / 10</Badge>
                                </div>
                                <p className="text-sm italic text-muted-foreground">"{rev.feedback}"</p>
                                <div className="flex flex-wrap gap-2">
                                    {rev.criteria?.map(c => <Badge key={c} variant="outline" className="text-[9px] uppercase font-black">{t(`jury_criteria_${c}`)}</Badge>)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Jury Evaluation Button */}
                {isCurrentUserJury && selectedSubmission && (
                    <JuryEvaluationModal 
                        submission={selectedSubmission}
                        onSave={(review) => handleCreateJuryReview(selectedSubmission!.id, review)}
                        t={t}
                    />
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
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{t('label_meeting_details')}</p>
                <div className="bg-black/40 rounded-[32px] p-8 border border-white/5 space-y-8 shadow-inner relative overflow-hidden">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xl"><MapPin size={18} className="text-blue-400" /></div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">{t('label_meeting_point')}</p>
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
  const handleTemplateSelect = (title: string) => { const tmpl = ISTANBUL_TEMPLATES.find(x => x.title === title); if (tmpl) setFormData({ ...formData, title: t(tmpl.title), startPoint: tmpl.start_point, endPoint: tmpl.end_point }); };
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

function JuryManager({ members, juryIds, isAiJuryEnabled, onAdd, onToggleAiJury, t }: { members: PublicUserProfile[], juryIds: string[], isAiJuryEnabled: boolean, onAdd: (id: string) => void, onToggleAiJury: () => void, t: any }) {
    return (
        <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Cpu className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="space-y-0.5">
                        <h4 className="text-sm font-black uppercase tracking-tight text-amber-500">{t('jury_ai_label')}</h4>
                        <p className="text-[10px] font-medium opacity-60 leading-tight max-w-[200px]">{t('jury_ai_description')}</p>
                    </div>
                </div>
                <Button 
                    size="sm" 
                    variant={isAiJuryEnabled ? "secondary" : "outline"} 
                    onClick={onToggleAiJury}
                    className={cn("rounded-xl h-9 px-4 font-black uppercase text-[9px] min-w-[100px]", isAiJuryEnabled ? "bg-amber-500 text-black border-none" : "")}
                >
                    {isAiJuryEnabled ? <Check size={12} className="mr-1" /> : null}
                    {isAiJuryEnabled ? t('button_ai_jury_active') : t('button_ai_jury_inactive')}
                </Button>
            </div>

            <div className="h-px bg-white/5 mx-2" />

            <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-2">{t('jury_list_title')}</p>
                <div className="grid gap-3">
                    {members.map(m => {
                        const isJury = juryIds.includes(m.id);
                        return (
                            <div key={m.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={m.photoURL || ''} />
                                        <AvatarFallback>{m.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-bold text-sm">@{m.name}</span>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant={isJury ? "secondary" : "outline"} 
                                    disabled={isJury}
                                    onClick={() => onAdd(m.id)}
                                    className="rounded-xl h-8 px-4 font-black uppercase text-[9px]"
                                >
                                    {isJury ? <Check size={12} className="mr-1" /> : null}
                                    {isJury ? t('tab_admin') : t('button_add_jury')}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function AwardManager({ submissions, onAssign, onRunAiJury, isJuryRunning, t }: { submissions: GroupSubmission[], onAssign: (id: string, award: string) => void, onRunAiJury: () => void, isJuryRunning: boolean, t: any }) {
    return (
        <div className="space-y-6">
            <div className="p-6 rounded-[32px] bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1 text-center md:text-left">
                    <h4 className="text-sm font-black uppercase tracking-widest text-amber-500">AI Jüri Karar Motoru</h4>
                    <p className="text-[10px] font-medium opacity-70">Tüm onaylı eserleri gpt-4o ile puanla ve İlk 3'ü belirle.</p>
                </div>
                <Button 
                    onClick={onRunAiJury} 
                    disabled={isJuryRunning || submissions.length === 0}
                    className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20"
                >
                    {isJuryRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cpu className="h-4 w-4 mr-2" />}
                    AI Jüriyi Çalıştır (2x Average)
                </Button>
            </div>
            <div className="grid gap-4">
                {submissions.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                                <img src={sub.photoUrl} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">@{sub.userName}</p>
                                {sub.award && <Badge className="bg-primary/20 text-primary text-[9px] uppercase font-black px-2 mt-1">{t(`award_${sub.award}`)}</Badge>}
                            </div>
                        </div>
                        <Select onValueChange={(val) => onAssign(sub.id, val)} value={sub.award || ''}>
                            <SelectTrigger className="w-[140px] h-9 rounded-xl text-[9px] font-black uppercase">
                                <SelectValue placeholder={t('button_assign_award')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="first">{t('award_first')}</SelectItem>
                                <SelectItem value="second">{t('award_second')}</SelectItem>
                                <SelectItem value="third">{t('award_third')}</SelectItem>
                                <SelectItem value="honorable_mention">{t('award_honorable')}</SelectItem>
                                <SelectItem value="participant">{t('award_participant')}</SelectItem>
                                <SelectItem value="viewora_special">{t('award_viewora')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </div>
    );
}

function JuryEvaluationModal({ submission, onSave, t }: { submission: GroupSubmission, onSave: (review: any) => void, t: any }) {
    const [score, setScore] = useState(8);
    const [feedback, setFeedback] = useState('');
    const [criteria, setCriteria] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const toggleCriteria = (c: string) => {
        setCriteria(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full h-14 rounded-3xl font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 shadow-xl active:scale-95">
                    <Star size={18} className="mr-2" /> {t('jury_modal_title')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase">{t('jury_modal_title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_score')}: {score}</Label>
                        <Input type="range" min="1" max="10" value={score} onChange={(e) => setScore(parseInt(e.target.value))} className="h-6" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_feedback')}</Label>
                        <Textarea 
                            placeholder="..." 
                            className="rounded-2xl min-h-[100px] border-white/10 bg-white/5 italic"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_criteria')}</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {['composition', 'theme', 'simplicity'].map(c => (
                                <div key={c} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 cursor-pointer" onClick={() => toggleCriteria(c)}>
                                    <Checkbox checked={criteria.includes(c)} onCheckedChange={() => toggleCriteria(c)} />
                                    <span className="text-xs font-bold">{t(`jury_criteria_${c}`)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button 
                        className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-primary" 
                        onClick={() => { onSave({ score, feedback, criteria }); setIsOpen(false); }}
                    >
                        {t('jury_button_submit')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StandardGroupView({ 
    group, activeTab, setActiveTab, trips, isTripsLoading, isOwner, userId, userProfile, assignments, submissions, 
    handleUploadSubmission, isUploading, setSelectedSubmission, canViewGallery, memberProfiles, handleAssignAward, handleRunAiJury, isJuryRunning, handleAddJury, handleCreateTrip, 
    canManageGroup, handleDeleteGroup, t 
}: any) {
    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
            <div className="relative filter-scroll">
                <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x">
                    <TabsList className="inline-flex w-max bg-[#121214]/60 backdrop-blur-xl p-1 rounded-2xl h-12 border border-white/5 gap-1 shadow-2xl overflow-hidden">
                        <TabsTrigger value="trips" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_trips')}</TabsTrigger>
                        <TabsTrigger value="assignments" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_assignments')}</TabsTrigger>
                        <TabsTrigger value="gallery" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_gallery')}</TabsTrigger>
                        <TabsTrigger value="members" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_members')}</TabsTrigger>
                        {isOwner && <TabsTrigger value="admin" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500 data-[state=active]:bg-amber-500/10 transition-all">{t('tab_admin')}</TabsTrigger>}
                    </TabsList>
                </div>
            </div>

            <TabsContent value="trips" className="space-y-8">
                {isTripsLoading ? <Skeleton className="h-40 w-full rounded-3xl" /> :
                    trips && trips.length > 0 ? (
                        <div className="grid gap-8">{trips.filter((t: any) => t.status !== 'cancelled').map((trip: any) => <TripCard key={trip.id} trip={trip} isOwner={isOwner} userId={userId} userProfile={userProfile} groupId={group.id} />)}</div>
                    ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><Calendar className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" /><h3 className="text-2xl font-black uppercase">{t('trips_empty_title')}</h3></div>}
            </TabsContent>

            <TabsContent value="assignments" className="space-y-8">
                {assignments && assignments.length > 0 ? (
                    <div className="grid gap-6">
                        {assignments.map((ass: any) => {
                            const userSubmission = submissions?.find((s: any) => s.assignmentId === ass.id && s.userId === userId);
                            return (
                                <Card key={ass.id} className="rounded-[40px] border-white/5 overflow-hidden bg-[#121214]/40 backdrop-blur-xl shadow-2xl transition-all hover:border-primary/20">
                                    <CardHeader className="bg-primary/5 p-10 border-b border-white/5">
                                        <CardTitle className="text-2xl font-black uppercase tracking-tighter drop-shadow-lg">{t('tab_assignments')}: {ass.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-10 space-y-10">
                                        <div className="bg-white/5 p-8 rounded-[32px] border border-dashed border-white/10 italic font-medium text-foreground/90 leading-relaxed text-lg shadow-inner">
                                            "{ass.description}"
                                        </div>
                                        {!userSubmission ? <AssignmentUploader onUpload={(file: File) => handleUploadSubmission(ass, file)} isUploading={isUploading} /> :
                                            <div className="flex flex-col md:flex-row items-center gap-8 p-10 rounded-[32px] bg-green-500/5 border border-green-500/20 shadow-xl">
                                                <div className="relative h-32 w-32 rounded-3xl overflow-hidden border-4 border-green-500/20 shadow-2xl shrink-0">
                                                    <img src={userSubmission.photoUrl} alt="Teslimatım" className="object-cover w-full h-full" />
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
                {canViewGallery ? (
                    submissions && submissions.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                            {submissions.map((sub: any) => (
                                <Card key={sub.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer border border-white/10 shadow-2xl transition-all hover:scale-[1.02] hover:border-primary/30" onClick={() => setSelectedSubmission(sub)}>
                                    <VieworaImage 
                                        variants={sub.imageUrls}
                                        fallbackUrl={sub.photoUrl}
                                        type="smallSquare"
                                        alt="Student Work"
                                        containerClassName="w-full h-full"
                                    />
                                    {sub.award && (
                                        <div className="absolute top-4 left-4 z-20">
                                            <Badge className="bg-amber-500 text-black font-black border-none shadow-lg animate-pulse">
                                                {sub.award === 'first' && <Trophy size={12} className="mr-1" />}
                                                {t(`award_${sub.award}`)}
                                            </Badge>
                                        </div>
                                    )}
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
                    ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><ImageIcon size={64} className="mx-auto mb-6 text-muted-foreground/20" /></div>
                ) : (
                    <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5">
                        <ShieldCheck size={64} className="mx-auto mb-6 text-muted-foreground/20" />
                        <h3 className="text-xl font-black uppercase">{t('group_not_found_no_permission')}</h3>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {memberProfiles?.map((profile: any) => (
                        <Card key={profile.id} className="p-4 rounded-2xl border-border/40 bg-card/50 flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={profile.photoURL || ''} />
                                <AvatarFallback className="bg-primary/20 text-[10px] font-black">{profile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div><p className="font-bold">@{profile.name}</p><p className="text-[10px] uppercase font-black text-primary">{profile.level_name}</p></div>
                        </Card>
                    ))}
                </div>
            </TabsContent>

            {canManageGroup && (
                <TabsContent value="admin" className="space-y-10">
                    <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl overflow-hidden">
                        <Tabs defaultValue="trip">
                            <TabsList className="w-full bg-primary/5 rounded-none h-14 border-b border-white/5">
                                <TabsTrigger value="trip" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('admin_card_title')}</TabsTrigger>
                                <TabsTrigger value="settings" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('tab_settings')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="trip" className="p-8">
                                <EventCreator onCreate={handleCreateTrip} />
                            </TabsContent>
                            <TabsContent value="settings" className="p-8 space-y-6">
                                <div className="p-8 rounded-[32px] bg-red-500/5 border border-red-500/10 space-y-4">
                                    <h3 className="text-xl font-black uppercase text-red-500">{t('delete_group_title')}</h3>
                                    <p className="text-sm text-muted-foreground font-medium">{t('delete_group_description')}</p>
                                    <DeleteGroupModal onConfirm={handleDeleteGroup} t={t} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    );
}

function ChallengeGroupView({ group, user, submissions, isOwner, isMember, isUploading, onUpload, onSelectSubmission, t, userProfile, memberProfiles, onAssignAward, onRunAiJury, isJuryRunning, onModeration, onAddJury, onToggleAiJury, onDeleteGroup, canManageGroup }: any) {
    const [challengeTab, setChallengeTab] = useState('participation');
    const mySubmission = submissions?.find((s: any) => s.userId === user?.uid);
    const approvedSubmissions = submissions?.filter((s: any) => s.status === 'approved' || s.userId === user?.uid);
    const awardedSubmissions = submissions?.filter((s: any) => s.award);
    const pendingSubmissions = submissions?.filter((s: any) => s.status === 'pending');

    return (
        <Tabs value={challengeTab} onValueChange={setChallengeTab} className="space-y-10">
            <div className="relative filter-scroll">
                <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x">
                    <TabsList className="inline-flex w-max bg-[#121214]/60 backdrop-blur-xl p-1 rounded-2xl h-12 border border-white/5 gap-1 shadow-2xl overflow-hidden">
                        <TabsTrigger value="participation" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('challenge_tab_my_participation')}</TabsTrigger>
                        <TabsTrigger value="exhibition" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('challenge_tab_exhibition')}</TabsTrigger>
                        <TabsTrigger value="results" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('challenge_tab_results')}</TabsTrigger>
                        <TabsTrigger value="members" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_members')}</TabsTrigger>
                        {canManageGroup && <TabsTrigger value="admin" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500 data-[state=active]:bg-amber-500/10 transition-all">{t('tab_admin')}</TabsTrigger>}
                    </TabsList>
                </div>
            </div>

            <TabsContent value="participation" className="space-y-8">
                {!mySubmission ? (
                    <Card className="rounded-[40px] border-white/5 overflow-hidden bg-[#121214]/40 backdrop-blur-xl shadow-2xl">
                        <CardHeader className="bg-amber-500/10 p-10 border-b border-white/5">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy size={18} className="text-amber-500" />
                                <Badge className="bg-amber-500/20 text-amber-500 border-none font-black text-[9px] uppercase tracking-widest">{t('challenge_hero_subtitle')}</Badge>
                            </div>
                            <CardTitle className="text-3xl font-black uppercase tracking-tighter">{t('challenge_upload_title')}</CardTitle>
                            <CardDescription className="text-sm font-medium italic opacity-70">{t('challenge_upload_desc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-10">
                            <AssignmentUploader onUpload={onUpload} isUploading={isUploading} />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-8">
                        <Card className="rounded-[40px] border-white/5 overflow-hidden bg-[#121214]/40 backdrop-blur-xl shadow-2xl p-10 flex flex-col md:flex-row items-center gap-10">
                            <div className="h-48 w-48 rounded-[32px] overflow-hidden border-4 border-amber-500/20 shadow-2xl rotate-3 shrink-0">
                                <img src={mySubmission.imageUrls?.analysis || mySubmission.photoUrl} className="w-full h-full object-cover" />
                            </div>
                            <div className="space-y-4 flex-1">
                                <Badge className="bg-green-500/20 text-green-500 border-none font-black text-[9px] uppercase tracking-widest mb-2">
                                    <CheckCircle2 size={10} className="mr-1" />
                                    {mySubmission.status === 'approved' ? t('challenge_status_approved') : t('challenge_status_pending')}
                                </Badge>
                                <h3 className="text-3xl font-black uppercase tracking-tighter">{t('challenge_confirmation_title')}</h3>
                                <p className="text-muted-foreground font-medium italic italic leading-relaxed">"{t('challenge_confirmation_desc')}"</p>
                                
                                <div className="flex flex-wrap gap-4 pt-4">
                                   <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                                       <p className="text-[8px] font-black uppercase opacity-50 mb-0.5">{t('challenge_type_label')}</p>
                                       <p className="text-xs font-bold uppercase">{t('challenge_type_competition')}</p>
                                   </div>
                                   {mySubmission.award && (
                                       <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                           <p className="text-[8px] font-black uppercase text-amber-500 mb-0.5">{t('challenge_tab_results')}</p>
                                           <p className="text-xs font-bold uppercase text-amber-500">{t(`award_${mySubmission.award}`)}</p>
                                       </div>
                                   )}
                                </div>
                            </div>
                            <Button onClick={() => onSelectSubmission(mySubmission)} size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest shadow-xl">{t('assignment_button_detail')}</Button>
                        </Card>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="exhibition" className="space-y-8">
                {approvedSubmissions && approvedSubmissions.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {approvedSubmissions.map((sub: any) => (
                            <Card key={sub.id} className="group relative aspect-square rounded-[40px] overflow-hidden cursor-pointer border border-white/10 shadow-2xl transition-all hover:scale-[1.02] hover:border-primary/30" onClick={() => onSelectSubmission(sub)}>
                                <VieworaImage variants={sub.imageUrls} fallbackUrl={sub.photoUrl} type="smallSquare" alt="Entry" containerClassName="w-full h-full" />
                                {sub.award && (
                                    <div className="absolute top-4 left-4 z-20">
                                        <Badge className="bg-amber-500 text-black font-black border-none shadow-lg animate-pulse">{t(`award_${sub.award}`)}</Badge>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                                    <Avatar className="h-10 w-10 border-2 border-white/50">
                                        <AvatarImage src={sub.userPhotoURL || ''} />
                                        <AvatarFallback className="bg-primary/20 text-[10px] font-black">{sub.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div><p className="text-xs font-black text-white uppercase drop-shadow-lg">@{sub.userName}</p></div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5"><ImageIcon size={64} className="mx-auto mb-6 text-muted-foreground/20" /></div>}
            </TabsContent>

            <TabsContent value="results" className="space-y-8">
                <div className="max-w-4xl mx-auto space-y-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">{t('challenge_results_title')}</h2>
                        <p className="text-muted-foreground font-medium italic">"{group.competitionSubject}"</p>
                    </div>
                    {awardedSubmissions && awardedSubmissions.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-6">
                            {awardedSubmissions.map((sub: any) => (
                                <Card key={sub.id} className="rounded-[40px] border-white/10 bg-[#121214]/60 p-6 flex items-center gap-6 shadow-2xl relative group overflow-hidden">
                                     <div className="absolute top-0 right-0 p-4 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform"><Award size={80} /></div>
                                     <div className="h-24 w-24 rounded-3xl overflow-hidden border-2 border-white/10 shadow-xl shrink-0">
                                         <img src={sub.imageUrls?.analysis || sub.photoUrl} className="w-full h-full object-cover" />
                                     </div>
                                     <div className="space-y-2">
                                         <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest">{t(`award_${sub.award}`)}</Badge>
                                         <p className="text-xl font-black uppercase tracking-tight">@{sub.userName}</p>
                                         <Button onClick={() => onSelectSubmission(sub)} variant="link" className="p-0 h-auto font-bold text-xs uppercase text-muted-foreground hover:text-primary">{t('assignment_button_detail')}</Button>
                                     </div>
                                </Card>
                            ))}
                        </div>
                    ) : <div className="text-center py-32 rounded-[48px] border border-white/5 bg-white/5"><Medal size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold uppercase text-xs opacity-50 tracking-widest">{t('competitions_no_competitions_title')}</p></div>}
                </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {memberProfiles?.map((profile: any) => (
                        <Card key={profile.id} className="p-4 rounded-2xl border-border/40 bg-card/50 flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={profile.photoURL || ''} />
                                <AvatarFallback className="bg-primary/20 text-[10px] font-black">{profile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div><p className="font-bold">@{profile.name}</p><p className="text-[10px] uppercase font-black text-primary">{profile.level_name}</p></div>
                        </Card>
                    ))}
                </div>
            </TabsContent>

            {canManageGroup && (
                <TabsContent value="admin" className="space-y-10">
                    <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl overflow-hidden">
                        <Tabs defaultValue="moderation">
                            <TabsList className="w-full bg-primary/5 rounded-none h-14 border-b border-white/5">
                                <TabsTrigger value="moderation" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('admin_tab_moderation')}</TabsTrigger>
                                <TabsTrigger value="awards" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('admin_tab_awards')}</TabsTrigger>
                                <TabsTrigger value="jury" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('admin_tab_jury')}</TabsTrigger>
                                <TabsTrigger value="settings" className="flex-1 font-black uppercase text-[10px] tracking-widest">{t('tab_settings')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="moderation" className="p-8">
                                <ModerationManager pendingSubmissions={pendingSubmissions || []} onApprove={(id: string) => onModeration(id, 'approved')} onReject={(id: string) => onModeration(id, 'rejected')} t={t} />
                            </TabsContent>
                             <TabsContent value="awards" className="p-8">
                                <AwardManager 
                                    submissions={approvedSubmissions || []} 
                                    onAssign={onAssignAward} 
                                    onRunAiJury={onRunAiJury}
                                    isJuryRunning={isJuryRunning}
                                    t={t} 
                                />
                            </TabsContent>
                            <TabsContent value="jury" className="p-8">
                                <JuryManager 
                                    members={memberProfiles || []} 
                                    juryIds={group.juryIds || []} 
                                    isAiJuryEnabled={group.isAiJuryEnabled || false} 
                                    onAdd={onAddJury} 
                                    onToggleAiJury={onToggleAiJury}
                                    t={t} 
                                />
                            </TabsContent>
                            <TabsContent value="settings" className="p-8 space-y-6">
                                <div className="p-8 rounded-[32px] bg-red-500/5 border border-red-500/10 space-y-4">
                                    <h3 className="text-xl font-black uppercase text-red-500">{t('delete_group_title')}</h3>
                                    <p className="text-sm text-muted-foreground font-medium">{t('delete_group_description')}</p>
                                    <DeleteGroupModal onConfirm={onDeleteGroup} t={t} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    );
}

function DeleteGroupModal({ onConfirm, t }: { onConfirm: () => void, t: any }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="destructive" className="h-12 px-8 rounded-2xl font-black uppercase tracking-wider shadow-xl shadow-red-500/20 active:scale-95 transition-all">
                    <Trash2 size={18} className="mr-2" /> {t('button_delete_group')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8 shadow-3xl">
                <DialogHeader className="space-y-4">
                    <div className="h-20 w-20 bg-red-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
                        {t('delete_group_dialog_title')}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground text-center font-medium opacity-70">
                        {t('delete_group_dialog_description')}
                    </p>
                </DialogHeader>
                <DialogFooter className="pt-8 flex flex-col gap-3 sm:flex-col">
                    <Button 
                        variant="destructive" 
                        onClick={onConfirm}
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-500/20 active:scale-95"
                    >
                        {t('button_delete_group')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModerationManager({ pendingSubmissions, onApprove, onReject, t }: any) {
    return (
        <div className="space-y-6">
            {pendingSubmissions.length > 0 ? (
                <div className="grid gap-4">
                    {pendingSubmissions.map((sub: any) => (
                        <div key={sub.id} className="flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-6">
                                <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-xl border-2 border-white/10 shrink-0">
                                    <img src={sub.imageUrls?.analysis || sub.photoUrl} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="font-black text-base">@{sub.userName}</p>
                                    <p className="text-[10px] font-medium text-muted-foreground">{new Date(sub.submittedAt).toLocaleString('tr')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button onClick={() => onReject(sub.id)} variant="ghost" className="h-10 px-6 rounded-xl font-black uppercase text-[10px] text-red-500 hover:bg-red-500/10">{t('button_reject')}</Button>
                                <Button onClick={() => onApprove(sub.id)} className="h-10 px-6 rounded-xl font-black uppercase text-[10px] shadow-lg">{t('button_approve')}</Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : <div className="text-center py-20 opacity-30"><ShieldCheck size={48} className="mx-auto mb-4" /><p className="font-bold text-xs uppercase tracking-[0.2em]">TÜM BAŞVURULAR DENETLENDİ</p></div>}
        </div>
    );
}
