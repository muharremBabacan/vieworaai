'use client';
import { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, documentId, deleteDoc } from 'firebase/firestore';
import type { Group, PublicUserProfile, User } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Trash2, Loader2, Crown, Users, Settings, Camera, Check, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const filename = `nick${num < 10 ? '0' + num : num}.jpg`;
  return {
    id: `avatar-${num}`,
    label: `Avatar ${num}`,
    url: `/nicphoto/${filename}`
  };
});

function MemberItem({ member, isGroupOwner, isCurrentUserOwner, currentUserId, onRemove }: { member: any, isGroupOwner: boolean, isCurrentUserOwner: boolean, currentUserId?: string, onRemove: (memberId: string, memberName: string) => void }) {
  const isBilinmeyen = !member.name || member.name === 'Yükleniyor...';
  return (
      <div className={cn("flex items-center justify-between p-3 rounded-xl transition-colors", isGroupOwner ? "bg-primary/5 border border-primary/10" : "hover:bg-muted/50")}>
          <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className={cn(isGroupOwner && "ring-2 ring-amber-400/50", isBilinmeyen && "opacity-50")}>
                    <AvatarImage src={member.photoURL || ''} alt={member.name || ''} className="object-cover" />
                    <AvatarFallback>{member.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                {isGroupOwner && <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 shadow-sm"><Crown className="h-2.5 w-2.5 text-black" /></div>}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2"><span className={cn("font-semibold text-sm", isBilinmeyen && "text-muted-foreground italic")}>{member.name || 'Bilinmeyen Üye'}</span>{isGroupOwner && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black uppercase bg-amber-400/10 text-amber-500 border-amber-400/20">Kurucu</Badge>}</div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{member.level_name || 'Neuner'}</span>
              </div>
          </div>
          {isCurrentUserOwner && currentUserId !== member.id && !isGroupOwner && (
              <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Üyeyi çıkartmak istediğinizden emin misiniz?</AlertDialogTitle><AlertDialogDescription>{member.name || 'Bu üye'} gruptan kalıcı olarak çıkartılacaktır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => onRemove(member.id, member.name || 'Üye')}>Çıkart</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const founderRef = useMemoFirebase(() => (group?.ownerId && firestore) ? doc(firestore, 'public_profiles', group.ownerId) : null, [group?.ownerId, firestore]);
  const { data: founderProfile } = useDoc<PublicUserProfile>(founderRef);

  const isCurrentUserOwner = group?.ownerId === user?.uid;
  const userLimits = getGroupLimits(userProfile?.level_name);
  
  const [editName, setEditName] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState(7);

  // Initialize edit states when group data loads
  useMemo(() => {
    if (group) {
      setEditName(group.name);
      setEditMaxMembers(group.maxMembers || 7);
    }
  }, [group]);

  const membersQuery = useMemoFirebase(() => {
    if (!group?.memberIds || group.memberIds.length === 0) return null;
    return query(collection(firestore, 'public_profiles'), where(documentId(), 'in', group.memberIds.slice(0, 30)));
  }, [group?.memberIds, firestore]);
  
  const { data: profiles } = useCollection<PublicUserProfile>(membersQuery);
  
  const allMembers = useMemo(() => {
    if (!group?.memberIds) return [];
    return group.memberIds.map(uid => profiles?.find(p => p.id === uid) || { id: uid, name: 'Yükleniyor...', level_name: 'Neuner' } as PublicUserProfile);
  }, [group?.memberIds, profiles]);

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isCurrentUserOwner) return;
      try { 
        await updateDoc(groupRef, { memberIds: arrayRemove(memberId) }); 
        toast({ title: `${memberName} çıkartıldı.` }); 
      } catch (e) { 
        toast({ variant: 'destructive', title: "Hata" }); 
      }
  };

  const handleUpdateGroup = async () => {
    if (!group || !isCurrentUserOwner || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateDoc(groupRef, {
        name: editName,
        maxMembers: Math.min(editMaxMembers, userLimits.maxMembers)
      });
      toast({ title: "Grup Güncellendi", description: "Değişiklikler başarıyla kaydedildi." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata", description: "Güncelleme yapılamadı." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePhoto = async (url: string) => {
    if (!group || !isCurrentUserOwner || isUpdating) return;
    try {
      await updateDoc(groupRef, { photoURL: url });
      toast({ title: "Görsel Güncellendi" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || !isCurrentUserOwner || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDoc(groupRef);
      toast({ title: "Grup Silindi", description: "Topluluğunuz kalıcı olarak kaldırıldı." });
      router.push('/groups');
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
      setIsDeleting(false);
    }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group || error) return <div className="container mx-auto px-4 pt-12 text-center"><h1 className="text-2xl font-bold">Grup Bulunamadı</h1><Button onClick={() => router.push('/groups')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplara Dön</Button></div>;

  return (
    <div className="container mx-auto px-4 pt-6 animate-in fade-in duration-500">
        <Button variant="ghost" onClick={() => router.push('/groups')} className="mb-6 hover:bg-primary/5 rounded-xl font-bold text-muted-foreground hover:text-primary transition-all">
            <ArrowLeft className="mr-2 h-4 w-4" /> Gruplarıma Dön
        </Button>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-10">
            <div className="flex items-center gap-6">
                <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-2xl">
                        <AvatarImage src={group.photoURL || ''} className="object-cover" />
                        <AvatarFallback className="text-3xl font-black bg-secondary">{group.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-1 shadow-lg border-2 border-background">
                        <Crown className="h-4 w-4 text-black" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <h1 className="text-4xl font-black tracking-tighter">{group.name}</h1>
                      <div className="bg-secondary/50 px-3 py-1 rounded-full border border-border/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        KOD: {group.joinCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black text-amber-500 uppercase tracking-[0.15em]">
                        <Users className="h-3.5 w-3.5" /> KURUCU: {founderProfile?.name || 'Yükleniyor...'}
                    </div>
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-lg">{group.description}</p>
                </div>
            </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
            <TabsList className="bg-secondary/30 p-1 rounded-2xl h-12">
                <TabsTrigger value="members" className="rounded-xl px-8 font-bold">Üyeler</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-xl px-8 font-bold">Ayarlar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="members" className="mt-8">
                <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-2xl overflow-hidden">
                    <CardHeader className="p-8 border-b border-border/40">
                        <CardTitle className="flex justify-between items-center">
                            <span className="text-xl font-black">Topluluk Üyeleri</span>
                            <Badge variant="secondary" className="px-4 h-7 rounded-full font-black bg-primary/10 text-primary border-none">
                                {group.memberIds.length} / {group.maxMembers}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allMembers.map(m => (
                                <MemberItem 
                                    key={m.id} 
                                    member={m} 
                                    isGroupOwner={m.id === group.ownerId} 
                                    isCurrentUserOwner={isCurrentUserOwner} 
                                    currentUserId={user?.uid} 
                                    onRemove={handleRemoveMember} 
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="mt-8 space-y-8">
                {isCurrentUserOwner ? (
                  <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
                        <CardHeader className="p-8 border-b border-border/40">
                          <CardTitle className="flex items-center gap-3"><Settings className="h-5 w-5 text-primary" /> Temel Bilgiler</CardTitle>
                          <CardDescription>Grubun adını ve üye kapasitesini buradan güncelleyebilirsiniz.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="groupName" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Grup Adı</Label>
                            <Input 
                              id="groupName" 
                              value={editName} 
                              onChange={(e) => setEditName(e.target.value)} 
                              className="rounded-xl h-12 bg-muted/30 border-border/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                              <Label htmlFor="maxMembers" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Maksimum Üye Sayısı</Label>
                              <span className="text-xs font-bold text-primary">{editMaxMembers} / {userLimits.maxMembers}</span>
                            </div>
                            <Input 
                              id="maxMembers" 
                              type="number" 
                              min={group.memberIds.length} 
                              max={userLimits.maxMembers} 
                              value={editMaxMembers} 
                              onChange={(e) => setEditMaxMembers(parseInt(e.target.value))} 
                              className="rounded-xl h-12 bg-muted/30 border-border/60"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1 ml-1">* Mevcut seviyeniz ({userProfile?.level_name}) en fazla {userLimits.maxMembers} üyeye izin verir.</p>
                          </div>
                          <Button onClick={handleUpdateGroup} disabled={isUpdating} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Değişiklikleri Kaydet
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
                        <CardHeader className="p-8 border-b border-border/40">
                          <CardTitle className="flex items-center gap-3"><Camera className="h-5 w-5 text-primary" /> Grup Görseli</CardTitle>
                          <CardDescription>Topluluğunuzu temsil edecek bir ikon seçin.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8">
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {PRESET_AVATARS.map((avatar) => (
                              <button
                                key={avatar.id}
                                onClick={() => handleUpdatePhoto(avatar.url)}
                                className={cn(
                                  "relative aspect-square rounded-xl border-2 transition-all hover:scale-105 active:scale-95 overflow-hidden",
                                  group.photoURL === avatar.url ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border hover:border-primary/50"
                                )}
                              >
                                <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                                {group.photoURL === avatar.url && (
                                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                    <div className="bg-primary text-white p-1 rounded-full shadow-lg"><Check className="h-4 w-4" /></div>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-8">
                      <Card className="rounded-[32px] border-destructive/20 bg-destructive/5 overflow-hidden shadow-xl">
                        <CardHeader className="p-8 border-b border-destructive/10">
                          <CardTitle className="flex items-center gap-3 text-destructive"><Trash2 className="h-5 w-5" /> Tehlikeli Bölge</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                          <div className="flex items-start gap-3 bg-destructive/10 p-4 rounded-2xl border border-destructive/20">
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-destructive/90 leading-relaxed">
                              Grubu sildiğinizde tüm üyeler çıkartılır ve gruba ait tüm geçmiş veriler kalıcı olarak yok edilir. Bu işlem geri alınamaz.
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="w-full h-12 rounded-xl font-bold shadow-lg shadow-destructive/20">Grubu Kalıcı Olarak Sil</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[32px] border-border/40">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black">Grubu silmek istediğinizden emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground font-medium">
                                  <b>{group.name}</b> grubu ve içindeki tüm içerikler kalıcı olarak silinecektir.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-3">
                                <AlertDialogCancel className="rounded-xl font-bold h-11">Vazgeç</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteGroup} className="rounded-xl font-bold h-11 bg-destructive hover:bg-destructive/90">Evet, Grubu Sil</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <Card className="rounded-[32px] border-border/40 bg-card/50 p-12 text-center">
                    <p className="text-muted-foreground font-medium">Grup ayarlarını sadece grup kurucusu yönetebilir.</p>
                  </Card>
                )}
            </TabsContent>
        </Tabs>
    </div>
  );
}
