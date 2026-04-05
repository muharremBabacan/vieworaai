'use client';
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Timer, CheckCircle, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompetitionStatusBadgeProps {
    startDate?: string;
    endDate?: string;
    isArchived?: boolean;
    t: any;
    className?: string;
}

export function CompetitionStatusBadge({ startDate, endDate, isArchived, t, className }: CompetitionStatusBadgeProps) {
    if (isArchived) {
        return (
            <Badge className={cn("bg-zinc-500/20 text-zinc-400 border-none font-black text-[9px] uppercase tracking-widest", className)}>
                <Archive size={10} className="mr-1" />
                {t('status_archived') || 'Arşivlendi'}
            </Badge>
        );
    }

    if (!startDate || !endDate) return null;

    const now = new Date();
    const end = new Date(endDate);
    const hasEnded = now > end;

    if (hasEnded) {
        return (
            <Badge className={cn("bg-red-500/20 text-red-500 border-none font-black text-[9px] uppercase tracking-widest animate-pulse", className)}>
                <Timer size={10} className="mr-1" />
                {t('status_ended')}
            </Badge>
        );
    }

    return (
        <Badge className={cn("bg-green-500/20 text-green-500 border-none font-black text-[9px] uppercase tracking-widest", className)}>
            <CheckCircle size={10} className="mr-1 shadow-green-500/50" />
            {t('status_active')}
        </Badge>
    );
}
