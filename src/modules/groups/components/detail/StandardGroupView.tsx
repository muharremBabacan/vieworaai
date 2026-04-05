'use client';
import React from "react";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    Calendar, 
    Info, 
    ImageIcon, 
    ShieldCheck, 
    Trophy 
} from "lucide-react";
import { VieworaImage } from '@/core/components/viewora-image';
import { cn } from "@/lib/utils";

interface StandardGroupViewProps {
    group: any;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    trips: any[];
    isTripsLoading: boolean;
    isOwner: boolean;
    userId: string;
    userProfile: any;
    assignments: any[];
    submissions: any[];
    handleUploadSubmission: (ass: any, file: File) => void;
    isUploading: boolean;
    setSelectedSubmission: (sub: any) => void;
    canViewGallery: boolean;
    memberProfiles: any[];
    handleAssignAward: (id: string, award: string) => void;
    handleRunAiJury: () => void;
    isJuryRunning: boolean;
    handleAddJury: (id: string) => void;
    handleCreateTrip: (data: any) => void;
    canManageGroup: boolean;
    handleDeleteGroup: () => void;
    t: any;
    // Sub-components
    TripCard: any;
    AssignmentUploader: any;
    EventCreator: any;
    DeleteGroupModal: any;
}

export function StandardGroupView({ 
    group, activeTab, setActiveTab, trips, isTripsLoading, isOwner, userId, userProfile, assignments, submissions, 
    handleUploadSubmission, isUploading, setSelectedSubmission, canViewGallery, memberProfiles, handleCreateTrip, 
    canManageGroup, handleDeleteGroup, t,
    TripCard,
    AssignmentUploader,
    EventCreator,
    DeleteGroupModal
}: StandardGroupViewProps) {
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
                                        {!userSubmission ? <AssignmentUploader onUpload={(file: File) => handleUploadSubmission(ass, file)} isUploading={isUploading} t={t} /> :
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
