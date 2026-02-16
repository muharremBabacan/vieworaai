'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, CheckCircle, Home, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const t = useTranslations('JoinGroupPage');

  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('status_processing_description'));

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user auth state is resolved
    }

    if (!user) {
      const currentPath = window.location.pathname;
      router.replace(`/?redirect_uri=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (!groupId || !firestore) {
      setStatus('error');
      setMessage(t('status_error_invalid_link'));
      return;
    }

    const joinGroup = async () => {
      const groupRef = doc(firestore, 'groups', groupId);
      const userRef = doc(firestore, 'users', user.uid);
      
      try {
        // We no longer read the group doc first. We just attempt to join.
        // The security rules will enforce all constraints (e.g., group is not full).
        await updateDoc(groupRef, { memberIds: arrayUnion(user.uid) });
        await updateDoc(userRef, { groups: arrayUnion(groupId) });

        setStatus('success');
        setMessage(t('status_success_description'));
        toast({ title: t('toast_welcome_title'), description: t('toast_welcome_description') });
        
        setTimeout(() => {
          router.replace(`/groups/${groupId}`);
        }, 2000);

      } catch (error) {
        console.error("Gruba katılma hatası:", error);
        setStatus('error');
        // Provide a more helpful message since we can't check reasons on the client anymore
        setMessage(t('status_error_failed_join'));
        toast({ variant: 'destructive', title: t('toast_error_title'), description: t('toast_error_description') });
      }
    };

    joinGroup();

  }, [groupId, user, isUserLoading, firestore, router, toast, t]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <CardTitle>{t('status_processing_title')}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500" />
            <CardTitle>{t('status_success_title')}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-destructive" />
            <CardTitle>{t('status_error_main_title')}</CardTitle>
            <CardDescription>{message}</CardDescription>
             <Button asChild className="mt-4" variant="secondary">
              <Link href="/groups">{t('button_back_to_groups')}</Link>
            </Button>
          </>
        );
    }
  };


  return (
    <div className="container mx-auto flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="p-6 text-center">
            <h1 className="text-2xl font-bold">{t('page_title')}</h1>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
