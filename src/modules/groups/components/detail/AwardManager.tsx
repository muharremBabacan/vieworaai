'use client';
import React from "react";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cpu } from "lucide-react";
import type { GroupSubmission } from "@/types";

interface AwardManagerProps {
    submissions: GroupSubmission[];
    onAssign: (id: string, award: string) => void;
    onRunAiJury: () => void;
    isJuryRunning: boolean;
    t: any;
}

export function AwardManager({ submissions, onAssign, onRunAiJury, isJuryRunning, t }: AwardManagerProps) {
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
                                <SelectItem value="honorable_mention">{t('award_honorable_mention')}</SelectItem>
                                <SelectItem value="participant">{t('award_participant')}</SelectItem>
                                <SelectItem value="viewora">{t('award_viewora')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </div>
    );
}
