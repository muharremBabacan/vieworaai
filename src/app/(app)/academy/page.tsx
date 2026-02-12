'use client';

import { useState } from 'react';
import Image from 'next/image';
import { lessons } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getLevelFromXp } from '@/lib/gamification';

function LessonCard({ lesson, onLearn, isCompleted }: { lesson: (typeof lessons)[0]; onLearn: (lessonId: string, xp: number, auro: number) => void; isCompleted: boolean; }) {
  const xpForLesson = 10;
  const auroForLesson = 2;

  const handleLearn = () => {
    if (isCompleted) return;
    onLearn(lesson.id, xpForLesson, auroForLesson);
  };

  return (
    <Card className="flex flex-col overflow-hidden h-full">
      <CardHeader className="p-0 relative h-48">
        <Image
          src={lesson.imageUrl}
          alt={lesson.title}
          fill
          className="object-cover"
          data-ai-hint={lesson.imageHint}
        />
        <div className="absolute top-4 left-4">
          <Badge variant="secondary">{lesson.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="font-sans text-xl mb-2">{lesson.title}</CardTitle>
        <p className="text-muted-foreground text-sm">{lesson.content}</p>
      </CardContent>
      <CardFooter className="p-6 pt-0">
        <Button
          onClick={handleLearn}
          disabled={isCompleted}
          className="w-full"
          variant={isCompleted ? 'secondary' : 'default'}
        >
          {isCompleted ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Öğrenildi!
            </>
          ) : (
             <>
              <BookOpen className="mr-2 h-4 w-4" />
              Öğrenildi Olarak İşaretle (+{xpForLesson} XP, +{auroForLesson} Auro)
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AcademyPage() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const handleLearn = (lessonId: string, xpToAdd: number, auroToAdd: number) => {
    if (!userProfile || !userDocRef) return;
    if (userProfile.completed_modules?.includes(lessonId)) return; // Already completed

    const currentXp = Number.isFinite(userProfile.current_xp) ? userProfile.current_xp : 0;
    const currentAuro = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
    
    const currentLevel = getLevelFromXp(currentXp);
    const newXp = currentXp + xpToAdd;
    const newLevel = getLevelFromXp(newXp);
    const newAuro = currentAuro + auroToAdd;

    const updatePayload: Partial<UserProfile> = {
      current_xp: newXp,
      auro_balance: newAuro,
      completed_modules: [...(userProfile.completed_modules || []), lessonId],
    };

    if (newLevel.name !== currentLevel.name) {
      updatePayload.level_name = newLevel.name;
      if (newLevel.isMentor) {
        updatePayload.is_mentor = true;
      }
    }

    updateDocumentNonBlocking(userDocRef, updatePayload);
    toast({
      title: 'Ödül Kazandın!',
      description: `Bu dersten ${xpToAdd} XP ve ${auroToAdd} Auro kazandın.`,
    });

    if (updatePayload.level_name) {
      setTimeout(() => {
        toast({
          title: '🎉 Seviye Atladın!',
          description: `Tebrikler! Yeni seviyen: ${updatePayload.level_name}`,
        });
      }, 100);
      if (updatePayload.is_mentor) {
        setTimeout(() => {
          toast({
            title: '👑 Mentor Oldun!',
            description: 'Tebrikler! Artık bir Vexer olarak mentorluk yapabilirsin.',
          });
        }, 200);
      }
    }
  };


  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lessons.map((lesson) => (
          <LessonCard 
            key={lesson.id} 
            lesson={lesson} 
            onLearn={handleLearn}
            isCompleted={userProfile?.completed_modules?.includes(lesson.id) || false}
          />
        ))}
      </div>
    </div>
  );
}
