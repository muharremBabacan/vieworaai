import { doc, increment, collection, writeBatch, query, where, getDocs, orderBy, limit, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { storage, db } from '@/lib/firebase/client';
import { prepareOptimizedFile, generateImageHash, getImageDimensions } from '@/lib/image/image-processing-final';
import { User, Photo, UserTier, PhotoAnalysis, ImageDerivatives } from '@/types';
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

export const getOverallScore = (photo: Photo, tier?: UserTier): number => {
  if (!photo.aiFeedback) return 0;
  
  // Use provided tier, or fallback to photo's analysis tier, or default to start
  const currentTier = tier || photo.analysisTier || 'start';
  
  const l = normalizeScore(photo.aiFeedback.light_score);
  const c = normalizeScore(photo.aiFeedback.composition_score);
  const t = normalizeScore(photo.aiFeedback.technical_clarity_score);
  const s = normalizeScore(photo.aiFeedback.storytelling_score);
  const b = normalizeScore(photo.aiFeedback.boldness_score);

  if (currentTier === 'start') {
    // Start Tier: Only 3 metrics are visible
    // Weighted: Composition 40%, Light 40%, Technical 20%
    return (c * 0.4) + (l * 0.4) + (t * 0.2);
  } else {
    // Pro/Master Tier: All 5 metrics are visible
    // Weighted: Composition 30%, Light 25%, Technical 15%, Storytelling 15%, Boldness 15%
    return (c * 0.3) + (l * 0.25) + (t * 0.15) + (s * 0.15) + (b * 0.15);
  }
};

export const updateUserProfileIndex = async (userId: string, newOverallScore: number) => {
  if (!userId) return;
  const photosRef = collection(db, 'users', userId, 'photos');
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
    acc.overall.push(getOverallScore(p, p.analysisTier));
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
  const userRef = doc(db, 'users', userId);
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
  locale: string;
  guestPix: number;
  currentTier: UserTier;
  uid: string | null;
};

export const executePhotoAnalysisFlow = async (options: AnalysisFlowOptions): Promise<FlowResult> => {
  const flowStartTime = performance.now();
  const {
    file, analyze, user, userProfile, locale,
    uid, guestPix, currentTier
  } = options;
  
  // 🛡️ HARD GUARD: No execution on server
  if (typeof window === 'undefined') {
    return { type: 'error', code: 'CLI_ONLY_FLOW' };
  }

  let lastSuccessfulStep = 'INITIALIZATION';

  // 🚀 DEPLOY VERSION TAG (Check this in console to verify deploy)
  const DEPLOY_VERSION = '2026-04-16-V9-STABLE-PROMPT';
  console.log(`%c 🛡️ [VIEWORA-DEPLOY] CURRENT VERSION: ${DEPLOY_VERSION}`, 'background: #222; color: #bada55; font-size: 14px; padding: 4px; border-radius: 4px;');

  console.log('🚀 [photo-flow] STARTING NUCLEAR FLOW', {
    analyze,
    userId: uid || 'guest',
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
    if (!db) {
      console.error('❌ [photo-flow] FATAL: Firestore instance is missing');
      return { type: 'error', code: 'FIRESTORE_NOT_INITIALIZED' };
    }

    const analysisCost = TIER_COSTS[currentTier] || 1;

    // 1. Initial Checks & Context
    console.log('📍 [photo-flow] STEP 1: Context validation...', { guestPix, analysisCost });
    // 🎁 WEEKLY FREE GIFT LOGIC for Members with 0 Pix
    let isFreeGiftEligible = false;
    const GUEST_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

    if (user) {
      const currentBalance = userProfile?.pix_balance || 0;
      const lastFreeAt = userProfile?.last_free_analysis_at ? new Date(userProfile.last_free_analysis_at).getTime() : 0;
      const isCooldownOver = (Date.now() - lastFreeAt) > GUEST_COOLDOWN;

      if (currentBalance === 0 && isCooldownOver) {
        console.log('🎁 [photo-flow] User is eligible for Weekly Free Gift!');
        isFreeGiftEligible = true;
      }
    }

    if (!user) {
      if (!analyze) return { type: 'upload_only' };
      
      // Guest Trial Logic
      if (guestPix < analysisCost) {
        console.warn('⚠️ [photo-flow] Guest insufficient balance');
        return { type: 'marketing_required' };
      }
    } else {
      const currentBalance = userProfile?.pix_balance || 0;
      if (analyze && currentBalance < analysisCost && !isFreeGiftEligible) {
        console.warn('⚠️ [photo-flow] Insufficient balance and no free gift available');
        return { type: 'error', code: 'INSUFFICIENT_BALANCE' };
      }
    }
    lastSuccessfulStep = 'STEP_1_CONTEXT_OK';

    // 2. Photo ID generation
    const photoId = doc(collection(db, 'photos')).id;
    const currentUserId = uid || 'anonymous';
    console.log('📦 [photo-flow] STEP 2: Photo ID:', photoId, 'User:', currentUserId);
    lastSuccessfulStep = 'STEP_2_ID_GENERATED';

    // 3. Hash & Optimization (Client-side compression to prevent 11MB+ upload hangs)
    const clientOptimStart = Date.now();
    console.log(`📍 [photo-flow] STEP 3: Compressing image on client (Original: ${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
    const hash = await generateImageHash(file);
    
    // 🚀 Performance: 1200px is the sweet spot for fast uploads + high AI fidelity
    const optimizedFile = await prepareOptimizedFile(file, 1200).catch(err => {
      console.warn('⚠️ [photo-flow] Compression failed, falling back to raw file:', err.message);
      return file;
    });

    console.log(`✅ [photo-flow] Compression complete. Size: ${(optimizedFile.size / 1024 / 1024).toFixed(2)} MB. Time: ${Date.now() - clientOptimStart}ms`);
    
    const uploadStart = Date.now();
    console.log('📦 [photo-flow] STEP 3: Optimized size:', (optimizedFile.size / 1024 / 1024).toFixed(2), 'MB');
    lastSuccessfulStep = 'STEP_3C_OPTIMIZATION_OK';

    // 4. Duplicate Check
    if (user) {
      console.log('🔍 [photo-flow] STEP 4: Checking for duplicates...', { uid });
      
      if (!uid) {
        throw new Error('USER_ID_MISSING_IN_FLOW');
      }

      const q = query(
        collection(db, 'users', uid, 'photos'),
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
          console.log('🤖 [photo-flow] Re-analyzing existing photo (MOCKED)...');
          
          const analysis: PhotoAnalysis = {
            light_score: 8.0,
            composition_score: 7.5,
            technical_clarity_score: 8.5,
            storytelling_score: 7.0,
            boldness_score: 6.5,
            tags: ['Existing', 'Duplicate', 'Verified'],
            genre: 'General',
            scene: 'Indoor',
            dominant_subject: 'Subject',
            short_neutral_analysis: 'Bu önceden analiz edilmiş bir fotoğrafın kopyasıdır.',
            style_analysis: 'Sistem stabilizasyonu için mock data kullanıldı.'
          };

          batch.update(dupSnap.docs[0].ref, {
            aiFeedback: analysis,
            tags: analysis.tags || [],
            analysisTier: currentTier
          });

          batch.update(doc(db, 'users', uid), {
            pix_balance: increment(-analysisCost),
            total_analyses_count: increment(1)
          });

          await batch.commit();
          console.log('✅ [photo-flow] Duplicate analysis saved');

          updateUserProfileIndex(uid, getOverallScore({ ...existingPhoto, aiFeedback: analysis } as Photo, currentTier)).catch(e =>
            console.error('⚠️ [photo-flow] Index update error:', e)
          );

          return { type: 'success', data: serializeData({ ...existingPhoto, aiFeedback: analysis, id: dupSnap.docs[0].id }) };
        }
        return { type: 'upload_only' };
      }
    }
    lastSuccessfulStep = 'STEP_4_DUPLICATE_CHECK_OK';

    // 5. Upload (Now leveraging Server Actions for Stability)
    console.log('[FLOW-DEBUG] STEP 5: Uploading & Processing via Server Action...');

    let imageUrls: ImageDerivatives;
    const storagePath = `users/${currentUserId}/photos/${photoId}/analysis.jpeg`; // Primary analysis path used by actions.ts

    try {
      const { uploadAndProcessImage } = await import('@/lib/image/actions');
      const formData = new FormData();
      formData.append('file', optimizedFile);
      
      console.log('📍 [photo-flow] Calling uploadAndProcessImage Server Action...');
      const response = await uploadAndProcessImage(formData, currentUserId, photoId);
      
      if (!response.success) {
        console.error('🔥 [UPLOAD ERROR] Server Action reported failure:', response.error, 'at step:', response.step);
        throw new Error(`SERVER_ERROR: ${response.error} (at ${response.step})`);
      }

      imageUrls = response.data;
      console.log('✅ [photo-flow] Server-side Processing complete');
    } catch (e: any) {
      console.error('🔥 [UPLOAD ERROR]:', e);
      throw new Error(`UPLOAD_FAILED: ${e.message}`);
    }

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
    if (analyze) {
      let analysis: PhotoAnalysis | null = null;
      let isAnalysisSuccessful = false;

      // 🤖 STEP 6: AI Analysis (Restored to Server Action for 100% Stability)
      console.log('🤖 [photo-flow] STEP 6: Starting AI Analysis (Server Action)...');

      try {
        const { analyzePhotoServerAction } = await import('@/lib/image/actions');
        
        const actionStart = Date.now();
        console.log('🤖 [photo-flow] Calling AI Server Action...');
        const aiData = await analyzePhotoServerAction({
          userId: currentUserId,
          photoId,
          imageUrl: imageUrls.analysis,
          filePath: storagePath
        });
        console.log('✅ [photo-flow] AI Server Action Success. Round-trip:', Date.now() - actionStart, 'ms');

        console.log('✅ [photo-flow] AI Analysis success');
        analysis = {
          ...aiData,
          short_neutral_analysis: aiData.short_neutral_analysis || aiData.summary,
          style_analysis: aiData.short_neutral_analysis || aiData.summary,
          genre: aiData.genre || 'General',
          scene: aiData.scene || 'None',
          dominant_subject: aiData.dominant_subject || 'Subject'
        };
        isAnalysisSuccessful = true;

      } catch (e: any) {
        console.error('🔥 [photo-flow] AI Server Action Error:', e.message);
        
        // Propagate specific critical errors
        if (e.message.includes('OPENAI_API_KEY_MISSING')) {
          console.error('❌ [photo-flow] OpenAI API Key is missing on server');
          return { type: 'error', code: 'SERVER_CONFIG_ERROR', message: 'OpenAI API Key eksik. Lütfen yöneticiye bildirin.' };
        }
        if (e.message.includes('AI_REFUSAL')) {
          const reason = e.message.split('AI_REFUSAL: ')[1] || 'İçerik reddedildi.';
          return { type: 'error', code: 'AI_REFUSAL', message: reason };
        }
        
        // Fallback for general errors (to keep the flow moving but warn user)
        isAnalysisSuccessful = false;
        analysis = {
          light_score: 0,
          composition_score: 0,
          technical_clarity_score: 0,
          storytelling_score: 0,
          boldness_score: 0,
          tags: ['analysis_failed'],
          short_neutral_analysis: `Analiz hatası: ${e.message}`,
          style_analysis: 'Hata detayı sistem günlüğüne kaydedildi.',
          genre: 'Hata',
          scene: 'Bilinmiyor',
          dominant_subject: 'Bilinmiyor',
          technical_details: {
            focus: 'Analiz yapılamadı.',
            light: 'Analiz yapılamadı.',
            technical_quality: 'Analiz yapılamadı.',
            color: 'Analiz yapılamadı.',
            composition: 'Analiz yapılamadı.'
          },
          general_quality: 'Düşük',
          expert_level: 'Beginner',
          quality_note: 'AI Analiz sunucusuyla iletişim kurulamadı. Pix bakiyenizden düşülmedi.'
        };
      }

      photoData.aiFeedback = analysis;
      photoData.analysisTier = currentTier;
      photoData.tags = analysis.tags || []; // 🏷️ Propagate tags to top-level for gallery visibility

      if (uid) {
        console.log('[FLOW-DEBUG] STEP 7: Saving to Firestore...', { uid });
        const photoDocRef = doc(collection(db, 'users', uid, 'photos'), photoId);
        const userRef = doc(db, 'users', uid);
        const batch = writeBatch(db);

        batch.set(photoDocRef, photoData);
        
        // 💰 CONDITIONAL BILLING: Only deduct Pix if analysis was successful
        if (isAnalysisSuccessful) {
          if (isFreeGiftEligible) {
            batch.update(userRef, {
              last_free_analysis_at: new Date().toISOString(),
              total_analyses_count: increment(1)
            });
            console.log('🎁 [photo-flow] Weekly Free Gift consumed.');
          } else {
            batch.update(userRef, {
              pix_balance: increment(-analysisCost),
              total_analyses_count: increment(1)
            });
            console.log('💸 [photo-flow] Pix deducted for successful analysis.');
          }
        } else {
          console.log('🛡️ [photo-flow] Analysis failed/fallback used. No Pix deducted.');
        }

        await batch.commit().catch((commitErr: any) => {
          console.error('[FLOW-ERROR] Firestore batch commit failed:', commitErr.message);
          throw commitErr;
        });
        console.log('[FLOW-DEBUG] Flow Complete. Overall Score:', getOverallScore(photoData, currentTier).toFixed(1));
      }

      if (uid) {
          updateUserProfileIndex(uid, getOverallScore(photoData, currentTier)).catch((indexErr: any) =>
            console.error('[FLOW-ERROR] Profile index update failure:', indexErr.message)
          );
        /* 
          if (guestId && isAnalysisSuccessful) {
            // 📊 MARKETING TRACKING: Log guest analysis cost ONLY IF SUCCESSFUL
            const guestLogRef = doc(collection(db, 'guest_analyses'));
            setDoc(guestLogRef, {
              guestId,
              cost: analysisCost,
              tier: currentTier,
              photoId: photoId,
              timestamp: new Date().toISOString()
            }).catch((logErr: any) => console.error('[MARKETING-LOG] Failed to track guest cost:', logErr.message));
          } 
        */
      }
      lastSuccessfulStep = 'STEP_7_COMPLETE';
      console.log('🎉 [photo-flow] COMPLETE! Total Pipeline Time:', Date.now() - flowStartTime, 'ms');
      return { type: 'success', data: serializeData(photoData) };
    } else {
      if (uid) {
        console.log('[FLOW-DEBUG] STEP 6: Saving upload-only entry...');
        const photoDocRef = doc(collection(db, 'users', uid, 'photos'), photoId);
        const batch = writeBatch(db);
        batch.set(photoDocRef, photoData);
        batch.update(doc(db, 'users', uid), { current_xp: increment(5) });
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
    console.error(`📍 STEP: ${lastSuccessfulStep}`);
    console.error(`❌ MSG: ${error?.message || 'Unknown Error'}`);
    console.error(`🛠️ FULL ERROR:`, error);
    
    if (error?.digest) console.error(`🆔 DIGEST: ${error.digest}`);
    if (error?.stack) console.error(`📚 STACK: ${error.stack}`);

    return {
      type: 'error',
      code: error?.code || 'FLOW_CRASH',
      message: `${error?.message || 'Unknown execution error'} (at ${lastSuccessfulStep})`
    };
  }






};

