'use client';
import React, { useState } from "react";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
    Trophy, 
    CheckCircle2, 
    Award, 
    Medal, 
    ImageIcon 
} from "lucide-react";
import { VieworaImage } from '@/core/components/viewora-image';
import { PrizeConfigCard } from "./PrizeConfigCard";
import { ResetCompetitionModal } from "./ResetCompetitionModal";
import { ManualEndModal } from "./ManualEndModal";
import { CompetitionHistory } from "./CompetitionHistory";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { Timer, Hash, History, Settings2, Info } from "lucide-react";

// Note: These sub-components should ideally be in their own files too
// but to keep the refactor focused, we'll import them or define them locally
// if they are small enough.

interface ChallengeGroupViewProps {
    group: any;
    user: any;
    submissions: any[];
    isOwner: boolean;
    isMember: boolean;
    isUploading: boolean;
    onUpload: (file: File) => void;
    onSelectSubmission: (sub: any) => void;
    t: any;
    userProfile: any;
    memberProfiles: any[];
    onAssignAward: (id: string, award: string) => void;
    onUpdatePrizes: (prizes: any) => Promise<void>;
    onRunAiJury: () => void;
    isJuryRunning: boolean;
    onModeration: (id: string, status: 'approved' | 'rejected') => void;
    onAddJury: (id: string) => void;
    onToggleAiJury: () => void;
    onDeleteGroup: () => void;
    onArchiveCompetition: (data?: any) => Promise<void>;
    canManageGroup: boolean;
    // Sub-components as props for now to avoid dependency hell
    AwardManager: any;
    JuryManager: any;
    ModerationManager: any;
    DeleteGroupModal: any;
    AssignmentUploader: any;
}

export function ChallengeGroupView({ 
    group, 
    user, 
    submissions, 
    isOwner, 
    isMember, 
    isUploading, 
    onUpload, 
    onSelectSubmission, 
    t, 
    userProfile, 
    memberProfiles, 
    onAssignAward, 
    onUpdatePrizes, 
    onRunAiJury, 
    isJuryRunning, 
    onModeration, 
    onAddJury, 
    onToggleAiJury, 
    onDeleteGroup, 
    onArchiveCompetition,
    canManageGroup,
    AwardManager,
    JuryManager,
    ModerationManager,
    DeleteGroupModal,
    AssignmentUploader
}: ChallengeGroupViewProps) {
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
                        <TabsTrigger value="history" className="shrink-0 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-white/5 transition-all">{t('tab_history') || 'Geçmiş'}</TabsTrigger>
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
                            <AssignmentUploader onUpload={onUpload} isUploading={isUploading} t={t} />
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
                                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 items-start">
                                        <Badge className="bg-amber-500 text-black font-black border-none shadow-lg animate-pulse">{t(`award_${sub.award}`)}</Badge>
                                        {group.prizes?.[sub.award] && (
                                            <Badge className="bg-black/60 backdrop-blur-md text-amber-500 border-amber-500/20 font-bold text-[9px] px-2 h-5">
                                                {group.prizes[sub.award]}
                                            </Badge>
                                        )}
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
                                     <div className="space-y-1">
                                         <div className="flex flex-wrap items-center gap-2">
                                            <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest">{t(`award_${sub.award}`)}</Badge>
                                            {group.prizes?.[sub.award] && (
                                                <div className="flex items-center gap-1.5 text-amber-500/80 px-2 py-0.5 rounded-lg bg-amber-500/5 border border-amber-500/10 animate-in zoom-in duration-300">
                                                    <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">{t('award_prize_label')}</span>
                                                    <span className="text-[10px] font-bold">{group.prizes[sub.award]}</span>
                                                </div>
                                            )}
                                          </div>
                                         <p className="text-xl font-black uppercase tracking-tight">@{sub.userName}</p>
                                         <Button onClick={() => onSelectSubmission(sub)} variant="link" className="p-0 h-auto font-bold text-xs uppercase text-muted-foreground hover:text-primary">{t('assignment_button_detail')}</Button>
                                     </div>
                                </Card>
                            ))}
                        </div>
                    ) : <div className="text-center py-32 rounded-[48px] border border-white/5 bg-white/5"><Medal size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold uppercase text-xs opacity-50 tracking-widest">{t('competitions_no_competitions_title')}</p></div>}
                </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-8">
                <div className="max-w-4xl mx-auto space-y-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">{t('tab_history') || 'Geçmiş Yarışmalar'}</h2>
                        <p className="text-muted-foreground font-medium italic">{t('history_desc') || 'Önceki yarışma turları ve kazananları.'}</p>
                    </div>

                    {/* Current Competition Context in History */}
                    <Card className="rounded-[32px] border-amber-500/10 bg-amber-500/5 p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                        <div className="space-y-1 flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Trophy size={14} className="text-amber-500" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">{t('label_current_competition')}</p>
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight">{group.competitionSubject}</h3>
                            <div className="flex items-center justify-center md:justify-start gap-4">
                                <p className="text-xs font-bold text-muted-foreground opacity-70">{group.startDate} — {group.endDate}</p>
                                <CompetitionStatusBadge startDate={group.startDate} endDate={group.endDate} t={t} />
                            </div>
                        </div>
                    </Card>

                    <CompetitionHistory history={group.pastCompetitions} t={t} />
                </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {memberProfiles?.map((profile: any) => (
                        <Card key={profile.id} className="p-4 rounded-2xl border-border/40 bg-card/50 flex items-center gap-4">
                            <Avatar className="border-none">
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
                             <TabsContent value="awards" className="p-8 space-y-10">
                                <PrizeConfigCard prizes={group.prizes} onSave={onUpdatePrizes} t={t} />
                                <div className="h-px bg-white/5 w-full" />
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
                                <div className="grid gap-6">
                                    <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12"><Trophy size={120} /></div>
                                        
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                            <div className="space-y-1.5 pt-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Trophy size={16} className="text-amber-500" />
                                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-500/80">{t('label_current_competition')}</h3>
                                                </div>
                                                <h4 className="text-3xl font-black uppercase tracking-tighter">{group.competitionSubject || t('not_determined')}</h4>
                                                <div className="flex items-center gap-4 pt-2">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                                        <Timer size={12} /> {group.startDate} — {group.endDate}
                                                    </div>
                                                    <CompetitionStatusBadge startDate={group.startDate} endDate={group.endDate} t={t} className="px-4 h-7 text-[10px]" />
                                                </div>
                                            </div>
                                            <div className="pt-4 w-full md:w-auto flex flex-col sm:flex-row gap-3">
                                                <ManualEndModal onConfirm={() => onArchiveCompetition()} t={t} />
                                                <ResetCompetitionModal onConfirm={onArchiveCompetition} currentSubject={group.competitionSubject} t={t} />
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
                                            <Info size={16} className="text-primary shrink-0 mt-0.5" />
                                            <p className="text-xs font-medium text-primary/80 leading-relaxed italic">
                                                {t('reset_comp_desc') || 'Mevcut yarışmayı arşivleyerek yeni bir konu ve tarihle taze bir başlangıç yapın.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-8 rounded-[32px] bg-red-500/5 border border-red-500/10 space-y-4">
                                        <h3 className="text-xl font-black uppercase text-red-500">{t('delete_group_title')}</h3>
                                        <p className="text-sm text-muted-foreground font-medium">{t('delete_group_description')}</p>
                                        <DeleteGroupModal onConfirm={onDeleteGroup} t={t} />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    );
}
