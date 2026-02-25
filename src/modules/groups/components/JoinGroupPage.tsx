'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import type { Group } from '@/types';
import { useToast } from '@/shared/hooks/use-toast';

import { Loader2 } from 'lucide-react';

export default function JoinGroupPage() {
    const { groupId } = useParams();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    useEffect(() => {
        if (isUserLoading || !firestore) return;

        if (!user) {
            router.push(`/?redirect=/groups/join/${groupId}`);
            return;
        }

        const joinGroup = async () => {
            const groupRef = doc(firestore, 'groups', groupId as string);
            try {
                const groupSnap = await getDoc(groupRef);
                if (!groupSnap.exists()) {
                    toast({ variant: 'destructive', title: "Hata", description: "Geçersiz grup linki." });
                    router.push('/groups');
                    return;
                }

                const groupData = groupSnap.data() as Group;
                if (groupData.memberIds.includes(user.uid)) {
                    router.push(`/groups/${groupId}`);
                    return;
                }

                if (groupData.memberIds.length >= groupData.maxMembers) {
                     toast({ variant: 'destructive', title: "Hata", description: "Gruba katılamadınız. Grup dolu olabilir, özel bir grup olabilir veya link geçersiz olabilir." });
                     router.push('/groups');
                     return;
                }

                await updateDoc(groupRef, {
                    memberIds: arrayUnion(user.uid)
                });
                
                toast({ title: "Hoş Geldin!", description: "Gruba başarıyla katıldın." });
                router.push(`/groups/${groupId}`);

            } catch (error) {
                toast({ variant: 'destructive', title: "Hata", description: "Gruba katılamadınız. Grup dolu olabilir veya bir hata oluştu." });
                router.push('/groups');
            }
        };

        joinGroup();

    }, [user, isUserLoading, firestore, groupId, router, toast]);

    return (
        <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-8" />
            <h1 className="text-2xl font-bold tracking-tight">Katılım İşleniyor...</h1>
            <p className="text-muted-foreground mt-2">Gruba katılma isteğiniz işleniyor...</p>
        </div>
    );
}
