
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
                {isGroupOwner && <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 shadow-sm"><Crown className="h-2.5 w-2.5 text-black" /></div>}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2"><span className={cn("font-semibold text-sm", isBilinmeyen && "text-muted-foreground italic")}>{member.name || 'Bilinmeyen Üye'}</span>{isGroupOwner && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black uppercase bg-amber-400/10 text-amber-500 border-amber-400/20">Yönetici</Badge>}</div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{member.level_name || 'Neuner'}</span>
              </div>
          </div>
          {isCurrentUserOwner && currentUserId !== member.id && !isGroupOwner && (
              <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

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

  const handleUpdateSettings = async (values: any) => {
    if (!group || !isCurrentUserOwner) return;
    try { await updateDoc(groupRef, values); toast({ title: "Güncellendi" }); } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isCurrentUserOwner) return;
      try { await updateDoc(groupRef, { memberIds: arrayRemove(memberId) }); toast({ title: `${memberName} çıkartıldı.` }); } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group || error) return <div className="container mx-auto px-4 pt-12 text-center"><h1 className="text-2xl font-bold">Grup Bulunamadı</h1><Button onClick={() => router.push('/groups')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplara Dön</Button></div>;

  return (
    <div className="container mx-auto px-4 pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
            <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-4 border-primary/10 shadow-lg"><AvatarImage src={group.photoURL || ''} className="object-cover" /><AvatarFallback>{group.name.charAt(0)}</AvatarFallback></Avatar>
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">{group.name}</h1>
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 uppercase tracking-widest"><Crown className="h-3 w-3" /> KURUCU: {ownerProfile?.name || 'Yükleniyor...'}</div>
                    <p className="text-muted-foreground text-sm line-clamp-1">{group.description}</p>
                </div>
            </div>
        </div>
        <Tabs defaultValue="members" className="w-full">
            <TabsList className="bg-secondary/30 p-1 rounded-xl"><TabsTrigger value="members">Üyeler</TabsTrigger><TabsTrigger value="gallery" disabled>Galeri</TabsTrigger><TabsTrigger value="settings">Ayarlar</TabsTrigger></TabsList>
            <TabsContent value="members" className="mt-8">
                <Card className="rounded-[24px] border-border/40 bg-card/50 shadow-sm"><CardHeader><CardTitle>Üyeler ({group.memberIds.length} / {group.maxMembers})</CardTitle></CardHeader>
                    <CardContent><div className="grid gap-3">{allMembers.map(m => (<MemberItem key={member.id} member={m} isGroupOwner={m.id === group.ownerId} isCurrentUserOwner={isCurrentUserOwner} currentUserId={user?.uid} onRemove={handleRemoveMember} />))}</div></CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
