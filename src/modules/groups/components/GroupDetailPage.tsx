
'use client';
import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, documentId, deleteDoc, addDoc, serverTimestamp, arrayUnion, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Group, PublicUserProfile, User, GroupAssignment, GroupSubmission } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Trash2, Loader2, Crown, Users, Settings, Camera, Check, AlertTriangle, PlusCircle, Calendar, Image as ImageIcon, Send, Heart, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

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
  const storage = getStorage();
  const { toast } = useToast();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const groupRef = useMemoFirebase(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading, error } = useDoc<Group>(groupRef);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const isCurrentUserOwner = group?.ownerId === user?.uid;
  const userLimits = getGroupLimits(userProfile?.level_name);
  
  const [editName, setEditName] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState(7);
  const [allowMemberComments, setAllowMemberComments] = useState(true);

  // Assignments Query
  const assignmentsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'assignments'), orderBy('createdAt', 'desc')) : null, [firestore, groupId]);
  const { data: assignments } = useCollection<GroupAssignment>(assignmentsQuery);

  // Submissions Query
  const submissionsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'submissions'), orderBy('submittedAt', 'desc')) : null, [firestore, groupId]);
  const { data: submissions } = useCollection<GroupSubmission>(submissionsQuery);

  // Initialize edit states
  useMemo(() => {
    if (group) {
      setEditName(group.name);
      setEditMaxMembers(group.maxMembers || 7);
      setAllowMemberComments(group.allowMemberComments ?? true);
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

  const handleCreateAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!group || !isCurrentUserOwner || isCreatingAssignment) return;
    setIsCreatingAssignment(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    try {
      const assignmentRef = collection(firestore, 'groups', group.id, 'assignments');
      await addDoc(assignmentRef, {
        groupId: group.id,
        title,
        description,
        createdAt: new Date().toISOString()
      });
      toast({ title: "Ödev Yayınlandı", description: "Grup üyelerine yeni görev bildirildi." });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleUploadSubmission = async (assignmentId: string, file: File) => {
    if (!user || !group || isUploading) return;
    
    // Yükleme sınırı kontrolü: Her üye her ödev için 1 tane yükleyebilir
    const existing = submissions?.find(s => s.assignmentId === assignmentId && s.userId === user.uid);
    if (existing) {
      toast({ variant: 'destructive', title: "Sınır Aşıldı", description: "Bu ödev için zaten bir fotoğraf yüklediniz." });
      return;
    }

    setIsUploading(true);
    try {
      const hash = Math.random().toString(36).substring(7);
      const storagePath = `groups/${group.id}/submissions/${assignmentId}/${user.uid}-${hash}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const submissionRef = collection(firestore, 'groups', group.id, 'submissions');
      await addDoc(submissionRef, {
        groupId: group.id,
        assignmentId,
        userId: user.uid,
        userName: userProfile?.name || 'Sanatçı',
        userPhotoURL: userProfile?.photoURL || null,
        photoUrl: url,
        status: 'pending',
        likes: [],
        comments: [],
        submittedAt: new Date().toISOString()
      });
      toast({ title: "Ödev Teslim Edildi", description: "Kurucunun onayı bekleniyor." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    if (!group || !isCurrentUserOwner) return;
    try {
      const subRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
      await updateDoc(subRef, { status: 'approved' });
      toast({ title: "Ödev Onaylandı", description: "Öğrenciye başarı puanı eklendi." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    }
  };

  const handleToggleLike = async (submission: GroupSubmission) => {
    if (!user || !group) return;
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submission.id);
    const isLiked = submission.likes.includes(user.uid);
    try {
      await updateDoc(subRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (submissionId: string, text: string) => {
    if (!user || !group || !text.trim()) return;
    if (!group.allowMemberComments && !isCurrentUserOwner) {
      toast({ variant: 'destructive', title: "Yorumlar Kapalı", description: "Bu grupta yorum yapma yetkisi sadece kurucuya aittir." });
      return;
    }
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
    const newComment = {
      userId: user.uid,
      userName: userProfile?.name || 'Sanatçı',
      text,
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(subRef, {
        comments: arrayUnion(newComment)
      });
    } catch (e) { console.error(e); }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
      if (!group || !isCurrentUserOwner) return;
      try { 
        await updateDoc(groupRef, { memberIds: arrayRemove(memberId) }); 
        toast({ title: `${memberName} çıkartıldı.` }); 
      } catch (e) { 
        toast({ variant: 'destructive', title: "Hata" }); 
      }
  };

  const handleUpdateSettings = async () => {
    if (!group || !isCurrentUserOwner || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateDoc(groupRef, {
        name: editName,
        maxMembers: Math.min(editMaxMembers, userLimits.maxMembers),
        allowMemberComments
      });
      toast({ title: "Grup Ayarları Güncellendi" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group || error) return <div className="container mx-auto px-4 pt-12 text-center"><h1 className="text-2xl font-bold">Grup Bulunamadı</h1><Button onClick={() => router.push('/groups')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplara Dön</Button></div>;

  return (
    <div className="container mx-auto px-4 pt-6 pb-20 animate-in fade-in duration-500">
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

        <Tabs defaultValue="assignments" className="w-full">
            <div className="relative filter-scroll mb-8">
              <div className="w-full overflow-x-auto no-scrollbar pb-2 touch-pan-x scroll-smooth snap-x snap-mandatory">
                <TabsList className="bg-secondary/30 p-1 rounded-2xl h-12 inline-flex w-max gap-1">
                    <TabsTrigger value="assignments" className="rounded-xl px-8 font-bold">Ödevler</TabsTrigger>
                    <TabsTrigger value="gallery" className="rounded-xl px-8 font-bold">Grup Galerisi</TabsTrigger>
                    <TabsTrigger value="members" className="rounded-xl px-8 font-bold">Üyeler</TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-xl px-8 font-bold">Ayarlar</TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            <TabsContent value="assignments" className="space-y-8">
                {isCurrentUserOwner && (
                  <Card className="rounded-[32px] border-primary/20 bg-primary/5 overflow-hidden">
                    <CardHeader className="p-8 border-b border-primary/10">
                      <CardTitle className="text-xl font-black flex items-center gap-2"><PlusCircle size={20} className="text-primary" /> Yeni Ödev Tanımla</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <form onSubmit={handleCreateAssignment} className="space-y-4">
                        <div className="grid gap-4">
                          <Input name="title" placeholder="Ödev Başlığı (örn: Altın Oran Uygulaması)" className="h-12 rounded-xl bg-background" required />
                          <Textarea name="description" placeholder="Ödev açıklaması ve kriterler..." className="rounded-xl bg-background min-h-[100px]" required />
                        </div>
                        <Button type="submit" disabled={isCreatingAssignment} className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                          {isCreatingAssignment ? <Loader2 className="animate-spin" /> : "Ödevi Yayınla"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-6">
                  {assignments && assignments.length > 0 ? assignments.map(asgn => {
                    const mySubmission = submissions?.find(s => s.assignmentId === asgn.id && s.userId === user?.uid);
                    return (
                      <Card key={asgn.id} className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="p-8 pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-2xl font-black tracking-tight">{asgn.title}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1 font-bold text-xs uppercase"><Calendar size={12} /> {new Date(asgn.createdAt).toLocaleDateString('tr-TR')}</CardDescription>
                            </div>
                            {mySubmission && (
                              <Badge className={cn("px-4 h-7 rounded-full font-black uppercase text-[10px]", mySubmission.status === 'approved' ? "bg-green-500/20 text-green-500 border-green-500/20" : "bg-amber-500/20 text-amber-500 border-amber-500/20")}>
                                {mySubmission.status === 'approved' ? <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> TAMAMLANDI</> : <><Clock className="mr-1.5 h-3.5 w-3.5" /> ONAY BEKLİYOR</>}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                          <p className="text-muted-foreground text-sm font-medium leading-relaxed whitespace-pre-wrap">{asgn.description}</p>
                          
                          {/* Üye Yükleme Alanı */}
                          {!isCurrentUserOwner && !mySubmission && (
                            <div className="mt-8 pt-8 border-t border-border/20">
                              <SubmissionUploader assignmentId={asgn.id} onUpload={(file) => handleUploadSubmission(asgn.id, file)} isLoading={isUploading} />
                            </div>
                          )}

                          {/* Kurucu Onay Paneli */}
                          {isCurrentUserOwner && (
                            <div className="mt-8 pt-8 border-t border-border/20">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Gelen Teslimler</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                {submissions?.filter(s => s.assignmentId === asgn.id).map(sub => (
                                  <div key={sub.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-border/40 cursor-pointer" onClick={() => {}}>
                                    <Image src={sub.photoUrl} alt="Submission" fill className="object-cover" unoptimized />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                                      <span className="text-[10px] text-white font-bold mb-2">@{sub.userName}</span>
                                      {sub.status === 'pending' ? (
                                        <Button size="sm" onClick={() => handleApproveSubmission(sub.id)} className="h-7 px-3 text-[9px] rounded-lg font-black uppercase tracking-widest bg-green-600 hover:bg-green-700">Onayla</Button>
                                      ) : (
                                        <Badge className="bg-green-500 text-white font-black text-[8px] h-6 px-2"><Check size={10} className="mr-1" /> ONAYLI</Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {submissions?.filter(s => s.assignmentId === asgn.id).length === 0 && (
                                  <div className="col-span-full py-10 text-center rounded-2xl border-2 border-dashed border-border/20">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Henüz teslim yok</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }) : (
                    <div className="text-center py-20 bg-muted/10 rounded-[40px] border-2 border-dashed border-border/40">
                      <PlusCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="text-xl font-bold">Henüz Ödev Tanımlanmamış</h3>
                      <p className="text-muted-foreground text-sm mt-1">Kurucu yeni bir görev paylaştığında burada göreceksiniz.</p>
                    </div>
                  )}
                </div>
            </TabsContent>

            <TabsContent value="gallery" className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {submissions?.filter(s => s.status === 'approved').map(sub => (
                    <Card key={sub.id} className="group relative aspect-square rounded-[32px] overflow-hidden border-none shadow-lg bg-secondary/20">
                      <Image src={sub.photoUrl} alt="Submission" fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-white/20">
                            <AvatarImage src={sub.userPhotoURL || ''} className="object-cover" />
                            <AvatarFallback className="text-[10px] font-bold">{sub.userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-black text-white uppercase drop-shadow-md">@{sub.userName}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleLike(sub)}
                            className={cn("h-8 w-8 rounded-full bg-black/20 backdrop-blur-md", sub.likes.includes(user?.uid || '') ? "text-red-500" : "text-white")}
                          >
                            <Heart className={cn("h-4 w-4", sub.likes.includes(user?.uid || '') && "fill-current")} />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/20 backdrop-blur-md text-white">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md rounded-[32px]">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-black">Yorumlar</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 mt-4">
                                <ScrollArea className="h-60 pr-4">
                                  <div className="space-y-4">
                                    {sub.comments?.map((c, i) => (
                                      <div key={i} className="flex gap-3">
                                        <Avatar className="h-8 w-8 shrink-0">
                                          <AvatarFallback className="text-[10px] font-bold">{c.userName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 p-3 rounded-2xl bg-muted/50 border border-border/40">
                                          <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] font-black uppercase text-primary">@{c.userName}</p>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: tr })}</span>
                                          </div>
                                          <p className="text-xs font-medium leading-relaxed">{c.text}</p>
                                        </div>
                                      </div>
                                    ))}
                                    {(!sub.comments || sub.comments.length === 0) && <p className="text-center text-xs text-muted-foreground font-medium py-10">İlk yorumu sen yap!</p>}
                                  </div>
                                </ScrollArea>
                                
                                {(group.allowMemberComments || isCurrentUserOwner) ? (
                                  <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const input = (e.target as any).comment;
                                    handleAddComment(sub.id, input.value);
                                    input.value = '';
                                  }} className="flex gap-2">
                                    <Input name="comment" placeholder="Harika bir kare..." className="h-10 rounded-xl" />
                                    <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shrink-0"><Send size={16} /></Button>
                                  </form>
                                ) : (
                                  <div className="p-3 text-center bg-muted/30 rounded-xl border border-dashed border-border/40">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Yorumlar Kurucu Tarafından Kısıtlandı</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {submissions?.filter(s => s.status === 'approved').length === 0 && (
                    <div className="col-span-full py-32 text-center border-2 border-dashed border-border/40 rounded-[48px]">
                      <ImageIcon className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
                      <h3 className="text-2xl font-black tracking-tight">Grup Galerisi Henüz Boş</h3>
                      <p className="text-muted-foreground max-w-xs mx-auto mt-2">Onaylanan ödevler burada sergilenmeye başlar.</p>
                    </div>
                  )}
                </div>
            </TabsContent>
            
            <TabsContent value="members" className="space-y-8">
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
            
            <TabsContent value="settings" className="space-y-8">
                {isCurrentUserOwner ? (
                  <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
                        <CardHeader className="p-8 border-b border-border/40">
                          <CardTitle className="flex items-center gap-3"><Settings className="h-5 w-5 text-primary" /> Grup Yönetimi</CardTitle>
                          <CardDescription>Grubun adını, üye kapasitesini ve etkileşim izinlerini buradan yönetin.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="groupName" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Grup Adı</Label>
                              <Input id="groupName" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl h-12 bg-muted/30 border-border/60" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1">
                                <Label htmlFor="maxMembers" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Maksimum Üye Sayısı</Label>
                                <span className="text-xs font-bold text-primary">{editMaxMembers} / {userLimits.maxMembers}</span>
                              </div>
                              <Input id="maxMembers" type="number" min={group.memberIds.length} max={userLimits.maxMembers} value={editMaxMembers} onChange={(e) => setEditMaxMembers(parseInt(e.target.value))} className="rounded-xl h-12 bg-muted/30 border-border/60" />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border/40">
                              <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Üye Yorumları</Label>
                                <p className="text-xs text-muted-foreground font-medium">Üyeler teslim edilen fotoğrafların altına yorum yazabilsin.</p>
                              </div>
                              <Switch checked={allowMemberComments} onCheckedChange={setAllowMemberComments} />
                            </div>
                          </div>

                          <Button onClick={handleUpdateSettings} disabled={isUpdating} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">
                            {isUpdating && <Loader2 className="animate-spin" />}
                            Ayarları Güncelle
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-xl">
                        <CardHeader className="p-8 border-b border-border/40">
                          <CardTitle className="flex items-center gap-3"><Camera className="h-5 w-5 text-primary" /> Grup Görseli</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {PRESET_AVATARS.map((avatar) => (
                              <button key={avatar.id} onClick={async () => { try { await updateDoc(groupRef, { photoURL: avatar.url }); toast({ title: "Görsel Güncellendi" }); } catch (e) {} }} className={cn("relative aspect-square rounded-xl border-2 transition-all overflow-hidden", group.photoURL === avatar.url ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border hover:border-primary/50")}>
                                <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                                {group.photoURL === avatar.url && <div className="absolute inset-0 bg-primary/10 flex items-center justify-center"><div className="bg-primary text-white p-1 rounded-full shadow-lg"><Check className="h-4 w-4" /></div></div>}
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
                            <p className="text-xs font-medium text-destructive/90 leading-relaxed">Grubu sildiğinizde tüm geçmiş veriler yok edilir. Bu işlem geri alınamaz.</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" className="w-full h-12 rounded-xl font-bold shadow-lg shadow-destructive/20">Grubu Kalıcı Olarak Sil</Button></AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[32px] border-border/40">
                              <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black">Grubu silmek istediğinizden emin misiniz?</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground font-medium"><b>{group.name}</b> grubu kalıcı olarak silinecektir.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter className="gap-3"><AlertDialogCancel className="rounded-xl font-bold h-11">Vazgeç</AlertDialogCancel><AlertDialogAction onClick={async () => { setIsDeleting(true); await deleteDoc(groupRef); toast({ title: "Grup Silindi" }); router.push('/groups'); }} className="rounded-xl font-bold h-11 bg-destructive">Evet, Sil</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <Card className="rounded-[32px] border-border/40 bg-card/50 p-12 text-center">
                    <p className="text-muted-foreground font-medium">Ayarları sadece grup kurucusu yönetebilir.</p>
                  </Card>
                )}
            </TabsContent>
        </Tabs>
    </div>
  );
}

function SubmissionUploader({ assignmentId, onUpload, isLoading }: { assignmentId: string, onUpload: (file: File) => void, isLoading: boolean }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) onUpload(acceptedFiles[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div {...getRootProps()} className={cn("border-2 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all hover:bg-primary/5 hover:border-primary/30 group", isDragActive ? "border-primary bg-primary/5" : "border-border/60")}>
      <input {...getInputProps()} />
      <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImageIcon className="h-6 w-6 text-primary" />}
      </div>
      <p className="text-sm font-black uppercase tracking-widest">{isLoading ? 'Yükleniyor...' : 'Ödevini Teslim Et'}</p>
      <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-tight">Tıklayın veya fotoğrafı buraya sürükleyin</p>
    </div>
  );
}
