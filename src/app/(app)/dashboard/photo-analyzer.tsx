'use client';

import { useState, useRef, useTransition, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { analyzePhotoAndSuggestImprovements } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, X, Loader2, Lightbulb, LayoutPanelLeft, Heart, Zap } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';
import { Skeleton } from '@/components/ui/skeleton';

function AnalysisRating({ rating }: { rating: AnalyzePhotoAndSuggestImprovementsOutput['rating'] }) {
  const data = [
    { subject: 'Işık', score: rating.lighting, fullMark: 10 },
    { subject: 'Kompozisyon', score: rating.composition, fullMark: 10 },
    { subject: 'Duygu', score: rating.emotion, fullMark: 10 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-sans text-xl font-semibold">Derecelendirme</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <h4 className="text-lg font-medium text-muted-foreground">Genel Puan</h4>
          <div className="flex items-baseline">
            <p className="text-6xl font-bold text-primary">{rating.overall.toFixed(1)}</p>
            <span className="text-2xl text-muted-foreground">/10</span>
          </div>
        </div>
        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
              <PolarGrid stroke="hsl(var(--border))"/>
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 14 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} axisLine={false} />
              <Radar name="Puan" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisResult({ result }: { result: AnalyzePhotoAndSuggestImprovementsOutput }) {
  const improvements = [
    { icon: Lightbulb, color: 'text-amber-400' },
    { icon: LayoutPanelLeft, color: 'text-blue-400' },
    { icon: Heart, color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {result.rating && <AnalysisRating rating={result.rating} />}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-sans text-xl font-semibold mb-4">YZ Analizi</h3>
          <p className="text-muted-foreground">{result.analysis}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <h3 className="font-sans text-xl font-semibold mb-4">İyileştirme İpuçları</h3>
          <ul className="space-y-4">
            {result.improvements.map((tip, index) => {
              const Icon = improvements[index % improvements.length].icon;
              const color = improvements[index % improvements.length].color;
              return (
                <li key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Icon className={cn('h-6 w-6', color)} />
                  </div>
                  <p className="text-muted-foreground">{tip}</p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PhotoAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzePhotoAndSuggestImprovementsOutput | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setResult(null);
    } else if (selectedFile) {
      toast({
        variant: 'destructive',
        title: 'Geçersiz Dosya Türü',
        description: 'Lütfen bir resim dosyası yükleyin (örn: JPG, PNG).',
      });
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleAnalyze = () => {
    if (!file || !preview || !userProfile || !userDocRef || !authUser) return;
    if (userProfile.aura_balance < 2) {
      toast({
        variant: 'destructive',
        title: 'Yetersiz Aura',
        description: 'Bir fotoğrafı analiz etmek için en az 2 Aura\'ya ihtiyacınız var.',
      });
      return;
    }

    startTransition(async () => {
      let analysisResult: AnalyzePhotoAndSuggestImprovementsOutput;
      try {
        analysisResult = await analyzePhotoAndSuggestImprovements({
          photoDataUri: preview,
        });
      } catch (error) {
        console.error('Analiz başarısız:', error);
        toast({
          variant: 'destructive',
          title: 'Analiz Başarısız',
          description: 'YZ analizi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        });
        return;
      }
      setResult(analysisResult);

      // --- Save Photo to Firestore ---
      const photosCollectionRef = collection(firestore, 'users', authUser.uid, 'photos');
      const photoData = {
          userId: authUser.uid, // Security Rule FIX
          imageUrl: preview,
          imageHint: '', // No hint for user uploads
          aiFeedback: analysisResult,
          createdAt: new Date().toISOString(),
      };
      addDoc(photosCollectionRef, photoData).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: photosCollectionRef.path,
              operation: 'create',
              requestResourceData: photoData,
          }));
      });
      
      // --- Gamification Logic ---
      const xpFromAnalysis = 15;
      const bonusXp = analysisResult.rating.overall >= 8.0 ? 50 : 0;
      const totalXpGained = xpFromAnalysis + bonusXp;

      const currentLevel = getLevelFromXp(userProfile.current_xp);
      const newXp = userProfile.current_xp + totalXpGained;
      const newLevel = getLevelFromXp(newXp);
      
      const updatePayload: Partial<UserProfile> = {
        aura_balance: userProfile.aura_balance - 2,
        current_xp: newXp
      };

      if (newLevel.name !== currentLevel.name) {
        updatePayload.level_name = newLevel.name;
        if (newLevel.isMentor) {
            updatePayload.is_mentor = true;
        }
      }

      updateDoc(userDocRef, updatePayload).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: updatePayload,
        }));
      });

      toast({
        title: 'XP Kazandın!',
        description: `Analiz için ${xpFromAnalysis} XP kazandın.`,
      });
      if(bonusXp > 0) {
          setTimeout(() => {
            toast({
              title: '✨ Bonus!',
              description: `Yüksek puan için +${bonusXp} bonus XP kazandın!`,
            });
          }, 100);
      }
      if (updatePayload.level_name) {
          setTimeout(() => {
            toast({
              title: '🎉 Seviye Atladın!',
              description: `Tebrikler! Yeni seviyen: ${updatePayload.level_name}`,
            });
          }, 200);
           if (updatePayload.is_mentor) {
            setTimeout(() => {
                toast({
                  title: '👑 Mentor Oldun!',
                  description: 'Tebrikler! Artık bir Vexer olarak mentorluk yapabilirsin.',
                });
              }, 300);
          }
      }
      // --- Gamification Logic End ---
    });
  };

  const handleClear = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canAnalyze = !isPending && !isProfileLoading && userProfile && userProfile.aura_balance >= 2;

  return (
    <div className="space-y-8">
      {!preview && (
        <div
          className={cn(
            'relative w-full h-80 rounded-lg border-2 border-dashed border-muted-foreground/50 transition-colors duration-200 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary hover:bg-accent',
            isDragging && 'border-primary bg-accent'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*"
          />
          <div className="space-y-4">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-primary">Yüklemek için tıklayın</span> veya sürükleyip bırakın
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF 10MB'a kadar</p>
          </div>
        </div>
      )}

      {preview && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video">
              <Image src={preview} alt="Preview" fill className="object-contain" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 right-4 h-8 w-8 rounded-full"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <Button onClick={handleAnalyze} disabled={!canAnalyze} className="w-full" size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analiz ediliyor...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Fotoğrafı Analiz Et (2 Aura)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
         <div className="space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
        </div>
      )}

      {result && <AnalysisResult result={result} />}
    </div>
  );
}
