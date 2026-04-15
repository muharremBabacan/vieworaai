
import { Sparkles, Gem, RefreshCw, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarketingItem } from './MarketingItem';

interface MarketingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingModal({ open, onOpenChange }: MarketingModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[40px] bg-[#0a0a0b] border-white/10 p-0 overflow-hidden shadow-3xl">
        <DialogHeader className="relative h-48 w-full">
          <img 
            src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-50" 
            alt="Background" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
          <div className="absolute bottom-6 left-8 right-8 text-left">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-primary fill-current" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">SINIRLI SÜRELİ TEKLİF</p>
            </div>
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">
              İLK 1000 ÜYE ARASINA KATILIN
            </DialogTitle>
            <DialogDescription className="sr-only">Üye avantajlarını keşfedin.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="p-10 pt-0 space-y-8">
          <div className="space-y-4 text-left">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Misafir analiz hakkınız doldu. Şimdi ücretsiz üye olarak bu özel avantajları hemen yakalayabilirsiniz:
            </p>
            <div className="grid gap-3">
              <MarketingItem icon={Gem} color="text-cyan-400" text="20 Pix Hoş Geldin Bonusu" />
              <MarketingItem icon={RefreshCw} color="text-purple-400" text="Her Hafta Otomatik 5 Pix Yükleme" />
              <MarketingItem icon={Globe} color="text-blue-400" text="1 Adet Kişisel Sergi Oluşturma Hakkı" />
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <Button 
                onClick={() => router.push('/signup')} 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm bg-primary text-primary-foreground shadow-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95"
            >
                Hemen Üye Ol <Sparkles size={18} />
            </Button>
            <Button 
                onClick={() => onOpenChange(false)} 
                variant="ghost" 
                className="w-full h-10 rounded-xl font-black uppercase tracking-widest text-[9px] text-muted-foreground opacity-50 hover:opacity-100"
            >
                Belki Daha Sonra
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

