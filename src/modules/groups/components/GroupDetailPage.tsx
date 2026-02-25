'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, deleteDoc, collection, query, where, writeBatch, getDocs, documentId } from 'firebase/firestore';
import type { Group, PublicUserProfile, GroupInvite } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/shared/hooks/use-toast';
import QRCode from 'qrcode';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, UserPlus, Trash2, Copy, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  const isOwner = group?.ownerId === user?.uid;
  
  const membersQuery = useMemoFirebase(() => (group && group.memberIds && group.memberIds.length > 0) ? query(collection(firestore, 'public_profiles'), where(documentId(), 'in', group.memberIds)) : null, [group, firestore]);
  const { data: members, isLoading: areMembersLoading } = useCollection<PublicUserProfile>(membersQuery);
  
  const inviteFormSchema = z.object({ email: z.string().email("Geçerli bir e-posta adresi girin.") });
  const inviteForm = useForm({ resolver: zodResolver(inviteFormSchema) });

  const MemberItem = ({ member, isOwner, onRemove }: { member: PublicUserProfile, isOwner: boolean, onRemove: (memberId: string, memberName: string) => void }) => {
    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={member.photoURL || ''} alt={member.name || ''} />
                    <AvatarFallback>{member.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.name}</span>
            </div>
            {isOwner && user?.uid !== member.id && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                           <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Üyeyi çıkartmak istediğinizden emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>{member.name} gruptan kalıcı olarak çıkartılacaktır.</AlertDialogDescription>
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
  };

  const handleInviteMember = async (values: { email: string }) => {
    if (!group || !isOwner || !user) {
        toast({ variant: 'destructive', title: "Hata", description: "Üye eklemek için izniniz yok." });
        return;
    }
    if (group.memberIds.length >= group.maxMembers) {
        toast({ variant: 'destructive', title: "Grup Dolu", description: `Bu grup en fazla ${group.maxMembers} üyeye sahip olabilir.` });
        return;
    }

    try {
        const userQuery = query(collection(firestore, 'users'), where('email', '==', values.email));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: "Kullanıcı Bulunamadı", description: "Bu e-postaya sahip bir kullanıcı yok." });
            return;
        }
        const invitedUserDoc = userSnapshot.docs[0];
        const invitedUser = { ...invitedUserDoc.data(), id: invitedUserDoc.id } as PublicUserProfile;

        if (group.memberIds.includes(invitedUser.id)) {
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
            toUserId: invitedUser.id,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        batch.set(inviteRef, { ...newInvite, id: inviteRef.id });
        await batch.commit();

        toast({ title: "Davetiye Gönderildi!", description: `${values.email} adresine bir grup davetiyesi gönderildi.` });
        inviteForm.reset();

    } catch (e) {
        toast({ variant: 'destructive', title: "Hata", description: "Üye davet edilirken bir sorun oluştu." });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isOwner) return;
      try {
          await updateDoc(groupRef, { memberIds: arrayRemove(memberId) });
          toast({ title: `${memberName} gruptan çıkartıldı.` });
      } catch (e) {
          toast({ variant: 'destructive', title: "Üye çıkartılırken bir hata oluştu." });
      }
  };
  
  const handleDeleteGroup = async () => {
    if (!group || !isOwner) return;
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
    return <div className="container text-center p-8"><Skeleton className="h-12 w-full" /></div>;
  }

  if (!group || error) {
    return (
      <div className="container text-center p-8">
        <h1 className="text-2xl font-bold">Grup Bulunamadı</h1>
        <p className="text-muted-foreground">{error ? "Bu grubu yüklerken bir hata oluştu." : "Böyle bir grup mevcut değil veya görme izniniz yok."}</p>
        <Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Geri Dön</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
                <p className="text-muted-foreground">{group.description}</p>
            </div>
            {isOwner && (
                <Dialog>
                    <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Üye Davet Et</Button></DialogTrigger>
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
                                <Button type="submit" className="w-full">Davet Et</Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )}
        </div>

        <Tabs defaultValue="members" className="w-full">
            <TabsList>
                <TabsTrigger value="members">Üyeler</TabsTrigger>
                <TabsTrigger value="gallery" disabled>Galeri</TabsTrigger>
                <TabsTrigger value="competitions">Yarışmalar</TabsTrigger>
                {isOwner && <TabsTrigger value="settings">Ayarlar</TabsTrigger>}
            </TabsList>
            <TabsContent value="members" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">Üyeler ({members?.length || 0} / {group.maxMembers})
                        {isOwner && (
                            <Dialog>
                                <DialogTrigger asChild><Button variant="secondary">Davet Seçeneklerini Göster</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Gruba Katılım Daveti</DialogTitle><DialogDescription>Bu QR kodu, linki veya 6 haneli kodu kullanarak yeni üyeleri grubunuza davet edebilirsiniz.</DialogDescription></DialogHeader>
                                    <div className="flex flex-col items-center gap-4">
                                        {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="Grup QR Kodu" />}
                                        <div className="flex items-center gap-2">
                                            <Input readOnly value={group.joinCode} className="text-center font-mono text-lg tracking-widest" />
                                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(group.joinCode || '', 'code')}><Copy /></Button>
                                        </div>
                                         <div className="flex items-center gap-2 w-full">
                                            <Input readOnly value={shareableLink} className="text-sm" />
                                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(shareableLink, 'link')}><LinkIcon /></Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {areMembersLoading ? (
                            <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                        ) : (
                            <div className="space-y-1">
                                {members?.map(member => <MemberItem key={member.id} member={member} isOwner={isOwner} onRemove={handleRemoveMember} />)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="competitions" className="mt-6">
                <p className="text-muted-foreground text-center p-8">Gruba özel sergi ve ödev alanı yakında burada olacak.</p>
            </TabsContent>
            {isOwner && (
                <TabsContent value="settings" className="mt-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Grubu Sil</CardTitle>
                            <CardDescription>Bu işlem geri alınamaz. Grup ve tüm içeriği kalıcı olarak silinecektir.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive">Grubu Kalıcı Olarak Sil</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Grubu silmek istediğinizden emin misiniz?</AlertDialogTitle><AlertDialogDescription>Bu işlem grubu ve ilişkili tüm verileri kalıcı olarak silecektir.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup}>Grubu Kalıcı Olarak Sil</AlertDialogAction></AlertDialogFooter>
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
