'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo, PhotoAnalysis, AnalysisLog, UserTier } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Loader2, Sparkles, Gem, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function PhotoAnalyzer() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const currentTier = userProfile?.tier || 'start';
  const analysisCost = TIER_COSTS[currentTier];

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Dosya Çok Büyük', description: 'Lütfen 10MB\'dan küçük bir dosya seçin.' });
      return;
    }
    setIsDuplicate(false);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }, [toast]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (acceptedFiles) => acceptedFiles.length > 0 && handleFileSelect(acceptedFiles[0]),
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  const handleUploadAndOptionalAnalysis = async (analyze = false) => {
    if (!file || !user || !firestore || !userProfile) return;

    if (analyze && userProfile.auro_balance < analysisCost) {
      toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Bu analiz derinliği için ${analysisCost} Auro gereklidir.` });
      return;
    }

    setIsLoading(true);

    try {
      const hash = await generateImageHash(file);
      const q = query(collection(firestore, 'users', user.uid, 'photos'), where('imageHash', '==', hash));
      const dupSnap = await getDocs(q);

      if (!dupSnap.empty) {
        setIsDuplicate(true);
        toast({ variant: 'destructive', title: 'Bu kare zaten galerinizde.', description: 'Aynı fotoğrafı tekrar yükleyemezsiniz.' });
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

      if (analyze) {
        const analysis = await generatePhotoAnalysis({ 
          photoUrl: imageUrl, 
          language: 'tr',
          tier: currentTier
        });
        photoData.aiFeedback = analysis;
        photoData.tags = analysis.tags || [];

        batch.update(userRef, {
          auro_balance: increment(-analysisCost),
          total_auro_spent: increment(analysisCost)
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

        const today = new Date().toISOString().split('T')[0];
        const statRef = doc(firestore, 'global_stats', `daily_${today}`);
        batch.set(statRef, { 
          date: today,
          auroSpent: increment(analysisCost),
          technicalAnalyses: increment(1)
        }, { merge: true });
      }

      batch.set(photoDocRef, photoData);
      batch.update(userRef, { current_xp: increment(analyze ? 20 : 5) });

      await batch.commit();
      toast({ title: analyze ? 'Analiz Tamamlandı' : 'Fotoğraf Yüklendi' });
      setFile(null);
      setPreview(null);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'İşlem Başarısız', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || isProfileLoading)
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 pt-10 pb-20 animate-in fade-in duration-700">
      {!file ? (
        <div {...getRootProps()} className="text-center p-20 border-2 border-dashed rounded-[40px] cursor-pointer bg-card/30 hover:bg-card/50 hover:border-primary/30 transition-all group shadow-inner">
          <input {...getInputProps()} />
          <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
            <Camera className="text-primary" size={40} />
          </div>
          <p className="font-black text-3xl tracking-tighter">VİZYONUNU PAYLAŞ</p>
          <p className="text-muted-foreground mt-3 text-lg font-medium">Analiz etmek veya galerine eklemek için bir fotoğraf seç.</p>
          <Button onClick={open} className="mt-10 px-12 h-14 rounded-2xl font-black tracking-widest shadow-2xl shadow-primary/20">Fotoğraf Seç</Button>
        </div>
      ) : isLoading ? (
        <div className="text-center py-32 space-y-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="font-black text-2xl tracking-tighter uppercase">Luma İşlem Yapıyor...</p>
        </div>
      ) : (
        <Card className="p-12 text-center rounded-[48px] border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12">
            <Image src={preview!} alt="Preview" fill className="object-cover" unoptimized />
          </div>

          <div className="flex flex-col items-center gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
              <Card className={cn("p-6 border-2 transition-all", currentTier === 'start' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Start</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 1
                </div>
                <ul className="text-[10px] text-left space-y-1 mb-4">
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> 3 Temel Metrik</li>
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Kısa Yorum</li>
                </ul>
              </Card>
              <Card className={cn("p-6 border-2 transition-all", currentTier === 'pro' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Pro</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 2
                </div>
                <ul className="text-[10px] text-left space-y-1 mb-4">
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> 5 Derin Metrik</li>
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> AI Stratejik Koç</li>
                </ul>
              </Card>
              <Card className={cn("p-6 border-2 transition-all", currentTier === 'master' ? "border-primary bg-primary/5" : "border-border opacity-50")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">Luma Master</p>
                <div className="flex items-center justify-center gap-1 mb-4 text-xl font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" /> 3
                </div>
                <ul className="text-[10px] text-left space-y-1 mb-4">
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Görsel İşaretleme</li>
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Stil Analizi</li>
                </ul>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <Button
                onClick={() => handleUploadAndOptionalAnalysis(true)}
                disabled={isDuplicate}
                className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30"
              >
                <Sparkles className="mr-3 h-6 w-6 text-yellow-400" /> Analiz Et ({analysisCost} Auro)
              </Button>
              <Button
                onClick={() => handleUploadAndOptionalAnalysis(false)}
                variant="secondary"
                disabled={isDuplicate}
                className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest"
              >
                Sadece Yükle (Ücretsiz)
              </Button>
            </div>
            
            <Button variant="ghost" className="text-muted-foreground hover:text-destructive font-black uppercase text-[10px]" onClick={() => { setFile(null); setPreview(null); }}>İptal Et</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
