'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useFirestore, useCollection, useMemoFirebase } from '@/lib/firebase';
import { collection, doc, setDoc, query, where, orderBy } from 'firebase/firestore';
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
import { NotificationAPI } from '@/lib/api/notification-api';

export default function AcademyAdminPanel() {
  const t = useTranslations('AdminPanel');
  const tCur = useTranslations('Curriculum');
  const locale = useLocale();
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = getStorage();

  const [selectedLevel, setSelectedLevel] = useState<string>('Temel');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [previewLessons, setPreviewLessons] = useState<GeneratedAcademyLesson[]>([]);

  // 1. Fetch Modules for Selected Level
  const modulesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'academy', selectedLevel, 'modules'), orderBy('moduleIndex')) : null, 
    [firestore, selectedLevel]
  );
  const { data: modulesData, isLoading: modulesLoading } = useCollection<{ title: string; moduleIndex: number }>(modulesQuery);

  // 2. Fetch Lessons for Selected Module
  const lessonsQuery = useMemoFirebase(() => 
    (firestore && selectedModuleId) ? query(collection(firestore, 'academy', selectedLevel, 'modules', selectedModuleId, 'lessons'), orderBy('lessonIndex')) : null, 
    [firestore, selectedLevel, selectedModuleId]
  );
  const { data: curriculumLessons, isLoading: lessonsLoading } = useCollection<{ title: string; type: string; lessonIndex: number; requiresSettings: boolean; description?: string; skills?: string[] }>(lessonsQuery);

  // Manual Image Lab States
  const [manualPrompt, setManualPrompt] = useState('');
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);

  const handleGenerateLessons = async (count: number) => {
    const selectedCurriculumLesson = curriculumLessons?.find(l => l.id === selectedLessonId);
    if (!selectedCurriculumLesson) {
      toast({ variant: 'destructive', title: "Eksik Seçim", description: "Lütfen önce bir ders konusu seçin." });
      return;
    }

    setIsGenerating(true);
    setPreviewLessons([]);
    
    try {
      const lessons = await generateAcademyLessons({
        level: selectedLevel,
        category: selectedModuleId, // Module ID used as category for context
        topics: [selectedCurriculumLesson.title],
        language: locale,
        count: count,
        seedLesson: {
          title: selectedCurriculumLesson.title,
          type: selectedCurriculumLesson.type,
          description: (selectedCurriculumLesson as any).description,
          skills: selectedCurriculumLesson.skills
        }
      } as any);
      
      setPreviewLessons(lessons);
      
      // Eğer tek bir ders üretilmişse, promptu otomatik olarak laboratuvar alanına aktar
      if (count === 1 && lessons.length > 0) {
        setManualPrompt(lessons[0].imageHint);
        toast({ title: t('toast_lesson_ready_title'), description: t('toast_lesson_ready_desc') });
        
        // Laboratuvar alanına odaklanması için sayfayı kaydır
        setTimeout(() => {
          document.getElementById('image-lab')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      } else {
        toast({ title: t('toast_drafts_ready', { count: lessons.length }), description: t('toast_drafts_ready_desc') });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Hata", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAll = async () => {
    if (previewLessons.length === 0 || !firestore) return;
    
    if (!selectedModuleId || !selectedLessonId) return;

    setIsPublishing(true);

    try {
      for (let i = 0; i < previewLessons.length; i++) {
        const lesson = previewLessons[i];
        // Browser compatible UUID fallback
        const lessonId = typeof crypto.randomUUID === 'function' 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        
        // Generate Image for each lesson using its prompt
        let imageResult;
        try {
          imageResult = await generateLessonImage(lesson.imageHint);
        } catch (e) {
          console.log("Image üretimi atlandı");
          imageResult = { success: false, imageUrl: "/fallback.jpg" };
        }

        let imageUrl = imageResult.imageUrl || "/fallback.jpg";
        if (imageResult.success && imageResult.imageUrl) {
          try {
            const storageRef = ref(storage, `academy-lessons/${lessonId}.jpg`);
            const isBase64 = imageResult.imageUrl.startsWith('data:') || (!imageResult.imageUrl.startsWith('http') && !imageResult.imageUrl.startsWith('/'));
            
            if (isBase64) {
              await uploadString(storageRef, imageResult.imageUrl, 'data_url');
              imageUrl = await getDownloadURL(storageRef);
            } else {
              imageUrl = imageResult.imageUrl;
            }
          } catch (storageError) {
            console.error("Storage upload failed, using original/fallback:", storageError);
          }
        }

        const lessonData = {
          ...lesson,
          id: lessonId,
          level: selectedLevel as any,
          category: selectedModuleId,
          moduleId: selectedModuleId,
          sourceLessonId: selectedLessonId,
          imageUrl,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(firestore, 'academy_lessons', lessonId), lessonData);
      }

      toast({ title: t('toast_success_title'), description: t('toast_lessons_published', { count: previewLessons.length }) });
      
      // 🚀 AUTOMATIC NOTIFICATION: Trigger broadcast to all users
      await NotificationAPI.triggerNewLessonEvent(previewLessons.length);

      setPreviewLessons([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toast_publish_error_title'), description: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishSingleWithManualImage = async (lessonIndex: number) => {
    if (!manualPreview || !firestore) {
      toast({ variant: 'destructive', title: t('toast_image_missing_title'), description: t('toast_image_missing_desc') });
      return;
    }

    const lesson = previewLessons[lessonIndex];
    if (!selectedModuleId || !selectedLessonId) return;

    setIsPublishing(true);
    try {
      // Browser compatible UUID fallback
      const lessonId = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        
      const storageRef = ref(storage, `academy-lessons/${lessonId}.jpg`);
      
      let imageUrl = manualPreview;
      
      const isBase64 = manualPreview.startsWith('data:') || (!manualPreview.startsWith('http') && !manualPreview.startsWith('/'));
      
      if (isBase64) {
        const uploadFormat = manualPreview.startsWith('data:') ? 'data_url' : 'base64';
        console.log("[ADMIN] Uploading image...", { format: uploadFormat, size: manualPreview.length });
        await uploadString(storageRef, manualPreview, uploadFormat);
        imageUrl = await getDownloadURL(storageRef);
      }
      
      console.log("[ADMIN] Final Image URL:", imageUrl);

      const lessonData = {
        ...lesson,
        id: lessonId,
        level: selectedLevel as any,
        category: selectedModuleId,
        moduleId: selectedModuleId,
        sourceLessonId: selectedLessonId,
        imageUrl,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(firestore, 'academy_lessons', lessonId), lessonData);
      
      toast({ title: t('toast_publish_success_title'), description: t('toast_publish_success_desc') });
      
      setPreviewLessons(prev => prev.filter((_, i) => i !== lessonIndex));
      setManualPreview(null);
      setManualPrompt('');
    } catch (e: any) {
      console.error("[ADMIN] Publish single failed:", e);
      toast({ variant: 'destructive', title: t('toast_error_title'), description: e.message });
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
      const result = await generateLessonImage(manualPrompt);
      if (result.success) {
        setManualPreview(result.imageUrl);
        toast({ title: t('toast_image_generated') });
      } else {
        setManualPreview(result.imageUrl); // This will be /fallback.jpg
        toast({ variant: 'destructive', title: t('toast_image_gen_error_title'), description: t('toast_image_fallback_desc') });
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
      
      const isBase64 = manualPreview.startsWith('data:') || (!manualPreview.startsWith('http') && !manualPreview.startsWith('/'));
      
      if (isBase64) {
        const uploadFormat = manualPreview.startsWith('data:') ? 'data_url' : 'base64';
        await uploadString(storageRef, manualPreview, uploadFormat);
        const url = await getDownloadURL(storageRef);
        setSavedImageUrl(url);
      } else {
        // Zaten bir URL (http) veya Fallback (/), olduğu gibi kullan
        setSavedImageUrl(manualPreview);
      }
      
      toast({ title: t('toast_save_success') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toast_save_error') });
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
              <Select value={selectedLevel} onValueChange={(val) => { setSelectedLevel(val); setSelectedModuleId(''); setSelectedLessonId(''); }}>
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Modül</Label>
              <Select value={selectedModuleId} onValueChange={(val) => { setSelectedModuleId(val); setSelectedLessonId(''); }}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                  <SelectValue placeholder="Modül Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {modulesLoading ? (
                    <div className="p-2 flex items-center justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
                  ) : modulesData?.map(mod => (
                    <SelectItem key={mod.id} value={mod.id}>{mod.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ders Konusu</Label>
              <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/60">
                  <SelectValue placeholder="Ders Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {lessonsLoading ? (
                    <div className="p-2 flex items-center justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
                  ) : curriculumLessons?.map(less => (
                    <SelectItem key={less.id} value={less.id}>{less.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={() => handleGenerateLessons(1)} 
              disabled={isGenerating || !selectedLessonId} 
              variant="outline"
              className="h-14 rounded-2xl font-black uppercase tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <><FileText className="mr-2 h-5 w-5" /> {t('btn_generate_single')}</>}
            </Button>
            <Button 
              onClick={() => handleGenerateLessons(10)} 
              disabled={isGenerating || !selectedLessonId} 
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
