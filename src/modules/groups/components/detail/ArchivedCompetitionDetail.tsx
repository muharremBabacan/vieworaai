'use client';
import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Trophy, MapPin, Camera, Info, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArchivedCompetitionDetailProps {
    competition: {
        subject: string;
        startDate: string;
        endDate: string;
        participants?: any[];
    };
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    t: any;
}

export function ArchivedCompetitionDetail({ competition, isOpen, onOpenChange, t }: ArchivedCompetitionDetailProps) {
    const [selectedParticipant, setSelectedParticipant] = useState<any>(null);

    // Guard against null competition to prevent crashes during dialog transitions
    if (!competition) return null;

    const getScore = (p: any) => {
        if (!p.aiFeedback?.evaluation?.score) return 0;
        return p.aiFeedback.evaluation.score;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden border-white/10 bg-[#0a0a0b] flex flex-col rounded-[48px] shadow-3xl">
                <DialogHeader className="p-10 border-b border-white/5 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="flex items-center gap-3 mb-2">
                        <Trophy size={16} className="text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{t('archive_detail_label') || 'YARIŞMA DETAYI LİSTESİ'}</p>
                    </div>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter">{competition.subject}</DialogTitle>
                    <DialogDescription className="font-bold opacity-60">
                        {competition.startDate} — {competition.endDate} • {competition.participants?.length || 0} {t('label_participants') || 'Katılımcı'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Participant List */}
                    <ScrollArea className="w-1/2 border-r border-white/5 p-6 md:p-10">
                        <div className="space-y-4">
                            {competition.participants?.sort((a,b) => getScore(b) - getScore(a)).map((p, idx) => (
                                <Card 
                                    key={idx} 
                                    onClick={() => setSelectedParticipant(p)}
                                    className={cn(
                                        "p-4 rounded-3xl border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-5 group",
                                        selectedParticipant?.userId === p.userId && "border-primary/30 bg-primary/10"
                                    )}
                                >
                                    <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                                        <img src={p.imageUrls?.smallSquare || p.photoUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge className={cn(
                                                "border-none font-black text-[8px] uppercase tracking-widest px-2 py-0.5",
                                                p.award !== 'participant' ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/40"
                                            )}>
                                                {t(`award_${p.award}`)}
                                            </Badge>
                                            <span className="text-[10px] font-black text-primary/80"><Star size={10} className="inline mr-1 fill-current" /> {getScore(p).toFixed(1)}</span>
                                        </div>
                                        <p className="font-black uppercase tracking-tight text-lg">@{p.userName}</p>
                                    </div>
                                    <Eye size={16} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Detailed Result Card */}
                    <div className="w-1/2 bg-black/40 p-10 flex flex-col justify-center">
                        {selectedParticipant ? (
                            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                                <div className="aspect-[4/3] rounded-[40px] overflow-hidden border border-white/10 shadow-3xl">
                                    <img src={selectedParticipant.imageUrls?.detailView || selectedParticipant.photoUrl} className="w-full h-full object-cover" />
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-2xl font-black uppercase tracking-tighter">@{selectedParticipant.userName}</h4>
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t(`award_${selectedParticipant.award}`)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase opacity-40">{t('label_total_score') || 'TOPLAM PUAN'}</p>
                                            <p className="text-3xl font-black text-primary leading-none tracking-tighter">{getScore(selectedParticipant).toFixed(1)}</p>
                                        </div>
                                    </div>

                                    {/* Jury Scores breakdown */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('label_jury_reviews') || 'JÜRİ DEĞERLENDİRMELERİ'}</p>
                                        <div className="grid gap-3">
                                            {selectedParticipant.juryReviews?.length > 0 ? selectedParticipant.juryReviews.map((rev: any, i: number) => (
                                                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                                                    <div className="flex justify-between items-center bg-white/5 -mx-4 -mt-4 p-3 px-4 rounded-t-2xl">
                                                        <span className="text-[10px] font-black uppercase opacity-70">Jüri #{i+1}</span>
                                                        <Badge variant="secondary" className="bg-primary/20 text-primary border-none shadow-none">{rev.score} / 10</Badge>
                                                    </div>
                                                    <p className="text-xs font-medium italic opacity-80 leading-relaxed">"{rev.comment}"</p>
                                                </div>
                                            )) : (
                                                <div className="p-6 rounded-2xl border-2 border-dashed border-white/5 text-center opacity-40">
                                                    <Info size={20} className="mx-auto mb-2" />
                                                    <p className="text-[10px] font-black uppercase">{t('no_jury_reviews') || 'Jüri puanı bulunamadı (AI Değerlendirmesi)'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-3 opacity-20">
                                <Camera size={64} className="mx-auto" />
                                <p className="font-black uppercase text-xs tracking-[0.3em]">{t('history_select_hint') || 'DETAY İÇİN LİSTEDEN SEÇİN'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

