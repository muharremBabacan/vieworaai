'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModerationManagerProps {
    pendingSubmissions: any[];
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    t: any;
}

export function ModerationManager({ pendingSubmissions, onApprove, onReject, t }: ModerationManagerProps) {
    if (pendingSubmissions.length === 0) {
        return (
            <div className="text-center py-20 rounded-3xl border-2 border-dashed border-white/5 bg-white/5 opacity-50">
                <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-black uppercase text-[10px] tracking-widest">{t('status_no_pending') || 'Onay bekleyen çalışma yok.'}</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {pendingSubmissions.map(sub => (
                <Card key={sub.id} className="p-6 rounded-3xl border-white/5 bg-white/5 flex flex-col md:flex-row items-center gap-6 shadow-xl">
                    <div className="h-40 w-40 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                        <img src={sub.photoUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                            <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase tracking-widest mb-1">{t('status_pending_approval')}</Badge>
                            <p className="text-xl font-black uppercase tracking-tight">@{sub.userName}</p>
                        </div>
                        <div className="flex gap-3">
                            <Button 
                                onClick={() => onApprove(sub.id)}
                                className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest bg-green-500 hover:bg-green-600 transition-all flex-1"
                            >
                                <Check size={14} className="mr-2" /> {t('button_approve')}
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => onReject(sub.id)}
                                className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all flex-1"
                            >
                                <X size={14} className="mr-2" /> {t('button_reject')}
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
