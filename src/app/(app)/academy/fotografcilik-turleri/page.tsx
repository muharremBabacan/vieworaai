'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { User as UserProfile, Lesson as AcademyLesson } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen, Camera, Info, Target, FileText, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getLevelFromXp } from '@/lib/gamification';

function LessonDetailDialog({ lesson, isOpen, onOpenChange, onLearn, isCompleted }: { lesson: AcademyLesson | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onLearn: (lessonId: string, xp: number, auro: number) => void; isCompleted: boolean; }) {
  if (!lesson) return null;

  const xpForLesson = 10;
  const auroForLesson = 2;

  const handleLearn = () => {
    if (isCompleted) return;
    onLearn(lesson.id, xpForLesson, auroForLesson);
  };

  const accordionItems = [
    { value: 'objective', trigger: 'Öğrenim Hedefi', content: lesson.learningObjective, icon: Target },
    { value: 'theory', trigger: 'Teori', content: lesson.theory, icon: FileText },
    { value: 'criteria', trigger: 'Başarı Kriterleri', content: <ul className="list-disc space-y-2 pl-5">{lesson.analysisCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>, icon: Info },
    { value: 'task', trigger: 'Pratik Görevi', content: lesson.practiceTask, icon: Camera },
    { value: 'auro', trigger: 'Auro Notu', content: lesson.auroNote, icon: Bot },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0 gap-0">
        <div className="md:w-2/5 w-full relative aspect-[4/3] md:aspect-auto">
           <Image
            src={lesson.imageUrl}
            alt={lesson.title}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover md:rounded-l-lg"
            data-ai-hint={lesson.imageHint}
          />
           <div className="absolute top-4 left-4">
            <Badge variant="secondary">{lesson.category}</Badge>
          </div>
        </div>
        <div className="md:w-3/5 w-full overflow-y-auto">
            <div className='p-6 flex flex-col h-full'>
              <DialogHeader className="mb-4">
                <DialogTitle className="font-sans text-2xl">{lesson.title}</DialogTitle>
              </DialogHeader>

              <div className="flex-grow">
                <Accordion type="single" collapsible className="w-full" defaultValue="objective">
                  {accordionItems.map(item => (
                    <AccordionItem value={item.value} key={item.value}>
                      <AccordionTrigger>
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
              </div>
              
              <div className="mt-6">
                <Button
                  onClick={handleLearn}
                  disabled={isCompleted}
                  className="w-full"
                  size="lg"
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
                      Dersi Tamamla (+{xpForLesson} XP, +{auroForLesson} Auro)
                    </>
                  )}
                </Button>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function LessonCard({ lesson, onSelect, isCompleted }: { lesson: AcademyLesson; onSelect: () => void; isCompleted: boolean; }) {
  return (
    <Card onClick={onSelect} className="overflow-hidden cursor-pointer group h-full flex flex-col">
       <CardHeader className="p-0 relative aspect-video">
        <Image
          src={lesson.imageUrl}
          alt={lesson.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          data-ai-hint={lesson.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
         {isCompleted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300">
            <Check className="h-16 w-16 text-white/80" />
          </div>
        )}
        <div className="absolute bottom-4 left-4">
          <Badge variant="secondary">{lesson.category}</Badge>
        </div>
      </CardHeader>
       <CardContent className="p-4 flex-grow flex items-center">
        <CardTitle className="font-sans text-base line-clamp-2 leading-snug">{lesson.title}</CardTitle>
      </CardContent>
    </Card>
  );
}

export default function PhotographyGenresPage() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const [selectedLesson, setSelectedLesson] = useState<AcademyLesson | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const mainCategories = ['Teknik', 'Kompozisyon', 'Işık'];

  const lessonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'academyLessons'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: allLessons, isLoading } = useCollection<AcademyLesson>(lessonsQuery);
  
  const lessons = useMemo(() => {
    return allLessons?.filter(lesson => !mainCategories.includes(lesson.category)) ?? [];
  }, [allLessons]);


  const handleLearn = (lessonId: string, xpToAdd: number, auroToAdd: number) => {
    if (!userProfile || !userDocRef) return;
    if (userProfile.completed_modules?.includes(lessonId)) return;

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

  const groupedLessons = lessons?.reduce((acc, lesson) => {
    const category = lesson.category || 'Diğer';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(lesson);
    return acc;
  }, {} as Record<string, AcademyLesson[]>) ?? {};

  const orderedCategories = Object.keys(groupedLessons).sort();

  if (isLoading) {
     return (
      <div className="container mx-auto">
        <div className="text-center mb-12">
            <Skeleton className="h-10 w-3/4 mx-auto" />
            <Skeleton className="h-5 w-1/2 mx-auto mt-2" />
        </div>
        <div className="space-y-12">
            {Array.from({length: 3}).map((_, i) => (
                <section key={i}>
                    <Skeleton className="h-8 w-1/4 mb-6" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, j) => (
                        <Card key={j} className="overflow-hidden">
                            <CardHeader className="p-0 relative aspect-video">
                                <Skeleton className="w-full h-full"/>
                            </CardHeader>
                            <CardContent className="p-4">
                                <Skeleton className="h-5 w-3/4 mb-1"/>
                                <Skeleton className="h-5 w-5/6"/>
                            </CardContent>
                        </Card>
                    ))}
                    </div>
                </section>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
        <div className="text-center mb-12">
            <h1 className="font-sans text-3xl font-bold tracking-tight">Fotoğrafçılık Türleri</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Portre, manzara, sokak ve diğer türlerde ustalaşın.</p>
        </div>

      {(!lessons || lessons.length === 0) ? (
        <div className="text-center py-20 rounded-lg border border-dashed">
            <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Bu Bölümde Henüz Ders Yok</h3>
            <p className="text-muted-foreground mt-2">Profil sayfasından yönetici aracıyla çeşitli türlerde dersler oluşturun.</p>
        </div>
      ) : (
        <div className="space-y-12">
            {orderedCategories.map(category => (
                groupedLessons[category] && groupedLessons[category].length > 0 && (
                    <section key={category}>
                        <h2 className="text-2xl font-bold tracking-tight mb-6 border-b pb-2">{category}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {groupedLessons[category].map(lesson => (
                                <LessonCard 
                                    key={lesson.id} 
                                    lesson={lesson} 
                                    onSelect={() => setSelectedLesson(lesson)}
                                    isCompleted={userProfile?.completed_modules?.includes(lesson.id) || false}
                                />
                            ))}
                        </div>
                    </section>
                )
            ))}
        </div>
      )}

      <LessonDetailDialog
        lesson={selectedLesson}
        isOpen={!!selectedLesson}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedLesson(null); }}
        onLearn={handleLearn}
        isCompleted={!!selectedLesson && (userProfile?.completed_modules?.includes(selectedLesson.id) || false)}
      />
    </div>
  );
}
