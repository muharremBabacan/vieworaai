
'use client';
import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc, setDoc, updateDoc, increment, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';
import { useToast } from '@/shared/hooks/use-toast';
import { useLocale, useTranslations, type AbstractIntlMessages } from 'next-intl';

import type { User, Photo, PhotoAnalysis } from '@/types';
import { getLevelFromXp } from '@/lib/gamification';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UploadCloud, Sparkles, Loader2, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  t,
  tRatings,
}: {
  analysis: PhotoAnalysis | null;
  adaptiveFeedback?: string | null;
  onNewAnalysis: () => void;
  t: (key: keyof AbstractIntlMessages['DashboardPage']) => string;
  tRatings: (key: keyof AbstractIntlMessages['Ratings']) => string;
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
        if (normalizeScore(analysis.composition_score) > 7) result.push({ key: 'strength_composition', score: normalizeScore(analysis.composition_score) });
        if (normalizeScore(analysis.light_score) > 7) result.push({ key: 'strength_lighting', score: normalizeScore(analysis.light_score) });
        if (normalizeScore(analysis.focus_score) > 7) result.push({ key: 'strength_focus', score: normalizeScore(analysis.focus_score) });
        if (normalizeScore(analysis.color_control_score) > 7) result.push({ key: 'strength_color', score: normalizeScore(analysis.color_control_score) });
        if (normalizeScore(analysis.background_control_score) > 7) result.push({ key: 'strength_background', score: normalizeScore(analysis.background_control_score) });
        if (normalizeScore(analysis.creativity_risk_score) > 7) result.push({ key: 'strength_creativity', score: normalizeScore(analysis.creativity_risk_score) });
        return result.sort((a, b) => b.score - a.score).slice(0, 3);
    }, [analysis]);
    
    if (!analysis) return null;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
                <div className="flex justify-between items-baseline mb-2">
                    <h3 className="text-2xl font-bold">{tRatings('overall')}</h3>
                    <p className="text-4xl font-bold tracking-tighter text-blue-400">{overallScore.toFixed(1)}</p>
                </div>
                <hr className="border-border mb-6" />
                <div className="space-y-5">
                    <RatingBar label={tRatings('light')} score={lightScore} />
                    <RatingBar label={tRatings('composition')} score={compositionScore} />
                    <RatingBar label={tRatings('technical')} score={technicalScore} />
                </div>
            </Card>
            <div className="space-y-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">{t('ai_analysis_title')}</h3>
                     {adaptiveFeedback ? (
                        <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: adaptiveFeedback.replace(/\n/g, '<br />') }} />
                     ) : (
                        <p className="text-sm text-muted-foreground italic">{analysis.short_neutral_analysis}</p>
                     )}
                </Card>

                {strengths.length > 0 && (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">{t('strengths_title')}</h3>
                        <div className="space-y-3">
                            {strengths.map(strength => (
                                <div key={strength.key} className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 rounded-full">
                                        <Award className="h-5 w-5 text-green-400" />
                                    </div>
                                    <span className="text-sm font-medium">{t(strength.key as any)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Button onClick={onNewAnalysis} className="w-full">{t('button_new_analysis')}</Button>
            </div>
        </div>
    );
};

// Component for the photo uploader
const Uploader = ({ onFileSelect, userProfile, onAnalyze, onUploadOnly, isUploading, t }: { onFileSelect: (file: File) => void, userProfile: User, onAnalyze: () => void, onUploadOnly: () => void, isUploading: boolean, t: (key: keyof AbstractIntlMessages['DashboardPage']) => string; }) => {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: (acceptedFiles) => acceptedFiles.length > 0 && onFileSelect(acceptedFiles[0]),
        noClick: true,
        noKeyboard: true,
        accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.heic', '.webp'] }
    });

    return (
        <div {...getRootProps()} className={cn("relative p-8 border-2 border-dashed rounded-xl text-center transition-colors", isDragActive ? "border-primary bg-primary/10" : "border-border")}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Sparkles className="h-12 w-12" />
                <h2 className="text-xl font-semibold text-foreground">{t('greeting_title', { name: userProfile.name })}</h2>
                <p className="text-foreground">{t('greeting_subtitle')}</p>
                <p>{t('greeting_desc_1')}</p>
                <p className="max-w-md">{t('greeting_desc_2')}</p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button onClick={open} size="lg" className="w-full sm:w-auto">
                    <UploadCloud className="mr-2" /> {t('button_select_photo')}
                </Button>
                <Button onClick={onAnalyze} size="lg" variant="outline" className="w-full sm:w-auto" disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />} {t('button_analyze', { cost: ANALYSIS_COST })}
                </Button>
                 <Button onClick={onUploadOnly} size="lg" variant="secondary" className="w-full sm:w-auto" disabled={isUploading}>
                    {t('button_upload_only')}
                </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-4">{t('upload_prompt_sub_new')}</p>
        </div>
    );
};

// Main component
export default function PhotoAnalyzer() {
    const t = useTranslations('DashboardPage');
    const tRatings = useTranslations('Ratings');
    const locale = useLocale();
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    
    const userDocRef = useMemoFirebase(() => (user && firestore ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
    const { data: userProfile } = useDoc<User>(userDocRef);

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingState, setLoadingState] = useState<'uploading' | 'analyzing' | ''>('');
    const [analysisResult, setAnalysisResult] = useState<PhotoAnalysis | null>(null);
    const [adaptiveFeedback, setAdaptiveFeedback] = useState<string | null>(null);


    const handleFileSelect = useCallback((selectedFile: File) => {
        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
            toast({ variant: 'destructive', title: t('toast_file_size_title'), description: t('toast_file_size_description') });
            return;
        }
        if (!selectedFile.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: t('toast_invalid_file_title'), description: t('toast_invalid_file_description') });
            return;
        }
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setAnalysisResult(null);
        setAdaptiveFeedback(null);
    }, [toast, t]);

    const handleUploadAndOptionalAnalysis = async (analyze = false) => {
        if (!file || !user || !firestore || !userProfile) return;

        if (analyze && userProfile.auro_balance < ANALYSIS_COST) {
            toast({ variant: 'destructive', title: t('toast_insufficient_auro_title'), description: t('toast_insufficient_auro_description', { cost: ANALYSIS_COST }) });
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
            
            let photoData: Photo = {
                id: photoDocRef.id,
                userId: user.uid,
                imageUrl,
                filePath,
                createdAt: new Date().toISOString(),
                aiFeedback: null
            };

            let xpGained = UPLOAD_XP_GAIN;

            if (analyze) {
                setLoadingState('analyzing');
                const analysis = await generatePhotoAnalysis({ photoUrl: imageUrl, language: locale });
                photoData.aiFeedback = analysis;
                setAnalysisResult(analysis);

                // Generate adaptive feedback
                const overallScore = Object.values(analysis).reduce((sum, value) => typeof value === 'number' ? sum + normalizeScore(value) : sum, 0) / 6;
                const adaptive = await generateAdaptiveFeedback({
                    userGamificationLevel: userProfile.level_name,
                    language: locale,
                    technicalAnalysis: analysis,
                    communicationStyle: userProfile.communication_style || 'balanced',
                    scoreTrend: userProfile.score_history && userProfile.score_history.length > 1 ? 'improving' : 'stagnant',
                    averageScore: userProfile.score_history ? userProfile.score_history.reduce((a,b) => a + b.score, 0) / userProfile.score_history.length : 0,
                    overallScore: overallScore
                });
                photoData.adaptiveFeedback = adaptive.feedback;
                setAdaptiveFeedback(adaptive.feedback);

                batch.update(userRef, { auro_balance: increment(-ANALYSIS_COST) });
                
                xpGained += 15; // Extra XP for analysis
                if(overallScore > 8) {
                    xpGained += 10; // Bonus for high score
                    toast({ title: t('toast_bonus_title'), description: t('toast_bonus_description', { xp: 10 }) });
                }
            } else {
                 toast({ title: t('toast_upload_only_title'), description: t('toast_upload_only_description') });
            }

            batch.set(photoDocRef, photoData);
            batch.update(userRef, { current_xp: increment(xpGained) });
            
            await batch.commit();
            toast({ title: t('toast_xp_gain_title'), description: t('toast_xp_gain_description', { xp: xpGained }) });

            // Check for level up
            const oldLevel = getLevelFromXp(userProfile.current_xp);
            const newLevel = getLevelFromXp(userProfile.current_xp + xpGained);
            if (newLevel.name !== oldLevel.name) {
                await updateDoc(userRef, { level_name: newLevel.name });
                toast({ title: t('toast_level_up_title'), description: t('toast_level_up_description', { level: newLevel.name }) });
                if (newLevel.isMentor && !oldLevel.isMentor) {
                    await updateDoc(userRef, { is_mentor: true });
                    toast({ title: t('toast_mentor_title'), description: t('toast_mentor_description') });
                }
            }


        } catch (error: any) {
            console.error('Upload/Analysis Error:', error);
            const toastErrorKey = analyze ? 'toast_analysis_fail' : 'toast_upload_fail';
            toast({ variant: 'destructive', title: t(`${toastErrorKey}_title`), description: t(`${toastErrorKey}_description`) });
        } finally {
            setIsLoading(false);
            setLoadingState('');
            if (!analyze) {
                setFile(null);
                setPreview(null);
            }
        }
    };

    if (!userProfile) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="container mx-auto">
            <div className="mx-auto max-w-4xl">
                 {!file ? (
                    <Uploader onFileSelect={handleFileSelect} userProfile={userProfile} onAnalyze={() => { if(file) handleUploadAndOptionalAnalysis(true) }} onUploadOnly={() => { if(file) handleUploadAndOptionalAnalysis(false) }} isUploading={isLoading} t={t} />
                 ) : isLoading ? (
                    <div className="analysis-wrapper">
                        <div className="image-wrapper">
                            <Image src={preview!} alt="Analiz ediliyor" width={512} height={512} className="rounded-lg object-contain aspect-video" />
                        </div>
                        <div className="analysis-text-container">
                            <p className="analysis-text">{loadingState === 'uploading' ? t('state_uploading') : t('state_analyzing')}</p>
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
                        t={t}
                        tRatings={tRatings}
                    />
                ) : (
                    <Card className="text-center p-8">
                        <div className="max-w-lg mx-auto">
                            <Image src={preview!} alt="Preview" width={512} height={512} className="rounded-lg object-contain aspect-video" />
                        </div>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button onClick={() => handleUploadAndOptionalAnalysis(true)} size="lg">
                                <Sparkles className="mr-2" /> {t('button_analyze', { cost: ANALYSIS_COST })}
                            </Button>
                             <Button onClick={() => handleUploadAndOptionalAnalysis(false)} size="lg" variant="secondary">
                                {t('button_upload_only')}
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
