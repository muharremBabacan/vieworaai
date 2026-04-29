"use client";

import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const t = useTranslations('PWA');
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Standalone modda mı kontrol et
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // 2. Daha önce kapatıldı mı kontrol et
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (isDismissed) return;

    // 3. Platform tespiti
    const ua = window.navigator.userAgent;
    const isIphone = /iphone|ipad|ipod/.test(ua.toLowerCase());
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    setIsIOS(isIphone && isSafari);

    // 4. Android/Chrome için install event dinle
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Tarayıcı yüklemeye hazır olduğunda pop-up'ı göster
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 5. UX: Yalnızca iOS (Safari) için zamanlayıcı ile göster
    // Çünkü iOS 'beforeinstallprompt' desteklemez, manuel rehber gösterilir.
    let timer: NodeJS.Timeout;
    if (isIphone && isSafari) {
      timer = setTimeout(() => {
        setIsVisible(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
      localStorage.setItem('pwa-prompt-dismissed', 'true');
    }
    setDeferredPrompt(null);
  };

  const dismissPrompt = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="max-w-md mx-auto bg-[#1a1c26] border border-white/10 rounded-3xl shadow-2xl p-6 relative overflow-hidden group">
        {/* Dekoratif Gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600 opacity-50" />
        
        <button 
          onClick={dismissPrompt}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <Download size={24} />
          </div>
          
          <div className="space-y-1 pr-6">
            <h3 className="text-white font-bold text-lg tracking-tight">{t('title')}</h3>
            <p className="text-gray-400 text-sm leading-snug">
              {t('description')}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {isIOS ? (
            <div className="bg-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white">1</div>
                <p>
                  {t.rich('ios_step1', {
                    icon: () => <Share size={16} className="inline mx-1 text-blue-400" />
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white">2</div>
                <p>
                  {t.rich('ios_step2', {
                    text: () => <span className="text-white font-medium">{t('ios_step2_text')}</span>,
                    icon: () => <PlusSquare size={16} className="inline mx-1" />
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white">3</div>
                <p>
                  {t.rich('ios_step3', {
                    text: () => <span className="text-blue-400 font-bold uppercase">{t('ios_step3_text')}</span>
                  })}
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Download size={20} />
              {t('install_button')}
            </button>
          )}

          <button
            onClick={dismissPrompt}
            className="w-full text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
          >
            {t('maybe_later')}
          </button>
        </div>
      </div>
    </div>
  );
}
