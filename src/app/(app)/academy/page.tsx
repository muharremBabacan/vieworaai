'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen, Camera, Info, Target, FileText, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { User as UserProfile, Lesson as AcademyLesson } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getLevelFromXp } from '@/lib/gamification';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';

function LessonCard({ lesson, onLearn, isCompleted }: { lesson: AcademyLesson; onLearn: (lessonId: string, xp: number, auro: number) => void; isCompleted: boolean; }) {
  const xpForLesson = 10;
  const auroForLesson = 2;

  const handleLearn = () => {
    if (isCompleted) return;
    onLearn(lesson.id, xpForLesson, auroForLesson);
  };

  const accordionItems = [
    { value: 'objective', trigger: 'Öğrenim Hedefi', content: lesson.learningObjective, icon: Target },
    { value: 'criteria', trigger: 'Başarı Kriterleri', content: <ul className="list-disc space-y-2 pl-5">{lesson.analysisCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>, icon: Info },
    { value: 'task', trigger: 'Pratik Görevi', content: lesson.practiceTask, icon: Camera },
    { value: 'auro', trigger: 'Auro Notu', content: lesson.auroNote, icon: Bot },
  ];

  return (
    <Card className="flex flex-col overflow-hidden h-full">
      <CardHeader className="p-0 relative h-48">
        <Image
          src={lesson.imageUrl}
          alt={lesson.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          data-ai-hint={lesson.imageHint}
        />
        <div className="absolute top-4 left-4">
          <Badge variant="secondary">{lesson.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow flex flex-col">
        <CardTitle className="font-sans text-xl mb-2">{lesson.title}</CardTitle>
        <p className="text-muted-foreground text-sm flex-grow">{lesson.theory}</p>
        
        <Accordion type="single" collapsible className="w-full mt-4">
          {accordionItems.map(item => (
            <AccordionItem value={item.value} key={item.value}>
              <AccordionTrigger className="text-sm">
                <div className='flex items-center gap-2'>
                  <item.icon className="h-4 w-4" />
                  {item.trigger}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 text-sm text-muted-foreground">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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

  const lessonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'academyLessons'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: lessons, isLoading } = useCollection<AcademyLesson>(lessonsQuery);

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

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col overflow-hidden h-full">
                <CardHeader className="p-0 relative h-48">
                    <Skeleton className="w-full h-full"/>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                    <Skeleton className="h-6 w-3/4 mb-4"/>
                    <Skeleton className="h-4 w-full mb-2"/>
                    <Skeleton className="h-4 w-5/6"/>
                </CardContent>
                 <CardFooter className="p-6 pt-0">
                    <Skeleton className="h-10 w-full"/>
                </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      {(!lessons || lessons.length === 0) ? (
        <div className="text-center py-20 rounded-lg border border-dashed">
            <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Akademi Henüz Boş</h3>
            <p className="text-muted-foreground mt-2">Profil sayfasından yönetici aracıyla günlük dersleri oluşturun.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
