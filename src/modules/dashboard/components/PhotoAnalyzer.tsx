'use client';
import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/lib/firebase';
import { doc, increment, collection, writeBatch, query, limit, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';
import { useToast } from '@/shared/hooks/use-toast';
import { useRouter } from 'next/navigation';

import type { User, Photo, PhotoAnalysis, AnalysisLog } from '@/types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Camera, Loader2, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const ANALYSIS_COST = 1;
const UPLOAD_XP_GAIN = 5;

const normalizeScore = (score: number | undefined | null): number => {
    if (score === undefined || score === null || !isFinite(score)) return 0;
    return score > 1 ? score : score * 10;
};

const RatingBar = ({ label, score }: { label: string, score: number | undefined }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold">{score?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <Progress value={(score ?? 0) * 10} className="h-2" />
    </div>
);

const AnalysisResult = ({ analysis, adaptiveFeedback, onNewAnalysis }: { analysis: PhotoAnalysis | null; adaptiveFeedback?: string | null; onNewAnalysis: () => void; }) => {
    const { overallScore, technicalScore, lightScore, compositionScore } = useMemo(() => {
        if (!analysis) return { overallScore: 0, technicalScore: 0, lightScore: 0, compositionScore: 0 };
        const lScore = normalizeScore(analysis.light_score);
        const cScore = normalizeScore(analysis.composition_score);
        const technicalSubScores = [normalizeScore(analysis.focus_score), normalizeScore(analysis.color_control_score), normalizeScore(analysis.background_control_score)];
        const tScore = technicalSubScores.reduce((sum, s) => sum + s, 0) / technicalSubScores.length;
        const ovScore = (lScore + cScore + tScore) / 3;
        return { overallScore: ovScore, technicalScore: tScore, lightScore: lScore, compositionScore: cScore };
    }, [analysis]);

    if (!analysis) return null;

    return (
        <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="space-y-6">
                <Card className="p-8 border-primary/20 bg-primary/5 rounded-[32px]">
                    <div className="flex justify-between items-baseline mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Genel Puan</h3>
                        <div className="flex items-center gap-2">
                            <Star className="h-6 w-6 text-primary fill-current" />
                            <p className="text-5xl font-black tracking-tighter text-primary">{overallScore.toFixed(1)}</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <RatingBar label="Işık" score={lightScore} />
                        <RatingBar label="Kompozisyon" score={compositionScore} />
                        <RatingBar label="Teknik" score={technicalScore} />
                    </div>
                </Card>
                {analysis.tags && (
                    <div className="flex flex-wrap gap-2">
                        {analysis.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="bg-secondary/50 text-[10px] font-black uppercase px-3 h-6 border-none">{tag}</Badge>
                        ))}
                    </div>
                )}
            </div>
            <div className="space-y-6">
                <Card className="p-8 rounded-[32px] border-border/40 bg-card/50">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6">Analiz Geri Bildirimi</h3>
                    <div className="prose prose-sm dark:prose-invert leading-relaxed italic text-foreground/90" dangerouslySetInnerHTML={{ __html: (adaptiveFeedback || analysis.short_neutral_analysis).replace(/\n/g, '<br />') }} />
                </Card>
                <Button onClick={onNewAnalysis} size="lg" className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/10">Yeni Analiz Başlat</Button>
            </div>
        </div>
    );
};

