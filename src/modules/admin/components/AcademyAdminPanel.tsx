'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, GraduationCap, Save, Image as ImageIcon, Download, Check } from 'lucide-react';
import type { CurriculumTopic, Lesson } from '@/types';
import { generateAcademyLessons, generateLessonImage } from '@/ai/flows/generate-academy-lessons';
import type { GeneratedAcademyLesson } from '@/ai/flows/generate-academy-lessons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function AcademyAdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();

  // Lesson Generation States
  const [selectedLevel, setSelectedLevel] = useState<'Temel' | 'Orta' | 'İleri'>('Temel');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewLessons, setPreviewLessons] = useState<GeneratedAcademyLesson[]>([]);

  // Manual Image Generation States
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);

  const curriculumQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'academy_curriculum'), where('level', '==', selectedLevel)) : null,
    [firestore, selectedLevel]
  );

  const { data: curriculum, isLoading: isCurriculumLoading } = useCollection<CurriculumTopic>(curriculumQuery);

  const handleGenerateLessons = async () => {
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

  // Manual Image Logic
  const handleManualImageGenerate = async () => {
    if (!imagePrompt.trim()) {
      toast({ variant: 'destructive', title: "Lütfen bir prompt girin." });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedBase64(null);
    setSavedImageUrl(null);

    try {
      const base64 = await generateLessonImage(imagePrompt);
      setGeneratedBase64(base64);
      toast({ title: "Görsel Üretildi", description: "Beğendiyseniz Storage'a kaydedebilirsiniz." });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Görsel üretilemedi." });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveImageToStorage = async () => {
    if (!generatedBase64 || !storage) return;

    setIsSavingImage(true);
    try {
      const timestamp = Date.now();
      const fileName = `manual-gen-${timestamp}.jpg`;
      const storageRef = ref(storage, `academy-lessons/manual-uploads/${fileName}`);
      
      await uploadString(storageRef, generatedBase64, 'base64');
      const downloadUrl = await getDownloadURL(storageRef);
      
      setSavedImageUrl(downloadUrl);
      toast({ title: "Storage'a Kaydedildi", description: `Klasör: academy-lessons/manual-uploads/${fileName}` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Kayıt sırasında hata oluştu." });
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Lesson Generator Section */}
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
            onClick={handleGenerateLessons}
            disabled={!selectedCategory || isGenerating || isPublishing}
            className="w-full h-14 rounded-2xl font-black shadow-xl shadow-primary/10"
          >
            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            10 Ders Taslağı Üret
          </Button>
        </CardContent>
      </Card>

      {/* Manual Image Generator Section */}
      <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="bg-amber-500/5 border-b border-border/40 p-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <ImageIcon size={28}/>
            </div>
            <div>
              <CardTitle className="text-2xl font-black uppercase">Görsel Üretim Laboratuvarı</CardTitle>
              <CardDescription>Akademi için özel sahneler ve kapaklar tasarlayın</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase ml-1">Görsel İstem (Prompt)</label>
              <Textarea 
                placeholder="Örn: moody portrait during golden hour, sharp focus, cinematic lighting..." 
                className="rounded-2xl min-h-[100px] bg-muted/30 resize-none border-border/60"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground italic">* İngilizce promptlar daha iyi sonuç verir.</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <Button
                onClick={handleManualImageGenerate}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="flex-1 h-12 rounded-xl font-bold bg-amber-500 text-black hover:bg-amber-600 transition-all"
              >
                {isGeneratingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Görseli Üret
              </Button>
              
              {generatedBase64 && (
                <Button
                  onClick={handleSaveImageToStorage}
                  disabled={isSavingImage || !!savedImageUrl}
                  variant="outline"
                  className={cn(
                    "flex-1 h-12 rounded-xl font-bold border-amber-500/30 text-amber-500 hover:bg-amber-500/10",
                    savedImageUrl && "border-green-500/30 text-green-500 hover:bg-green-500/10"
                  )}
                >
                  {isSavingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : savedImageUrl ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  {savedImageUrl ? "Kaydedildi" : "Storage'a Kaydet"}
                </Button>
              )}
            </div>
          </div>

          {generatedBase64 && (
            <div className="space-y-4 pt-4 border-t border-border/20 animate-in zoom-in-95 duration-500">
              <label className="text-[10px] font-black uppercase text-center block text-muted-foreground">Sonuç Önizleme</label>
              <div className="relative aspect-video max-w-2xl mx-auto rounded-[24px] overflow-hidden border-4 border-background shadow-2xl">
                <img src={`data:image/jpeg;base64,${generatedBase64}`} alt="Generated" className="w-full h-full object-cover" />
                {savedImageUrl && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                      <Check size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-white uppercase text-xs tracking-widest mb-1">Başarıyla Kaydedildi</p>
                      <p className="text-[10px] text-white/70 break-all select-all font-mono">{savedImageUrl}</p>
                    </div>
                    <Button variant="secondary" size="sm" className="rounded-lg text-[10px] font-black" onClick={() => window.open(savedImageUrl, '_blank')}>
                      <Download className="mr-1 h-3 w-3" /> Görseli Aç
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lesson Preview Section */}
      {previewLessons.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <Check size={18} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Taslak Önizleme ({previewLessons.length} Ders)</h3>
            </div>
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-green-600/20"
            >
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Hemen Yayınla
            </Button>
          </div>
          <div className="grid gap-4">
            {previewLessons.map((lesson, idx) => (
              <Card key={idx} className="p-6 rounded-2xl border-border/40 bg-card/30 hover:border-primary/20 transition-colors">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary border border-primary/20">{idx + 1}</div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{lesson.title}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.learningObjective}</p>
                    <div className="pt-2">
                      <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest">{lesson.imageHint}</Badge>
                    </div>
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
