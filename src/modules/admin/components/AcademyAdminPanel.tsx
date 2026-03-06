'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, GraduationCap, Save, Image as ImageIcon } from 'lucide-react';
import type { CurriculumTopic, Lesson } from '@/types';
import { generateAcademyLessons, generateLessonImage } from '@/ai/flows/generate-academy-lessons';
import type { GeneratedAcademyLesson } from '@/ai/flows/generate-academy-lessons';
import { Badge } from '@/components/ui/badge';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function AcademyAdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();

  const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri'>('Temel');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewLessons, setPreviewLessons] = useState<GeneratedAcademyLesson[]>([]);

  const curriculumQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'academy_curriculum'), where('level', '==', selectedLevel)) : null,
    [firestore, selectedLevel]
  );

  const { data: curriculum, isLoading: isCurriculumLoading } = useCollection<CurriculumTopic>(curriculumQuery);

  const handleGenerate = async () => {
    if (!selectedCategory || !curriculum) {
      toast({ variant: 'destructive', title: "Lütfen kategori seçin." });
      return;
    }

    const categoryData = curriculum.find(c => c.category === selectedCategory);
    if (!categoryData) return;

    setIsGenerating(true);
    setPreviewLessons([]);

    try {
      const lessons = await generateAcademyLessons({
        level: selectedLevel,
        category: selectedCategory,
        topics: categoryData.topics,
        language: 'tr'
      });

      setPreviewLessons(lessons);
      toast({
        title: "Taslaklar hazır",
        description: "10 yeni ders önizleme için hazırlandı."
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: "Ders üretimi sırasında hata oluştu"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!previewLessons.length || !firestore || !storage) return;

    setIsPublishing(true);
    try {
      const batch = writeBatch(firestore);
      const lessonCollection = collection(firestore, 'academy_lessons');

      toast({
        title: "Yayınlanıyor...",
        description: "Dersler ve görseller hazırlanıyor (Bu işlem zaman alabilir)."
      });

      for (const lessonData of previewLessons) {
        const lessonRef = doc(lessonCollection);
        const lessonId = lessonRef.id;

        let imageUrl = '';
        try {
          const base64Data = await generateLessonImage(lessonData.imageHint);
          const storageRef = ref(storage, `academy-lessons/${lessonId}/cover.jpg`);
          await uploadString(storageRef, base64Data, 'base64');
          imageUrl = await getDownloadURL(storageRef);
          // Rate limit koruması için her görselden sonra bekleme
          await sleep(2000);
        } catch (error) {
          console.warn("Görsel üretilemedi, fallback kullanılıyor:", error);
          imageUrl = `https://picsum.photos/seed/viewora-${lessonId}/800/600`;
        }

        const finalLesson: Lesson = {
          ...lessonData,
          id: lessonId,
          level: selectedLevel,
          category: selectedCategory,
          imageUrl,
          createdAt: new Date().toISOString(),
        };

        batch.set(lessonRef, finalLesson);
      }

      await batch.commit();
      toast({
        title: "Başarıyla yayınlandı",
        description: `${previewLessons.length} ders akademiye eklendi.`
      });
      setPreviewLessons([]);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: "Firestore kayıt hatası"
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-border/40 p-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <GraduationCap size={28}/>
            </div>
            <div>
              <CardTitle className="text-2xl font-black uppercase">Akademi Müfredat Robotu</CardTitle>
              <CardDescription>Müfredat konularını kullanarak otomatik ders üretir</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase ml-1">Eğitim Seviyesi</label>
              <Select value={selectedLevel} onValueChange={(v: any) => {
                setSelectedLevel(v);
                setSelectedCategory('');
              }}>
                <SelectTrigger className="rounded-2xl h-12 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Temel">Temel</SelectItem>
                  <SelectItem value="Orta">Orta</SelectItem>
                  <SelectItem value="İleri">İleri</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase ml-1">Müfredat Kategorisi</label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                disabled={isCurriculumLoading || !curriculum?.length}
              >
                <SelectTrigger className="rounded-2xl h-12 bg-muted/30">
                  <SelectValue placeholder={isCurriculumLoading ? "Yükleniyor..." : "Kategori seç"} />
                </SelectTrigger>
                <SelectContent>
                  {curriculum?.map(c => (
                    <SelectItem key={c.id} value={c.category}>{c.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedCategory || isGenerating || isPublishing}
            className="w-full h-14 rounded-2xl font-black shadow-xl shadow-primary/10"
          >
            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            10 Ders Taslağı Üret
          </Button>
        </CardContent>
      </Card>

      {previewLessons.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase tracking-tight">Taslak Önizleme ({previewLessons.length} Ders)</h3>
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold h-11 px-8"
            >
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Hemen Yayınla
            </Button>
          </div>
          <div className="grid gap-4">
            {previewLessons.map((lesson, idx) => (
              <Card key={idx} className="p-6 rounded-2xl border-border/40 bg-card/30">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary">{idx + 1}</div>
                  <div className="space-y-1">
                    <h4 className="font-bold">{lesson.title}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.learningObjective}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}