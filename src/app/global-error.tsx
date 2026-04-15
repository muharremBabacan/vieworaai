'use client';

import { ShieldAlert, RefreshCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body className="bg-[#0f111a] text-white antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-in fade-in duration-700">
          <div className="mb-8 p-6 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 shadow-2xl shadow-red-500/5">
            <ShieldAlert size={64} className="text-red-500" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4 leading-none">
            Sistem <span className="text-red-500">Kritik</span> Hata
          </h1>
          
          <p className="text-muted-foreground text-sm font-bold uppercase tracking-[0.2em] mb-12 max-w-md opacity-60">
            Beklenmedik bir hata ile karşılaşıldı. Oturum açma verileri veya ağ bağlantısı kaynaklı olabilir.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
            <button 
              onClick={() => reset()}
              className="flex-1 h-14 rounded-2xl bg-white text-black font-black uppercase text-xs tracking-widest shadow-xl shadow-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCcw size={18} />
              Tekrar Dene
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="flex-1 h-14 rounded-2xl bg-secondary/30 border border-border/40 font-black uppercase text-xs tracking-widest hover:bg-secondary/50 transition-all flex items-center justify-center gap-3"
            >
              <Home size={18} />
              Ana Sayfa
            </button>
          </div>

          {error.digest && (
             <div className="mt-12 p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-white/30 uppercase tracking-widest">
               Digest ID: {error.digest}
             </div>
          )}
        </div>
      </body>
    </html>
  );
}