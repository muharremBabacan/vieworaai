'use client';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { User, UserTier } from '@/types';
import { levels } from '@/lib/gamification';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings as SettingsIcon, User as UserIcon, Camera, Check, ShieldAlert, Sparkles, Diamond, Zap, Flame, Award, HelpCircle, Phone, Instagram, Languages, Loader2, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signOut, updateProfile } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useTranslations } from 'next-intl';
import { usePush } from '@/components/providers/PushProvider';

const PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const filename = `nick${num < 10 ? '0' + num : num}.jpg`;
  return {
    id: `avatar-${num}`,
    label: `Avatar ${num}`,
    url: `/nicphoto/${filename}`
  };
});

const LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ru', label: 'Русский' },
  { value: 'zh', label: '中文' },
];

import { Switch } from '@/components/ui/switch';

const NotificationSettings = ({ t, user, firestore, notificationsEnabled }: { t: any, user: any, firestore: any, notificationsEnabled: boolean }) => {
  const { permission, requestPermission } = usePush();
  const [isPending, setIsPending] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (!user || !firestore) return;
    setIsPending(true);
    try {
      // 1. Update Firestore
      await updateDoc(doc(firestore, 'users', user.uid), { 
        notifications_enabled: checked 
      });

      // 2. If enabling, ensure permission is requested
      if (checked && permission === 'default') {
        await requestPermission();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPending(false);
    }
  };
  
  return (
    <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/50 shadow-sm animate-in fade-in duration-500">
      <CardHeader className="p-8 border-b bg-primary/5">
        <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
          <Bell className="h-6 w-6 text-primary" /> {t('notification_settings_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-black text-sm uppercase tracking-tight">{t('notification_toggle_label')}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('notification_modal_desc')}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-1">
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    notificationsEnabled ? "text-green-500" : "text-muted-foreground"
                )}>
                    {notificationsEnabled ? t('notification_enabled') : t('notification_disabled')}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-50">
                    Sistem: {permission.toUpperCase()}
                </span>
            </div>
            <Switch 
                checked={notificationsEnabled}
                onCheckedChange={handleToggle}
                disabled={isPending}
                className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function SettingsPage() {
  const t = useTranslations('SettingsPage');
  const tApp = useTranslations('AppLayout');
  const tNav = useTranslations('UserNav');
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { currencyName } = useAppConfig();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [language, setLanguage] = useState('tr');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setNickname(userProfile.name || '');
      setPhone(userProfile.phone || '');
      setInstagram(userProfile.instagram || '');
      setLanguage(userProfile.language || 'tr');
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    if (!user || !firestore || isUpdating) return;
    setIsUpdating(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      
      await Promise.all([
        updateDoc(userRef, { name: nickname, phone, instagram }),
        updateDoc(publicRef, { name: nickname, phone, instagram }),
        updateProfile(user, { displayName: nickname })
      ]);
      toast({ title: t("toast_profile_updated") });
    } catch (error) {
      toast({ variant: 'destructive', title: t("toast_error") });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLanguageChange = async (newLocale: string) => {
    if (!user || !firestore) return;
    setLanguage(newLocale);
    try {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      await updateDoc(doc(firestore, 'users', user.uid), { language: newLocale });
      router.replace(pathname, { locale: newLocale });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectPreset = async (url: string) => {
    if (!user || !firestore) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      await Promise.all([
        updateDoc(userRef, { photoURL: url }),
        updateDoc(publicRef, { photoURL: url }),
        updateProfile(user, { photoURL: url })
      ]);
      toast({ title: t("toast_avatar_updated") });
    } catch (error) {
      toast({ variant: 'destructive', title: t("toast_error") });
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (isProfileLoading) return <div className="container mx-auto max-w-2xl p-4 py-10"><Skeleton className="h-64 w-full rounded-[32px]" /></div>;
  if (!userProfile || !user) return <div className="p-20 text-center">{t('please_login')}</div>;

  const isDevUser = userProfile.email === 'babacan.muharrem@gmail.com' || userProfile.email === 'admin@viewora.ai' || userProfile.id === '01DT86bQwWUVrewnEb8c6bd8H43';

  return (
    <div className="container mx-auto max-w-3xl space-y-10 px-4 pt-10 pb-24 animate-in fade-in duration-700">
      <h1 className="text-5xl font-black tracking-tighter uppercase">{tApp('title_settings')}</h1>
      
      <Card className="rounded-[32px] overflow-hidden">
        <CardHeader className="p-8 border-b bg-secondary/10">
          <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><UserIcon className="h-6 w-6" /> {t('profile_settings')}</CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="flex flex-col items-center sm:flex-row gap-8">
            <Avatar className="h-32 w-32 border-4 border-primary/10 shadow-xl">
              <AvatarImage src={userProfile.photoURL || ''} className="object-cover" />
              <AvatarFallback className="text-4xl font-bold bg-secondary">{userProfile.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('nickname_label')}</Label>
                  <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-12 rounded-xl bg-muted/50 border-border/60 font-bold" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5"><Phone size={10} /> {t('phone_label')}</Label>
                    <Input id="phone" placeholder="05xx..." value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl bg-muted/50 border-border/60 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5"><Instagram size={10} /> {t('instagram_label')}</Label>
                    <Input id="instagram" placeholder="@kullaniciadi" value={instagram} onChange={(e) => setInstagram(e.target.value)} className="h-12 rounded-xl bg-muted/50 border-border/60 font-medium" />
                  </div>
                </div>
              </div>
              <Button onClick={handleUpdateProfile} disabled={isUpdating} className="rounded-xl h-11 px-8 font-bold">{t('save_button')}</Button>
            </div>
          </div>
          
          <div className="space-y-4 border-t pt-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Languages size={12} /> {t('language_label')}</Label>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 border-t pt-8">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Camera className="h-3 w-3" /> {t('select_avatar')}</Label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {PRESET_AVATARS.map((avatar) => (
                <button key={avatar.id} onClick={() => handleSelectPreset(avatar.url)} className={cn("relative aspect-square rounded-2xl border-2 overflow-hidden transition-all active:scale-90", userProfile.photoURL === avatar.url ? "border-primary ring-4 ring-primary/10 shadow-lg" : "border-border/40 hover:border-primary/40")}>
                  <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                  {userProfile.photoURL === avatar.url && <div className="absolute inset-0 bg-primary/10 flex items-center justify-center"><div className="bg-primary text-white p-1 rounded-full"><Check className="h-3 w-3" /></div></div>}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/30">
        <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
          <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight uppercase">
            <HelpCircle className="h-6 w-6 text-primary" /> {t('badge_guide_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 border border-orange-500/20">
              <Flame size={24} className="fill-current" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm uppercase">{t('streak_title')}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('streak_desc')}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
              <Award size={24} />
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="font-black text-sm uppercase">{t('ranks_xp_title')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {levels.map(l => (
                  <div key={l.name} className="p-2 rounded-xl bg-muted/30 border border-border/40 text-center">
                    <p className="text-[10px] font-black uppercase text-primary">{l.name}</p>
                    <p className="text-[8px] font-bold text-muted-foreground">{l.minXp} XP</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isDevUser && <DeveloperTools userProfile={userProfile} user={user} firestore={firestore} toast={toast} />}

      <NotificationSettings 
        t={t} 
        user={user} 
        firestore={firestore} 
        notificationsEnabled={userProfile?.notifications_enabled ?? false} 
      />

      <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/50">
        <CardHeader className="p-8 border-b bg-secondary/10">
          <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><SettingsIcon className="h-6 w-6" /> {t('app_and_account')}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
            <Button onClick={handleSignOut} variant="ghost" className="w-full h-14 rounded-2xl border border-border/60 font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-2 h-5 w-5" /> {tNav('sign_out')}
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const DeveloperTools = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {
  const t = useTranslations('SettingsPage');
  const handleLevelChange = async (newLevelName: string) => {
    if (!user || !firestore) return;
    const newLevel = levels.find(l => l.name === newLevelName);
    if (!newLevel) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { level_name: newLevel.name, current_xp: newLevel.minXp });
      toast({ title: t('toast_level_updated') });
    } catch (e) { console.error(e); }
  };

  const handleTierChange = async (newTier: UserTier) => {
    if (!user || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { tier: newTier });
      toast({ title: `${t('toast_tier_updated')}: ${newTier.toUpperCase()}` });
    } catch (e) { console.error(e); }
  };

  return (
    <Card className="rounded-[32px] border-dashed border-orange-500/50 bg-orange-500/5 overflow-hidden">
      <CardHeader className="p-8 border-b border-orange-500/20">
        <CardTitle className="flex items-center gap-3 text-orange-500 text-xl font-black uppercase tracking-tight"><ShieldAlert className="h-6 w-6" /> {t('dev_tools_title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('dev_level_simulator')}</Label>
          <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
            <SelectTrigger className="h-12 rounded-xl bg-background/50"><SelectValue placeholder={t('dev_level_simulator')} /></SelectTrigger>
            <SelectContent>{levels.map(l => (<SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('dev_tier_simulator')}</Label>
          <div className="grid grid-cols-3 gap-3">
            {(['start', 'pro', 'master'] as UserTier[]).map(t => (
              <Button key={t} variant={userProfile.tier === t ? 'default' : 'outline'} onClick={() => handleTierChange(t)} className="h-12 rounded-xl text-[10px] font-black uppercase tracking-widest">
                {t === 'start' && <Zap className="h-3 w-3 mr-1" />}
                {t === 'pro' && <Sparkles className="h-3 w-3 mr-1" />}
                {t === 'master' && <Diamond className="h-3 w-3 mr-1" />}
                {t}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
