
import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion, Firestore } from 'firebase/firestore';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';
import { uploadAndProcessImage } from '@/lib/image/actions';
import { prepareOptimizedFile, generateImageHash } from '@/lib/image/image-optimizer';
import { User, Photo, UserTier } from '@/types';

export const TIER_COSTS: Record<UserTier, number> = {
  start: 1,
  pro: 2,
  master: 3
};

export const normalizeScore = (score: number | undefined | null): number => {
  if (score === undefined || score === null || !isFinite(score)) return 0;
  return score > 1 ? score : score * 10;
};

export const getOverallScore = (photo: Photo): number => {
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

export const updateUserProfileIndex = async (firestore: Firestore, userId: string, newOverallScore: number) => {
  const photosRef = collection(firestore, 'users', userId, 'photos');
  const q = query(photosRef, where('aiFeedback', '!=', null), orderBy('createdAt', 'desc'), limit(12));
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
  const mean = totals.overall.reduce((a, b) => a + b, 0) / count;
  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    'profile_index.technical': technicalMetrics,
    'profile_index.profile_index_score': mean * 10,
    score_history: arrayUnion({ score: newOverallScore, date: new Date().toISOString() })
  });
};

export type AnalysisFlowOptions = {
  file: File;
  analyze: boolean;
  user: any;
  userProfile: User | null;
  firestore: Firestore;
  locale: string;
  guestId: string | null;
  guestUsed: boolean;
  currentTier: UserTier;
  onSuccess: (result: Photo) => void;
  onUploadOnly: () => void;
  onMarketingRequired: () => void;
  onResolutionRequired: (dimensions: { width: number; height: number }) => void;
  onError: (error: any) => void;
};

export const executePhotoAnalysisFlow = async (options: AnalysisFlowOptions) => {
  const { 
    file, analyze, user, userProfile, firestore, locale, 
    guestId, guestUsed, currentTier, 
    onSuccess, onUploadOnly, onMarketingRequired, onResolutionRequired, onError 
  } = options;

  const analysisCost = TIER_COSTS[currentTier];

  // 1. Context & Balance Check
  if (!user) {
    if (guestUsed || !analyze) {
      onMarketingRequired();
      return;
    }
  } else {
    const currentBalance = userProfile?.pix_balance || 0;
    if (analyze && currentBalance < analysisCost) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
  }

  try {
    const photoId = doc(collection(firestore, 'photos')).id;

    // 2. Optimization & Hash
    const optimizedFile = await prepareOptimizedFile(file, 1600);
    const hash = await generateImageHash(optimizedFile);

    // 3. Duplicate Check
    if (user) {
      const q = query(
        collection(firestore, 'users', user.uid, 'photos'),
        where('imageHash', '==', hash)
      );
      const dupSnap = await getDocs(q);
      if (!dupSnap.empty) {
        const existingPhoto = dupSnap.docs[0].data() as Photo;
        if (existingPhoto.aiFeedback) {
          onSuccess(existingPhoto);
          return;
        }
        if (analyze) {
           // Analyze existing but unanalyzed photo
           const analysis = await generatePhotoAnalysis({
             photoUrl: existingPhoto.imageUrls?.analysis || existingPhoto.imageUrl,
             language: locale,
             tier: currentTier
           });
           await updateDoc(dupSnap.docs[0].ref, {
             aiFeedback: analysis,
             tags: analysis.tags || [],
             analysisTier: currentTier
           });
           onSuccess({ ...existingPhoto, aiFeedback: analysis });
           return;
        }
        onUploadOnly();
        return;
      }
    }

    // 4. Upload
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const currentUserId = user?.uid || guestId || 'anonymous';
    const imageUrls = await uploadAndProcessImage(formData, currentUserId, photoId, 'photos');

    // 5. Data Prep
    const photoData: Photo = {
      id: photoId,
      userId: currentUserId,
      imageUrl: imageUrls.analysis,
      imageUrls,
      imageHash: hash,
      createdAt: new Date().toISOString(),
      aiFeedback: null,
      tags: []
    };

    // 6. Analysis OR Save
    if (analyze) {
      const analysis = await generatePhotoAnalysis({
        photoUrl: imageUrls.analysis,
        language: locale,
        tier: currentTier,
        guestId: !user ? (guestId || undefined) : undefined
      });

      photoData.aiFeedback = analysis;
      photoData.analysisTier = currentTier;

      if (user) {
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const userRef = doc(firestore, 'users', user.uid);
        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(userRef, {
          pix_balance: increment(-analysisCost),
          total_analyses_count: increment(1)
        });
        await batch.commit();
        
        // Background Index Update
        updateUserProfileIndex(firestore, user.uid, getOverallScore(photoData)).catch(err => 
          console.error('[photo-flow] Index update failed:', err)
        );
      }
      onSuccess(photoData);
    } else {
      if (user) {
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const userRef = doc(firestore, 'users', user.uid);
        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(userRef, { current_xp: increment(5) });
        await batch.commit();
      }
      onUploadOnly();
    }
  } catch (error: any) {
    onError(error);
  }
};
