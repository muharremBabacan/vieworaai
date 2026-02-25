'use client';
import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User, PublicUserProfile } from '@/types';
import { levels } from '@/lib/gamification';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Code, Settings as SettingsIcon, User as UserIcon, Upload, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/shared/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signOut } from 'firebase/auth';

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

      await updateDoc(userRef, { name: nickname });
      await updateDoc(publicRef, { name: nickname });

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

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: "Dosya Çok Büyük", description: "Lütfen 2MB'dan küçük bir resim seçin." });
      return;
    }

    setIsUploading(true);
    try {
      const photoRef = ref(storage, `users/${user.uid}/profile_photo_${Date.now()}`);
      const uploadResult = await uploadBytes(photoRef, file);
      const photoURL = await getDownloadURL(uploadResult.ref);

      const userRef = doc(firestore, 'users', user.uid);
      const publicRef = doc(firestore, 'public_profiles', user.uid);

      await updateDoc(userRef, { photoURL });
      await updateDoc(publicRef, { photoURL });

      toast({ title: "Fotoğraf Güncellendi", description: "Profil fotoğrafınız başarıyla yüklendi." });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ variant: 'destructive', title: "Hata", description: "Fotoğraf yüklenemedi." });
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
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center sm:flex-row gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-primary/20">
              <AvatarImage src={userProfile.photoURL || ''} />
              <AvatarFallback className="text-2xl">{userProfile.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
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
              <Label htmlFor="nickname">Takma Ad (Nickname)</Label>
              <Input 
                id="nickname" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value)} 
                placeholder="Örn: IşıkAvcısı"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isUpdating || nickname === userProfile.name} className="w-full sm:w-auto">
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Değişiklikleri Kaydet
            </Button>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Code className="h-6 w-6" />
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

  const isSuperAdmin = userProfile?.email === 'babacan.muharrem@gmail.com';

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

      {isSuperAdmin && <DeveloperTools userProfile={userProfile} user={user} firestore={firestore} toast={toast} />}

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
