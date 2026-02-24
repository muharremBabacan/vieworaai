'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import type { Group } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';
import { useTranslations } from 'next-intl';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JoinGroupPage() {
    const t = useTranslations('JoinGroupPage');
    const { groupId } = useParams();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    useEffect(() => {
        if (isUserLoading || !firestore) return;

        if (!user) {
            // User not logged in, redirect to login but keep the join link for after
            router.push(`/?redirect=/groups/join/${groupId}`);
            return;
        }

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
                if (groupData.memberIds.includes(user.uid)) {
                    // Already a member, just redirect
                    router.push(`/groups/${groupId}`);
                    return;
                }

                if (groupData.memberIds.length >= groupData.maxMembers) {
                     toast({ variant: 'destructive', title: t('toast_error_title'), description: t('status_error_failed_join') });
                     router.push('/groups');
                     return;
                }

                await updateDoc(groupRef, {
                    memberIds: arrayUnion(user.uid)
                });
                
                toast({ title: t('toast_welcome_title'), description: t('toast_welcome_description') });
                router.push(`/groups/${groupId}`);

            } catch (error) {
                toast({ variant: 'destructive', title: t('toast_error_title'), description: t('status_error_failed_join') });
                router.push('/groups');
            }
        };

        joinGroup();

    }, [user, isUserLoading, firestore, groupId, router, toast, t]);

    return (
        <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-8" />
            <h1 className="text-2xl font-bold tracking-tight">{t('status_processing_title')}</h1>
            <p className="text-muted-foreground mt-2">{t('status_processing_description')}</p>
        </div>
    );
}
