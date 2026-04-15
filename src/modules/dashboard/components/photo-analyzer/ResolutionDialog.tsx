
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";


interface ResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dimensions: { width: number; height: number } | null;
  onClose: () => void;
  t: (key: string) => string;
}

export function ResolutionDialog({ open, onOpenChange, dimensions, onClose, t }: ResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[32px] border-white/10 bg-[#0a0a0b]/95 backdrop-blur-3xl">
        <DialogHeader className="space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
            {t('error_photo_too_small_dialog_title')}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground font-medium leading-relaxed">
            {t('error_photo_too_small_dialog_description')}
          </DialogDescription>
          {dimensions && (
            <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase opacity-50">Genişlik</p>
                <p className="text-lg font-black text-primary">{dimensions.width}px</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase opacity-50">Yükseklik</p>
                <p className="text-lg font-black text-primary">{dimensions.height}px</p>
              </div>
            </div>
          )}
        </DialogHeader>
        <DialogFooter className="mt-6">
          <Button 
            onClick={onClose} 
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary shadow-xl"
          >
            {t('button_ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
