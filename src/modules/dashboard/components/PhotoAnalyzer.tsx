
'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo, AnalysisLog, UserTier } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Sparkles, Gem, Check, Info, TrendingUp, Star, ChevronRight, RefreshCw, Lock, BarChart3, GraduationCap, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';
import { useRouter } from 'next/navigation';

async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const TIER_COSTS: Record<UserTier, number> = {
  start: 1,
  pro: 2,
  master: 3
};

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const getOverallScore = (photo: Photo): number => {
    if (!photo.aiFeedback) return 0;
    const scores = [
        normalizeScore(photo.aiFeedback.light_score),
        normalizeScore(photo.aiFeedback.composition_score),
        normalizeScore(photo.aiFeedback.technical_clarity_score),
        normalizeScore(photo.aiFeedback.storytelling_score),
        normalizeScore(photo.aiFeedback.boldness_score)
    ].filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
};

const RatingBar = ({ label, score, isLocked }: { label: string; score: number; isLocked?: boolean }) => (
    <div className={cn("relative", isLocked && "opacity-40 grayscale")}>
        <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1">{label} {isLocked && <Lock className="h-2.5 w-2.5" />}</span>
            <span className="text-foreground">{isLocked ? '?' : score.toFixed(1)}</span>
        </div>
        <div className="relative">
          <Progress value={isLocked ? 0 : score * 10} className="h-1.5" />
          {isLocked && <div className="absolute inset-0 bg-muted/20 backdrop-blur-[1px] rounded-full" />}
        </div>
    </div>
);

