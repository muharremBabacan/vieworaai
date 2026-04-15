
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

  let lastSuccessfulStep = 'INITIALIZATION';

  console.log('🚀 [photo-flow] STARTING NUCLEAR FLOW', {
    analyze,
    userId: user?.uid || 'guest',
    guestId,
    locale,
    tier: currentTier,
    fileSize: file?.size,
    fileType: file?.type
  });

  try {
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
    console.log('📍 [photo-flow] STEP 1: Context validation...');
    if (!user) {
      if (guestUsed || !analyze) {
        console.warn('⚠️ [photo-flow] Guest limit reached or analysis disabled');
        return { type: 'marketing_required' };
      }
    } else {
      const currentBalance = userProfile?.pix_balance || 0;
      if (analyze && currentBalance < analysisCost) {
        console.warn('⚠️ [photo-flow] Insufficient balance');
        return { type: 'error', code: 'INSUFFICIENT_BALANCE' };
      }
    }
    lastSuccessfulStep = 'STEP_1_CONTEXT_OK';

    // 2. Photo ID generation
    const photoId = doc(collection(firestore, 'photos')).id;
    console.log('📦 [photo-flow] STEP 2: Photo ID:', photoId);
    lastSuccessfulStep = 'STEP_2_ID_GENERATED';

    // 3. Hash & Optimization
    console.log('⚙️ [photo-flow] STEP 3: Generating Image Hash...');
    const hash = await generateImageHash(file);
    console.log('✅ [photo-flow] Hash calculated:', hash);
    lastSuccessfulStep = 'STEP_3A_HASH_OK';

    console.log('⚙️ [photo-flow] STEP 3B: Getting Dimensions...');
    const dims = await getImageDimensions(file);
    console.log('📊 [photo-flow] Dimensions:', dims);
    lastSuccessfulStep = 'STEP_3B_DIMS_OK';

    console.log('⚙️ [photo-flow] STEP 3C: Optimizing/Resizing (1600px)...');
    let optimizedFile: File;
    try {
      optimizedFile = await prepareOptimizedFile(file, 1600);
      console.log('✅ [photo-flow] Optimization complete. New size:', optimizedFile.size);
    } catch (err: any) {
      console.error('❌ [photo-flow] Image optimization failed:', err?.message);
      if (err?.message === 'PHOTO_TOO_SMALL') {
        return { type: 'resolution_error', dims };
      }
      throw err;
    }
    lastSuccessfulStep = 'STEP_3C_OPTIMIZATION_OK';

    // 4. Duplicate Check
    if (user) {
      console.log('🔍 [photo-flow] STEP 4: Checking for duplicates in user library...');
      const q = query(
        collection(firestore, 'users', user.uid, 'photos'),
        where('imageHash', '==', hash)
      );
      const dupSnap = await getDocs(q);

      if (!dupSnap.empty) {
        console.log('♻️ [photo-flow] Duplicate found. ID:', dupSnap.docs[0].id);
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

          console.log('💾 [photo-flow] Saving analysis to existing record...');
          const batch = writeBatch(firestore);
          batch.update(dupSnap.docs[0].ref, {
            aiFeedback: analysis,
            tags: analysis.tags || [],
            analysisTier: currentTier
          });

          batch.update(doc(firestore, 'users', user.uid), {
            pix_balance: increment(-analysisCost),
            total_analyses_count: increment(1)
          });

          await batch.commit();
          console.log('✅ [photo-flow] Duplicate analysis saved');

          updateUserProfileIndex(firestore, user.uid, getOverallScore({ ...existingPhoto, aiFeedback: analysis } as Photo)).catch(e =>
            console.error('⚠️ [photo-flow] Index update error:', e)
          );

          return { type: 'success', data: serializeData({ ...existingPhoto, aiFeedback: analysis, id: dupSnap.docs[0].id }) };
        }
        return { type: 'upload_only' };
      }
    }
    lastSuccessfulStep = 'STEP_4_DUPLICATE_CHECK_OK';

    // 5. Upload
    console.log('[FLOW-DEBUG] STEP 5: Calling Server Action (Upload)...');
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const currentUserId = user?.uid || guestId || 'anonymous';

    const imageUrls = await uploadAndProcessImage(formData, currentUserId, photoId, 'photos').catch(e => {
      console.error('[FLOW-ERROR] Upload Server Action failed:', e.message);
      throw e;
    });

    if (!imageUrls?.analysis) {
      console.error('[FLOW-ERROR] Upload succeeded but analysis URL is missing');
      throw new Error('UPLOAD_SERVER_ACTION_RETURNED_EMPTY_URLS');
    }
    console.log('[FLOW-DEBUG] Upload successful. URL:', imageUrls.analysis);
    lastSuccessfulStep = 'STEP_5_UPLOAD_OK';

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

    // 6. Analysis
    // 6. Analysis
    if (analyze) {
      console.log('[FLOW-DEBUG] STEP 6: Starting AI Analysis...');

      // 🛡️ Hard Guard
      if (!imageUrls.analysis) {
        throw new Error("photoUrl missing before AI call");
      }

      let analysis = null; // 🔴 BURASI ÖNEMLİ

      try {
        console.log('[FLOW-DEBUG] STEP 6: Calling AI...');

        const raw = await generatePhotoAnalysis({
          photoUrl: imageUrls.analysis,
          language: locale,
          tier: currentTier,
          guestId: !user ? (guestId || undefined) : undefined
        });

        if (!raw) {
          throw new Error('AI_EMPTY_RESPONSE');
        }

        // 🛡️ JSON güvenliği
        if (typeof raw === 'string') {
          try {
            analysis = JSON.parse(raw);
          } catch (e) {
            console.error('[AI ERROR] JSON PARSE FAILED:', raw);
            throw new Error('AI_INVALID_JSON');
          }
        } else {
          analysis = raw;
        }

      } catch (e: any) {
        console.error('🔥 [AI FAILSAFE TRIGGERED]', {
          message: e?.message,
          stack: e?.stack
        });

        // 💡 FALLBACK → sistem çökmez
        analysis = {
          light_score: 0,
          composition_score: 0,
          technical_clarity_score: 0,
          storytelling_score: 0,
          boldness_score: 0,
          tags: ['analysis_failed'],
          summary: 'AI analysis failed. Please retry.'
        };
      }

      console.log(
        '[FLOW-DEBUG] AI Analysis Result:',
        JSON.stringify(analysis).substring(0, 100) + '...'
      );

      photoData.aiFeedback = analysis;
      photoData.analysisTier = currentTier;

      if (user) {
        console.log('[FLOW-DEBUG] STEP 7: Saving to Firestore...');
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const userRef = doc(firestore, 'users', user.uid);
        const batch = writeBatch(firestore);

        batch.set(photoDocRef, photoData);
        batch.update(userRef, {
          pix_balance: increment(-analysisCost),
          total_analyses_count: increment(1)
        });

        await batch.commit().catch(e => {
          console.error('[FLOW-ERROR] Firestore batch commit failed:', e.message);
          throw e;
        });
        console.log('[FLOW-DEBUG] Flow Complete. Overall Score:', getOverallScore(photoData));

        updateUserProfileIndex(firestore, user.uid, getOverallScore(photoData)).catch(e =>
          console.error('[FLOW-ERROR] Profile index update failure:', e.message)
        );
      }
      lastSuccessfulStep = 'STEP_7_COMPLETE';
      return { type: 'success', data: serializeData(photoData) };
    } else {
      if (user) {
        console.log('[FLOW-DEBUG] STEP 6: Saving upload-only entry...');
        const photoDocRef = doc(collection(firestore, 'users', user.uid, 'photos'), photoId);
        const batch = writeBatch(firestore);
        batch.set(photoDocRef, photoData);
        batch.update(doc(firestore, 'users', user.uid), { current_xp: increment(5) });
        await batch.commit().catch(e => {
          console.error('[FLOW-ERROR] Upload-only commit failed:', e.message);
          throw e;
        });
        console.log('[FLOW-DEBUG] Upload-only save complete');
      }
      lastSuccessfulStep = 'STEP_6_UPLOAD_ONLY_COMPLETE';
      return { type: 'upload_only' };
    }
  }
  catch (error: any) {
    console.error('🚨 [photo-flow] CRITICAL EXCEPTION CAUGHT');

    console.error('STEP:', lastSuccessfulStep);

    console.error('ERROR DETAILS:', {
      message: error?.message,
      code: error?.code,
      digest: error?.digest,
      name: error?.name,
      stack: error?.stack,
    });

    if (error?.cause) {
      console.error('CAUSE:', error.cause);
    }

    console.error('CONTEXT:', {
      userId: user?.uid || guestId || 'anonymous',
      analyze,
      locale,
      tier: currentTier,
      fileSize: file?.size,
      fileType: file?.type,
      lastStep: lastSuccessfulStep
    });

    const hasDigest = !!error?.digest;

    const message = hasDigest
      ? `Server Error (Digest: ${error.digest})`
      : (error?.message || 'Unknown execution error');

    const code = error?.code || (hasDigest ? 'SERVER_COMPONENT_CRASH' : 'FLOW_CRASH');

    return {
      type: 'error',
      code,
      message: `${message} (at ${lastSuccessfulStep})`
    };
  }






};

