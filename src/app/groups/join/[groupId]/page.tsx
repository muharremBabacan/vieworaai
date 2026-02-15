'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion, DocumentData } from 'firebase/firestore';
import type { Group, User as UserProfile } from '@/types';
import { getGroupLimits } from '@/lib/gamification';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, CheckCircle, Home, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Gruba katılma isteğiniz işleniyor...');

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user auth state is resolved
    }

    if (!user) {
      // User is not authenticated. Redirect them to the login page.
      // Pass the current path as a `redirect_uri` so we can come back.
      const currentPath = window.location.pathname;
      router.replace(`/?redirect_uri=${encodeURIComponent(currentPath)}`);
      setMessage('Giriş sayfasına yönlendiriliyorsunuz...');
      return;
    }

    if (!groupId || !firestore) {
      setStatus('error');
      setMessage('Geçersiz grup IDsi veya veritabanı bağlantı hatası.');
      return;
    }

    const joinGroup = async () => {
      const groupRef = doc(firestore, 'groups', groupId);
      
      try {
        const groupSnap = await getDoc(groupRef);

        if (!groupSnap.exists()) {
          setStatus('error');
          setMessage('Böyle bir grup bulunamadı.');
          return;
        }

        const group = groupSnap.data() as Group;

        if (group.memberIds.includes(user.uid)) {
          toast({ title: 'Zaten Üyesiniz', description: `Zaten '${group.name}' grubunun bir üyesisiniz.` });
          router.replace(`/groups/${groupId}`);
          return;
        }
        
        // Use group owner's level to determine limits
        const ownerRef = doc(firestore, 'users', group.ownerId);
        const ownerSnap = await getDoc(ownerRef);
        const ownerProfile = ownerSnap.data() as UserProfile;
        const { maxMembers } = getGroupLimits(ownerProfile?.level_name);

        if (group.memberIds.length >= maxMembers) {
          setStatus('error');
          setMessage(`Grup dolu. Bu grup en fazla ${maxMembers} üyeye sahip olabilir.`);
          return;
        }

        await updateDoc(groupRef, {
          memberIds: arrayUnion(user.uid)
        });

        setStatus('success');
        setMessage(`'${group.name}' grubuna başarıyla katıldınız! Yönlendiriliyorsunuz...`);
        toast({ title: 'Hoş Geldin!', description: `'${group.name}' grubuna katıldın.` });
        
        setTimeout(() => {
          router.replace(`/groups/${groupId}`);
        }, 2000);

      } catch (error) {
        console.error("Gruba katılma hatası:", error);
        setStatus('error');
        setMessage('Gruba katılırken bir hata oluştu.');
        toast({ variant: 'destructive', title: 'Hata', description: 'İşlem sırasında bir sorun oluştu.' });
      }
    };

    joinGroup();

  }, [groupId, user, isUserLoading, firestore, router, toast]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <CardTitle>{message}</CardTitle>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500" />
            <CardTitle>Başarılı!</CardTitle>
            <CardDescription>{message}</CardDescription>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-destructive" />
            <CardTitle>Bir Sorun Oluştu</CardTitle>
            <CardDescription>{message}</CardDescription>
             <Button asChild className="mt-4" variant="secondary">
              <Link href="/groups">Gruplarıma Dön</Link>
            </Button>
          </>
        );
    }
  };


  return (
    <div className="container mx-auto flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="p-6 text-center">
            <h1 className="text-2xl font-bold">Gruba Katıl</h1>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
