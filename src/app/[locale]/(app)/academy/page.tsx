'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, BookOpen, Layers, Trophy } from 'lucide-react';
import { Link } from '@/navigation';

const levels = [
  {
    title: 'Temel Seviye',
    slug: 'temel',
    description: 'Kamera kontrolü, ışık ve temel kompozisyon konularında sağlam bir temel oluşturun.',
    icon: BookOpen,
  },
  {
    title: 'Orta Seviye',
    slug: 'orta',
    description: 'Farklı fotoğrafçılık türlerinde teknik kontrol kazanın ve bilinçli estetik kararlar verin.',
    icon: Layers,
  },
  {
    title: 'İleri Seviye',
    slug: 'ileri',
    description: 'Bir alanda uzmanlaşın, sanatsal kimliğinizi oluşturun ve profesyonel adımlar atın.',
    icon: Trophy,
  },
];

export default function AcademyHubPage() {
  return (
    <div className="container mx-auto">
       <div className="text-center mb-12">
        <h1 className="font-sans text-3xl font-bold tracking-tight">Viewora Akademi</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Fotoğrafçılık bilginizi temelden ustalığa taşıyın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {levels.map((level) => (
          <Link href={`/academy/${level.slug}`} key={level.title} className="group block">
            <Card className="h-full overflow-hidden transition-all duration-300 group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-1 flex flex-col">
              <CardHeader className="p-6">
                <div className="flex items-center gap-4 mb-2">
                    <level.icon className="h-8 w-8 text-primary"/>
                    <CardTitle className="font-sans text-xl">{level.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex-grow">
                <CardDescription>{level.description}</CardDescription>
              </CardContent>
              <div className="p-6 pt-0 flex items-center font-semibold text-primary text-sm">
                  Dersleri Gör
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
