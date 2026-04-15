
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MarketingItemProps = {
  icon: LucideIcon;
  color: string;
  text: string;
};

export function MarketingItem({ icon: Icon, color, text }: MarketingItemProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
      <div className={cn("p-2 rounded-xl bg-white/5", color)}>
        <Icon size={18} />
      </div>
      <span className="text-xs font-black uppercase tracking-tight">{text}</span>
    </div>
  );
}
