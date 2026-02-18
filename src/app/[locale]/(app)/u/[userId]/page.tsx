'use client';

import { useParams } from 'next/navigation';
import { useRouter, Link } from '@/navigation';
import { useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection, where, query, orderBy } from 'firebase/firestore';
import type { User as UserProfile, Group, Photo } from '@/types';
import { useState } from 'react';
import Image from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Camera, Users, Award, ShieldCheck, ArrowLeft, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

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

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};


function FoyerPhotoDialog({ photo, author, isOpen, onOpenChange }: { photo: Photo | null; author: UserProfile | null; isOpen: boolean; onOpenChange: (open: boolean) => void; }) {
  if (!photo || !author) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0 overflow-hidden">
        <div className="absolute right-4 top-4 z-10">
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm text-foreground/80 hover:bg-background/80 hover:text-foreground">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Button>
            </DialogClose>
        </div>
        <div className="md:w-3/5 w-full relative aspect-square md:aspect-auto bg-black/5">
          <Image
            src={photo.imageUrl}
            alt="Fuaye fotoğrafı"
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-contain"
            unoptimized={true}
            priority
          />
        </div>
        <div className="md:w-2/5 w-full overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-3 rounded-lg p-2 -ml-2">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{author.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{author.name}</p>
              <p className="text-xs text-muted-foreground">{author.level_name}</p>
            </div>
          </div>
          {photo.adaptiveFeedback && (
              <p className="text-sm text-muted-foreground italic">"{photo.adaptiveFeedback}"</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const t = useTranslations('PublicProfilePage');

  const firestore = useFirestore();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

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

  const foyerPhotosQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(collection(firestore, 'users', userId, 'photos'), where("isInFoyer", "==", true), orderBy('createdAt', 'desc'));
  }, [firestore, userId]);
  const { data: foyerPhotos, isLoading: areFoyerPhotosLoading } = useCollection<Photo>(foyerPhotosQuery);
  
  const isLoading = isProfileLoading || areGroupsLoading || areFoyerPhotosLoading;

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

        {foyerPhotos && foyerPhotos.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Camera className="h-6 w-6" />
                        Fuaye
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {foyerPhotos.map(photo => (
                             <Card key={photo.id} className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={() => setSelectedPhoto(photo)}>
                                <Image src={photo.imageUrl} alt="Fuaye Fotoğrafı" fill className="object-cover transition-transform group-hover:scale-110" unoptimized={true} />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {photo.aiFeedback && (() => {
                                    const lightScore = normalizeScore(photo.aiFeedback.light_score);
                                    const compositionScore = normalizeScore(photo.aiFeedback.composition_score);
                                    const technicalScore = normalizeScore(
                                    (
                                        normalizeScore(photo.aiFeedback.focus_score) +
                                        normalizeScore(photo.aiFeedback.color_control_score) +
                                        normalizeScore(photo.aiFeedback.background_control_score) +
                                        normalizeScore(photo.aiFeedback.creativity_risk_score)
                                    ) / 4
                                    );
                                    const overallScore = (lightScore + compositionScore + technicalScore) / 3;

                                    return (
                                        <Badge className="absolute top-2 right-2 flex items-center gap-1 border-transparent bg-black/50 text-white backdrop-blur-sm">
                                        <Star className="h-3 w-3 text-yellow-400" />
                                        <span className="text-xs font-bold">{overallScore.toFixed(1)}</span>
                                        </Badge>
                                    )
                                })()}
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}

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
        
        <FoyerPhotoDialog 
            photo={selectedPhoto}
            author={userProfile}
            isOpen={!!selectedPhoto}
            onOpenChange={setSelectedPhoto}
        />
    </div>
  );
}
