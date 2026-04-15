'use client';
import React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter, Link } from "@/navigation";
import { useTranslations, useLocale } from 'next-intl';
import { prepareOptimizedFile } from '@/lib/image/image-processing-final';
import { VieworaImage } from '@/core/components/viewora-image';

import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase
} from "@/lib/firebase";

import { doc, collection, query, where, documentId, orderBy, increment, writeBatch, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { uploadAndProcessImage } from '@/lib/image/actions';
import { moderateSubmission } from '@/ai/flows/moderate-submission';
import { evaluateGroupSubmission } from '@/ai/flows/evaluate-group-submission';
import { runAiJury } from '@/ai/flows/run-ai-jury';
import { NotificationAPI } from '@/lib/api/notification-api';

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
import { CompetitionStatusBadge } from "./detail/CompetitionStatusBadge";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";

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
  Cpu,
  Heart
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
  DialogDescription,
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

// Modular Components
import { ChallengeGroupView } from "./detail/ChallengeGroupView";
import { StandardGroupView } from "./detail/StandardGroupView";
import { TripCard } from "./detail/TripCard";
import { AwardManager } from "./detail/AwardManager";
import { JuryManager } from "./detail/JuryManager";
import { ModerationManager } from "./detail/ModerationManager";
import { AssignmentUploader } from "./detail/AssignmentUploader";
import { EventCreator } from "./detail/EventCreator";
import { DeleteGroupModal } from "./detail/DeleteGroupModal";
import { JuryEvaluationModal } from "./detail/JuryEvaluationModal";
import { PrizeConfigCard } from "./detail/PrizeConfigCard";

const PURPOSE_CONFIG: Record<GroupPurpose, { labelKey: string; icon: any; color: string }> = {
  study: { labelKey: 'purpose_study', icon: GraduationCap, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  challenge: { labelKey: 'purpose_challenge', icon: Trophy, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  walk: { labelKey: 'purpose_walk', icon: Map, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mentor: { labelKey: 'purpose_mentor', icon: ShieldCheck, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  exhibition: { labelKey: 'purpose_exhibition', icon: Camera, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
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
      const optimizedFile = await prepareOptimizedFile(file, 1600);
      const photoId = crypto.randomUUID();
      const formData = new FormData();
      formData.append('file', optimizedFile);
      const imageUrls = await uploadAndProcessImage(formData, user.uid, photoId, 'submissions');
      
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
      
      toast({ title: t('toast_analyzing') });
      const aiResult = await evaluateGroupSubmission({ 
        photoUrl: imageUrls.analysis, 
        assignmentTitle: assignment.title || group.name || "Task", 
        assignmentDescription: assignment.description || group.description || "", 
        language: (locale as string) || "tr" 
      });

      const requiredTag = assignment.requiredTag || group.requiredTag;
      if (requiredTag) {
        const hasTag = aiResult.analysis.tags.some(tag => tag.toLowerCase().includes(requiredTag.toLowerCase()));
        if (!hasTag) {
          setIsUploading(false);
          toast({ variant: 'destructive', title: "Etiket Uyumsuzluğu", description: t('toast_tag_mismatch', { tag: requiredTag }) || `Bu fotoğraf ${requiredTag} etiketiyle eşleşmiyor.` });
          return;
        }
      }
      
      batch.set(submissionRef, { 
        id: submissionRef.id, 
        groupId: group.id, 
        assignmentId: assignment.id, 
        userId: user.uid, 
        userName: userProfile?.name || t('anonymous_artist'), 
        userPhotoURL: userProfile?.photoURL || null, 
        photoUrl: imageUrls.analysis,
        imageUrls,
        status: isCurrentUserOwner ? 'approved' : 'pending', 
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
      toast({ variant: 'destructive', title: t('toast_error') }); 
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
      const subSnap = await getDoc(submissionRef);
      await updateDoc(submissionRef, { status });
      
      if (subSnap.exists()) {
        const subData = subSnap.data() as GroupSubmission;
        // [EVENT] Notify User via Notification Server
        await NotificationAPI.triggerModerationEvent(subData.userId, submissionId);
      }
      
      toast({ title: status === 'approved' ? t('toast_approved_success') : t('toast_rejected_success') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleWithdrawSubmission = async (submissionId: string) => {
    if (!user || !group || !firestore) return;
    try {
      const submissionRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      await deleteDoc(submissionRef);
      toast({ title: t('toast_withdraw_success') || 'Başarıyla vazgeçildi.' });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleLikeSubmission = async (submissionId: string) => {
    if (!user || !group || !firestore) return;
    if (group.endDate) {
      const now = new Date();
      if (now > new Date(group.endDate)) {
        toast({ title: t('voting_closed'), variant: 'destructive' });
        return;
      }
    }
    try {
      const submissionRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      const subSnap = await getDoc(submissionRef);
      if (!subSnap.exists()) return;
      const subData = subSnap.data() as GroupSubmission;
      const isLiked = subData.likes?.includes(user.uid);
      await updateDoc(submissionRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
      toast({ title: isLiked ? t('toast_unlike_success') : t('toast_like_success'), duration: 2000 });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleUpdateGalleryPrivacy = async (isPublic: boolean) => {
    if (!canManageGroup || !groupRef) return;
    try {
      await updateDoc(groupRef, { isGalleryPublic: isPublic });
      toast({ title: t('toast_profile_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleAddJury = async (memberId: string) => {
    if (!isCurrentUserOwner || !firestore || !group || !groupRef) return;
    try {
      const juryIds = group.juryIds || [];
      if (juryIds.includes(memberId)) return;
      await updateDoc(groupRef, { juryIds: [...juryIds, memberId] });
      toast({ title: t('toast_group_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleToggleAiJury = async () => {
    if (!isCurrentUserOwner || !groupRef) return;
    try {
      await updateDoc(groupRef, { isAiJuryEnabled: !group.isAiJuryEnabled });
      toast({ title: t('toast_profile_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleRunAiJury = async () => {
    if (!firestore || !group || !submissions || submissions.length === 0) return;
    setIsJuryRunning(true);
    toast({ title: "AI Jüri değerlendirmesi başlıyor..." });
    try {
      const approvedSubs = submissions.filter(s => s.status === 'approved');
      if (approvedSubs.length === 0) return;
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
        batch.update(subRef, { juryResult: { score: ev.score, comment: ev.comment, evaluatedAt: new Date().toISOString() } });
      });
      result.ranking.forEach(rank => {
        const subRef = doc(firestore, 'groups', group.id, 'submissions', rank.photo_id);
        const awardMap: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third' };
        batch.update(subRef, { award: awardMap[rank.position] || 'none', 'juryResult.finalRank': rank.position });
      });
      await batch.commit();
      toast({ title: "AI Jüri tamamlandı!" });
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

  const handleUpdatePrizes = async (newPrizes: any) => {
    if (!groupRef) return;
    try {
      await updateDoc(groupRef, { prizes: newPrizes });
      toast({ title: t('toast_prizes_updated') });
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
  };

  const handleArchiveCompetition = async (data?: { subject: string, startDate: string, endDate: string, reason?: string }) => {
    if (!groupRef || !firestore || !group || !submissions) return;
    try {
      const awarded = submissions.filter(s => s.award && ['first', 'second', 'third'].includes(s.award));
      const newArchive = {
        id: crypto.randomUUID(),
        subject: group.competitionSubject || group.name,
        winners: awarded.map(s => ({ userId: s.userId, userName: s.userName, award: s.award!, photoUrl: s.photoUrl })),
        archivedAt: new Date().toISOString()
      };

      await updateDoc(groupRef, {
        pastCompetitions: [newArchive, ...(group.pastCompetitions || [])],
        competitionSubject: data?.subject || null,
        startDate: data?.startDate || null,
        endDate: data?.endDate || null
      });

      const batch = writeBatch(firestore);
      submissions.forEach(sub => batch.delete(doc(firestore, 'groups', group.id, 'submissions', sub.id)));
      await batch.commit();

      // [EVENT] Notify New Competition
      await NotificationAPI.triggerNewCompetitionEvent();

      toast({ title: t('toast_archive_success') || 'Yarışma arşivlendi!' });
      window.location.reload();
    } catch (e) { toast({ variant: 'destructive', title: t('toast_error') }); }
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
              
              {group.joinCode && isMember && (
                <div className="bg-[#121214] border border-white/5 rounded-full px-4 h-8 flex items-center gap-2 shadow-xl cursor-pointer hover:bg-white/5 transition-colors" onClick={() => { navigator.clipboard.writeText(group.joinCode!); toast({ title: t('toast_copied_title') }); }}>
                  <Hash size={10} className="text-primary" />
                  <span className="text-[11px] font-black tracking-[0.2em]">{group.joinCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {group.purpose === 'challenge' || group.purpose === 'exhibition' ? (
        <ChallengeGroupView 
          group={group} 
          user={user} 
          submissions={submissions || []} 
          isOwner={!!isCurrentUserOwner} 
          isMember={!!isMember} 
          isUploading={!!isUploading}
          onUpload={(file: File) => handleUploadSubmission({ id: 'entry', title: group.name, description: group.description, groupId: group.id, ownerId: group.ownerId, createdAt: new Date().toISOString() } as GroupAssignment, file)}
          onSelectSubmission={setSelectedSubmission}
          t={t}
          userProfile={userProfile}
          memberProfiles={memberProfiles || []}
          onAssignAward={handleAssignAward}
          onUpdatePrizes={handleUpdatePrizes}
          onUpdateGalleryPrivacy={handleUpdateGalleryPrivacy}
          onRunAiJury={handleRunAiJury}
          isJuryRunning={!!isJuryRunning}
          onModeration={handleModeration}
          onWithdraw={handleWithdrawSubmission}
          onLike={handleLikeSubmission}
          onAddJury={handleAddJury}
          onToggleAiJury={handleToggleAiJury}
          onDeleteGroup={handleDeleteGroup}
          onArchiveCompetition={handleArchiveCompetition}
          canManageGroup={!!canManageGroup}
          AwardManager={AwardManager}
          JuryManager={JuryManager}
          ModerationManager={ModerationManager}
          allSubmissions={submissions || []}
          DeleteGroupModal={DeleteGroupModal}
          AssignmentUploader={AssignmentUploader}
        />
      ) : (
        <StandardGroupView 
          group={group}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          trips={trips || []}
          isTripsLoading={!!isTripsLoading}
          isOwner={isCurrentUserOwner}
          userId={user?.uid || ''}
          assignments={assignments || []}
          submissions={submissions || []}
          handleUploadSubmission={handleUploadSubmission}
          isUploading={!!isUploading}
          setSelectedSubmission={setSelectedSubmission}
          onLike={handleLikeSubmission}
          t={t}
          onModeration={handleModeration}
          ModerationManager={ModerationManager}
          TripCard={TripCard}
          AssignmentUploader={AssignmentUploader}
          EventCreator={EventCreator}
          DeleteGroupModal={DeleteGroupModal}
        />
      )}

      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl flex flex-col md:flex-row rounded-[48px] shadow-3xl">
            <div className="relative w-full md:w-3/5 h-[45vh] md:h-auto bg-black/60 shrink-0 border-r border-white/5 overflow-hidden group">
              <VieworaImage variants={selectedSubmission.imageUrls} fallbackUrl={selectedSubmission.photoUrl} type="detailView" alt="Eser" containerClassName="w-full h-full" />
            </div>
            <div className="flex-1 md:w-2/5 flex flex-col p-10 space-y-8 overflow-y-auto">
              <DialogHeader className="space-y-6">
                <div className="flex items-center justify-between py-4 border-y border-white/5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border-4 border-white/10">
                      <AvatarImage src={selectedSubmission.userPhotoURL || ''} />
                      <AvatarFallback>{selectedSubmission.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-xl font-black tracking-tighter uppercase mb-0.5">@{selectedSubmission.userName}</DialogTitle>
                      <DialogDescription className="text-[10px] uppercase font-black">{new Date(selectedSubmission.submittedAt).toLocaleString('tr')}</DialogDescription>
                    </div>
                  </div>
                  <Button onClick={() => handleLikeSubmission(selectedSubmission.id)} variant={selectedSubmission.likes?.includes(user?.uid) ? 'default' : 'outline'} className="gap-2">
                    <Heart className={cn("h-4 w-4", selectedSubmission.likes?.includes(user?.uid) ? "fill-current" : "")} />
                    {selectedSubmission.likes?.length || 0}
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-8">
                <div className="text-center">
                    <p className="text-3xl font-black">{selectedSubmission.aiFeedback?.evaluation?.score || 0}%</p>
                    <p className="text-muted-foreground italic text-sm">"{selectedSubmission.aiFeedback?.evaluation?.feedback}"</p>
                </div>
                {selectedSubmission.juryReviews?.map(rev => (
                    <div key={rev.userId} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <p className="font-bold">@{rev.userName} - {rev.score}/10</p>
                        <p className="text-sm italic">"{rev.feedback}"</p>
                    </div>
                ))}
                {isCurrentUserJury && <JuryEvaluationModal submission={selectedSubmission} onSave={(review) => handleCreateJuryReview(selectedSubmission.id, review)} t={t} />}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
