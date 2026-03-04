'use client';
import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User, UserTier } from '@/types';
import { levels } from '@/lib/gamification';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings as SettingsIcon, User as UserIcon, Upload, Loader2, Camera, Check, ShieldAlert, Sparkles, Diamond, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/shared/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signOut, updateProfile } from 'firebase/auth';
import { cn } from '@/lib/utils';

const PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const filename = `nick${num < 10 ? '0' + num : num}.jpg`;
  return {
    id: `avatar-${num}`,
    label: `Avatar ${num}`,
    url: `/nicphoto/${filename}`
  };
});

const ProfileSettings = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {
  const [nickname, setNickname] = useState(userProfile.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storage = getStorage();

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3"><UserIcon className="h-6 w-6" /> Profil Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col items-center sm:flex-row gap-8">
          <Avatar className="h-32 w-32 border-4 border-primary/10 shadow-xl">
            <AvatarImage src={userProfile.photoURL || ''} className="object-cover" />
            <AvatarFallback className="text-4xl font-bold bg-secondary">{userProfile.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Takma Ad</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="bg-muted/50" />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isUpdating || nickname === userProfile.name}>Kaydet</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label className="text-sm font-semibold flex items-center gap-2"><Camera className="h-4 w-4" /> Simge Seçin</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {PRESET_AVATARS.map((avatar) => (
              <button key={avatar.id} onClick={() => handleSelectPreset(avatar.url)} className={cn("relative aspect-square rounded-xl border-2 overflow-hidden", userProfile.photoURL === avatar.url ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border hover:border-primary/50")}>
                <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                {userProfile.photoURL === avatar.url && <div className="absolute inset-0 bg-primary/10 flex items-center justify-center"><div className="bg-primary text-white p-1 rounded-full"><Check className="h-4 w-4" /></div></div>}
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
    <Card className="border-dashed border-orange-500/50 bg-orange-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-orange-500"><ShieldAlert className="h-6 w-6" /> Geliştirici Araçları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Seviye Simülatörü</Label>
          <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
            <SelectTrigger><SelectValue placeholder="Seviye seç..." /></SelectTrigger>
            <SelectContent>{levels.map(l => (<SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Paket Simülatörü</Label>
          <div className="grid grid-cols-3 gap-3">
            {(['start', 'pro', 'master'] as UserTier[]).map(t => (
              <Button key={t} variant={userProfile.tier === t ? 'default' : 'outline'} onClick={() => handleTierChange(t)} className="h-10 text-[10px] font-black uppercase tracking-widest">
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

  const isDevUser = userProfile?.email === 'babacan.muharrem@gmail.com' || userProfile?.email === 'admin@viewora.ai';

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isUserLoading || isProfileLoading) return <div className="container mx-auto max-w-2xl p-4"><Skeleton className="h-64 w-full" /></div>;
  if (!userProfile || !user) return null;

  return (
    <div className="container mx-auto max-w-2xl space-y-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
      <ProfileSettings userProfile={userProfile} user={user} firestore={firestore} toast={toast} />
      {isDevUser && <DeveloperTools userProfile={userProfile} user={user} firestore={firestore} toast={toast} />}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-3"><SettingsIcon className="h-6 w-6" /> Uygulama & Hesap</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <Button onClick={handleSignOut} variant="outline" className="w-full"><LogOut className="mr-2 h-4 w-4" /> Çıkış Yap</Button>
        </CardContent>
      </Card>
    </div>
  );
}
