'use client';
import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User } from '@/types';
import { levels } from '@/lib/gamification';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings as SettingsIcon, User as UserIcon, Upload, Loader2, Camera, Check, ShieldAlert } from 'lucide-react';
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

const resizeAndCropImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context error');

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject('Blob conversion error');
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

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

      toast({
        title: "Profil Güncellendi",
        description: "Takma adınız başarıyla kaydedildi.",
      });
    } catch (error) {
      console.error("Update profile error:", error);
      toast({ variant: 'destructive', title: "Hata", description: "Profil güncellenemedi." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || isUploading) return;

    setIsUploading(true);
    try {
      const resizedBlob = await resizeAndCropImage(file);
      
      const photoRef = ref(storage, `users/${user.uid}/profile_photo_v2`);
      const uploadResult = await uploadBytes(photoRef, resizedBlob);
      const photoURL = await getDownloadURL(uploadResult.ref);

      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);

      await Promise.all([
        updateDoc(userRef, { photoURL }),
        updateDoc(publicRef, { photoURL }),
        updateProfile(user, { photoURL })
      ]);

      toast({ title: "Fotoğraf Güncellendi", description: "Profil fotoğrafınız başarıyla yüklendi ve optimize edildi." });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ variant: 'destructive', title: "Hata", description: "Fotoğraf yüklenemedi." });
    } finally {
      setIsUploading(false);
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

      toast({ title: "Avatar Güncellendi", description: "Yeni simgeniz başarıyla ayarlandı." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata", description: "Avatar güncellenemedi." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <UserIcon className="h-6 w-6" />
          Profil Ayarları
        </CardTitle>
        <CardDescription>Diğer kullanıcıların sizi nasıl göreceğini belirleyin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col items-center sm:flex-row gap-8">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary/10 shadow-xl">
              <AvatarImage src={userProfile.photoURL || ''} className="object-cover" />
              <AvatarFallback className="text-4xl font-bold bg-secondary text-secondary-foreground">
                {userProfile.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : (
                <>
                  <Upload className="h-8 w-8 mb-1" />
                  <span className="text-[10px] font-bold uppercase">Değiştir</span>
                </>
              )}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
          </div>
          <div className="flex-1 w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm font-semibold">Takma Ad (Nickname)</Label>
              <Input 
                id="nickname" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value)} 
                placeholder="Örn: IşıkAvcısı"
                className="bg-muted/50"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isUpdating || nickname === userProfile.name} className="w-full sm:w-auto shadow-md">
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Değişiklikleri Kaydet
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Veya Bir Simge Seçin
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {PRESET_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleSelectPreset(avatar.url)}
                disabled={isUploading}
                className={cn(
                  "relative aspect-square rounded-xl border-2 transition-all hover:scale-105 active:scale-95 overflow-hidden",
                  userProfile.photoURL === avatar.url ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border hover:border-primary/50"
                )}
                title={avatar.label}
              >
                <img 
                  src={avatar.url} 
                  alt={avatar.label} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/222/white?text=Avatar';
                  }}
                />
                {userProfile.photoURL === avatar.url && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
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
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        level_name: newLevel.name,
        is_mentor: newLevel.isMentor || false,
        current_xp: newLevel.minXp,
      });
      toast({
        title: "Seviye Değiştirildi",
        description: `Yeni seviyeniz artık: ${newLevel.name}`,
      });
    } catch (error) {
      console.error("Failed to update level:", error);
    }
  };

  return (
    <Card className="border-dashed border-orange-500/50 bg-orange-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-orange-500">
          <ShieldAlert className="h-6 w-6" />
          Geliştirici Araçları
        </CardTitle>
        <CardDescription>Test amacıyla kullanıcı seviyenizi değiştirin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
          <SelectTrigger>
            <SelectValue placeholder="Kullanıcı seviyesini değiştir" />
          </SelectTrigger>
          <SelectContent>
            {levels.map(level => (
              <SelectItem key={level.name} value={level.name}>
                {level.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

  const isDevUser = userProfile?.email === 'babacan.muharrem@gmail.com';

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Başarıyla çıkış yaptınız." });
      router.push('/');
    } catch (error) {
      toast({ variant: 'destructive', title: "Çıkış yapılamadı." });
      console.error('Sign out failed', error);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-8 px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!userProfile || !user) {
    return <div className="container text-center px-4">Kullanıcı bulunamadı.</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
      
      <ProfileSettings userProfile={userProfile} user={user} firestore={firestore} toast={toast} />

      {isDevUser && <DeveloperTools userProfile={userProfile} user={user} firestore={firestore} toast={toast} />}

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-3">
                <SettingsIcon className="h-6 w-6" />
                Uygulama & Hesap
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                    <p className="font-medium">Dil</p>
                    <p className="text-sm text-muted-foreground">Uygulama dilini değiştirin</p>
                </div>
                <Select disabled defaultValue="tr">
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Dil seç..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="tr">Türkçe</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border">
                <p className="font-medium">Sürüm</p>
                <p className="text-sm text-muted-foreground">1.0.0</p>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <Link href="/terms" className="font-medium w-full text-left">Hizmet Şartları</Link>
            </div>
             <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <Link href="/privacy" className="font-medium w-full text-left">Gizlilik Politikası</Link>
            </div>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
                <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
            </Button>
        </CardContent>
      </Card>

    </div>
  );
}
