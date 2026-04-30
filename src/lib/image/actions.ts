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
  const actionStartTime = Date.now();
  let currentStep = '0_START';
  try {
    console.log(`🎬 [upload-flow] 1. START: User=${userId}, Photo=${photoId}, Folder=${folder}`);
    
    currentStep = '1_ADMIN_IMPORT';
    const { initAdmin, getAdminStorage, getAdminDb } = await import('@/lib/firebase/admin-init');
    
    currentStep = '2_ADMIN_INIT';
    console.log('🏗️ [upload-flow] 2. Admin Initialization...');
    initAdmin();
    
    currentStep = '3_ADMIN_CLIENTS';
    const bucket = getAdminStorage();
    const adminDb = getAdminDb();
    if (!bucket || !adminDb) throw new Error('ADMIN_CLIENTS_MISSING');
    console.log(`🪣 [upload-flow] 3. Storage Bucket: ${bucket.name}`);

    currentStep = '4_PROCESSOR_IMPORT';
    const { ImageProcessor } = await import('./processor');

    currentStep = '5_FILE_READ';
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) throw new Error('FILE_INVALID');
    console.log(`📂 [upload-flow] 5. File detected: ${file.name} (${file.size} bytes)`);
    
    currentStep = '6_BUFFER_CONVERT';
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`🧱 [upload-flow] 6. Buffer created. Length: ${buffer.length}`);
    
    currentStep = '7_PROCESSOR_INIT';
    const processor = new ImageProcessor(buffer);
    
    currentStep = '8_WATERMARK_LOAD';
    const watermarkPath = path.join(process.cwd(), 'public', 'icon-512.png');
    console.log(`📍 [upload-flow] 8. Loading watermark from: ${watermarkPath}`);
    await processor.loadWatermark(watermarkPath).catch(err => {
      console.warn('⚠️ [upload-flow] 8. Watermark skip (Non-fatal):', err.message);
    });
    
    currentStep = '9_IMAGE_GENERATE';
    console.log('🖼️ [upload-flow] 9. Generating derivatives (Sharp)...');
    const genStart = Date.now();
    const derivatives = await processor.generateAll();
    console.log(`✅ [upload-flow] 9. Generated all derivatives in ${Date.now() - genStart}ms`);
    
    currentStep = '10_STORAGE_UPLOAD';
    const imageUrls: Partial<ImageDerivatives> = {};
    const uploadPromises = Object.entries(derivatives).map(async ([type, result]) => {
      const typedResult = result as any;
      const filePath = `users/${userId}/${folder}/${photoId}/${type}.${typedResult.format || 'jpg'}`;
      const fileObj = bucket.file(filePath);
      
      console.log(`📤 [upload-flow] 10. Uploading: ${filePath}`);
      
      await fileObj.save(typedResult.buffer, {
        contentType: `image/${typedResult.format || 'jpg'}`,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      
      await fileObj.makePublic().catch((e) => {
        console.warn(`⚠️ [upload-flow] 10. makePublic failed for ${filePath}:`, e.message);
      });
      
      // 🔗 Use GCS Direct Public URL (Standard, robust, and best for Next.js Image)
      imageUrls[type as keyof ImageDerivatives] = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    });
    
    const uploadStart = Date.now();
    await Promise.all(uploadPromises);
    console.log(`🎉 [upload-flow] 10. All uploads finished in ${Date.now() - uploadStart}ms. Total Action Time: ${Date.now() - actionStartTime}ms`);
    
    currentStep = '11_FINALIZING';
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
    console.error(`🔥 [upload-flow] CRASH AT STEP ${currentStep}:`, error.message);
    return { 
      success: false, 
      error: error.message || 'Server error during upload',
      step: currentStep,
      details: error.stack
    };
  }
}

export async function analyzePhotoServerAction(params: { 
  userId: string; 
  photoId: string; 
  imageUrl: string; 
  filePath: string; 
  isGuest?: boolean;
  onboardingResults?: any;
}) {
  const { performAiAnalysis } = await import('./ai');
  console.log('🤖 [actions] Calling Expert AI analysis with gpt-4.1-mini...');
  const aiStart = Date.now();
  const result = await performAiAnalysis(
    params.imageUrl, 
    params.photoId, 
    params.filePath, 
    params.isGuest, 
    params.onboardingResults
  );
  console.log(`✅ [actions] AI Analysis Server Action Round-trip: ${Date.now() - aiStart}ms`);
  return result;
}
