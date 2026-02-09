'use client';

import { useState } from 'react';
import Image from 'next/image';
import { lessons } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function LessonCard({ lesson }: { lesson: (typeof lessons)[0] }) {
  const [isLearned, setIsLearned] = useState(false);

  const handleLearn = () => {
    setIsLearned(true);
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
          disabled={isLearned}
          className="w-full"
          variant={isLearned ? 'secondary' : 'default'}
        >
          {isLearned ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Öğrenildi!
            </>
          ) : (
             <>
              <BookOpen className="mr-2 h-4 w-4" />
              Öğrenildi Olarak İşaretle
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AcademyPage() {
  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}
