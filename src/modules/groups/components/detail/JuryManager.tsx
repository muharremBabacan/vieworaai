'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Cpu, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicUserProfile } from "@/types";

interface JuryManagerProps {
    members: PublicUserProfile[];
    juryIds: string[];
    isAiJuryEnabled: boolean;
    onAdd: (id: string) => void;
    onToggleAiJury: () => void;
    t: any;
}

export function JuryManager({ members, juryIds, isAiJuryEnabled, onAdd, onToggleAiJury, t }: JuryManagerProps) {
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
