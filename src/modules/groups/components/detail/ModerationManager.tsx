'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModerationManagerProps {
    submissions: any[];
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onReset: (id: string) => void;
    t: any;
}

export function ModerationManager({ submissions, onApprove, onReject, onReset, t }: ModerationManagerProps) {
    const pending = submissions.filter(s => s.status === 'pending');
    const moderated = submissions.filter(s => s.status === 'approved' || s.status === 'rejected');

    return (
        <div className="space-y-12">
            {/* Pending Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Badge className="bg-amber-500/20 text-amber-500 border-none font-black text-[10px] uppercase tracking-widest">{t('status_pending_approval')}</Badge>
                    <div className="h-px bg-white/5 flex-1" />
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{pending.length} {t('label_items') || 'Eser'}</span>
                </div>
                
                {pending.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border-2 border-dashed border-white/5 bg-white/5 opacity-50">
                        <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase text-[10px] tracking-widest">{t('status_no_pending') || 'Onay bekleyen çalışma yok.'}</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {pending.map(sub => (
                            <ModerationCard 
                                key={sub.id} 
                                sub={sub} 
                                onApprove={onApprove} 
                                onReject={onReject} 
                                t={t} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Moderated Section */}
            {moderated.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest">{t('status_moderated') || 'İşlem Yapılanlar'}</Badge>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {moderated.map(sub => (
                            <Card key={sub.id} className="p-4 rounded-2xl border-white/5 bg-white/5 flex items-center gap-4 relative group overflow-hidden">
                                <div className="h-16 w-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                    <img src={sub.photoUrl} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase truncate">@{sub.userName}</p>
                                    <Badge className={cn(
                                        "mt-1 border-none font-black text-[8px] uppercase tracking-widest px-2 h-4",
                                        sub.status === 'approved' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                    )}>
                                        {sub.status === 'approved' ? t('status_approved') : t('status_rejected')}
                                    </Badge>
                                </div>
                                <Button 
                                    onClick={() => onReset(sub.id)}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <RefreshCw size={14} className="text-muted-foreground" />
                                </Button>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ModerationCard({ sub, onApprove, onReject, t }: { sub: any, onApprove: any, onReject: any, t: any }) {
    return (
        <Card className="p-6 rounded-3xl border-white/5 bg-white/5 flex flex-col md:flex-row items-center gap-6 shadow-xl hover:bg-white/[0.07] transition-colors">
            <div className="h-40 w-40 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                <img src={sub.photoUrl} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-4">
                <div className="space-y-1 text-center md:text-left">
                    <p className="text-xl font-black uppercase tracking-tight">@{sub.userName}</p>
                    <p className="text-[10px] font-medium text-muted-foreground opacity-60">ID: {sub.id.substring(0,8)}... • {new Date(sub.submittedAt).toLocaleTimeString()}</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={() => onApprove(sub.id)}
                        className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/10 transition-all flex-1"
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
    );
}

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
