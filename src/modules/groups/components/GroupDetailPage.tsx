
'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, documentId, deleteDoc, addDoc, arrayUnion, orderBy, increment, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Group, PublicUserProfile, User, GroupAssignment, GroupSubmission } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Crown, Users, CheckCircle2, MessageSquare, Send, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);

  const groupRef = useMemoFirebase(() => (firestore && groupId) ? doc(firestore, 'groups', groupId as string) : null, [firestore, groupId]);
  const { data: group, isLoading: isGroupLoading } = useDoc<Group>(groupRef);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const isCurrentUserOwner = group?.ownerId === user?.uid;

  const handleUploadSubmission = async (assignmentId: string, file: File) => {
    if (!user || !group || isUploading || !firestore) return;
    
    setIsUploading(true);
    try {
      const hash = Math.random().toString(36).substring(7);
      const storagePath = `groups/${group.id}/submissions/${assignmentId}/${user.uid}-${hash}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const batch = writeBatch(firestore);
      const submissionRef = doc(collection(firestore, 'groups', group.id, 'submissions'));
      const userRef = doc(firestore, 'users', user.uid);

      batch.set(submissionRef, {
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

      batch.update(userRef, {
        'profile_index.behavioral.group_activity_score': increment(5) // Davranış Katmanı Güncelleme
      });

      await batch.commit();
      toast({ title: "Başarıyla Yüklendi" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Hata" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddComment = async (submissionId: string, text: string) => {
    if (!user || !group || !text.trim() || !firestore) return;
    const subRef = doc(firestore, 'groups', group.id, 'submissions', submissionId);
    const userRef = doc(firestore, 'users', user.uid);
    
    try {
      const batch = writeBatch(firestore);
      batch.update(subRef, {
        comments: arrayUnion({
          userId: user.uid,
          userName: userProfile?.name || 'Sanatçı',
          text,
          createdAt: new Date().toISOString()
        })
      });
      batch.update(userRef, {
        'profile_index.behavioral.group_activity_score': increment(1) // Davranış Katmanı Güncelleme (Yorum)
      });
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  if (isGroupLoading) return <div className="container mx-auto px-4 pt-12 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!group) return null;

  return (
    <div className="container mx-auto px-4 pt-6 pb-20">
        <h1 className="text-4xl font-black mb-10">{group.name}</h1>
        <p className="text-muted-foreground mb-10">{group.description}</p>
        <div className="text-center py-20 bg-muted/10 rounded-[40px] border-2 border-dashed">
            <p>Grup özellikleri (Ödevler ve Galeri) aktif.</p>
        </div>
    </div>
  );
}
