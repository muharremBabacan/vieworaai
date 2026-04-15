'use client';

import { usePush } from '@/components/providers/PushProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function NotificationOnboarding() {
  const t = useTranslations('SettingsPage');
  const { permission, requestPermission, hasDismissed, dismissPrompt } = usePush();

  // Only show if permission is default AND hasn't been dismissed in this session
  const showPrompt = permission === 'default' && !hasDismissed;

  const handleEnable = async () => {
    await requestPermission();
    dismissPrompt(); // Always dismiss after asking once
  };

  const handleDismiss = () => {
    dismissPrompt();
  };

  return (
    <Dialog open={showPrompt} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-gradient-to-b from-primary/20 to-background p-10 space-y-8 text-center">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-[32px] flex items-center justify-between p-5 border border-primary/20 animate-bounce cursor-default">
            <Bell className="h-full w-full text-primary" />
          </div>
          
          <div className="space-y-3">
            <DialogHeader>
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-center">
                    {t('notification_modal_title')}
                </DialogTitle>
            </DialogHeader>
            <p className="text-sm font-bold text-muted-foreground uppercase leading-relaxed px-4">
                {t('notification_modal_desc')}
            </p>
          </div>

          <div className="space-y-3">
            <Button 
                onClick={handleEnable}
                className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
                <Sparkles className="mr-2 h-4 w-4" /> {t('notification_button_enable')}
            </Button>
            <Button 
                onClick={handleDismiss}
                variant="ghost" 
                className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-transparent"
            >
                {t('notification_button_later')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
