'use client';
import React from "react";
import { doc, collection, setDoc } from "firebase/firestore";
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/lib/firebase";
import { useTranslations } from 'next-intl';
import { useToast } from "@/shared/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
    Calendar, 
    Clock, 
    Map, 
    MapPin, 
    Users, 
    Flag, 
    ShieldCheck, 
    Loader2, 
    ImageIcon, 
    Info 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trip, PublicUserProfile } from "@/types";

type ParticipantStatus = 'yes' | 'no' | 'pending';
interface TripParticipant {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  status: ParticipantStatus;
  updatedAt: string;
}

const TYPE_MAP: Record<string, { icon: any, labelKey: string, color: string }> = {
  start: { icon: MapPin, labelKey: "type_start", color: "text-primary" },
  photo_stop: { icon: Camera, labelKey: "type_photo_stop", color: "text-amber-400" },
  break: { icon: Coffee, labelKey: "type_break", color: "text-blue-400" },
  viewpoint: { icon: Eye, labelKey: "type_viewpoint", color: "text-green-400" },
  end: { icon: Flag, labelKey: "type_end", color: "text-primary" },
};

import { Camera, Coffee, Eye } from "lucide-react";

export function TripCard({ trip, isOwner, userId, userProfile, groupId }: { trip: Trip, isOwner: boolean, userId: string, userProfile: any, groupId: string }) {
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

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div className="grid md:grid-cols-2 gap-8">
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
