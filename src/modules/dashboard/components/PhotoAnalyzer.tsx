'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { useToast } from '@/shared/hooks/use-toast';
import type { User, Photo, PhotoAnalysis, AnalysisLog } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Loader2, Sparkles } from 'lucide-react';

async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const ANALYSIS_COST = 1;
const UPLOAD_XP_GAIN = 5;

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
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysis | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Dosya Çok Büyük' });
      return;
    }

    setIsDuplicate(false);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setAnalysisResult(null);
  }, [toast]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (acceptedFiles) => acceptedFiles.length > 0 && handleFileSelect(acceptedFiles[0]),
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  const handleUploadAndOptionalAnalysis = async (analyze = false) => {
    if (!file || !user || !firestore || !userProfile) return;

    setIsLoading(true);

    try {
      const hash = await generateImageHash(file);

      // 🔎 Duplicate check
      const q = query(
        collection(firestore, 'users', user.uid, 'photos'),
        where('imageHash', '==', hash)
      );

      const dupSnap = await getDocs(q);

      if (!dupSnap.empty) {
        setIsDuplicate(true);
        toast({
          variant: 'destructive',
          title: 'Daha önce galerinize yüklemişsiniz.',
          description: 'Aynı kareyi tekrar yükleyemezsiniz.'
        });
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
        tags: []
      };

      let xpGained = UPLOAD_XP_GAIN;

      if (analyze) {
        if (userProfile.auro_balance < ANALYSIS_COST) {
          toast({ variant: 'destructive', title: 'Yetersiz Auro' });
          setIsLoading(false);
          return;
        }

        const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: 'tr' });
        photoData.aiFeedback = analysis;
        photoData.tags = analysis.tags || [];
        setAnalysisResult(analysis);

        // Update user balances
        batch.update(userRef, {
          auro_balance: increment(-ANALYSIS_COST),
          total_auro_spent: increment(ANALYSIS_COST)
        });

        // Create Analysis Log
        const logRef = doc(collection(firestore, 'analysis_logs'));
        const log: AnalysisLog = {
          id: logRef.id,
          userId: user.uid,
          userName: userProfile.name || 'Sanatçı',
          type: 'technical',
          auroSpent: ANALYSIS_COST,
          timestamp: new Date().toISOString(),
          status: 'success'
        };
        batch.set(logRef, log);

        // Update Daily Stats
        const today = new Date().toISOString().split('T')[0];
        const statRef = doc(firestore, 'global_stats', `daily_${today}`);
        batch.set(statRef, { 
          date: today,
          auroSpent: increment(ANALYSIS_COST),
          technicalAnalyses: increment(1)
        }, { merge: true });

        xpGained += 15;
      }

      batch.set(photoDocRef, photoData);
      batch.update(userRef, { current_xp: increment(xpGained) });

      await batch.commit();

      toast({ title: analyze ? 'Analiz Tamamlandı' : 'Fotoğraf Yüklendi' });

    } catch (error) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Hata', description: 'Bir sorun oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || isProfileLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  if (!user || !userProfile) return null;

  return (
    <div className="container mx-auto px-4 pt-10">
      {!file ? (
        <div {...getRootProps()} className="text-center p-16 border-2 border-dashed rounded-3xl cursor-pointer bg-card/30 hover:bg-card/50 transition-colors">
          <input {...getInputProps()} />
          <Camera className="mx-auto mb-4 text-muted-foreground" size={48} />
          <p className="font-bold text-xl">Vizyonunu Paylaş</p>
          <p className="text-muted-foreground mt-2">Analiz etmek veya galerine eklemek için bir fotoğraf seç.</p>
          <Button onClick={open} className="mt-8 px-10 h-12 rounded-2xl font-bold">Fotoğraf Seç</Button>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <p className="font-bold text-lg">Luma İşlem Yapıyor...</p>
          <p className="text-muted-foreground mt-2">Lütfen bekleyin.</p>
        </div>
      ) : (
        <Card className="p-10 text-center rounded-[40px] border-border/40 shadow-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
          <div className="relative max-w-lg mx-auto aspect-square rounded-3xl overflow-hidden border-4 border-primary/10 shadow-xl mb-10">
            <Image src={preview!} alt="Preview" fill className="object-cover" unoptimized />
          </div>

          {isDuplicate && (
            <div className="mb-8 p-4 bg-destructive/10 rounded-2xl border border-destructive/20 animate-in zoom-in duration-300">
              <p className="text-destructive font-bold text-sm">
                Bu kare zaten galerinizde yer alıyor.
              </p>
              <Button
                variant="link"
                className="mt-1 h-auto p-0 text-xs font-black uppercase text-destructive/70"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setIsDuplicate(false);
                }}
              >
                Farklı bir fotoğraf seç
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              onClick={() => handleUploadAndOptionalAnalysis(true)}
              disabled={isDuplicate}
              size="lg"
              className="h-14 px-10 rounded-2xl font-bold shadow-lg shadow-primary/20"
            >
              <Sparkles className="mr-2 h-5 w-5" /> Teknik Analiz Et ({ANALYSIS_COST} Auro)
            </Button>

            <Button
              onClick={() => handleUploadAndOptionalAnalysis(false)}
              variant="secondary"
              disabled={isDuplicate}
              size="lg"
              className="h-14 px-10 rounded-2xl font-bold"
            >
              Sadece Galeriye Yükle
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="mt-6 text-muted-foreground hover:text-primary font-bold"
            onClick={() => { setFile(null); setPreview(null); setIsDuplicate(false); }}
          >
            İptal Et
          </Button>
        </Card>
      )}
    </div>
  );
}
