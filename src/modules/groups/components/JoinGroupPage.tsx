
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useUser, useFirestore } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import type { Group, User } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';

import { Loader2 } from 'lucide-react';

export default function JoinGroupPage() {
    const { groupId } = useParams();
    const t = useTranslations('JoinGroupPage');
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    useEffect(() => {
        if (isUserLoading || !firestore || !user) return;

        const joinGroup = async () => {
            const groupRef = doc(firestore, 'groups', groupId as string);
            try {
                const groupSnap = await getDoc(groupRef);
                if (!groupSnap.exists()) {
                    toast({ variant: 'destructive', title: t('toast_error_title'), description: t('status_error_invalid_link') });
                    router.push('/groups');
                    return;
                }

                const groupData = groupSnap.data() as Group;
                
                // 1. Üyelik kontrolü ve ekleme
                if (!groupData.memberIds.includes(user.uid)) {
                    if (groupData.memberIds.length >= groupData.maxMembers) {
                         toast({ variant: 'destructive', title: t('toast_error_title'), description: t('status_error_failed_join') });
                         router.push('/groups');
                         return;
                    }
                    await updateDoc(groupRef, {
                        memberIds: arrayUnion(user.uid)
                    });
                }

                // 2. public_profiles varlığını kontrol et ve oluştur
                const publicProfileRef = doc(firestore, 'public_profiles', user.uid);
                const publicProfileSnap = await getDoc(publicProfileRef);

                if (!publicProfileSnap.exists()) {
                    const userSnap = await getDoc(doc(firestore, 'users', user.uid));
                    if (userSnap.exists()) {
                        const userData = userSnap.data() as User;
                        await setDoc(publicProfileRef, {
                            id: user.uid,
                            name: userData.name,
                            email: userData.email,
                            photoURL: userData.photoURL || null,
                            level_name: userData.level_name || 'Neuner'
                        });
                    }
                }
                
                toast({ title: t('toast_welcome_title'), description: t('toast_welcome_description') });
                router.push(`/groups/${groupId}`);

            } catch (error) {
                console.error("Join error:", error);
                toast({ variant: 'destructive', title: t('toast_error_title'), description: t('status_error_failed_join') });
                router.push('/groups');
            }
        };

        joinGroup();

    }, [user, isUserLoading, firestore, groupId, router, toast]);

    return (
        <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-8" />
            <h1 className="text-2xl font-bold tracking-tight">{t('status_processing_title')}</h1>
            <p className="text-muted-foreground mt-2">{t('status_processing_description')}</p>
        </div>
    );
}
