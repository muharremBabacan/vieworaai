'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, addDoc, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, GraduationCap, CheckCircle2, Save, Image as ImageIcon } from 'lucide-react';
import type { CurriculumTopic, Lesson } from '@/types';
import { generateAcademyLessons, type GeneratedAcademyLesson } from '@/ai/flows/generate-academy-lessons';
import { ai } from '@/ai/genkit';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AcademyAdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
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
      toast({ variant: 'destructive', title: "Kategori Seçin" });
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
      toast({ title: "Dersler Hazır", description: "10 yeni ders taslağı oluşturuldu. Aşağıdan inceleyebilirsiniz." });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Üretim Başarısız" });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAndUploadImage = async (hint: string, lessonId: string): Promise<string> => {
    // Note: This logic uses Genkit Imagen model.
    const result = await ai.generate({
      model: 'vertexai/imagen-3.0-generate-001',
      prompt: `Professional photography of: ${hint}. Realistic, high resolution, stunning composition.`,
    });

    const base64 = result.media?.data;
    if (!base64) throw new Error("Görsel üretilemedi");

    const storage = getStorage();
    const storageRef = ref(storage, `academy-lessons/${lessonId}/cover.jpg`);
    await uploadString(storageRef, base64, 'base64');
    return await getDownloadURL(storageRef);
  };

  const handlePublish = async () => {
    if (previewLessons.length === 0 || !firestore) return;
    setIsPublishing(true);

    try {
      const batch = writeBatch(firestore);
      const lessonCollection = collection(firestore, 'academyLessons');

      for (const lessonData of previewLessons) {
        const lessonRef = doc(lessonCollection);
        const lessonId = lessonRef.id;

        // Visual production happens sequentially to avoid heavy load
        let imageUrl = '';
        try {
          imageUrl = await generateAndUploadImage(lessonData.imageHint, lessonId);
        } catch (e) {
          console.warn("Image generation failed for lesson, using fallback", e);
          imageUrl = `https://picsum.photos/seed/${lessonId}/800/600`;
        }

        const finalLesson: Omit<Lesson, 'id'> = {
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
      toast({ title: "Yayınlandı!", description: "10 yeni ders akademiye başarıyla eklendi." });
      setPreviewLessons([]);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Yayınlama Hatası" });
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
              <GraduationCap size={28} />
            </div>
            <div>
              <CardTitle className="text-2xl font-black tracking-tight">Akademi Müfredat Robotu</CardTitle>
              <CardDescription>Yapay zeka ile müfredata dayalı profesyonel dersler üretin.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Eğitim Seviyesi</label>
              <Select value={selectedLevel} onValueChange={(v: any) => { setSelectedLevel(v); setSelectedCategory(''); }}>
                <SelectTrigger className="rounded-2xl h-12 bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Temel">Temel Seviye</SelectItem>
                  <SelectItem value="Orta">Orta Seviye</SelectItem>
                  <SelectItem value="İleri">İleri Seviye</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Müfredat Kategorisi</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isCurriculumLoading || !curriculum?.length}>
                <SelectTrigger className="rounded-2xl h-12 bg-muted/30">
                  <SelectValue placeholder={isCurriculumLoading ? "Yükleniyor..." : "Kategori seç..."} />
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
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
          >
            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            10 Ders Üret
          </Button>
        </CardContent>
      </Card>

      {previewLessons.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black uppercase tracking-tighter">Taslak Önizleme (10 Ders)</h3>
            <Button onClick={handlePublish} disabled={isPublishing} className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold h-10 px-6">
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Hemen Yayınla
            </Button>
          </div>

          <div className="grid gap-4">
            {previewLessons.map((lesson, i) => (
              <Card key={i} className="rounded-3xl border-border/40 bg-card/30 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="flex flex-col md:flex-row">
                  <div className="relative w-full md:w-48 aspect-video md:aspect-square bg-muted flex items-center justify-center border-r border-border/40">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    <div className="absolute inset-0 bg-black/5 flex items-end p-2">
                      <Badge className="bg-black/60 backdrop-blur-md text-[8px] font-black">{lesson.imageHint}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="text-lg font-black tracking-tight">{lesson.title}</h4>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">{selectedCategory}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic">"{lesson.learningObjective}"</p>
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {lesson.analysisCriteria.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[9px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">
                          <CheckCircle2 size={10} /> {c}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
