'use client';
import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, RefreshCw, AlertTriangle, Trophy } from "lucide-react";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";

interface ResetCompetitionModalProps {
    onConfirm: (data: { subject: string, startDate: string, endDate: string }) => void;
    currentSubject: string;
    t: any;
}

export function ResetCompetitionModal({ onConfirm, currentSubject, t }: ResetCompetitionModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-wider border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shadow-xl shadow-amber-500/5 active:scale-95 transition-all">
                    <RefreshCw size={18} className="mr-2" /> {(new Date() > new Date(formData.endDate)) ? (t('button_archive_and_finish') || 'Bitir \u0026 Yeni Tur') : (t('button_reset_competition') || 'Yeni Yarışma Başlat')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8 shadow-3xl">
                <DialogHeader className="space-y-4">
                    <div className="h-20 w-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                        <RefreshCw size={40} className="text-amber-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
                        {t('reset_comp_dialog_title') || 'Yeni Yarışma Turu'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground text-center font-medium opacity-70">
                        {t('reset_comp_dialog_desc') || 'Mevcut yarışma sonuçlarını arşivleyecek ve yeni bir tur başlatacaksınız. Mevcut tüm başvurular sergiden kaldırılacaktır.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('form_label_comp_subject')}</Label>
                        <Input 
                            value={formData.subject} 
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder={currentSubject}
                            className="rounded-xl border-white/5 bg-white/5 font-medium h-11"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('form_label_comp_start_date')}</Label>
                            <Input 
                                type="date"
                                value={formData.startDate} 
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="rounded-xl border-white/5 bg-white/5 h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('form_label_comp_end_date')}</Label>
                            <Input 
                                type="date"
                                value={formData.endDate} 
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="rounded-xl border-white/5 bg-white/5 h-11"
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex gap-3">
                        <AlertTriangle size={18} className="text-red-500 shrink-0" />
                        <p className="text-[10px] font-bold text-red-500/80 leading-relaxed uppercase italic">
                            {t('reset_comp_warning') || 'BU İŞLEM GERİ ALINAMAZ. MEVCUT BAŞVURULAR ARŞİVLENECEK VE YENİ TUR BAŞLAYACAK.'}
                        </p>
                    </div>
                </div>

                <DialogFooter className="pt-8 flex flex-col gap-3 sm:flex-col">
                    <Button 
                        onClick={() => { onConfirm(formData); setIsOpen(false); }}
                        disabled={!formData.subject}
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-amber-500/20 active:scale-95 bg-amber-500 hover:bg-amber-600"
                    >
                        {t('button_reset_and_start') || 'Arşivle \u0026 Başlat'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
