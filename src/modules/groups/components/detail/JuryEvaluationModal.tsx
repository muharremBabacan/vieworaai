'use client';
import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Star } from "lucide-react";
import type { GroupSubmission } from "@/types";

interface JuryEvaluationModalProps {
    submission: GroupSubmission;
    onSave: (review: any) => void;
    t: any;
}

export function JuryEvaluationModal({ submission, onSave, t }: JuryEvaluationModalProps) {
    const [score, setScore] = useState(8);
    const [feedback, setFeedback] = useState('');
    const [criteria, setCriteria] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const toggleCriteria = (c: string) => {
        setCriteria(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full h-14 rounded-3xl font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 shadow-xl active:scale-95">
                    <Star size={18} className="mr-2" /> {t('jury_modal_title')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-8 shadow-3xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase">{t('jury_modal_title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_score')}: {score}</Label>
                        <Input type="range" min="1" max="10" value={score} onChange={(e) => setScore(parseInt(e.target.value))} className="h-6" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_feedback')}</Label>
                        <Textarea 
                            placeholder="..." 
                            className="rounded-2xl min-h-[100px] border-white/10 bg-white/5 italic"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('jury_label_criteria')}</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {['composition', 'theme', 'simplicity'].map(c => (
                                <div key={c} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 cursor-pointer" onClick={() => toggleCriteria(c)}>
                                    <Checkbox checked={criteria.includes(c)} onCheckedChange={() => toggleCriteria(c)} />
                                    <span className="text-xs font-bold">{t(`jury_criteria_${c}`)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button 
                        className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-primary shadow-xl" 
                        onClick={() => { onSave({ score, feedback, criteria }); setIsOpen(false); }}
                    >
                        {t('jury_button_submit')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