export default function PhotoAnalyzer() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { currencyName } = useAppConfig();
  
  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);

  const currentTier = userProfile?.tier || 'start';
  const analysisCost = TIER_COSTS[currentTier];

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Dosya Çok Büyük', description: 'Lütfen 10MB\'dan küçük bir dosya seçin.' });
      return;
    }
    setIsDuplicate(false);
    setAnalysisResult(null);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }, [toast]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (acceptedFiles) => acceptedFiles.length > 0 && handleFileSelect(acceptedFiles[0]),
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  const updateUserProfileIndex = async (userId: string, newOverallScore: number) => {
    if (!firestore) return;
    
    const photosRef = collection(firestore, 'users', userId, 'photos');
    const q = query(
      photosRef, 
      where('aiFeedback', '!=', null), 
      orderBy('createdAt', 'desc'), 
      limit(12)
    );
    
    const snap = await getDocs(q);
    if (snap.empty) return;

    const analyzedPhotos = snap.docs.map(d => d.data() as Photo);
    const count = analyzedPhotos.length;

    const totals = analyzedPhotos.reduce((acc, p) => {
      const f = p.aiFeedback!;
      acc.light += normalizeScore(f.light_score);
      acc.composition += normalizeScore(f.composition_score);
      acc.clarity += normalizeScore(f.technical_clarity_score);
      acc.story += normalizeScore(f.storytelling_score || 0);
      acc.boldness += normalizeScore(f.boldness_score || 0);
      acc.overall.push(getOverallScore(p));
      return acc;
    }, { light: 0, composition: 0, clarity: 0, story: 0, boldness: 0, overall: [] as number[] });

    const technicalMetrics = {
      light: totals.light / count,
      composition: totals.composition / count,
      technical_clarity: totals.clarity / count,
      storytelling: totals.story / count,
      boldness: totals.boldness / count
    };

    const allTags = analyzedPhotos.flatMap(p => p.tags || []);
    const tagCounts: Record<string, number> = {};
    allTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    const dominantStyle = Object.entries(tagCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || "unknown";

    const metricEntries = Object.entries(technicalMetrics);
    const strengths = [metricEntries.sort((a,b) => b[1] - a[1])[0][0]];
    const weaknesses = [metricEntries.sort((a,b) => a[1] - b[1])[0][0]];

    const totalAvg = (technicalMetrics.light + technicalMetrics.composition + technicalMetrics.technical_clarity) / 3;
    const dominantLevel = totalAvg > 7 ? 'advanced' : totalAvg > 4 ? 'intermediate' : 'beginner';

    const mean = totals.overall.reduce((a, b) => a + b, 0) / count;
    const variance = totals.overall.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const consistencyGap = Math.round(stdDev * 10);

    let trendDirection: 'improving' | 'stagnant' | 'declining' = 'stagnant';
    let trendPercentage = 0;
    if (count > 1) {
        const recentAvg = (totals.overall[0] + (totals.overall[1] || totals.overall[0])) / 2;
        const pastAvg = mean;
        trendPercentage = Math.round(((recentAvg - pastAvg) / pastAvg) * 100) || 0;
        trendDirection = trendPercentage > 5 ? 'improving' : trendPercentage < -5 ? 'declining' : 'stagnant';
    }

    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, {
      'profile_index.dominant_style': dominantStyle,
      'profile_index.strengths': strengths,
      'profile_index.weaknesses': weaknesses,
      'profile_index.dominant_technical_level': dominantLevel,
      'profile_index.technical': technicalMetrics,
      'profile_index.consistency_gap': consistencyGap,
      'profile_index.trend': { direction: trendDirection, percentage: Math.abs(trendPercentage) },
      'profile_index.profile_index_score': mean * 10,
      score_history: arrayUnion({ score: newOverallScore, date: new Date().toISOString() })
    });
  };

  const handleUploadAndOptionalAnalysis = async (analyze = false) => {
    if (!file || !user || !firestore || !userProfile) return;

    if (analyze && userProfile.auro_balance < analysisCost) {
      toast({ 
        variant: 'destructive', 
        title: `Yetersiz ${currencyName}`, 
        description: `Bu analiz derinliği için ${analysisCost} ${currencyName} gereklidir.`,
        action: (
          <Button variant="outline" size="sm" onClick={() => router.push('/pricing')}>
            {currencyName} Yükle
          </Button>
        )
      });
      return;
    }

    setIsLoading(true);

    try {
      const hash = await generateImageHash(file);
      const q = query(collection(firestore, 'users', user.uid, 'photos'), where('imageHash', '==', hash));
      const dupSnap = await getDocs(q);

      if (!dupSnap.empty) {
        setIsDuplicate(true);
        toast({ variant: 'destructive', title: 'Bu kare zaten galerinizde.' });
        setIsLoading(false);
        return;
      }

      const storage = getStorage();
      const filePath = `users/${user.uid}/photos/${hash}.jpg`;
      const storageRef = ref(storage, filePath);
      const uploadTask = await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(uploadTask.ref);

      const batch = writeBatch(firestore);
      const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'));
      const userRef = doc(firestore, 'users', user.uid);

      let photoData: Photo = {
        id: photoDocRef.id,
        userId: user.uid,
        imageUrl,
        filePath,
        imageHash: hash,
        createdAt: new Date().toISOString(),
        aiFeedback: null,
        tags: [],
        analysisTier: analyze ? currentTier : undefined
      };

      let overallScore = 0;

      if (analyze) {
        const analysis = await generatePhotoAnalysis({ 
          photoUrl: imageUrl, 
          language: 'tr',
          tier: currentTier
        });
        photoData.aiFeedback = analysis;
        photoData.tags = analysis.tags || [];
        overallScore = getOverallScore(photoData);

        batch.update(userRef, {
          auro_balance: increment(-analysisCost),
          total_auro_spent: increment(analysisCost),
          total_analyses_count: increment(1)
        });

        const logRef = doc(collection(firestore, 'analysis_logs'));
        batch.set(logRef, {
          id: logRef.id,
          userId: user.uid,
          userName: userProfile.name || 'Sanatçı',
          type: 'technical',
          auroSpent: analysisCost,
          timestamp: new Date().toISOString(),
          status: 'success'
        } as AnalysisLog);
      }

      batch.set(photoDocRef, photoData);
      batch.update(userRef, { current_xp: increment(analyze ? 20 : 5) });

      await batch.commit();
      
      if (analyze) {
        await updateUserProfileIndex(user.uid, overallScore);
        setAnalysisResult(photoData);
        toast({ title: 'Analiz Tamamlandı' });
      } else {
        toast({ title: 'Fotoğraf Yüklendi' });
        setFile(null);
        setPreview(null);
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'İşlem Başarısız', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalyzer = () => {
    setFile(null);
    setPreview(null);
    setAnalysisResult(null);
    setIsDuplicate(false);
  };

  if (isUserLoading || isProfileLoading)
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 pt-10 pb-20 animate-in fade-in duration-700">
      {analysisResult ? (
        <Card className="max-w-5xl mx-auto rounded-[48px] border-border/40 bg-card/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-700">
          <div className="flex flex-col md:flex-row">
            <div className="relative md:w-3/5 w-full aspect-square md:aspect-auto bg-black/40">
              <Image src={analysisResult.imageUrl} alt="Analiz" fill className="object-contain" unoptimized />
            </div>
            <div className="md:w-2/5 w-full flex flex-col p-8 space-y-8 overflow-y-auto max-h-[800px]">
              <div className="space-y-2">
                <Badge variant="outline" className="px-3 h-6 border-primary/30 text-primary font-black uppercase tracking-widest text-[9px] rounded-full">ANALİZ TAMAMLANDI</Badge>
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black tracking-tighter">Luma Raporu</h2>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 font-black uppercase text-[10px]">
                    <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" /> {getOverallScore(analysisResult).toFixed(1)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-6">
                <Card className="p-6 border-primary/20 bg-primary/5 rounded-[24px] space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Teknik Katman (AI)</h4>
                  <div className="space-y-4">
                    <RatingBar label="Işık" score={normalizeScore(analysisResult.aiFeedback!.light_score)} />
                    <RatingBar label="Kompozisyon" score={normalizeScore(analysisResult.aiFeedback!.composition_score)} />
                    <RatingBar label="Teknik Netlik" score={normalizeScore(analysisResult.aiFeedback!.technical_clarity_score)} />
                    <RatingBar label="Hikaye Anlatımı" score={normalizeScore(analysisResult.aiFeedback!.storytelling_score)} isLocked={analysisResult.analysisTier === 'start'} />
                    <RatingBar label="Cesur Kadraj" score={normalizeScore(analysisResult.aiFeedback!.boldness_score)} isLocked={analysisResult.analysisTier === 'start'} />
                  </div>
                </Card>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Luma Notu</span>
                  <p className="text-sm italic text-foreground/90 leading-relaxed font-medium bg-muted/30 p-5 rounded-2xl border border-border/40">
                    "{analysisResult.aiFeedback!.short_neutral_analysis}"
                  </p>
                </div>
              </div>

              <div className="pt-8 border-t border-border/40 mt-auto">
                <Button onClick={resetAnalyzer} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                  <RefreshCw className="mr-2 h-5 w-5" /> Yeni Analiz Başlat
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : !file ? (
        <div className="max-w-6xl mx-auto space-y-16">
          <div {...getRootProps()} className="relative p-10 md:p-16 border-2 border-dashed border-border/60 rounded-[48px] bg-card/30 hover:bg-card/40 transition-all group shadow-inner">
            <input {...getInputProps()} />
            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="text-center md:text-left space-y-4 max-w-md">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Fotoğrafını yükle</h2>
                <p className="text-xl md:text-2xl font-bold text-muted-foreground">Yapay zeka fotoğrafını analiz etsin</p>
                <p className="text-sm font-medium text-muted-foreground/70">Işık, kompozisyon ve hikaye gücünü keşfet.</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <Camera className="text-primary" size={40} />
                </div>
                <Button onClick={open} className="px-12 h-14 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-95">
                  Fotoğraf Seç
                </Button>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">veya buraya sürükle bırak</p>
              </div>
            </div>
          </div>

          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            <h3 className="text-xl font-black tracking-tight uppercase ml-2">Viewora ile neler yapabilirsin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-secondary/20 border-border/40 p-6 rounded-[24px] space-y-4 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <BarChart3 size={18} />
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight">AI Fotoğraf Analizi</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">Fotoğrafını yükle. Yapay zeka ışık, kompozisyon ve hikaye gücünü analiz etsin.</p>
              </Card>

              <Card className="bg-secondary/20 border-border/40 p-6 rounded-[24px] space-y-4 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <GraduationCap size={18} />
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Fotoğraf Akademisi</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">Seviyene göre hazırlanmış derslerle fotoğraf bilgisini geliştir.</p>
              </Card>

              <Card className="bg-secondary/20 border-border/40 p-6 rounded-[24px] space-y-4 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Globe size={18} />
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Topluluk ve Sergiler</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">Fotoğraflarını paylaş, geri bildirim al ve sergilere katıl.</p>
              </Card>

              <Card className="bg-secondary/20 border-border/40 p-6 rounded-[24px] space-y-4 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Sparkles size={18} />
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Luma – Özel Koçluk</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">Fotoğraf gelişim koçun. Kişisel geri bildirimler ve gelişim önerileri al.</p>
              </Card>
            </div>
            <p className="text-center pt-10 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Türkiye'de geliştirilen küresel bir mobil fotoğraf ve yapay zekâ platformu.</p>
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center rounded-[48px] border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12">
            <Image src={preview!} alt="Preview" fill className="object-cover" unoptimized />
          </div>

          <div className="flex flex-col items-center gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
              <Card className={cn("p-6 border-2 transition-all rounded-[24px]", currentTier === 'start' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Start</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 1 <span className="text-[9px] uppercase">{currencyName}</span>
                </div>
              </Card>
              <Card className={cn("p-6 border-2 transition-all rounded-[24px]", currentTier === 'pro' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Pro</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 2 <span className="text-[9px] uppercase">{currencyName}</span>
                </div>
              </Card>
              <Card className={cn("p-6 border-2 transition-all rounded-[24px]", currentTier === 'master' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Master</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 3 <span className="text-[9px] uppercase">{currencyName}</span>
                </div>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <Button
                onClick={() => handleUploadAndOptionalAnalysis(true)}
                disabled={isDuplicate || isLoading}
                className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30"
              >
                {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : (
                  <>
                    <Sparkles className="mr-3 h-6 w-6 text-yellow-400" /> Analiz Et ({analysisCost} {currencyName})
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleUploadAndOptionalAnalysis(false)}
                variant="secondary"
                disabled={isDuplicate || isLoading}
                className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest"
              >
                Sadece Yükle
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
