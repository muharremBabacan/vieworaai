
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, deleteDoc, collection, query, where, writeBatch, getDocs, documentId } from 'firebase/firestore';
import type { Group, PublicUserProfile, GroupInvite, User } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import QRCode from 'qrcode';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, UserPlus, Trash2, Copy, Link as LinkIcon, Settings as SettingsIcon, Camera, Check, Loader2, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const GROUP_PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const filename = `nick${num < 10 ? '0' + num : num}.jpg`;
  return {
    id: `gavatar-${num}`,
    url: `/nicphoto/${filename}`
  };
});

function MemberItem({ member, isGroupOwner, isCurrentUserOwner, currentUserId, onRemove }: { member: any, isGroupOwner: boolean, isCurrentUserOwner: boolean, currentUserId?: string, onRemove: (memberId: string, memberName: string) => void }) {
  const isBilinmeyen = !member.name || member.name === 'Bilinmeyen Üye';
  
  return (
      <div className={cn("flex items-center justify-between p-3 rounded-xl transition-colors", isGroupOwner ? "bg-primary/5 border border-primary/10" : "hover:bg-muted/50")}>
          <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className={cn(isGroupOwner && "ring-2 ring-amber-400/50", isBilinmeyen && "opacity-50")}>
                    <AvatarImage src={member.photoURL || ''} alt={member.name || ''} className="object-cover" />
                    <AvatarFallback>{member.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                {isGroupOwner && (
                  <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 shadow-sm">
                    <Crown className="h-2.5 w-2.5 text-black" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={cn("font-semibold text-sm", isBilinmeyen && "text-muted-foreground italic")}>
                    {member.name || 'Bilinmeyen Üye'}
                  </span>
                  {isGroupOwner && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-bold uppercase bg-amber-400/10 text-amber-500 border-amber-400/20">Yönetici</Badge>}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                    {member.level_name || 'Neuner'}
                </span>
              </div>
          </div>
          {isCurrentUserOwner && currentUserId !== member.id && !isGroupOwner && (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive transition-colors">
                         <Trash2 className="h-4 w-4" />
                      </Button>
                  </AlertDialogTrigger>
                   <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Üyeyi çıkartmak istediğinizden emin misiniz?</AlertDialogTitle>
                          <AlertDialogDescription>{member.name || 'Bu üye'} gruptan kalıcı olarak çıkartılacaktır.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>İptal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRemove(member.id, member.name || 'Üye')}>Çıkart</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}
      </div>
  );
}

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const isCurrentUserOwner = group?.ownerId === user?.uid;
  const groupLimits = getGroupLimits(userProfile?.level_name);
  
  // Üye profillerini getir
  const membersQuery = useMemoFirebase(() => {
    if (!group?.memberIds || group.memberIds.length === 0) return null;
    const ids = group.memberIds.slice(0, 30);
    return query(collection(firestore, 'public_profiles'), where(documentId(), 'in', ids));
  }, [group?.memberIds, firestore]);

  const { data: profiles, isLoading: areMembersLoading } = useCollection<PublicUserProfile>(membersQuery);
  
  const allMembers = useMemo(() => {
    if (!group?.memberIds) return [];
    return group.memberIds.map(uid => {
        const foundProfile = profiles?.find(p => p.id === uid);
        if (foundProfile) return foundProfile;
        return { 
            id: uid, 
            name: uid === group.ownerId ? 'Grup Sahibi' : 'Bilinmeyen Üye', 
            level_name: 'Neuner' 
        } as PublicUserProfile;
    });
  }, [group?.memberIds, group?.ownerId, profiles]);

  const founderMember = useMemo(() => {
    return allMembers.find(m => m.id === group?.ownerId);
  }, [allMembers, group?.ownerId]);

  const inviteFormSchema = z.object({ email: z.string().email("Geçerli bir e-posta adresi girin.") });
  const inviteForm = useForm({ resolver: zodResolver(inviteFormSchema), defaultValues: { email: '' } });

  const settingsFormSchema = z.object({
    name: z.string().min(3, "En az 3 karakter olmalıdır.").max(50, "En fazla 50 karakter olabilir."),
    description: z.string().max(200, "En fazla 200 karakter olabilir."),
    maxMembers: z.number().min(1).max(groupLimits.maxMembers, `Seviyeniz için maksimum limit ${groupLimits.maxMembers}'dir.`),
  });

  const settingsForm = useForm({
    resolver: zodResolver(settingsFormSchema),
    values: group ? {
      name: group.name,
      description: group.description || '',
      maxMembers: group.maxMembers
    } : { name: '', description: '', maxMembers: 7 }
  });

  const handleUpdateSettings = async (values: z.infer<typeof settingsFormSchema>) => {
    if (!group || !isCurrentUserOwner || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateDoc(groupRef, {
        name: values.name,
        description: values.description,
        maxMembers: values.maxMembers
      });
      toast({ title: "Grup Güncellendi", description: "Değişiklikler başarıyla kaydedildi." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata", description: "Ayarlar güncellenemedi." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePhoto = async (url: string) => {
    if (!group || !isCurrentUserOwner || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateDoc(groupRef, { photoURL: url });
      toast({ title: "Grup Görseli Güncellendi" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata", description: "Görsel güncellenemedi." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInviteMember = async (values: { email: string }) => {
    if (!group || !isCurrentUserOwner || !user) {
        toast({ variant: 'destructive', title: "Hata", description: "Üye eklemek için izniniz yok." });
        return;
    }
    if (group.memberIds.length >= group.maxMembers) {
        toast({ variant: 'destructive', title: "Grup Dolu", description: `Bu grup en fazla ${group.maxMembers} üyeye sahip olabilir.` });
        return;
    }

    try {
        // Query public_profiles instead of private users collection to avoid permission errors
        const userQuery = query(collection(firestore, 'public_profiles'), where('email', '==', values.email));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: "Kullanıcı Bulunamadı", description: "Bu e-postaya sahip bir kullanıcı yok veya henüz Viewora'ya giriş yapmamış." });
            return;
        }
        const invitedUserDoc = userSnapshot.docs[0];
        const invitedUserId = invitedUserDoc.id;

        if (group.memberIds.includes(invitedUserId)) {
            toast({ variant: 'destructive', title: "Zaten Üye", description: "Bu kullanıcı zaten grubun bir üyesi." });
            return;
        }

        const batch = writeBatch(firestore);
        const inviteRef = doc(collection(firestore, 'group_invites'));
        const newInvite: Omit<GroupInvite, 'id'> = {
            groupId: group.id,
            groupName: group.name,
            fromUserId: user.uid,
            fromUserName: user.displayName || 'Sahip',
            toUserId: invitedUserId,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        batch.set(inviteRef, { ...newInvite, id: inviteRef.id });
        await batch.commit();

        toast({ title: "Davetiye Gönderildi!", description: `${values.email} adresine bir grup davetiyesi gönderildi.` });
        inviteForm.reset();

    } catch (e) {
        console.error("Invite error:", e);
        toast({ variant: 'destructive', title: "Hata", description: "Üye davet edilirken bir sorun oluştu." });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isCurrentUserOwner) return;
      try {
          await updateDoc(groupRef, { memberIds: arrayRemove(memberId) });
          toast({ title: `${memberName} gruptan çıkartıldı.` });
      } catch (e) {
          toast({ variant: 'destructive', title: "Üye çıkartılırken bir hata oluştu." });
      }
  };
  
  const handleDeleteGroup = async () => {
    if (!group || !isCurrentUserOwner) return;
    try {
        await deleteDoc(groupRef);
        toast({ title: "Grup başarıyla silindi." });
        router.push('/groups');
    } catch (e) {
        toast({ variant: 'destructive', title: "Grup silinirken bir hata oluştu." });
    }
  };

  const shareableLink = typeof window !== 'undefined' ? `${window.location.origin}/groups/join/${group?.id}` : '';

  useEffect(() => {
    if (group?.joinCode) {
      QRCode.toDataURL(shareableLink, { width: 256, margin: 2 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [group?.joinCode, shareableLink]);
  
  const copyToClipboard = (text: string, type: 'code' | 'link') => {
      navigator.clipboard.writeText(text).then(() => {
          toast({ title: "Kopyalandı!", description: type === 'code' ? "Kod panoya kopyalandı." : "Link panoya kopyalandı." });
      }).catch(() => toast({ variant: 'destructive', title: 'Hata', description: `${type} kopyalanamadı.` }));
  };

  if (isGroupLoading) {
    return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!group || error) {
    return (
      <div className="container mx-auto px-4 pt-12 text-center">
        <h1 className="text-2xl font-bold">Grup Bulunamadı</h1>
        <p className="text-muted-foreground">{error ? "Bu grubu yüklerken bir hata oluştu." : "Böyle bir grup mevcut değil veya görme izniniz yok."}</p>
        <Button onClick={() => router.push('/groups')} className="mt-6 rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplara Dön</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-4 border-primary/10 shadow-lg">
                    <AvatarImage src={group.photoURL || ''} className="object-cover" />
                    <AvatarFallback className="text-3xl font-bold">{group.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-wider">
                        <span>Kurucu: {founderMember?.name || "Yükleniyor..."}</span>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-1">{group.description}</p>
                    </div>
                </div>
            </div>
            {isCurrentUserOwner && (
                <Dialog>
                    <DialogTrigger asChild><Button className="w-full sm:w-auto h-11 px-6 rounded-xl shadow-md"><UserPlus className="mr-2 h-4 w-4" /> Üye Davet Et</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Üye Davet Et</DialogTitle><DialogDescription>Gruba davet etmek istediğiniz kullanıcının e-posta adresini girin.</DialogDescription></DialogHeader>
                        <Form {...inviteForm}>
                            <form onSubmit={inviteForm.handleSubmit(handleInviteMember)} className="space-y-4">
                                <FormField control={inviteForm.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input type="email" placeholder="kullanici@email.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" className="w-full h-11">Davet Et</Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )}
        </div>

        <Tabs defaultValue="members" className="w-full">
            <TabsList className="bg-secondary/30 p-1 rounded-xl">
                <TabsTrigger value="members" className="rounded-lg">Üyeler</TabsTrigger>
                <TabsTrigger value="gallery" disabled className="rounded-lg">Galeri</TabsTrigger>
                <TabsTrigger value="competitions" className="rounded-lg">Yarışmalar</TabsTrigger>
                {isCurrentUserOwner && <TabsTrigger value="settings" className="rounded-lg">Ayarlar</TabsTrigger>}
            </TabsList>
            <TabsContent value="members" className="mt-8">
                <Card className="rounded-[24px] border-border/40 bg-card/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center text-xl">
                            <span>Üyeler ({group.memberIds.length} / {group.maxMembers})</span>
                            {isCurrentUserOwner && (
                                <Dialog>
                                    <DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-lg text-xs font-bold uppercase tracking-wider">Davet Seçenekleri</Button></DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader><DialogTitle>Gruba Katılım Daveti</DialogTitle><DialogDescription>Aşağıdaki seçeneklerle yeni üyeleri davet edebilirsiniz.</DialogDescription></DialogHeader>
                                        <div className="flex flex-col items-center gap-6 py-4">
                                            {qrCodeDataUrl && <div className="p-4 bg-white rounded-2xl shadow-inner"><img src={qrCodeDataUrl} alt="Grup QR Kodu" className="w-48 h-48" /></div>}
                                            <div className="space-y-4 w-full">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Katılım Kodu</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input readOnly value={group.joinCode} className="text-center font-mono text-lg tracking-[0.2em] font-bold h-12 bg-secondary/50 border-none" />
                                                        <Button size="icon" variant="secondary" className="h-12 w-12" onClick={() => copyToClipboard(group.joinCode || '', 'code')}><Copy className="h-5 w-5" /></Button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Paylaşılabilir Link</Label>
                                                    <div className="flex items-center gap-2 w-full">
                                                        <Input readOnly value={shareableLink} className="text-xs h-10 bg-secondary/50 border-none truncate" />
                                                        <Button size="icon" variant="secondary" className="h-10 w-10 shrink-0" onClick={() => copyToClipboard(shareableLink, 'link')}><LinkIcon className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {areMembersLoading ? (
                            <div className="space-y-3">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
                        ) : (
                            <div className="grid gap-3">
                                {allMembers.map(member => (
                                  <MemberItem 
                                    key={member.id} 
                                    member={member} 
                                    isGroupOwner={member.id === group.ownerId} 
                                    isCurrentUserOwner={isCurrentUserOwner} 
                                    currentUserId={user?.uid}
                                    onRemove={handleRemoveMember} 
                                  />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="competitions" className="mt-8">
                <div className="text-center py-24 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5">
                    <p className="text-muted-foreground font-medium">Gruba özel sergi ve ödev alanı yakında burada olacak.</p>
                </div>
            </TabsContent>
            {isCurrentUserOwner && (
                <TabsContent value="settings" className="mt-8 space-y-8">
                    <Card className="rounded-[24px] border-border/40 bg-card/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <SettingsIcon className="h-5 w-5 text-primary" />
                                Genel Bilgiler
                            </CardTitle>
                            <CardDescription>Grup adını, açıklamasını ve üye kapasitesini güncelleyin.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...settingsForm}>
                                <form onSubmit={settingsForm.handleSubmit(handleUpdateSettings)} className="space-y-6">
                                    <FormField control={settingsForm.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-wider">Grup Adı</FormLabel>
                                            <FormControl><Input {...field} className="h-11 rounded-xl" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={settingsForm.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-wider">Açıklama</FormLabel>
                                            <FormControl><Textarea {...field} className="rounded-xl min-h-[100px]" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={settingsForm.control} name="maxMembers" render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center mb-1">
                                                <FormLabel className="text-xs font-bold uppercase tracking-wider">Maksimum Üye Sayısı</FormLabel>
                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">LİMİT: {groupLimits.maxMembers}</span>
                                            </div>
                                            <FormControl>
                                                <Input type="number" {...field} className="h-11 rounded-xl" onChange={e => field.onChange(parseInt(e.target.value))} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <Button type="submit" disabled={isUpdating} className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/10">
                                        {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                                        Değişiklikleri Kaydet
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px] border-border/40 bg-card/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Camera className="h-5 w-5 text-purple-400" />
                                Grup Görseli
                            </CardTitle>
                            <CardDescription>Grubunuzu temsil edecek bir simge seçin.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                                {GROUP_PRESET_AVATARS.map((avatar) => (
                                    <button
                                        key={avatar.id}
                                        onClick={() => handleUpdatePhoto(avatar.url)}
                                        disabled={isUpdating}
                                        className={cn(
                                            "relative aspect-square rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 overflow-hidden",
                                            group.photoURL === avatar.url ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        <img src={avatar.url} alt="Grup Simge" className="w-full h-full object-cover" />
                                        {group.photoURL === avatar.url && (
                                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                                <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                                                    <Check className="h-3 w-3" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/30 bg-destructive/5 rounded-[24px]">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Tehlikeli Bölge</CardTitle>
                            <CardDescription>Bu işlem geri alınamaz. Grup ve tüm içeriği kalıcı olarak silinecektir.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive" className="rounded-xl px-8 h-11 font-bold">Grubu Kalıcı Olarak Sil</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Grubu silmek istediğinizden emin misiniz?</AlertDialogTitle><AlertDialogDescription>Bu işlem grubu ve ilişkili tüm verileri kalıcı olarak silecektir.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Grubu Kalıcı Olarak Sil</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    </div>
  );
}
