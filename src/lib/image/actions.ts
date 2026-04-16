'use server';
import { getAdminStorage, getAdminDb } from '@/lib/firebase/admin-init';
import { ImageProcessor, DerivativeType, ProcessingResult } from './processor';
import { ImageDerivatives } from '@/types';
import path from 'path';

export type ActionResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: any; step?: string };

export async function uploadAndProcessImage(
  formData: FormData, 
  userId: string, 
  photoId: string, 
  folder: 'photos' | 'submissions' | 'entries' | 'academy-practice' | 'exhibitions' = 'photos'
): Promise<ActionResponse<ImageDerivatives>> {
  let currentStep = 'PRE-FLIGHT';
  try {
    console.log('🏁 [actions] uploadAndProcessImage STARTED', { userId, photoId, folder });
    
    currentStep = 'DYNAMIC_IMPORT_ADMIN';
    const { getAdminStorage, getAdminDb } = await import('@/lib/firebase/admin-init');
    
    currentStep = 'DYNAMIC_IMPORT_PROCESSOR';
    const { ImageProcessor } = await import('./processor');
    
    currentStep = 'ADMIN_INIT';
    const bucket = getAdminStorage();
    const adminDb = getAdminDb();
    
    if (!bucket || !adminDb) throw new Error('Firebase Admin SDK is not initialized.');

    currentStep = 'FILE_RETRIEVAL';
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      throw new Error('MISSING_OR_INVALID_FILE');
    }
    
    currentStep = 'BUFFER_CREATION';
    const buffer = Buffer.from(await file.arrayBuffer());
    
    currentStep = 'IMAGE_PROCESSING_LOAD';
    const processor = new ImageProcessor(buffer);
    
    currentStep = 'IMAGE_PROCESSING_VALIDATE';
    await processor.validateResolution().catch(() => {});

    currentStep = 'WATERMARK_LOADING';
    const watermarkPath = path.join(process.cwd(), 'public/icon-512.png');
    await processor.loadWatermark(watermarkPath).catch(() => {});
    
    currentStep = 'IMAGE_PROCESSING_GENERATE';
    const derivatives = await processor.generateAll();
    
    currentStep = 'STORAGE_UPLOAD';
    const imageUrls: Partial<ImageDerivatives> = {};
    const uploadPromises = Object.entries(derivatives).map(async ([type, result]) => {
      const typedResult = result as any; // Using any here to bypass complex type mapping in short form
      const filePath = `users/${userId}/${folder}/${photoId}/${type}.${typedResult.format || 'jpg'}`;
      const fileObj = bucket.file(filePath);
      
      await fileObj.save(typedResult.buffer, {
        contentType: `image/${typedResult.format || 'jpg'}`,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      
      await fileObj.makePublic().catch(() => {});
      imageUrls[type as keyof ImageDerivatives] = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    });
    
    await Promise.all(uploadPromises);
    
    currentStep = 'FINALIZATION';
    imageUrls.original = imageUrls.analysis;
    imageUrls.smallSquare = imageUrls.smallSquare || imageUrls.analysis;
    imageUrls.featureCover = imageUrls.featureCover || imageUrls.analysis;
    imageUrls.detailView = imageUrls.detailView || imageUrls.analysis;
    imageUrls.detailViewWatermarked = imageUrls.detailViewWatermarked || imageUrls.analysis;
    
    return { 
      success: true, 
      data: JSON.parse(JSON.stringify(imageUrls)) as ImageDerivatives 
    };

  } catch (error: any) {
    console.error(`🔥 [actions] ERROR AT ${currentStep}:`, error.message);
    return { 
      success: false, 
      error: error.message || 'Unknown server error',
      step: currentStep,
      details: error.stack
    };
  }
}

export async function analyzePhotoServerAction(params: { userId: string; photoId: string; imageUrl: string; filePath: string; }) {
  const { performAiAnalysis } = await import('./ai');
  console.log('🤖 [actions] Calling Expert AI analysis with gpt-4.1-mini...');
  return await performAiAnalysis(params.imageUrl, params.photoId);
}
