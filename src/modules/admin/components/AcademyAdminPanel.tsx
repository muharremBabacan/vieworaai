'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, doc, setDoc, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, GraduationCap, Image as ImageIcon, Save, CheckCircle2, FileText, Check, ArrowLeftRight } from 'lucide-react';
import { generateAcademyLessons, generateLessonImage, type GeneratedAcademyLesson } from '@/ai/flows/lesson/generate-academy-lessons';
import type { CurriculumTopic } from '@/types';
import { cn } from '@/lib/utils';

export default function AcademyAdminPanel() {
  const t = useTranslations('AdminPanel');
  const tCur = useTranslations('Curriculum');
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = getStorage();

  const [selectedLevel, setSelectedLevel] = useState<string>('Temel');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
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

  const handleGenerateLessons = async (count: number) => {
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
        language: "tr",
        count: count
      });
      
      setPreviewLessons(lessons);
      
      // Eğer tek bir ders üretilmişse, promptu otomatik olarak laboratuvar alanına aktar
      if (count === 1 && lessons.length > 0) {
        setManualPrompt(lessons[0].imageHint);
        toast({ title: "Ders İçeriği Hazır!", description: "Görsel ipucu laboratuvara aktarıldı. Lütfen aşağıdan onaylayıp görseli üretin." });
        
        // Laboratuvar alanına odaklanması için sayfayı kaydır
        setTimeout(() => {
          document.getElementById('image-lab')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      } else {
        toast({ title: `${lessons.length} Taslak Hazır`, description: "Dersleri inceleyip toplu yayınlayabilirsiniz." });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Hata", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAll = async () => {
    if (previewLessons.length === 0 || !firestore) return;
    
    const selectedCurriculum = availableCategories.find(c => c.id === selectedCategoryId);
    if (!selectedCurriculum) return;

    setIsPublishing(true);

    try {
      for (let i = 0; i < previewLessons.length; i++) {
        const lesson = previewLessons[i];
        const lessonId = crypto.randomUUID();
        
        // Generate Image for each lesson using its prompt
        const base64 = await generateLessonImage(lesson.imageHint);
        const storageRef = ref(storage, `academy-lessons/${lessonId}.jpg`);
        await uploadString(storageRef, base64, 'base64');
        const imageUrl = await getDownloadURL(storageRef);

        const lessonData = {
          ...lesson,
          id: lessonId,
          level: selectedLevel,
          category: selectedCurriculum.category,
          imageUrl,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(firestore, 'academy_lessons', lessonId), lessonData);
      }

      toast({ title: "Başarılı!", description: `${previewLessons.length} ders yayınlandı.` });
      setPreviewLessons([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Yayınlama Hatası", description: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishSingleWithManualImage = async (lessonIndex: number) => {
    if (!manualPreview || !firestore) {
      toast({ variant: 'destructive', title: "Görsel Eksik", description: "Lütfen önce görseli üretin." });
      return;
    }

    const lesson = previewLessons[lessonIndex];
    const selectedCurriculum = availableCategories.find(c => c.id === selectedCategoryId);
    if (!selectedCurriculum) return;

    setIsPublishing(true);
    try {
      const lessonId = crypto.randomUUID();
      const storageRef = ref(storage, `academy-lessons/${lessonId}.jpg`);
      
      const base64Data = manualPreview.includes('base64,') ? manualPreview.split('base64,')[1] : manualPreview;
      await uploadString(storageRef, base64Data, 'base64');
      const imageUrl = await getDownloadURL(storageRef);

      const lessonData = {
        ...lesson,
        id: lessonId,
        level: selectedLevel as any,
        category: selectedCurriculum.category,
        imageUrl,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(firestore, 'academy_lessons', lessonId), lessonData);
      
      toast({ title: "Ders Yayınlandı!", description: "Seçili görsel ile ders akademiye eklendi." });
      
      setPreviewLessons(prev => prev.filter((_, i) => i !== lessonIndex));
      setManualPreview(null);
      setManualPrompt('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Hata", description: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGenerateManualImage = async () => {
    if (!manualPrompt) return;
    setIsGeneratingManual(true);
    setManualPreview(null);
    setSavedImageUrl(null);
    
    try {
      const base64 = await generateLessonImage(manualPrompt);
      if (base64) {
        setManualPreview(`data:image/jpeg;base64,${base64}`);
        toast({ title: "Görsel Üretildi" });
      }
    } catch (e: any) {
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
      toast({ title: "Görsel Kaydedildi" });
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
                <CardTitle className="text-2xl font-black tracking-tight">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase tracking-widest text-[10px] px-3 h-6">{t('badge_active')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('label_level')}</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Temel">{tCur('Temel')}</SelectItem>
                  <SelectItem value="Orta">{tCur('Orta')}</SelectItem>
                  <SelectItem value="İleri">{tCur('İleri')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('label_category')}</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                  <SelectValue placeholder={t('placeholder_category')} />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={() => handleGenerateLessons(1)} 
              disabled={isGenerating || !selectedCategoryId} 
              variant="outline"
              className="h-14 rounded-2xl font-black uppercase tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <><FileText className="mr-2 h-5 w-5" /> {t('btn_generate_single')}</>}
            </Button>
            <Button 
              onClick={() => handleGenerateLessons(10)} 
              disabled={isGenerating || !selectedCategoryId} 
              className="h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <><Sparkles className="mr-2 h-5 w-5 text-yellow-400" /> {t('btn_generate_ten')}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewLessons.length > 0 && (
        <Card className="rounded-[32px] border-primary/30 bg-primary/5 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
          <CardHeader className="p-8 border-b border-primary/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-widest">{t('preview_title')} ({previewLessons.length} {tCur('cat_other')})</CardTitle>
              <p className="text-xs font-bold text-primary mt-1">{t('preview_subtitle')}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setPreviewLessons([])} className="rounded-xl font-black text-[10px] uppercase">{t('preview_clear')}</Button>
              {previewLessons.length > 1 && (
                <Button 
                  onClick={handlePublishAll} 
                  disabled={isPublishing} 
                  className="h-11 px-8 rounded-xl font-black uppercase text-xs tracking-widest bg-green-600 hover:bg-green-700 shadow-lg"
                >
                  {isPublishing ? <Loader2 className="animate-spin" /> : t('preview_publish_all')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/40">
                {previewLessons.map((lesson, idx) => (
                  <div key={idx} className="p-8 flex gap-6 hover:bg-primary/5 transition-colors group">
                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 font-black text-xl border border-border/40">{idx + 1}</div>
                    <div className="space-y-3 flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-lg font-black tracking-tight">{lesson.title}</h4>
                        {previewLessons.length === 1 && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase bg-amber-500/10 px-3 py-1 rounded-full">
                            <ArrowLeftRight size={12} className="rotate-90" /> {t('lab_hint_waiting')}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed italic">"{lesson.learningObjective}"</p>
                        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-2">
                           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('lab_prompt_label')}:</p>
                           <p className="text-xs font-mono text-primary bg-primary/5 p-2 rounded-lg">{lesson.imageHint}</p>
                        </div>
                      </div>
                      
                      {previewLessons.length === 1 && (
                        <div className="pt-4">
                           <Button 
                            onClick={() => handlePublishSingleWithManualImage(idx)} 
                            disabled={!manualPreview || isPublishing}
                            className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
                           >
                             {isPublishing ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2 h-4 w-4" />}
                             {t('btn_publish_with_image')}
                           </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Manual Image Lab */}
      <Card id="image-lab" className="rounded-[32px] border-border/40 bg-card/50 overflow-hidden shadow-lg border-dashed">
        <CardHeader className="p-8 border-b border-border/40">
          <CardTitle className="text-xl font-black flex items-center gap-3"><ImageIcon className="text-primary" /> {t('image_lab_title')}</CardTitle>
          <CardDescription>{t('image_lab_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('lab_prompt_label')}</Label>
              <Input 
                placeholder={t('lab_prompt_placeholder')} 
                value={manualPrompt}
                onChange={e => setManualPrompt(e.target.value)}
                className="h-12 rounded-xl bg-muted/30 border-border/60 font-medium"
              />
            </div>
            <Button 
              onClick={handleGenerateManualImage} 
              disabled={isGeneratingManual || !manualPrompt}
              className="sm:mt-6 h-12 rounded-xl px-10 font-black uppercase tracking-widest shadow-lg shadow-primary/10"
            >
              {isGeneratingManual ? <Loader2 className="animate-spin" /> : t('btn_generate_image')}
            </Button>
          </div>

          {manualPreview && (
            <div className="space-y-6 animate-in zoom-in duration-500">
              <div className="relative aspect-video max-w-2xl mx-auto rounded-[32px] overflow-hidden border-8 border-background shadow-2xl">
                <img src={manualPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-3">
                  <Button 
                    onClick={handleSaveManualImage} 
                    disabled={isSavingManual}
                    variant="secondary"
                    className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest border border-border/60"
                  >
                    {isSavingManual ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                    {t("btn_save_folder")}
                  </Button>
                </div>
                {savedImageUrl && (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-[10px] font-black text-green-500 uppercase">
                    <CheckCircle2 size={16} /> {t('toast_image_saved')}
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
