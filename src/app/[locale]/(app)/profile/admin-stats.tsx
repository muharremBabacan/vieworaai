'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AdminStats() {
    const t = useTranslations('ProfilePage');
    const firestore = useFirestore();
    const [userCount, setUserCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserCount = async () => {
            if (!firestore) return;
            try {
                const usersCollectionRef = collection(firestore, 'public_profiles');
                const snapshot = await getDocs(usersCollectionRef);
                setUserCount(snapshot.size);
            } catch (error) {
                console.error("Error fetching user count:", error);
                setUserCount(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserCount();
    }, [firestore]);

    return (
        <Card className="border-blue-500/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                    <Users className="h-5 w-5 text-blue-400" />
                    {t('admin_total_users_title')}
                </CardTitle>
                <CardDescription>{t('admin_total_users_description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-10 w-24" />
                ) : (
                    <div className="text-3xl font-bold">
                        {userCount?.toLocaleString() ?? 'N/A'}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
