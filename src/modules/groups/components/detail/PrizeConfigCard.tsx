'use client';
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trophy, Medal, Award, Star } from "lucide-react";

interface PrizeConfigCardProps {
    prizes: any;
    onSave: (newPrizes: any) => Promise<void>;
    t: any;
}

export function PrizeConfigCard({ prizes, onSave, t }: PrizeConfigCardProps) {
    const [localPrizes, setLocalPrizes] = useState(prizes || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { 
        setLocalPrizes(prizes || {}); 
    }, [prizes]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(localPrizes);
        } finally {
            setIsSaving(false);
        }
    };

    const tiers = [
        { id: 'first', label: t('award_first'), icon: Trophy, color: 'text-amber-500' },
        { id: 'second', label: t('award_second'), icon: Trophy, color: 'text-slate-400' },
        { id: 'third', label: t('award_third'), icon: Trophy, color: 'text-amber-700' },
        { id: 'honorable_mention', label: t('award_honorable_mention'), icon: Medal, color: 'text-primary' },
        { id: 'viewora', label: t('award_viewora'), icon: Star, color: 'text-purple-500' },
        { id: 'participant', label: t('award_participant'), icon: Award, color: 'text-green-500' },
    ];

    return (
        <Card className="p-8 rounded-[32px] bg-white/5 border border-white/10 space-y-6">
            <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tight">{t('label_prize_config_title')}</h3>
                <p className="text-xs text-muted-foreground font-medium">{t('label_prize_config_desc')}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                {tiers.map(r => (
                    <div key={r.id} className="space-y-2">
                        <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                            <r.icon size={12} className={r.color} /> {r.label}
                        </Label>
                        <Input 
                            value={localPrizes[r.id] || ''} 
                            onChange={(e) => setLocalPrizes({ ...localPrizes, [r.id]: e.target.value })}
                            placeholder="..."
                            className="rounded-xl border-white/5 bg-white/5 font-medium focus:border-primary/50 transition-colors"
                            disabled={isSaving}
                        />
                    </div>
                ))}
            </div>
            <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-primary shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {isSaving ? t('status_saving') || 'Kaydediliyor...' : t('button_save_prizes')}
            </Button>
        </Card>
    );
}
