'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, documentId, deleteDoc, addDoc, arrayUnion, orderBy, increment, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Group, PublicUserProfile, User, GroupAssignment, GroupSubmission, GroupComment } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Crown, Users, CheckCircle2, MessageSquare, Send, Loader2, ImageIcon, Info, PlusCircle, Heart, UserCheck, Star, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { evaluateGroupSubmission } from '@/ai/flows/evaluate-group-submission';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('assignments');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<GroupSubmission | null>(null);

  // 1. Group Data
  const groupRef = useMemoFirebase(() => (firestore && groupId) ? doc(firestore, 'groups', groupId as string) : null, [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading } = useDoc<Group>(groupRef);

  // 2. User Profile Data
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  // 3. Profiles of All Group Members
  const profilesQuery = useMemoFirebase(() => {
    if (!firestore || !group?.memberIds || group.memberIds.length === 0) return null;
    return query(collection(firestore, 'public_profiles'), where(documentId(), 'in', group.memberIds));
  }, [firestore, group?.memberIds]);
  const { data: memberProfiles } = useCollection<PublicUserProfile>(profilesQuery);

  // 4. Assignments Data
  const assignmentsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'assignments'), orderBy('createdAt', 'desc')) : null, [firestore, groupId]);
  const { data: assignments, isLoading: isAssignmentsLoading } = useCollection<GroupAssignment>(assignmentsQuery);

  // 5. Submissions Data
  const submissionsQuery = useMemoFirebase(() => (firestore && groupId) ? query(collection(firestore, 'groups', groupId as string, 'submissions'), orderBy('submittedAt', 'desc')) : null, [firestore, groupId]);
  const { data: submissions, isLoading: isSubmissionsLoading } = useCollection<GroupSubmission>(submissionsQuery);

  const isCurrentUserOwner = group?.ownerId === user?.uid;

  // AUTO-SYNC: Ensure user has a public profile
  useEffect(() => {
    if (!user || !userProfile || !firestore || isSyncingProfile) return;
    const checkAndSyncProfile = async () => {
      setIsSyncingProfile(true);
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      const snap = await getDoc(publicRef);
      if (!snap.exists()) {
        await setDoc(publicRef, {
          id: user.uid,
          name: userProfile.name || "Anonim Vizyoner",
          email: userProfile.email,
          photoURL: userProfile.photoURL || null,
          level_name: userProfile.level_name || "Neuner"
        });
      }
      setIsSyncingProfile(false);
    };
    checkAndSyncProfile();
  }, [user, userProfile, firestore, isSyncingProfile]);

  const handleUploadSubmission = async (assignment: GroupAssignment, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    
    setIsUploading(true);
    toast({ title: "Yükleniyor ve Analiz Ediliyor...", description: "Luma ödevini değerlendiriyor. Lütfen bekleyin..." });
    
    try {
      const hash = Math.random().toString(36).substring(7);
      const storagePath = `groups/${group.id}/submissions/${assignment.id}/${user.uid}-${hash}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // Trigger Specific AI Analysis for this assignment
      const aiResult = await evaluateGroupSubmission({
        photoUrl: url,
        assignmentTitle: assignment.title,
        assignmentDescription: assignment.description,
        language: "tr"
      });

      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      const userRef = doc(firestore, 'users', user.uid);

      batch.set(submissionRef, {
        id: submissionRef.id,
        groupId: group.id,
        assignmentId: assignment.id,
        userId: user.uid,
        userName: userProfile?.name || 'Sanatçı',
        userPhotoURL: userProfile?.photoURL || null,
        photoUrl: url,
        status: aiResult.isSuccess ? 'approved' : 'pending',
        likes: [],
        comments: [],
        aiFeedback: aiResult,
        submittedAt: new Date().toISOString()
      } as GroupSubmission);

      batch.update(userRef, {
        'profile_index.activity_signals.group_activity_score': increment(10)
      });

      await batch.commit();
      toast({ title: "Ödev Teslim Edildi!", description: "AI analizi tamamlandı ve galeriye eklendi." });
    } catch (e) {
      console.error("Upload error:", e);
      toast({ variant: 'destructive', title: "Hata", description: "İşlem tamamlanamadı." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAssignment = async (title: string, description: string) => {
    if (!firestore || !group) return;
    try {
      const docRef = await addDoc(collection(firestore, 'groups', group.id, 'assignments'), {
        groupId: group.id,
        title,
        description,
        createdAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      toast({ title: "Ödev Oluşturuldu" });
    } catch (e) { toast({ variant: 'destructive', title: "Hata" }); }
  };

  const handleToggleLike = async (submission: GroupSubmission) => {
    if (!user || !firestore || !group) return;
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submission.id);
    const isLiked = submission.likes.includes(user.uid);
    try {
      await updateDoc(subRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (submission: GroupSubmission, text: string) => {
    if (!user || !firestore || !group || !text.trim()) return;
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submission.id);
    const newComment: GroupComment = {
      userId: user.uid,
      userName: userProfile?.name || 'Vizyoner',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(subRef, {
        comments: arrayUnion(newComment)
      });
    } catch (e) { console.error(e); }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group) return null;

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 animate-in fade-in duration-700">
      <header className="mb-12 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/groups')} className="rounded-xl font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Gruplarım</Button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-black tracking-tighter uppercase">{group.name}</h1>
              {isCurrentUserOwner && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black h-6 uppercase tracking-widest px-3">KURUCU</Badge>}
            </div>
            <p className="text-muted-foreground text-lg font-medium">{group.description}</p>
          </div>
          <div className="flex items-center gap-4 bg-secondary/30 px-6 py-3 rounded-2xl border border-border/40">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm"><Users size={20} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Toplam Üye</p>
              <p className="text-lg font-black">{group.memberIds.length} / {group.maxMembers}</p>
            </div>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <TabsList className="bg-secondary/30 p-1 rounded-2xl h-12 border border-border/40">
          <TabsTrigger value="assignments" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Ödevler</TabsTrigger>
          <TabsTrigger value="gallery" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Galeri</TabsTrigger>
          <TabsTrigger value="members" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl">Grup Listesi</TabsTrigger>
          {isCurrentUserOwner && <TabsTrigger value="admin" className="px-8 font-black uppercase text-[10px] tracking-widest rounded-xl text-amber-500">Kurucu Paneli</TabsTrigger>}
        </TabsList>

        <TabsContent value="assignments" className="space-y-8">
          {isAssignmentsLoading ? <Skeleton className="h-40 w-full rounded-3xl" /> : 
           assignments && assignments.length > 0 ? (
            <div className="grid gap-6">
              {assignments.map(ass => {
                const userSubmission = submissions?.find(s => s.assignmentId === ass.id && s.userId === user?.uid);
                return (
                  <Card key={ass.id} className="rounded-[32px] border-border/40 overflow-hidden bg-card/50">
                    <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-2xl font-black uppercase tracking-tight">{ass.title}</CardTitle>
                          <p className="text-sm font-medium text-muted-foreground">{new Date(ass.createdAt).toLocaleDateString('tr-TR')} tarihinde verildi</p>
                        </div>
                        {userSubmission && (
                          <div className="flex flex-col items-end gap-2">
                            <Badge className="bg-green-500 text-white font-black px-4 h-7 rounded-full uppercase tracking-widest text-[10px]"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Teslim Edildi</Badge>
                            {userSubmission.aiFeedback && <Badge variant="secondary" className="bg-primary/10 text-primary font-black px-2 h-5 text-[9px]">LUMA: {userSubmission.aiFeedback.score}/10</Badge>}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                      <div className="bg-muted/20 p-6 rounded-2xl border border-dashed border-border/60 italic font-medium text-foreground/80 leading-relaxed">
                        "{ass.description}"
                      </div>
                      {!userSubmission ? (
                        <div className="pt-4">
                          <AssignmentUploader onUpload={(file) => handleUploadSubmission(ass, file)} isUploading={isUploading} />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center gap-6 p-6 rounded-[24px] bg-green-500/5 border border-green-500/20">
                            <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0">
                              <Image src={userSubmission.photoUrl} alt="Teslimatım" fill className="object-cover" unoptimized />
                            </div>
                            <div className="flex-1">
                              <p className="text-lg font-black tracking-tight text-green-500 uppercase">Görevi Başardın!</p>
                              <p className="text-sm text-muted-foreground font-medium">Ödevin başarıyla teslim edildi ve AI tarafından analiz edildi.</p>
                            </div>
                            <Button onClick={() => setSelectedSubmission(userSubmission)} variant="outline" className="rounded-xl h-10 px-6 font-bold">Detay ve Yorumlar</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5">
              <Info className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
              <h3 className="text-2xl font-black tracking-tight">Henüz Ödev Yok</h3>
              <p className="text-muted-foreground mt-2">Kurucunuz ödev eklediğinde burada göreceksiniz.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gallery" className="space-y-8">
          {isSubmissionsLoading ? <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div> :
           submissions && submissions.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {submissions.map(sub => (
                <Card 
                  key={sub.id} 
                  className="group relative aspect-square rounded-[32px] overflow-hidden border-none shadow-2xl transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <Image src={sub.photoUrl} alt="Teslim" fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {sub.aiFeedback && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-black/50 backdrop-blur-md text-white border-white/10 px-2 h-6 font-black text-[10px]">
                        <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" /> {sub.aiFeedback.score.toFixed(1)}
                      </Badge>
                    </div>
                  )}

                  <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                        <AvatarImage src={sub.userPhotoURL || ''} className="object-cover" />
                        <AvatarFallback className="text-[10px] bg-secondary font-black">{sub.userName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-black text-white drop-shadow-md">@{sub.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <div className="flex items-center gap-1 text-[10px] font-bold"><Heart size={12} className={sub.likes.includes(user?.uid || '') ? "fill-red-500 text-red-500" : ""} /> {sub.likes.length}</div>
                      <div className="flex items-center gap-1 text-[10px] font-bold"><MessageSquare size={12} /> {sub.comments.length}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 rounded-[48px] border-2 border-dashed bg-muted/5">
              <ImageIcon className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
              <h3 className="text-2xl font-black tracking-tight">Galeri Boş</h3>
              <p className="text-muted-foreground mt-2">Henüz kimse ödev teslim etmedi.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-8">
          <Card className="rounded-[40px] border-border/40 bg-card/50 overflow-hidden shadow-2xl">
            <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3"><Users className="text-primary h-6 w-6" /> Grup Listesi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {group.memberIds.map(memberId => {
                  const profile = memberProfiles?.find(p => p.id === memberId);
                  const isOwner = memberId === group.ownerId;
                  return (
                    <div key={memberId} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <Avatar className="h-14 w-14 border-2 border-border/60 transition-transform group-hover:scale-105">
                            <AvatarImage src={profile?.photoURL || ''} className="object-cover" />
                            <AvatarFallback className="text-xl font-black bg-secondary">{profile?.name?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                          {isOwner && <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center shadow-lg"><Crown size={12} className="text-black" /></div>}
                        </div>
                        <div>
                          <div className="text-lg font-black tracking-tight flex items-center gap-2">
                            {profile ? profile.name : <span className="text-muted-foreground italic font-medium">Yükleniyor...</span>}
                            {profile?.id === user?.uid && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-primary text-primary uppercase">SEN</Badge>}
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{profile?.level_name || 'Neuner'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCurrentUserOwner && (
          <TabsContent value="admin" className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl">
                <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
                  <CardTitle className="text-xl font-black flex items-center gap-3"><PlusCircle className="text-primary" /> Yeni Ödev Ver</CardTitle>
                  <CardDescription>Grup üyeleri için yeni bir pratik görevi oluştur.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <AssignmentCreator onCreate={handleCreateAssignment} />
                </CardContent>
              </Card>

              <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-xl">
                <CardHeader className="bg-green-500/5 p-8 border-b border-border/40">
                  <CardTitle className="text-xl font-black flex items-center gap-3"><ShieldCheck className="text-green-500" /> Bekleyen Teslimler</CardTitle>
                  <CardDescription>Henüz incelenmemiş yeni ödev teslimleri.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {submissions?.filter(s => s.status === 'pending').map(sub => (
                        <div key={sub.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-white/20"><AvatarImage src={sub.userPhotoURL || ''} /><AvatarFallback>{sub.userName.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                              <p className="text-sm font-black tracking-tight">@{sub.userName}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{assignments?.find(a => a.id === sub.assignmentId)?.title || 'Ödev'}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-xl h-8 text-[9px] font-black uppercase" onClick={() => setSelectedSubmission(sub)}>İncele</Button>
                        </div>
                      ))}
                      {submissions?.filter(s => s.status === 'pending').length === 0 && (
                        <div className="text-center py-10 italic text-muted-foreground text-sm font-medium">Henüz yeni teslim yok.</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[40px] border-border/40 bg-card/50 shadow-2xl">
              <CardHeader className="bg-secondary/20 p-8 border-b border-border/40">
                <CardTitle className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter"><UserCheck className="text-primary" /> Üye Takip Çizelgesi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="px-8 font-black uppercase text-[10px] h-14">Vizyoner</TableHead>
                        {assignments?.map(ass => (
                          <TableHead key={ass.id} className="text-center font-black uppercase text-[10px] min-w-[120px] h-14">{ass.title}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.memberIds.map(memberId => {
                        const profile = memberProfiles?.find(p => p.id === memberId);
                        return (
                          <TableRow key={memberId} className="hover:bg-muted/20 border-border/40 transition-colors">
                            <TableCell className="px-8 py-5 flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border/60"><AvatarImage src={profile?.photoURL || ''} /><AvatarFallback>{profile?.name?.charAt(0) || '?'}</AvatarFallback></Avatar>
                              <span className="font-black text-sm tracking-tight">{profile?.name || '...'}</span>
                            </TableCell>
                            {assignments?.map(ass => {
                              const done = submissions?.some(s => s.assignmentId === ass.id && s.userId === memberId);
                              return (
                                <TableCell key={ass.id} className="text-center">
                                  {done ? <div className="h-8 w-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto border border-green-500/20"><CheckCircle2 size={16} /></div> : <div className="h-2 w-2 rounded-full bg-muted/40 mx-auto" />}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Submission Detail & Interaction Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        {selectedSubmission && (
          <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row">
            <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
              <Image src={selectedSubmission.photoUrl} alt="Eser" fill className="object-contain" unoptimized />
            </div>
            <div className="md:w-2/5 w-full flex flex-col p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black uppercase text-[9px] tracking-widest">ÖDEV TESLİMİ</Badge>
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight">{assignments?.find(a => a.id === selectedSubmission.assignmentId)?.title || 'Ödev Detayı'}</DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-6 w-6"><AvatarImage src={selectedSubmission.userPhotoURL || ''}/><AvatarFallback>{selectedSubmission.userName.charAt(0)}</AvatarFallback></Avatar>
                  <span className="text-xs font-bold text-muted-foreground uppercase">@{selectedSubmission.userName}</span>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-2 pr-4">
                <div className="space-y-6">
                  {/* AI Evaluation Section */}
                  {selectedSubmission.aiFeedback ? (
                    <Card className="p-5 border-primary/20 bg-primary/5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles size={12}/> Luma Ödev Analizi</h4>
                        <Badge className="bg-primary text-white h-5 px-2 text-[9px] font-black">{selectedSubmission.aiFeedback.score}/10</Badge>
                      </div>
                      <p className="text-xs italic leading-relaxed text-foreground/90 bg-background/40 p-3 rounded-xl">"{selectedSubmission.aiFeedback.feedback}"</p>
                      <div className="grid gap-2">
                        {selectedSubmission.aiFeedback.technicalPoints.map((pt, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                            <CheckCircle2 size={10} className="text-green-500" /> {pt}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ) : (
                    <div className="p-6 border-dashed border-border/60 bg-muted/10 rounded-2xl text-center">
                      <Loader2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40 animate-spin" />
                      <p className="text-xs font-bold text-muted-foreground italic">Analiz yükleniyor...</p>
                    </div>
                  )}

                  {/* Interaction Buttons */}
                  <div className="flex items-center gap-4 py-4 border-y border-border/40">
                    <Button 
                      variant="ghost" 
                      className={cn("h-10 px-4 rounded-xl gap-2 font-black text-xs", selectedSubmission.likes.includes(user?.uid || '') ? "text-red-500 bg-red-500/5" : "")}
                      onClick={() => handleToggleLike(selectedSubmission)}
                    >
                      <Heart className={cn("h-4 w-4", selectedSubmission.likes.includes(user?.uid || '') && "fill-current")} />
                      {selectedSubmission.likes.length} Beğeni
                    </Button>
                    <div className="flex items-center gap-2 text-muted-foreground font-black text-xs px-2">
                      <MessageSquare className="h-4 w-4" />
                      {selectedSubmission.comments.length} Yorum
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Topluluk Geri Bildirimi</h5>
                    <div className="space-y-4">
                      {selectedSubmission.comments.map((comment, i) => (
                        <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback></Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-tight">{comment.userName}</span>
                              <span className="text-[8px] text-muted-foreground uppercase">{new Date(comment.createdAt).toLocaleTimeString('tr-TR')}</span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed bg-secondary/20 p-2.5 rounded-xl border border-border/40">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                      {selectedSubmission.comments.length === 0 && <p className="text-center py-6 text-xs italic text-muted-foreground">Henüz yorum yapılmamış.</p>}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Comment Input */}
              <div className="pt-4 border-t border-border/40">
                <CommentInput onSend={(text) => handleAddComment(selectedSubmission, text)} />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function CommentInput({ onSend }: { onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  const handleSend = () => { if (text.trim()) { onSend(text); setText(''); } };
  return (
    <div className="relative">
      <Input 
        value={text} 
        onChange={e => setText(e.target.value)} 
        placeholder="Yorumunu yaz..." 
        className="h-12 pr-14 rounded-2xl bg-muted/30 border-border/60 focus:border-primary/40 transition-all font-medium text-sm"
        onKeyDown={e => e.key === 'Enter' && handleSend()}
      />
      <Button 
        size="icon" 
        onClick={handleSend} 
        disabled={!text.trim()} 
        className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl shadow-lg shadow-primary/20"
      >
        <Send size={16} />
      </Button>
    </div>
  );
}

function AssignmentCreator({ onCreate }: { onCreate: (t: string, d: string) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const handleAdd = () => { if (title.trim() && desc.trim()) { onCreate(title, desc); setTitle(''); setDesc(''); } };
  return (
    <div className="space-y-5">
      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest ml-1">Ödev Başlığı</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: Pencere Portresi" className="rounded-2xl h-12 bg-muted/30" /></div>
      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest ml-1">Detaylar & Kurallar</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Örn: Doğal pencere ışığını kullanarak derinlikli bir portre çekin..." className="rounded-2xl min-h-[120px] bg-muted/30" /></div>
      <Button onClick={handleAdd} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">Ödevi Yayınla</Button>
    </div>
  );
}

function AssignmentUploader({ onUpload, isUploading }: { onUpload: (f: File) => void, isUploading: boolean }) {
  const onDrop = useCallback((files: File[]) => { if (files.length > 0) onUpload(files[0]); }, [onUpload]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });
  return (
    <div {...getRootProps()} className={cn("border-2 border-dashed rounded-[32px] p-12 text-center cursor-pointer transition-all hover:bg-primary/5 hover:border-primary/40 group bg-muted/10", isDragActive && "border-primary bg-primary/10", isUploading && "opacity-50 pointer-events-none")}>
      <input {...getInputProps()} />
      <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
        {isUploading ? <Loader2 className="animate-spin text-primary" size={32} /> : <ImageIcon className="text-muted-foreground group-hover:text-primary transition-colors" size={32} />}
      </div>
      <p className="font-black text-xl tracking-tight uppercase">Ödevini Teslim Et</p>
      <p className="text-sm text-muted-foreground mt-2 font-medium">Fotoğrafını buraya sürükle veya seç.</p>
    </div>
  );
}
