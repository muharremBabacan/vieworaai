'use server';

import { adminStorage, adminDb } from '@/lib/firebase/admin-init';
import { ImageProcessor, DerivativeType, ProcessingResult } from './processor';
import { ImageDerivatives } from '@/types';
import path from 'path';

/**
 * Görsel Yükleme ve Türev Üretimi (Server Action)
 * Orijinal dosyayı alır, 5 farklı türev üretir ve Storage'a yükler.
 * URL'leri içeren bir Map (imageUrls) döner.
 */

export async function uploadAndProcessImage(
  formData: FormData, 
  userId: string, 
  photoId: string,
  folder: 'photos' | 'submissions' | 'entries' | 'academy-practice' | 'exhibitions' = 'photos'
): Promise<ImageDerivatives> {
  console.log(`[Server Action] uploadAndProcessImage started. User: ${userId}, Photo: ${photoId}, Folder: ${folder}`);
  
  if (!adminStorage || !adminDb) {
    console.error('[Server Action] Firebase Admin SDK is not initialized!');
    throw new Error('Firebase Admin SDK is not initialized. Check your serviceAccount.json or environment variables.');
  }

  try {
    const file = formData.get('file') as File;
    if (!file) {
      console.error('[Server Action] No file found in FormData');
      throw new Error('No file provided in FormData');
    }
    
    console.log(`[Server Action] File received: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('[Server Action] Buffer created. Size:', buffer.length);

    const processor = new ImageProcessor(buffer);
    
    // Çözünürlük Kontrolü (Min 800px)
    console.log('[Server Action] Validating resolution...');
    await processor.validateResolution().catch(err => {
      console.warn(`[Server Action] Resolution validation failed: ${err.message}`);
      if (err.message.startsWith('RESOLUTION_TOO_LOW')) {
        throw new Error('PHOTO_TOO_SMALL');
      }
      throw err;
    });

    // Watermark yükle (public klasöründen)
    const watermarkPath = path.join(process.cwd(), 'public/icon-512.png');
    console.log('[Server Action] Loading watermark from:', watermarkPath);
    await processor.loadWatermark(watermarkPath);

    // Tüm türevleri üret
    console.log('[Server Action] Generating image derivatives (Sharp)...');
    const derivatives = await processor.generateAll();
    console.log('[Server Action] Successfully generated all derivatives.');

    const bucket = adminStorage.bucket();
    const imageUrls: Partial<ImageDerivatives> = {};

    // Her türevi Storage'a yükle
    console.log('[Server Action] Starting upload to Storage bucket:', bucket.name);
    const uploadPromises = Object.entries(derivatives).map(async ([type, result]) => {
      const typedResult = result as ProcessingResult;
      const filePath = `users/${userId}/${folder}/${photoId}/${type}.${typedResult.format}`;
      const file = bucket.file(filePath);

      console.log(`[Server Action] Uploading ${type}... -> ${filePath}`);

      await file.save(typedResult.buffer, {
        contentType: `image/${typedResult.format}`,
        metadata: { 
          cacheControl: 'public, max-age=31536000'
        }
      });

      await file.makePublic().catch(err => {
        console.warn(`[Server Action] Failed to make file public (continuing): ${filePath}`, err.message);
      });

      imageUrls[type as DerivativeType] = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    });

    await Promise.all(uploadPromises);

    imageUrls.original = imageUrls.analysis;
    console.log('[Server Action] Upload completed successfully. All URLs generated.');
    return imageUrls as ImageDerivatives;

  } catch (error: any) {
    console.error('[Server Action] FATAL ERROR in uploadAndProcessImage:', error.message);
    if (error.stack) console.error(error.stack);
    throw error;
  }
}
