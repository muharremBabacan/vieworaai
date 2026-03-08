'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, Send, GraduationCap, Image as ImageIcon, Save, CheckCircle2, Trash2 } from 'lucide-react';
import { generateAcademyLessons, generateLessonImage, type GeneratedAcademyLesson } from '@/ai/flows/lesson/generate-academy-lessons';
import type { CurriculumTopic } from '@/types';
import { cn } from '@/lib/utils';

export default function AcademyAdminPanel() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = getStorage();

  const [selectedLevel, setSelectedLevel] = useState<string>('Temel');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  
  const [previewLessons, setPreviewLessons] = useState<GeneratedAcademyLesson[]>([]);

  // Manual Image Lab States
  const [manualPrompt, setManualPrompt] = useState('');
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);

  // Fetch Curriculum
  const curriculumQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'academy_curriculum') : null), [firestore]);
  const { data: curriculumData } = useCollection<CurriculumTopic>(curriculumQuery);

  const availableCategories = useMemo(() => {
    return curriculumData?.filter(c => c.level === selectedLevel) || [];
  }, [curriculumData, selectedLevel]);

  const handleGenerateLessons = async () => {
    const selectedCurriculum = availableCategories.find(c => c.id === selectedCategoryId);
    if (!selectedCurriculum) {
      toast({ variant: 'destructive', title: "Kategori Seçin", description: "Lütfen önce bir kategori seçin." });
      return;
    }

    setIsGenerating(true);
    setPreviewLessons([]);
    
    try {
      const lessons = await generateAcademyLessons({
        level: selectedLevel,
        category: selectedCurriculum.category,
        topics: selectedCurriculum.topics,
        language: "tr"
      });
      setPreviewLessons(lessons);
      toast({ title: "10 Taslak Hazır", description: "Dersleri inceleyip yayınlayabilirsiniz." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Hata", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (previewLessons.length === 0 || !firestore) return;
    
    const selectedCurriculum = availableCategories.find(c => c.id === selectedCategoryId);
    if (!selectedCurriculum) return;

    setIsPublishing(true);
    setPublishProgress(0);

    try {
      for (let i = 0; i < previewLessons.length; i++) {
        const lesson = previewLessons[i];
        const lessonId = crypto.randomUUID();
        
        // 1. Generate Image for each lesson
        const base64 = await generateLessonImage(lesson.imageHint);
        
        // 2. Upload to Storage
        const storageRef = ref(storage, `academy-lessons/${lessonId}.jpg`);
        await uploadString(storageRef, base64, 'base64');
        const imageUrl = await getDownloadURL(storageRef);

        // 3. Save to Firestore
        const lessonData = {
          ...lesson,
          id: lessonId,
          level: selectedLevel,
          category: selectedCurriculum.category,
          imageUrl,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(firestore, 'academy_lessons', lessonId), lessonData);
        setPublishProgress(i + 1);
      }

      toast({ title: "Başarılı!", description: "10 ders görselleriyle birlikte akademiye eklendi." });
      setPreviewLessons([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Yayınlama Hatası", description: e.message });
    } finally {
      setIsPublishing(false);
      setPublishProgress(0);
    }
  };

  const handleGenerateManualImage = async () => {
    if (!manualPrompt) return;
    setIsGeneratingManual(true);
    setManualPreview(null);
    setSavedImageUrl(null);
    
    console.log("[CLIENT] Görsel üretimi başlatılıyor...");
    
    try {
      const base64 = await generateLessonImage(manualPrompt);
      
      if (base64) {
        console.log(`[CLIENT] Görsel verisi alındı. Uzunluk: ${base64.length} karakter.`);
        setManualPreview(`data:image/jpeg;base64,${base64}`);
        toast({ 
          title: "Görsel Üretildi", 
          description: "Yapay zeka veriyi başarıyla oluşturdu ve gönderdi." 
        });
      }
    } catch (e: any) {
      console.error("[CLIENT] Üretim hatası:", e.message);
      toast({ variant: 'destructive', title: "Görsel Üretilemedi", description: e.message });
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const handleSaveManualImage = async () => {
    if (!manualPreview) return;
    setIsSavingManual(true);
    try {
      const fileName = `manual-${Date.now()}.jpg`;
      const storageRef = ref(storage, `academy-lessons/manual-uploads/${fileName}`);
      const base64Data = manualPreview.split(',')[1];
      await uploadString(storageRef, base64Data, 'base64');
      const url = await getDownloadURL(storageRef);
      setSavedImageUrl(url);
      toast({ title: "Görsel Kaydedildi", description: "academy-lessons klasörüne eklendi." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Kayıt Hatası" });
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <Card className="rounded-[32px] border-border/40 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-border/40 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <GraduationCap size={24} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black tracking-tight">Akademi İçerik Robotu</CardTitle>
                <CardDescription>Müfredata dayalı 10 dersi AI ile tek tıkla üretin.</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase tracking-widest text-[10px] px-3 h-6">IMAGEN 3.0 AKTİF</Badge>
              <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-50">Vertex AI Engine</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Eğitim Seviyesi</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Kategori (Müfredat)</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                  <SelectValue placeholder="Kategori seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerateLessons} 
            disabled={isGenerating || !selectedCategoryId} 
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 10 Ders Hazırlanıyor...</>
            ) : (
              <><Sparkles className="mr-2 h-5 w-5 text-yellow-400" /> 10 Ders Üret (Taslak)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewLessons.length > 0 && (
        <Card className="rounded-[32px] border-primary/30 bg-primary/5 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
          <CardHeader className="p-8 border-b border-primary/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-widest">Taslak Önizleme (10 Ders)</CardTitle>
              <p className="text-xs font-bold text-primary mt-1">Yayınlandığında görseller Imagen 3 ile üretilecektir.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setPreviewLessons([])} className="rounded-xl font-black text-[10px] uppercase"><Trash2 className="mr-2 h-4 w-4" /> İptal</Button>
              <Button 
                onClick={handlePublish} 
                disabled={isPublishing} 
                className="h-11 px-8 rounded-xl font-black uppercase text-xs tracking-widest bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
              >
                {isPublishing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {publishProgress}/10 Yayınlanıyor...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Hemen Yayınla</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-border/40">
                {previewLessons.map((lesson, idx) => (
                  <div key={idx} className="p-8 flex gap-6 hover:bg-primary/5 transition-colors group">
                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 font-black text-xl border border-border/40 group-hover:border-primary/30 group-hover:text-primary transition-all">{idx + 1}</div>
                    <div className="space-y-3 flex-1">
                      <h4 className="text-lg font-black tracking-tight">{lesson.title}</h4>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed italic">"{lesson.learningObjective}"</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 rounded-xl bg-background/50 border border-border/40 text-[10px] font-bold">
                          <p className="uppercase text-primary mb-2 tracking-widest">Görsel İpucu</p>
                          {lesson.imageHint}
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border/40 text-[10px] font-bold">
                          <p className="uppercase text-amber-500 mb-2 tracking-widest">Pratik Görev</p>
                          {lesson.practiceTask}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Manual Image Lab */}
      <Card className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-lg border-dashed">
        <CardHeader className="p-8 border-b border-border/40">
          <CardTitle className="text-xl font-black flex items-center gap-3"><ImageIcon className="text-primary" /> Görsel Üretim Laboratuvarı</CardTitle>
          <CardDescription>Imagen 3 motoruyla bağımsız görsel üretin ve klasöre kaydedin.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">İstem (Prompt)</Label>
              <Input 
                placeholder="Örn: Cinematic portrait, golden hour lighting..." 
                value={manualPrompt}
                onChange={e => setManualPrompt(e.target.value)}
                className="h-12 rounded-xl bg-muted/30 border-border/60"
              />
            </div>
            <Button 
              onClick={handleGenerateManualImage} 
              disabled={isGeneratingManual || !manualPrompt}
              className="mt-6 h-12 rounded-xl px-8 font-black uppercase tracking-widest"
            >
              {isGeneratingManual ? <Loader2 className="animate-spin" /> : "Üret"}
            </Button>
          </div>

          {manualPreview && (
            <div className="space-y-6 animate-in zoom-in duration-500">
              <div className="relative aspect-video max-w-2xl mx-auto rounded-[32px] overflow-hidden border-8 border-background shadow-2xl">
                <img src={manualPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-center gap-4">
                <Button 
                  onClick={handleSaveManualImage} 
                  disabled={isSavingManual}
                  variant="secondary"
                  className="rounded-2xl h-14 px-12 font-black uppercase tracking-widest border border-border/60"
                >
                  {isSavingManual ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                  Beğendim, Klasöre Kaydet
                </Button>
                {savedImageUrl && (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-[10px] font-black text-green-500 uppercase">
                    <CheckCircle2 size={16} /> Görsel Kaydedildi: <a href={savedImageUrl} target="_blank" className="underline">{savedImageUrl.substring(0, 40)}...</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
