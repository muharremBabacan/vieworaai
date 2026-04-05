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
import { Power, AlertCircle } from "lucide-react";

interface ManualEndModalProps {
    onConfirm: () => void;
    t: any;
}

export function ManualEndModal({ onConfirm, t }: ManualEndModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-2xl font-black uppercase tracking-wider border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all active:scale-95 shadow-xl shadow-red-500/5">
                    <Power size={18} className="mr-2" /> {t('button_finish_now') || 'Şimdi Bitir'}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8 shadow-3xl">
                <DialogHeader className="space-y-4">
                    <div className="h-20 w-20 bg-red-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-red-500/20 shadow-inner group">
                        <Power size={40} className="text-red-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
                        {t('manual_end_title') || 'Yarışmayı Sonlandır'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground text-center font-medium opacity-70">
                        {t('manual_end_desc') || 'Yarışmayı şimdi durdurmak istediğinize emin misiniz? Mevcut başvurular arşive taşınacak ve yeni ödev bekleniyor durumuna geçilecektir.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-3 items-center">
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wide">
                            {t('reset_comp_warning') || 'BU İŞLEM GERİ ALINAMAZ.'}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button 
                        variant="destructive"
                        onClick={() => { onConfirm(); setIsOpen(false); }}
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-500/20 active:scale-95"
                    >
                        {t('button_finish_now') || 'Evet, Şimdi Bitir'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
