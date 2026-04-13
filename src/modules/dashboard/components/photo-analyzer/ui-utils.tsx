
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Lock, Scan } from 'lucide-react';

export const RatingBar = ({ label, score, isLocked }: { label: string; score: number; isLocked?: boolean }) => (
  <div className={cn("relative", isLocked && "opacity-40 grayscale")}>
    <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      <span className="flex items-center gap-1">{label} {isLocked && <Lock className="h-2.5 w-2.5" />}</span>
      <span className="text-foreground">{isLocked ? '?' : score.toFixed(1)}</span>
    </div>
    <div className="relative">
      <Progress value={isLocked ? 0 : score * 10} className="h-1.5" />
      {isLocked && <div className="absolute inset-0 bg-muted/20 backdrop-blur-[1px] rounded-full" />}
    </div>
  </div>
);

export const ScanningOverlay = ({ label }: { label: string }) => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
    <div className="relative w-full max-w-[280px] space-y-6 text-center">
      <div className="relative h-20 w-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Scan className="h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black uppercase tracking-tighter text-white">Luma Taraması</h3>
        <p className="text-xs font-bold text-primary/80 uppercase tracking-[0.2em] animate-pulse">{label}</p>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary animate-progress-fast shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
      </div>
    </div>
  </div>
);
