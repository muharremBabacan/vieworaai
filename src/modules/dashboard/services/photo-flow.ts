
import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion, Firestore } from 'firebase/firestore';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';
import { uploadAndProcessImage } from '@/lib/image/actions';
import { prepareOptimizedFile, generateImageHash, getImageDimensions } from '@/lib/image/image-processing-final';
import { User, Photo, UserTier } from '@/types';
import { serializeData } from '@/lib/utils';

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


export type FlowResult =
  | { type: 'success'; data: Photo }
  | { type: 'upload_only' }
  | { type: 'resolution_error'; dims: { width: number; height: number } }
  | { type: 'marketing_required' }
  | { type: 'error'; code: string; message?: string };

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
};

export const executePhotoAnalysisFlow = async (options: AnalysisFlowOptions): Promise<FlowResult> => {
  const { 
    file, analyze, user, userProfile, firestore, locale, 
    guestId, guestUsed, currentTier
  } = options;

  console.log('🚀 [photo-flow] STARTING FLOW', { 
    analyze, 
    userId: user?.uid || 'guest', 
    guestId, 
    locale, 
    tier: currentTier,
    fileSize: file?.size,
    fileType: file?.type 
  });

  // 0. HARD GUARDS
  if (!file) {
    console.error('❌ [photo-flow] FATAL: No file provided');
    return { type: 'error', code: 'MISSING_FILE' };
  }
  if (!firestore) {
    console.error('❌ [photo-flow] FATAL: Firestore instance is missing');
    return { type: 'error', code: 'FIRESTORE_NOT_INITIALIZED' };
  }

  const analysisCost = TIER_COSTS[currentTier] || 1;

  // 1. Initial Checks & Context
  if (!user) {
    console.log('📍 [photo-flow] Context: Guest User');
    if (guestUsed || !analyze) {
      console.warn('⚠️ [photo-flow] Guest limit reached or analysis disabled');
      return { type: 'marketing_required' };
    }
  } else {
    console.log('📍 [photo-flow] Context: Registered User', { balance: userProfile?.pix_balance });
    const currentBalance = userProfile?.pix_balance || 0;
    
    if (analyze && currentBalance < analysisCost) {
      console.warn('⚠️ [photo-flow] Insufficient balance for user:', user.uid);
      return { type: 'error', code: 'INSUFFICIENT_BALANCE' };
    }
  }

  try {
    const photoId = doc(collection(firestore, 'photos')).id;
    console.log('📦 [photo-flow] STEP 1: Generated Photo ID:', photoId);

    // 2. Hash & Optimization
    console.log('⚙️ [photo-flow] STEP 2: Processing image (hash/dims/optimization)...');
    const hash = await generateImageHash(file);
    const dims = await getImageDimensions(file);
    console.log('📊 [photo-flow] Image stats:', { hash, dims });

    let optimizedFile: File;
    try {
      optimizedFile = await prepareOptimizedFile(file, 1600);
      console.log('✅ [photo-flow] Optimization complete');
    } catch (err: any) {
      console.error('❌ [photo-flow] Optimization failed:', err?.message);
      if (err?.message === 'PHOTO_TOO_SMALL') {
        return { type: 'resolution_error', dims };
      }
      throw err || new Error('Optimization failed');
    }

    // 3. Duplicate Check
    if (user) {
      console.log('🔍 [photo-flow] STEP 3: Performing duplicate check...');
      const q = query(
        collection(firestore, 'users', user.uid, 'photos'),
        where('imageHash', '==', hash)
      );
      const dupSnap = await getDocs(q);
      if (!dupSnap.empty) {
        console.log('♻️ [photo-flow] Duplicate found in library');
        const existingData = dupSnap.docs[0].data();
        if (!existingData) throw new Error('DUPLICATE_DATA_MISSING');
        
        const existingPhoto = serializeData(existingData) as Photo;
        
        if (existingPhoto.aiFeedback) {
          console.log('✅ [photo-flow] Returning existing analyzed photo');
          return { type: 'success', data: { ...existingPhoto, id: dupSnap.docs[0].id } };
        }
        
        if (analyze) {
           console.log('🤖 [photo-flow] Re-analyzing existing photo...');
           const analysis = await generatePhotoAnalysis({
             photoUrl: existingPhoto.imageUrls?.analysis || existingPhoto.imageUrl,
             language: locale,
             tier: currentTier,
             guestId: undefined
           });

           if (!analysis) throw new Error('AI_ANALYSIS_FAILED');

           console.log('💾 [photo-flow] Updating existing record with AI feedback');
           const batch = writeBatch(firestore);
           batch.update(dupSnap.docs[0].ref, {
             aiFeedback: analysis,
             tags: analysis.tags || [],
             analysisTier: currentTier
           });
           
           const userRef = doc(firestore, 'users', user.uid);
           batch.update(userRef, {
             pix_balance: increment(-analysisCost),
             total_analyses_count: increment(1)
           });
           
           await batch.commit();
           console.log('✅ [photo-flow] Batch update complete');

           updateUserProfileIndex(firestore, user.uid, getOverallScore({ ...existingPhoto, aiFeedback: analysis } as Photo)).catch(err => 
             console.error('⚠️ [photo-flow] Index update failed:', err)
           );

           return { type: 'success', data: serializeData({ ...existingPhoto, aiFeedback: analysis, id: dupSnap.docs[0].id }) };
        }
        console.log('✅ [photo-flow] Returning upload-only for duplicate');
        return { type: 'upload_only' };
      }
    }

    // 4. Upload
    console.log('☁️ [photo-flow] STEP 4: Uploading to storage...');
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const currentUserId = user?.uid || guestId || 'anonymous';
    const imageUrls = await uploadAndProcessImage(formData, currentUserId, photoId, 'photos');
    
    if (!imageUrls?.analysis) {
      throw new Error('UPLOAD_FAILED_NO_URL');
    }
    console.log('✅ [photo-flow] Upload successful:', imageUrls.analysis);

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
      console.log('🤖 [photo-flow] STEP 5: Starting AI analysis...');
      const analysis = await generatePhotoAnalysis({
        photoUrl: imageUrls.analysis,
        language: locale,
        tier: currentTier,
        guestId: !user ? (guestId || undefined) : undefined
      });

      if (!analysis) throw new Error('AI_ANALYSIS_RETURNED_NULL');
      console.log('✅ [photo-flow] AI Analysis complete');

      photoData.aiFeedback = analysis;
      photoData.analysisTier = currentTier;

      if (user) {
        console.log('💾 [photo-flow] STEP 6: Saving to Firestore (Batch)...');
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const userRef = doc(firestore, 'users', user.uid);
        const batch = writeBatch(firestore);
        
        batch.set(photoDocRef, photoData);
        batch.update(userRef, {
          pix_balance: increment(-analysisCost),
          total_analyses_count: increment(1)
        });
        
        await batch.commit();
        console.log('✅ [photo-flow] Save complete');
        
        updateUserProfileIndex(firestore, user.uid, getOverallScore(photoData)).catch(err => 
          console.error('⚠️ [photo-flow] Index update failed:', err)
        );
      }
      return { type: 'success', data: serializeData(photoData) };
    } else {
      if (user) {
        console.log('💾 [photo-flow] STEP 5: Saving upload-only to Firestore...');
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const userRef = doc(firestore, 'users', user.uid);
        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(userRef, { current_xp: increment(5) });
        await batch.commit();
        console.log('✅ [photo-flow] Upload-only save complete');
      }
      return { type: 'upload_only' };
    }
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown fatal error in photo-flow';
    console.error('🔥 [photo-flow] FATAL ERROR:', { 
      message: errorMsg, 
      code: error?.code,
      stack: error?.stack?.substring(0, 200) 
    });
    return { 
      type: 'error', 
      code: error?.code || 'EXECUTION_FAILED', 
      message: errorMsg 
    };
  }
};

