'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, BookOpen, Camera } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const courses = [
  {
    title: 'Temel Fotoğraf Eğitimi',
    description: 'Fotoğrafçılığın temel taşları olan teknik, kompozisyon ve ışık konularında uzmanlaşın.',
    href: '/academy/temel-egitim',
    icon: BookOpen,
    image: PlaceHolderImages.find(p => p.id === 'academy-composition'),
  },
  {
    title: 'Fotoğrafçılık Türleri',
    description: 'Portre, manzara, sokak fotoğrafçılığı ve daha birçok türde kendinizi geliştirin.',
    href: '/academy/fotografcilik-turleri',
    icon: Camera,
    image: PlaceHolderImages.find(p => p.id === 'academy-street'),
  },
];

export default function AcademyHubPage() {
  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {courses.map((course) => (
          <Link href={course.href} key={course.title} className="group block">
            <Card className="h-full overflow-hidden transition-all duration-300 group-hover:border-primary group-hover:shadow-2xl group-hover:-translate-y-1">
              <CardHeader className="p-0 relative aspect-video">
                {course.image && (
                  <Image
                    src={course.image.imageUrl}
                    alt={course.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    data-ai-hint={course.image.imageHint}
                  />
                )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                    <course.icon className="h-6 w-6 text-primary"/>
                    <CardTitle className="font-sans text-xl">{course.title}</CardTitle>
                </div>
                <CardDescription className="mb-4">{course.description}</CardDescription>
                <div className="flex items-center font-semibold text-primary">
                  Eğitime Başla
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
