'use client';

import { ShieldAlert, RefreshCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in duration-700">
      <div className="mb-6 p-5 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 shadow-2xl shadow-amber-500/5">
        <ShieldAlert size={48} className="text-amber-500" />
      </div>
      
      <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-4 leading-none">
        Bir Hata <span className="text-amber-500">Oluştu</span>
      </h1>
      
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] mb-10 max-w-sm opacity-60">
        Sayfa düzgün yüklenemedi. Verilerinizi kaybetmemek için sayfayı yenilemeyi deneyebilirsiniz.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <button 
          onClick={() => reset()}
          className="flex-1 h-12 rounded-xl bg-white text-black font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCcw size={14} />
          Yenile
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="flex-1 h-12 rounded-xl bg-secondary/30 border border-border/40 font-black uppercase text-[10px] tracking-widest hover:bg-secondary/50 transition-all flex items-center justify-center gap-2"
        >
          <Home size={14} />
          Geri Dön
        </button>
      </div>

      {error.digest && (
         <div className="mt-8 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[8px] text-white/30 uppercase tracking-widest">
           ID: {error.digest}
         </div>
      )}
    </div>
  );
}
