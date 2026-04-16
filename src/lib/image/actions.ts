'use server';
import { getAdminStorage, getAdminDb } from '@/lib/firebase/admin-init';
import { ImageProcessor, DerivativeType, ProcessingResult } from './processor';
import { ImageDerivatives } from '@/types';
import path from 'path';

export async function uploadAndProcessImage(formData: FormData, userId: string, photoId: string, folder: 'photos' | 'submissions' | 'entries' | 'academy-practice' | 'exhibitions' = 'photos'): Promise<ImageDerivatives> {
  const bucket = getAdminStorage();
  const adminDb = getAdminDb();
  console.log("🔥 [actions] ACTIVE BUCKET NAME:", bucket.name);
  if (!bucket || !adminDb) throw new Error('Firebase Admin SDK is not initialized.');
  try {
    const file = formData.get('file') as File;
    if (!file || !userId || !photoId) throw new Error('MISSING_DATA');
    const buffer = Buffer.from(await file.arrayBuffer());
    const processor = new ImageProcessor(buffer);
    console.log('📍 [actions] STEP 1: Image loaded into processor');
    
    await processor.validateResolution().catch(err => {
      console.warn('⚠️ [actions] Minor resolution warning ignored during flexible flow:', err.message);
    });

    const watermarkPath = path.join(process.cwd(), 'public/icon-512.png');
    await processor.loadWatermark(watermarkPath).catch(() => {});
    
    console.log('📍 [actions] STEP 2: Generating all derivatives...');
    const derivatives = await processor.generateAll();
    
    console.log('📍 [actions] STEP 3: Uploading derivatives to bucket...');
    const imageUrls: Partial<ImageDerivatives> = {};
    const uploadPromises = Object.entries(derivatives).map(async ([type, result]) => {
      const typedResult = result as ProcessingResult;
      const filePath = `users/${userId}/${folder}/${photoId}/${type}.${typedResult.format || 'jpg'}`;
      const fileObj = bucket.file(filePath);
      await fileObj.save(typedResult.buffer, {
        contentType: `image/${typedResult.format || 'jpg'}`,
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      await fileObj.makePublic().catch(() => {});
      imageUrls[type as DerivativeType] = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    });
    await Promise.all(uploadPromises);
    
    console.log('📍 [actions] STEP 4: Serialization and return');
    imageUrls.original = imageUrls.analysis;
    imageUrls.smallSquare = imageUrls.smallSquare || imageUrls.analysis;
    imageUrls.featureCover = imageUrls.featureCover || imageUrls.analysis;
    imageUrls.detailView = imageUrls.detailView || imageUrls.analysis;
    imageUrls.detailViewWatermarked = imageUrls.detailViewWatermarked || imageUrls.analysis;
    return JSON.parse(JSON.stringify(imageUrls)) as ImageDerivatives;
  } catch (error: any) {
    console.error('🔥 [actions] CRITICAL ERROR IN UPLOAD/PROCESS:', error.message);
    throw new Error(error.message);
  }
}

export async function analyzePhotoServerAction(params: { userId: string; photoId: string; imageUrl: string; filePath: string; }) {
  const { performAiAnalysis } = await import('./ai');
  console.log('🤖 [actions] Calling Expert AI analysis with gpt-4.1-mini...');
  return await performAiAnalysis(params.imageUrl, params.photoId);
}
