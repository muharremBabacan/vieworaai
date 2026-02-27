'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, documentId } from 'firebase/firestore';
import type { Group, PublicUserProfile, User } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Trash2, Loader2, Crown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  // Kurucunun ismini her zaman çekmek için bağımsız profil sorgusu
  const ownerProfileRef = useMemoFirebase(() => (group?.ownerId && firestore) ? doc(firestore, 'public_profiles', group.ownerId) : null, [group?.ownerId, firestore]);
  const { data: ownerProfile } = useDoc<PublicUserProfile>(ownerProfileRef);

  const isCurrentUserOwner = group?.ownerId === user?.uid;
  
  const membersQuery = useMemoFirebase(() => {
    if (!group?.memberIds || group.memberIds.length === 0) return null;
    return query(collection(firestore, 'public_profiles'), where(documentId(), 'in', group.memberIds.slice(0, 30)));
  }, [group?.memberIds, firestore]);
  
  const { data: profiles, isLoading: areMembersLoading } = useCollection<PublicUserProfile>(membersQuery);
  
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

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group || error) return <div className="container mx-auto px-4 pt-12 text-center"><h1 className="text-2xl font-bold">Grup Bulunamadı</h1><Button onClick={() => router.push('/groups')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplara Dön</Button></div>;

  return (
    <div className="container mx-auto px-4 pt-6 animate-in fade-in duration-500">
        <Button variant="ghost" onClick={() => router.push('/groups')} className="mb-6 hover:bg-primary/5 rounded-xl font-bold">
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
                    <h1 className="text-4xl font-black tracking-tighter">{group.name}</h1>
                    <div className="flex items-center gap-2 text-xs font-black text-amber-500 uppercase tracking-[0.15em]">
                        <Users className="h-3.5 w-3.5" /> KURUCU: {ownerProfile?.name || 'Yükleniyor...'}
                    </div>
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-lg">{group.description}</p>
                </div>
            </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
            <TabsList className="bg-secondary/30 p-1 rounded-2xl h-12">
                <TabsTrigger value="members" className="rounded-xl px-8 font-bold">Üyeler</TabsTrigger>
                <TabsTrigger value="gallery" disabled className="rounded-xl px-8 font-bold">Galeri (Yakında)</TabsTrigger>
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
            
            <TabsContent value="settings" className="mt-8">
                <Card className="rounded-[32px] border-border/40 bg-card/50 p-12 text-center">
                    <p className="text-muted-foreground font-medium">Grup ayarları ve QR davetiye yönetimi bu sekmede geliştiriliyor.</p>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
