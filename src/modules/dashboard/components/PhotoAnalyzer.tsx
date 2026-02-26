
'use client';
import { useState, useCallback, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, writeBatch, query, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';
import { useToast } from '@/shared/hooks/use-toast';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';
import { useRouter } from 'next/navigation';

import type { User, Photo, PhotoAnalysis, AnalysisLog } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, Sparkles, Loader2, Award, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Constants
const ANALYSIS_COST = 1;
const UPLOAD_XP_GAIN = 5;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

// Component to render individual rating bar
const RatingBar = ({ label, score }: { label: string, score: number | undefined }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold">{score?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <Progress value={(score ?? 0) * 10} className="h-2" />
    </div>
);

// Component to show the analysis result
const AnalysisResult = ({
  analysis,
  adaptiveFeedback,
  onNewAnalysis,
}: {
  analysis: PhotoAnalysis | null;
  adaptiveFeedback?: string | null;
  onNewAnalysis: () => void;
}) => {
    const { overallScore, technicalScore, lightScore, compositionScore } = useMemo(() => {
        if (!analysis) return { overallScore: 0, technicalScore: 0, lightScore: 0, compositionScore: 0 };
        
        const lScore = normalizeScore(analysis.light_score);
        const cScore = normalizeScore(analysis.composition_score);
        
        const technicalSubScores = [
            normalizeScore(analysis.focus_score),
            normalizeScore(analysis.color_control_score),
            normalizeScore(analysis.background_control_score),
        ];
        const tScore = technicalSubScores.reduce((sum, s) => sum + s, 0) / technicalSubScores.length;

        const mainScores = [ lScore, cScore, tScore ];
        const ovScore = mainScores.reduce((sum, score) => sum + score, 0) / mainScores.length;

        return { 
            overallScore: ovScore, 
            technicalScore: tScore,
            lightScore: lScore,
            compositionScore: cScore
        };
    }, [analysis]);

    const strengths = useMemo(() => {
        if (!analysis) return [];
        const result = [];
        if (normalizeScore(analysis.composition_score) > 7) result.push({ key: 'Başarılı kompozisyon', score: normalizeScore(analysis.composition_score) });
        if (normalizeScore(analysis.light_score) > 7) result.push({ key: 'Etkili ışık kullanımı', score: normalizeScore(analysis.light_score) });
        if (normalizeScore(analysis.focus_score) > 7) result.push({ key: 'İyi netlik ve odaklama', score: normalizeScore(analysis.focus_score) });
        if (normalizeScore(analysis.color_control_score) > 7) result.push({ key: 'Dengeli renk kontrolü', score: normalizeScore(analysis.color_control_score) });
        if (normalizeScore(analysis.background_control_score) > 7) result.push({ key: 'Sade ve etkili arkaplan', score: normalizeScore(analysis.background_control_score) });
        if (normalizeScore(analysis.creativity_risk_score) > 7) result.push({ key: 'Yaratıcı ve orijinal bakış açısı', score: normalizeScore(analysis.creativity_risk_score) });
        return result.sort((a, b) => b.score - a.score).slice(0, 3);
    }, [analysis]);
    
    if (!analysis) return null;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <Card className="p-6">
                    <div className="flex justify-between items-baseline mb-2">
                        <h3 className="text-2xl font-bold">Genel Puan</h3>
                        <p className="text-4xl font-bold tracking-tighter text-blue-400">{overallScore.toFixed(1)}</p>
                    </div>
                    <hr className="border-border mb-6" />
                    <div className="space-y-5">
                        <RatingBar label="Işık" score={lightScore} />
                        <RatingBar label="Kompozisyon" score={compositionScore} />
                        <RatingBar label="Teknik" score={technicalScore} />
                    </div>
                </Card>

                {analysis.tags && analysis.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {analysis.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="bg-secondary/50 text-[10px] font-bold uppercase tracking-wider">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">YZ Analizi</h3>
                     {adaptiveFeedback ? (
                        <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: adaptiveFeedback.replace(/\n/g, '<br />') }} />
                     ) : (
                        <p className="text-sm text-muted-foreground italic">{analysis.short_neutral_analysis}</p>
                     )}
                </Card>

                {strengths.length > 0 && (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Güçlü Yönler</h3>
                        <div className="space-y-3">
                            {strengths.map(strength => (
                                <div key={strength.key} className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 rounded-full">
                                        <Award className="h-5 w-5 text-green-400" />
                                    </div>
                                    <span className="text-sm font-medium">{strength.key}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Button onClick={onNewAnalysis} className="w-full">Yeni Analiz Başlat</Button>
            </div>
        </div>
    );
};

// Component for the photo uploader
const Uploader = ({ onFileSelect, userProfile, hasPhotos }: { onFileSelect: (file: File) => void, userProfile: User, hasPhotos: boolean }) => {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: (acceptedFiles) => acceptedFiles.length > 0 && onFileSelect(acceptedFiles[0]),
        noClick: true,
        noKeyboard: true,
        accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.heic', '.webp'] }
    });

    return (
        <div className="text-center max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2.5 mb-4">
                <Sparkles className="h-6 w-6 text-purple-400" />
                <h1 className="text-5xl font-bold tracking-tighter">Luma</h1>
                <Sparkles className="h-6 w-6 text-cyan-400" />
            </div>
            
            <p className="text-lg text-muted-foreground">Ben Luma. Fotoğraf yolculuğunda sana eşlik ediyorum.</p>
            
             <p className="text-xl font-medium mt-6">
                {hasPhotos ? "Analizini merak ettiğin fotoğrafı yükle." : `Merhaba ${userProfile.name}. Hazırsan ilk fotoğrafını yükle.`}
            </p>

            <div {...getRootProps()} className={cn("relative mt-6 p-10 border-2 border-dashed rounded-xl transition-colors", isDragActive ? "border-primary bg-primary/10" : "border-border")}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Camera className="h-12 w-12" />
                    <p className="text-lg font-semibold text-foreground mt-4">Fotoğrafını sürükle veya yükle</p>
                    <p className="text-sm">JPG, PNG, HEIC desteklenir</p>
                    <Button onClick={open} size="lg" className="mt-6">
                        Fotoğraf Seç
                    </Button>
                </div>
            </div>
        </div>
    );
};


// Main component
export default function PhotoAnalyzer() {
    const { toast } = useToast();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    
    const userDocRef = useMemoFirebase(() => (user && firestore ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);

    const photosQuery = useMemoFirebase(
        () => (user ? query(collection(firestore, 'users', user.uid, 'photos'), limit(1)) : null),
        [user, firestore]
    );
    const { data: photos, isLoading: arePhotosLoading } = useCollection<Photo>(photosQuery);
    
    const hasPhotos = useMemo(() => (photos ? photos.length > 0 : false), [photos]);

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingState, setLoadingState] = useState<'uploading' | 'analyzing' | ''>('');
    const [analysisResult, setAnalysisResult] = useState<PhotoAnalysis | null>(null);
    const [adaptiveFeedback, setAdaptiveFeedback] = useState<string | null>(null);

    // Redirect if not logged in
    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/');
        }
    }, [user, isUserLoading, router]);

    const handleFileSelect = useCallback((selectedFile: File) => {
        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
            toast({ variant: 'destructive', title: "Dosya Boyutu Çok Büyük", description: "Lütfen 10MB'dan küçük bir resim dosyası yükleyin." });
            return;
        }
        if (!selectedFile.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: "Geçersiz Dosya Türü", description: "Lütfen bir resim dosyası yükleyin (örn: JPG, PNG)." });
            return;
        }
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setAnalysisResult(null);
        setAdaptiveFeedback(null);
    }, [toast]);

    const handleUploadAndOptionalAnalysis = async (analyze = false) => {
        if (!file || !user || !firestore || !userProfile) return;

        if (analyze && userProfile.auro_balance < ANALYSIS_COST) {
            toast({ variant: 'destructive', title: "Yetersiz Auro", description: `Bir fotoğrafı analiz etmek için en az ${ANALYSIS_COST} Auro'ya ihtiyacınız var.` });
            return;
        }

        setIsLoading(true);
        setLoadingState('uploading');

        try {
            const storage = getStorage();
            const filePath = `users/${user.uid}/photos/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, filePath);
            const uploadTask = await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(uploadTask.ref);

            const batch = writeBatch(firestore);
            const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'));
            const userRef = doc(firestore, 'users', user.uid);
            
            const today = new Date().toISOString().split('T')[0];
            const statRef = doc(firestore, 'global_stats', `daily_${today}`);

            let photoData: Photo = {
                id: photoDocRef.id,
                userId: user.uid,
                imageUrl,
                filePath,
                createdAt: new Date().toISOString(),
                aiFeedback: null,
                tags: []
            };

            let xpGained = UPLOAD_XP_GAIN;
            batch.update(statRef, { photoUploads: increment(1) });

            if (analyze) {
                setLoadingState('analyzing');
                const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: 'tr' });
                photoData.aiFeedback = analysis;
                photoData.tags = analysis.tags || [];
                setAnalysisResult(analysis);

                const overallScore = Object.values(analysis).reduce((sum, value) => typeof value === 'number' ? sum + normalizeScore(value) : sum, 0) / 6;
                const adaptive = await generateAdaptiveFeedback({
                    userGamificationLevel: userProfile.level_name,
                    language: 'tr',
                    technicalAnalysis: analysis,
                    communicationStyle: userProfile.communication_style || 'balanced',
                    scoreTrend: userProfile.score_history && userProfile.score_history.length > 1 ? 'improving' : 'stagnant',
                    averageScore: userProfile.score_history ? userProfile.score_history.reduce((a,b) => a + b.score, 0) / userProfile.score_history.length : 0,
                    overallScore: overallScore
                });
                photoData.adaptiveFeedback = adaptive.feedback;
                setAdaptiveFeedback(adaptive.feedback);

                batch.update(userRef, { 
                  auro_balance: increment(-ANALYSIS_COST),
                  total_auro_spent: increment(ANALYSIS_COST),
                  total_analyses_count: increment(1)
                });

                batch.update(statRef, { 
                  technicalAnalyses: increment(1),
                  auroSpent: increment(ANALYSIS_COST)
                });

                // Log entry
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
                
                xpGained += 15;
                if(overallScore > 8) {
                    xpGained += 10;
                    toast({ title: "✨ Bonus!", description: "+10 bonus XP kazandın!" });
                }
            } else {
                 toast({ title: "Fotoğraf Yüklendi!", description: "Fotoğrafın galerine eklendi. Dilediğin zaman analiz edebilirsin." });
            }

            batch.set(photoDocRef, photoData);
            batch.update(userRef, { current_xp: increment(xpGained) });
            
            await batch.commit().catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'dashboard-upload-batch',
                    operation: 'write'
                }));
            });

            toast({ title: "XP Kazandın!", description: `${xpGained} XP kazandın.` });

            const oldLevel = getLevelFromXp(userProfile.current_xp);
            const newLevel = getLevelFromXp(userProfile.current_xp + xpGained);
            if (newLevel.name !== oldLevel.name) {
                updateDoc(userRef, { level_name: newLevel.name }).catch(async (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: userRef.path,
                        operation: 'update'
                    }));
                });
                toast({ title: "🎉 Seviye Atladın!", description: `Tebrikler! Yeni seviyen: ${newLevel.name}` });
                if (newLevel.isMentor && !oldLevel.isMentor) {
                    updateDoc(userRef, { is_mentor: true }).catch(async (err) => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: userRef.path,
                            operation: 'update'
                        }));
                    });
                    toast({ title: "👑 Mentor Oldun!", description: "Tebrikler! Artık bir Vexer olarak mentorluk yapabilirsin." });
                }
            }


        } catch (error: any) {
            console.error('Upload/Analysis Error:', error);
            toast({ variant: 'destructive', title: "İşlem Başarısız", description: "Bir hata oluştu." });
        } finally {
            setIsLoading(false);
            setLoadingState('');
            if (!analyze) {
                setFile(null);
                setPreview(null);
            }
        }
    };

    if (isUserLoading || isProfileLoading || arePhotosLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!user || !userProfile) {
        return null; // Effect handles redirect
    }
    
    return (
        <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
                 {!file ? (
                    <Uploader onFileSelect={handleFileSelect} userProfile={userProfile} hasPhotos={hasPhotos} />
                 ) : isLoading ? (
                    <div className="analysis-wrapper">
                        <div className="image-wrapper">
                            <Image src={preview!} alt="Analiz ediliyor" width={512} height={512} className="rounded-lg object-contain aspect-video" />
                        </div>
                        <div className="analysis-text-container">
                            <p className="analysis-text">{loadingState === 'uploading' ? "Fotoğraf yükleniyor..." : "Analiz ediliyor..."}</p>
                            <div className="analysis-progress-bar">
                                <div className="analysis-progress-bar-fill"></div>
                            </div>
                        </div>
                    </div>
                ) : analysisResult ? (
                    <AnalysisResult 
                        analysis={analysisResult} 
                        adaptiveFeedback={adaptiveFeedback} 
                        onNewAnalysis={() => { setFile(null); setPreview(null); setAnalysisResult(null); }}
                    />
                ) : (
                    <Card className="text-center p-8">
                        <div className="max-w-lg mx-auto">
                            <Image src={preview!} alt="Preview" width={512} height={512} className="rounded-lg object-contain aspect-video" unoptimized />
                        </div>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button onClick={() => handleUploadAndOptionalAnalysis(true)} size="lg">
                                <Sparkles className="mr-2" /> Analiz Et ({ANALYSIS_COST} Auro)
                            </Button>
                             <Button onClick={() => handleUploadAndOptionalAnalysis(false)} size="lg" variant="secondary">
                                Sadece Yükle (Ücretsiz)
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
