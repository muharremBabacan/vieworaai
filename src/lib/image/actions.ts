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
  if (!adminStorage || !adminDb) {
    throw new Error('Firebase Admin SDK is not initialized. Check your serviceAccount.json or environment variables.');
  }
  
  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided in FormData');
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const processor = new ImageProcessor(buffer);
  
  // Watermark yükle (public klasöründen)
  // Not: Sunucu tarafında path.join ile public klasörüne erişilir.
  const watermarkPath = path.join(process.cwd(), 'public/icon-512.png');
  await processor.loadWatermark(watermarkPath);

  // Tüm türevleri üret
  const derivatives = await processor.generateAll();
  const bucket = adminStorage.bucket();
  const imageUrls: Partial<ImageDerivatives> = {};

  // Her türevi Storage'a yükle
  const uploadPromises = Object.entries(derivatives).map(async ([type, result]) => {
    const typedResult = result as ProcessingResult;
    const filePath = `users/${userId}/${folder}/${photoId}/${type}.${typedResult.format}`;
    const file = bucket.file(filePath);

    await file.save(typedResult.buffer, {
      contentType: `image/${typedResult.format}`,
      metadata: { 
        cacheControl: 'public, max-age=31536000'
      }
    });

    // Public URL oluştur (Firebase standardı veya Cloud Storage public url)
    // Not: getDownloadURL admin sdk tarafında biraz farklı çalışır, 
    // genelde public yapıp URL'sini döneriz.
    await file.makePublic();
    imageUrls[type as DerivativeType] = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  });

  await Promise.all(uploadPromises);

  // Orijinal görsel referansı (Analysis kopyasını orijinal olarak da işaretliyoruz veya 
  // gerçekten orijinali de saklayabiliriz.)
  imageUrls.original = imageUrls.analysis;

  return imageUrls as ImageDerivatives;
}
