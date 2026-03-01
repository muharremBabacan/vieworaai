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
      toast({ variant: 'destructive', title: 'Dosya Çok Büyük', description: 'Lütfen 10MB\'dan küçük bir dosya seçin.' });
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

      // 🧬 1. SHA-256 Duplicate Check
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

      // 📦 2. Hash-based Storage Path
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
          toast({ variant: 'destructive', title: 'Yetersiz Auro', description: `Analiz için ${ANALYSIS_COST} Auro gereklidir.` });
          setIsLoading(false);
          return;
        }

        const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: 'tr' });
        photoData.aiFeedback = analysis;
        photoData.tags = analysis.tags || [];
        setAnalysisResult(analysis);

        // 💰 3. Update Balances
        batch.update(userRef, {
          auro_balance: increment(-ANALYSIS_COST),
          total_auro_spent: increment(ANALYSIS_COST)
        });

        // 📝 4. Create Analysis Log (CRITICAL FOR ACCOUNTING)
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

        // 📈 5. Update Daily Stats
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

      toast({ title: analyze ? 'Analiz Tamamlandı' : 'Fotoğraf Yüklendi', description: analyze ? 'Teknik geri bildirimlerin galerine eklendi.' : 'Fotoğrafın başarıyla saklandı.' });
      
      // Reset after success
      setFile(null);
      setPreview(null);

    } catch (error) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Hata', description: 'İşlem sırasında bir sorun oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || isProfileLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );

  if (!user || !userProfile) return null;

  return (
    <div className="container mx-auto px-4 pt-10 pb-20 animate-in fade-in duration-700">
      {!file ? (
        <div {...getRootProps()} className="text-center p-20 border-2 border-dashed rounded-[40px] cursor-pointer bg-card/30 hover:bg-card/50 hover:border-primary/30 transition-all group shadow-inner">
          <input {...getInputProps()} />
          <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg">
            <Camera className="text-primary" size={40} />
          </div>
          <p className="font-black text-3xl tracking-tighter">VİZYONUNU PAYLAŞ</p>
          <p className="text-muted-foreground mt-3 text-lg font-medium">Analiz etmek veya galerine eklemek için bir fotoğraf seç.</p>
          <Button onClick={open} className="mt-10 px-12 h-14 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/20 active:scale-95 transition-all">Fotoğraf Seç</Button>
        </div>
      ) : isLoading ? (
        <div className="text-center py-32 space-y-6">
          <div className="relative mx-auto h-24 w-24">
            <Loader2 className="absolute inset-0 h-24 w-24 animate-spin text-primary opacity-20" />
            <Sparkles className="absolute inset-0 h-12 w-12 m-auto text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-black text-2xl tracking-tighter uppercase">Luma İşlem Yapıyor...</p>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest mt-2">Lütfen pencereyi kapatmayın.</p>
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center rounded-[48px] border-border/40 shadow-2xl overflow-hidden bg-card/50 backdrop-blur-sm animate-in zoom-in-95 duration-500">
          <div className="relative max-w-xl mx-auto aspect-square rounded-[32px] overflow-hidden border-8 border-background shadow-2xl mb-12 group">
            <Image src={preview!} alt="Preview" fill className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
          </div>

          {isDuplicate && (
            <div className="mb-10 p-6 bg-destructive/10 rounded-[24px] border border-destructive/20 animate-in slide-in-from-top-4 duration-500">
              <p className="text-destructive font-black text-sm uppercase tracking-widest">
                BU KARE ZATEN GALERİNİZDE MEVCUT.
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0 text-xs font-black uppercase text-destructive/70 underline underline-offset-4"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setIsDuplicate(false);
                }}
              >
                FARKLI BİR FOTOĞRAF SEÇ
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <Button
              onClick={() => handleUploadAndOptionalAnalysis(true)}
              disabled={isDuplicate}
              size="lg"
              className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all group"
            >
              <Sparkles className="mr-3 h-6 w-6 text-yellow-400 group-hover:rotate-12 transition-transform" /> Teknik Analiz Et ({ANALYSIS_COST} Auro)
            </Button>

            <Button
              onClick={() => handleUploadAndOptionalAnalysis(false)}
              variant="secondary"
              disabled={isDuplicate}
              size="lg"
              className="h-16 px-12 rounded-[20px] font-black uppercase tracking-widest border border-border/60 hover:bg-background transition-all active:scale-95"
            >
              Sadece Galeriye Yükle
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="mt-8 text-muted-foreground hover:text-destructive font-black uppercase tracking-widest text-[10px] transition-colors"
            onClick={() => { setFile(null); setPreview(null); setIsDuplicate(false); }}
          >
            İşlemi İptal Et
          </Button>
        </Card>
      )}
    </div>
  );
}