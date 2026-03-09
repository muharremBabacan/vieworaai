'use client';
import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref } from 'firebase/storage';
import type { User, UserTier } from '@/types';
import { levels } from '@/lib/gamification';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings as SettingsIcon, User as UserIcon, Camera, Check, ShieldAlert, Sparkles, Diamond, Zap, Flame, Award, HelpCircle, GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signOut, updateProfile } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';

const PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const filename = `nick${num < 10 ? '0' + num : num}.jpg`;
  return {
    id: `avatar-${num}`,
    label: `Avatar ${num}`,
    url: `/nicphoto/${filename}`
  };
});

const BadgeGlossary = () => {
  const { currencyName } = useAppConfig();
  
  return (
    <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/30">
      <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
        <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight uppercase">
          <HelpCircle className="h-6 w-6 text-primary" /> Rozet ve Seviye Rehberi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {/* Günlük Seri */}
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 border border-orange-500/20">
            <Flame size={24} className="fill-current" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase">Günlük Seri (Streak)</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">Viewora'da kaç gün üst üste aktif olduğunuzu gösterir. Her gün giriş yaparak serinizi koruyabilir ve disiplininizi kanıtlayabilirsiniz.</p>
          </div>
        </div>

        {/* Seviyeler */}
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
            <Award size={24} />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-black text-sm uppercase">Rütbeler ve XP</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">Fotoğraf analiz ettirerek ve ödev tamamlayarak XP kazanırsınız. XP biriktikçe rütbeniz yükselir:</p>
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

        {/* Paket Tierları */}
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 border border-cyan-500/20">
            <Sparkles size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase">Analiz Derinliği (Tier)</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Luma'nın analiz kapasitesini belirler. <b>Start</b> temel teknikleri, <b>Pro</b> stratejik mentorluğu, <b>Master</b> ise sanatsal kimlik danışmanlığını açar. Her analiz harcaması bu derinliğe göre {currencyName} maliyeti oluşturur.
            </p>
          </div>
        </div>

        {/* Mentorluk */}
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0 border border-green-500/20">
            <GraduationCap size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase">Vexer & Mentorluk</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">En üst rütbe olan <b>Vexer</b> seviyesine ulaşanlar, topluluk içinde mentorluk yapma ve diğer vizyonerlere yol gösterme hakkı kazanırlar.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProfileSettings = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {
  const [nickname, setNickname] = useState(userProfile.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || !firestore || isUpdating) return;
    setIsUpdating(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      await Promise.all([
        updateDoc(userRef, { name: nickname }),
        updateDoc(publicRef, { name: nickname }),
        updateProfile(user, { displayName: nickname })
      ]);
      toast({ title: "Profil Güncellendi" });
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectPreset = async (url: string) => {
    if (!user || !firestore || isUploading) return;
    setIsUploading(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      await Promise.all([
        updateDoc(userRef, { photoURL: url }),
        updateDoc(publicRef, { photoURL: url }),
        updateProfile(user, { photoURL: url })
      ]);
      toast({ title: "Avatar Güncellendi" });
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="rounded-[32px] overflow-hidden">
      <CardHeader className="p-8 border-b bg-secondary/10">
        <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><UserIcon className="h-6 w-6" /> Profil Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-10">
        <div className="flex flex-col items-center sm:flex-row gap-8">
          <Avatar className="h-32 w-32 border-4 border-primary/10 shadow-xl">
            <AvatarImage src={userProfile.photoURL || ''} className="object-cover" />
            <AvatarFallback className="text-4xl font-bold bg-secondary">{userProfile.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Takma Ad</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-12 rounded-xl bg-muted/50 border-border/60 font-bold" />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isUpdating || nickname === userProfile.name} className="rounded-xl h-11 px-8 font-bold">Kaydet</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Camera className="h-3 w-3" /> Simge Seçin</Label>
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
  );
};

const DeveloperTools = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {
  const handleLevelChange = async (newLevelName: string) => {
    if (!user || !firestore) return;
    const newLevel = levels.find(l => l.name === newLevelName);
    if (!newLevel) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { level_name: newLevel.name, current_xp: newLevel.minXp });
      toast({ title: "Seviye Güncellendi" });
    } catch (e) { console.error(e); }
  };

  const handleTierChange = async (newTier: UserTier) => {
    if (!user || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { tier: newTier });
      toast({ title: `Paket Değişti: ${newTier.toUpperCase()}` });
    } catch (e) { console.error(e); }
  };

  return (
    <Card className="rounded-[32px] border-dashed border-orange-500/50 bg-orange-500/5 overflow-hidden">
      <CardHeader className="p-8 border-b border-orange-500/20">
        <CardTitle className="flex items-center gap-3 text-orange-500 text-xl font-black uppercase tracking-tight"><ShieldAlert className="h-6 w-6" /> Geliştirici Araçları</CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Seviye Simülatörü</Label>
          <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
            <SelectTrigger className="h-12 rounded-xl bg-background/50"><SelectValue placeholder="Seviye seç..." /></SelectTrigger>
            <SelectContent>{levels.map(l => (<SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Paket Simülatörü</Label>
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

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const isDevUser = userProfile?.email === 'babacan.muharrem@gmail.com' || userProfile?.email === 'admin@viewora.ai' || userProfile?.id === '01DT86bQwWUVrewnEb8c6bd8H43';

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isUserLoading || isProfileLoading) return <div className="container mx-auto max-w-2xl p-4 py-10"><Skeleton className="h-64 w-full rounded-[32px]" /></div>;
  if (!userProfile || !user) return null;

  return (
    <div className="container mx-auto max-w-3xl space-y-10 px-4 pt-10 pb-24 animate-in fade-in duration-700">
      <h1 className="text-5xl font-black tracking-tighter uppercase">Ayarlar</h1>
      
      <ProfileSettings userProfile={userProfile} user={user} firestore={firestore} toast={toast} />
      
      <BadgeGlossary />

      {isDevUser && <DeveloperTools userProfile={userProfile} user={user} firestore={firestore} toast={toast} />}
      
      <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card/50">
        <CardHeader className="p-8 border-b bg-secondary/10">
          <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><SettingsIcon className="h-6 w-6" /> Uygulama & Hesap</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
            <Button onClick={handleSignOut} variant="ghost" className="w-full h-14 rounded-2xl border border-border/60 font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-2 h-5 w-5" /> Çıkış Yap
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
