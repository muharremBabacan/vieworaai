
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, GraduationCap, CheckCircle2, Save, Image as ImageIcon, AlertCircle } from 'lucide-react';
import type { CurriculumTopic, Lesson } from '@/types';
import { generateAcademyLessons, generateLessonImage } from '@/ai/flows/generate-academy-lessons';
import type { GeneratedAcademyLesson } from '@/ai/flows/generate-academy-lessons';
import { Badge } from '@/components/ui/badge';

export default function AcademyAdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  
  const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri'>('Temel');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewLessons, setPreviewLessons] = useState<GeneratedAcademyLesson[]>([]);

  // academy_curriculum koleksiyonundan müfredat yapısını çek
  const curriculumQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'academy_curriculum'), where('level', '==', selectedLevel)) : null,
    [firestore, selectedLevel]
  );
  const { data: curriculum, isLoading: isCurriculumLoading } = useCollection<CurriculumTopic>(curriculumQuery);

  const handleGenerate = async () => {
    if (!selectedCategory || !curriculum) {
      toast({ variant: 'destructive', title: "Lütfen bir kategori seçin." });
      return;
    }

    const categoryData = curriculum.find(c => c.category === selectedCategory);
    if (!categoryData) return;

    setIsGenerating(true);
    setPreviewLessons([]);

    try {
      // Server Action üzerinden 10 adet ders taslağı üret
      const lessons = await generateAcademyLessons({
        level: selectedLevel,
        category: selectedCategory,
        topics: categoryData.topics,
        language: 'tr'
      });
      setPreviewLessons(lessons);
      toast({ title: "Taslaklar Hazır", description: "10 yeni ders önizleme için aşağıda listelendi." });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Ders üretimi sırasında bir hata oluştu." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (previewLessons.length === 0 || !firestore || !storage) return;
    setIsPublishing(true);

    try {
      const batch = writeBatch(firestore);
      const lessonCollection = collection(firestore, 'academyLessons');

      toast({ title: "Yayınlanıyor...", description: "Dersler ve görseller hazırlanıyor, lütfen bekleyin." });

      for (const lessonData of previewLessons) {
        const lessonRef = doc(lessonCollection);
        const lessonId = lessonRef.id;

        // Görsel üretimi (Server Side)
        let imageUrl = '';
        try {
          const base64Data = await generateLessonImage(lessonData.imageHint);
          const storageRef = ref(storage, `academy-lessons/${lessonId}/cover.jpg`);
          
          // Base64 verisini yükle
          await uploadString(storageRef, base64Data, 'base64');
          imageUrl = await getDownloadURL(storageRef);
        } catch (e) {
          console.warn("Görsel üretilemedi, fallback kullanılıyor:", e);
          imageUrl = `https://picsum.photos/seed/${lessonId}/800/600`;
        }

        // Final döküman yapısı
        const finalLesson: Lesson = {
          id: lessonId,
          ...lessonData,
          level: selectedLevel,
          category: selectedCategory,
          imageUrl,
          createdAt: new Date().toISOString(),
        };

        batch.set(lessonRef, finalLesson);
      }

      await batch.commit();
      toast({ title: "Başarıyla Yayınlandı!", description: "10 yeni ders veritabanına kaydedildi ve akademiye eklendi." });
      setPreviewLessons([]);
    } catch (error) {
      console.error("Yayınlama hatası:", error);
      toast({ variant: 'destructive', title: "Yayınlama Başarısız", description: "Veritabanına kayıt sırasında bir sorun oluştu." });
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
              <CardTitle className="text-2xl font-black tracking-tight uppercase">Akademi Müfredat Robotu</CardTitle>
              <CardDescription>Müfredat konularını kullanarak otomatik ders serileri oluşturun.</CardDescription>
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
            10 Ders Taslağı Üret
          </Button>
        </CardContent>
      </Card>

      {previewLessons.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-secondary/20 p-6 rounded-3xl border border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-widest">Taslaklar Hazır</h3>
                <p className="text-[10px] text-muted-foreground font-bold">Kayıt etmek için sağdaki butona basın.</p>
              </div>
            </div>
            <Button onClick={handlePublish} disabled={isPublishing} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold h-12 px-10 shadow-lg shadow-green-500/20">
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Hemen Yayınla (Firestore'a Kaydet)
            </Button>
          </div>

          <div className="grid gap-4">
            {previewLessons.map((lesson, i) => (
              <Card key={i} className="rounded-3xl border-border/40 bg-card/30 overflow-hidden hover:border-primary/30 transition-colors group">
                <div className="flex flex-col md:flex-row">
                  <div className="relative w-full md:w-48 aspect-video md:aspect-square bg-muted flex flex-col items-center justify-center border-r border-border/40">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Görsel Üretilecek</p>
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-black/60 backdrop-blur-md text-[8px] font-black border-none">{lesson.imageHint}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="text-lg font-black tracking-tight uppercase">{lesson.title}</h4>
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/30 text-primary">{selectedCategory}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic">"{lesson.learningObjective}"</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                      {lesson.analysisCriteria.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[9px] font-bold text-primary bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                          <CheckCircle2 size={10} className="shrink-0" /> {c}
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
