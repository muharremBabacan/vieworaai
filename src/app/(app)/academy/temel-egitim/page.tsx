'use client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Layers, Sun, BookOpen } from 'lucide-react';

const categories = [
  {
    title: 'Teknik',
    description: 'ISO, enstantane, diyafram gibi temel teknik ayarları öğrenin ve makinenize hakim olun.',
    href: '/academy/temel-egitim/teknik',
    icon: BookOpen,
  },
  {
    title: 'Kompozisyon',
    description: 'Üçler kuralı, altın oran, öncü çizgiler gibi konularla fotoğraflarınıza derinlik ve anlam katın.',
    href: '/academy/temel-egitim/kompozisyon',
    icon: Layers,
  },
  {
    title: 'Işık',
    description: 'Işığı okumayı, kullanmayı ve yönlendirmeyi öğrenerek fotoğraflarınızın atmosferini değiştirin.',
    href: '/academy/temel-egitim/isik',
    icon: Sun,
  },
];

export default function BasicTrainingHubPage() {
  return (
    <div className="container mx-auto">
      <div className="text-center mb-12">
        <h1 className="font-sans text-3xl font-bold tracking-tight">Temel Fotoğraf Eğitimi</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Fotoğrafçılığın yapı taşlarını oluşturan üç ana konuda uzmanlaşın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {categories.map((category) => (
          <Link href={category.href} key={category.title} className="group block">
            <Card className="h-full overflow-hidden transition-all duration-300 group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-1 flex flex-col">
              <CardHeader className="p-6">
                <div className="flex items-center gap-4 mb-2">
                    <category.icon className="h-8 w-8 text-primary"/>
                    <CardTitle className="font-sans text-xl">{category.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex-grow">
                <CardDescription>{category.description}</CardDescription>
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
