import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Medal, Star, Award, Search, Info } from "lucide-react";
import type { Group } from "@/types";
import { ArchivedCompetitionDetail } from "./ArchivedCompetitionDetail";

interface CompetitionHistoryProps {
    history: Group['pastCompetitions'];
    t: any;
}

export function CompetitionHistory({ history, t }: CompetitionHistoryProps) {
    const [selectedDetail, setSelectedDetail] = useState<any>(null);

    if (!history || history.length === 0) {
        return (
            <div className="text-center py-20 rounded-3xl border-2 border-dashed border-white/5 bg-white/5 opacity-50">
                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-black uppercase text-[10px] tracking-widest">{t('history_empty') || 'Yarışma geçmişi henüz yok.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {history.map((item) => (
                <Card key={item.id} className="p-8 rounded-[40px] border-white/5 bg-white/5 space-y-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                        <Trophy size={120} />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/5 pb-6">
                        <div className="space-y-2">
                            <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase tracking-widest">{item.startDate} — {item.endDate}</Badge>
                            <h3 className="text-2xl font-black uppercase tracking-tight">{item.subject}</h3>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="text-right hidden md:block">
                                <p className="text-[10px] font-black uppercase opacity-50">{t('label_archived_at') || 'Arşivlenme Tarihi'}</p>
                                <p className="text-sm font-bold">{new Date(item.archivedAt).toLocaleDateString('tr')}</p>
                            </div>
                            <Button 
                                onClick={() => setSelectedDetail(item)}
                                className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                            >
                                <Search size={14} className="mr-2" /> {t('button_detail_review') || 'Detay İncele'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('label_winners')}</p>
                            <div className="grid gap-3">
                                {item.winners.map((winner, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl bg-black/40 border border-white/5 shadow-xl">
                                        <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                                            <img src={winner.photoUrl} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-primary/20 text-primary border-none font-black text-[8px] uppercase">{t(`award_${winner.award}`)}</Badge>
                                                {item.prizes?.[winner.award as keyof typeof item.prizes] && (
                                                    <span className="text-[9px] font-bold text-amber-500 opacity-80">{item.prizes[winner.award as keyof typeof item.prizes]}</span>
                                                )}
                                            </div>
                                            <p className="font-black text-sm uppercase">@{winner.userName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('label_prizes')}</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'first', icon: Trophy, color: 'text-amber-500' },
                                    { id: 'second', icon: Trophy, color: 'text-slate-400' },
                                    { id: 'third', icon: Trophy, color: 'text-amber-700' },
                                ].map(p => (
                                    item.prizes?.[p.id as keyof typeof item.prizes] && (
                                        <div key={p.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                                            <p.icon size={14} className={p.color} />
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-black uppercase opacity-50">{t(`award_${p.id}`)}</p>
                                                <p className="text-[10px] font-bold truncate max-w-[80px]">{item.prizes[p.id as keyof typeof item.prizes]}</p>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            ))}

            <ArchivedCompetitionDetail 
                competition={selectedDetail} 
                isOpen={!!selectedDetail} 
                onOpenChange={(o) => !o && setSelectedDetail(null)} 
                t={t} 
            />
        </div>
    );
}
