'use client';

import { useParams, useRouter } from '@/navigation';
import { useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection, where, query } from 'firebase/firestore';
import type { User as UserProfile, Group } from '@/types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Camera, Users, Award, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';

function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="items-center text-center">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const t = useTranslations('PublicProfilePage');

  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(collection(firestore, 'groups'), where("memberIds", "array-contains", userId));
  }, [firestore, userId]);

  const { data: groups, isLoading: areGroupsLoading } = useCollection<Group>(groupsQuery);
  
  const isLoading = isProfileLoading || areGroupsLoading;

  if (isLoading) {
    return <div className="container mx-auto max-w-2xl"><ProfilePageSkeleton /></div>;
  }

  if (!userProfile) {
    return (
        <div className="container mx-auto text-center py-20">
            <p>{t('user_not_found')}</p>
             <Button onClick={() => router.back()} className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('button_go_back')}
            </Button>
        </div>
    )
  }

  const { name, level_name, profileIndex } = userProfile;
  const isMentor = userProfile.is_mentor ?? false;
  const fallbackChar = name?.charAt(0) || '?';

  return (
    <div className="container mx-auto max-w-2xl space-y-6">
        <Card>
            <CardHeader className="items-center text-center p-6">
                <Avatar className="h-24 w-24 text-4xl mb-4">
                  {/* Public profile, so we don't use the Google photoURL directly, assuming it might be private.
                      We will rely on a potential public 'avatarUrl' field if it existed, otherwise fallback. */}
                  <AvatarFallback>{fallbackChar.toUpperCase()}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-sans text-3xl">{name}</CardTitle>
                <div className="flex gap-2 pt-2">
                    <Badge variant={isMentor ? 'default' : 'secondary'} className="capitalize text-sm">
                        <Award className="mr-2 h-4 w-4" />
                        {level_name}
                    </Badge>
                    {isMentor && (
                        <Badge variant="destructive" className="capitalize text-sm">
                           <ShieldCheck className="mr-2 h-4 w-4" />
                           Mentor
                        </Badge>
                    )}
                </div>
            </CardHeader>
            {profileIndex?.dominant_style && (
              <CardContent className="border-t p-6">
                <div className="flex items-center justify-center gap-3 text-lg text-muted-foreground">
                    <Camera className="h-6 w-6 text-primary" />
                    <span className="font-semibold capitalize">{profileIndex.dominant_style}</span>
                </div>
              </CardContent>
            )}
        </Card>

        {groups && groups.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Users className="h-6 w-6" />
                        {t('groups_title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {groups.map(group => (
                            <Link key={group.id} href={`/groups/${group.id}`} className="block">
                                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary">
                                    <span className="font-semibold">{group.name}</span>
                                    <span className="text-sm text-muted-foreground">{group.memberIds.length} üye</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}

        <Button size="lg" className="w-full" asChild>
            <Link href={`/explore?user=${userId}`}>
                <Camera className="mr-2 h-4 w-4" />
                {t('view_public_photos')}
            </Link>
        </Button>
    </div>
  );
}
