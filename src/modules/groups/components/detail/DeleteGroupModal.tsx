'use client';
import React from "react";
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
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteGroupModalProps {
    onConfirm: () => void;
    t: any;
}

export function DeleteGroupModal({ onConfirm, t }: DeleteGroupModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="destructive" className="h-12 px-8 rounded-2xl font-black uppercase tracking-wider shadow-xl shadow-red-500/20 active:scale-95 transition-all">
                    <Trash2 size={18} className="mr-2" /> {t('button_delete_group')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8 shadow-3xl">
                <DialogHeader className="space-y-4">
                    <div className="h-20 w-20 bg-red-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
                        {t('delete_group_dialog_title')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground text-center font-medium opacity-70">
                        {t('delete_group_dialog_description')}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="pt-8 flex flex-col gap-3 sm:flex-col">
                    <Button 
                        variant="destructive" 
                        onClick={onConfirm}
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-500/20 active:scale-95"
                    >
                        {t('button_delete_group')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