const Uploader = ({ onFileSelect, userProfile, hasPhotos }: { onFileSelect: (file: File) => void, userProfile: User, hasPhotos: boolean }) => {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: (acceptedFiles) => acceptedFiles.length > 0 && onFileSelect(acceptedFiles[0]),
        noClick: true, noKeyboard: true, accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.heic', '.webp'] }
    });
    return (
        <div className="text-center max-w-xl mx-auto pt-8 animate-in zoom-in duration-500">
            <p className="text-3xl font-black tracking-tight mb-2">Analizini merak ettiğin fotoğrafı yükle.</p>
            <p className="text-muted-foreground text-sm font-medium mb-10">Vizyonunu geliştirmek için teknik detayları keşfedelim.</p>
            
            <div {...getRootProps()} className={cn("relative p-12 border-2 border-dashed rounded-[40px] transition-all duration-500", isDragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-border/60 hover:border-primary/40 bg-card/30 shadow-inner")}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-24 w-24 rounded-[32px] bg-secondary/50 border border-border/40 flex items-center justify-center mb-6 shadow-sm">
                        <Camera className="h-10 w-10 text-muted-foreground/60" />
                    </div>
                    <p className="text-xl font-bold text-foreground">Sürükle veya yükle</p>
                    <p className="text-sm font-medium">JPG, PNG, HEIC desteklenir (Max 10MB)</p>
                    <Button onClick={open} size="lg" className="mt-10 h-12 px-10 rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all active:scale-95">Fotoğraf Seç</Button>
                </div>
            </div>
        </div>
    );
};

export default function PhotoAnalyzer() {
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const userDocRef = useMemoFirebase(() => (user && firestore ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
    const photosQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'photos'), limit(1)) : null), [user, firestore]);
    const { data: photos } = useCollection<Photo>(photosQuery);
    const hasPhotos = useMemo(() => (photos ? photos.length > 0 : false), [photos]);

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingState, setLoadingState] = useState<'uploading' | 'analyzing' | ''>('');
    const [analysisResult, setAnalysisResult] = useState<PhotoAnalysis | null>(null);
    const [adaptiveFeedback, setAdaptiveFeedback] = useState<string | null>(null);

    const handleFileSelect = useCallback((selectedFile: File) => {
        if (selectedFile.size > 10 * 1024 * 1024) { toast({ variant: 'destructive', title: "Dosya Çok Büyük" }); return; }
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setAnalysisResult(null);
        setAdaptiveFeedback(null);
    }, [toast]);

    const handleUploadAndOptionalAnalysis = async (analyze = false) => {
        if (!file || !user || !firestore || !userProfile) return;
        if (analyze && userProfile.auro_balance < ANALYSIS_COST) { toast({ variant: 'destructive', title: "Yetersiz Auro" }); return; }
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
            
            let photoData: Photo = { id: photoDocRef.id, userId: user.uid, imageUrl, filePath, createdAt: new Date().toISOString(), aiFeedback: null, tags: [] };
            let xpGained = UPLOAD_XP_GAIN;
            
            batch.set(statRef, { photoUploads: increment(1), date: today }, { merge: true });
            
            if (analyze) {
                setLoadingState('analyzing');
                const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: 'tr' });
                photoData.aiFeedback = analysis;
                photoData.tags = analysis.tags || [];
                setAnalysisResult(analysis);
                
                const adaptive = await generateAdaptiveFeedback({ 
                    userGamificationLevel: userProfile.level_name, 
                    language: 'tr', 
                    technicalAnalysis: analysis, 
                    communicationStyle: userProfile.communication_style || 'balanced', 
                    scoreTrend: 'stagnant', 
                    averageScore: 0, 
                    overallScore: 7 
                });
                photoData.adaptiveFeedback = adaptive.feedback;
                setAdaptiveFeedback(adaptive.feedback);
                
                batch.update(userRef, { auro_balance: increment(-ANALYSIS_COST), total_auro_spent: increment(ANALYSIS_COST), total_analyses_count: increment(1) });
                batch.set(statRef, { technicalAnalyses: increment(1), auroSpent: increment(ANALYSIS_COST) }, { merge: true });
                
                const logRef = doc(collection(firestore, 'analysis_logs'));
                batch.set(logRef, { id: logRef.id, userId: user.uid, userName: userProfile.name || 'Sanatçı', type: 'technical', auroSpent: ANALYSIS_COST, timestamp: new Date().toISOString(), status: 'success' });
                xpGained += 15;
            }
            
            batch.set(photoDocRef, photoData);
            batch.update(userRef, { current_xp: increment(xpGained) });
            await batch.commit();
            toast({ title: analyze ? "Analiz Tamamlandı" : "Fotoğraf Yüklendi" });
        } catch (error) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsLoading(false); setLoadingState(''); }
    };

    if (isUserLoading || isProfileLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!user || !userProfile) return null;
    
    return (
        <div className="container mx-auto px-4"><div className="mx-auto max-w-4xl">
            {!file ? (<Uploader onFileSelect= {handleFileSelect} userProfile={userProfile} hasPhotos={hasPhotos} />) : isLoading ? (
                <div className="analysis-wrapper"><div className="image-wrapper"><Image src={preview!} alt="Process" width={512} height={512} className="rounded-[24px] object-contain aspect-video" unoptimized /></div><div className="analysis-text-container"><p className="analysis-text font-bold tracking-tight">{loadingState === 'uploading' ? "Fotoğraf Hazırlanıyor..." : "Luma Analiz Ediyor..."}</p><div className="analysis-progress-bar"><div className="analysis-progress-bar-fill"></div></div></div></div>
            ) : analysisResult ? (<AnalysisResult analysis={analysisResult} adaptiveFeedback={adaptiveFeedback} onNewAnalysis={() => { setFile(null); setPreview(null); setAnalysisResult(null); }} />) : (
                <Card className="text-center p-10 bg-card/50 rounded-[40px] border-border/40 overflow-hidden shadow-2xl animate-in zoom-in duration-500">
                    <div className="max-w-lg mx-auto relative rounded-3xl overflow-hidden shadow-2xl border border-white/5"><Image src={preview!} alt="Preview" width={512} height={512} className="object-contain aspect-video" unoptimized /></div>
                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button onClick={() => handleUploadAndOptionalAnalysis(true)} size="lg" className="h-14 px-10 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 transition-all active:scale-95 group">
                            <Sparkles className="mr-2 group-hover:animate-pulse" /> Analiz Et ({ANALYSIS_COST} Auro)
                        </Button>
                        <Button onClick={() => handleUploadAndOptionalAnalysis(false)} size="lg" variant="secondary" className="h-14 px-10 rounded-2xl font-bold text-lg transition-all active:scale-95">Sadece Yükle</Button>
                    </div>
                </Card>
            )}
        </div></div>
    );
}
