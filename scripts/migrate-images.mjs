import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import axios from 'axios';

// 🛠️ Yollar
const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = join(__dirname, '../serviceAccount.json');
const WATERMARK_PATH = join(__dirname, '../public/icon-512.png');

// 🔑 Firebase Admin Init
const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
if (serviceAccount && serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'studio-8632782825-fce99.firebasestorage.app' 
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Görsel İşleme Mantığı (Standalone)
 */
async function processImage(buffer, photoId, userId) {
  const pipeline = sharp(buffer);
  const metadata = await pipeline.metadata();
  const watermarkBuffer = await readFile(WATERMARK_PATH).catch(() => null);

  const derivatives = [
    { type: 'smallSquare', width: 320, height: 320, fit: 'cover', format: 'webp' },
    { type: 'featureCover', width: 1280, height: 720, fit: 'cover', format: 'webp' },
    { type: 'detailView', width: 1200, height: 1500, fit: 'inside', format: 'webp' },
    { type: 'analysis', width: 1600, height: 1600, fit: 'inside', format: 'jpeg' }
  ];

  const results = {};

  for (const der of derivatives) {
    let p = sharp(buffer).resize(der.width, der.height, { fit: der.fit, withoutEnlargement: true });
    
    if (der.format === 'webp') p = p.webp({ quality: 85 });
    else p = p.jpeg({ quality: 85 });

    const processedBuffer = await p.toBuffer();
    const fileName = `users/${userId}/photos/${photoId}/${der.type}.${der.format}`;
    const file = bucket.file(fileName);
    
    await file.save(processedBuffer, {
      contentType: `image/${der.format}`,
      metadata: { cacheControl: 'public, max-age=31536000' }
    });
    
    await file.makePublic();
    results[der.type] = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  }

  // Watermarked Detail View
  if (watermarkBuffer) {
    const detailBase = await sharp(buffer)
      .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    const detailMeta = await sharp(detailBase).metadata();
    const wmSize = Math.round(detailMeta.width * 0.15);
    const resizedWm = await sharp(watermarkBuffer).resize(wmSize).png().toBuffer();

    const wBuffer = await sharp(detailBase)
      .composite([{ input: resizedWm, gravity: 'southeast', blend: 'over' }])
      .webp({ quality: 85 })
      .toBuffer();

    const wFileName = `users/${userId}/photos/${photoId}/detailViewWatermarked.webp`;
    const wFile = bucket.file(wFileName);
    await wFile.save(wBuffer, { contentType: 'image/webp' });
    await wFile.makePublic();
    results['detailViewWatermarked'] = `https://storage.googleapis.com/${bucket.name}/${wFileName}`;
  }

  results['original'] = results['analysis']; // Placeholder or actual original ref
  return results;
}

/**
 * Ana Migration Akışı
 */
async function migrate() {
  console.log('🚀 Migration başlıyor...');

  // 1. Photos Koleksiyonu
  const photosSnap = await db.collectionGroup('photos').limit(1).get();
  console.log(`📸 Test: ${photosSnap.size} adet fotoğraf ile deneme yapılıyor.`);

  for (const doc of photosSnap.docs) {
    const data = doc.data();
    if (data.imageProcessing?.version === 2) {
      console.log(`⏩ Atlanıyor: ${doc.id} (Zaten işlenmiş)`);
      continue;
    }

    try {
      console.log(`🔄 İşleniyor: ${doc.id} (URL: ${data.imageUrl})`);
      const response = await axios.get(data.imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const urls = await processImage(buffer, doc.id, data.userId);

      await doc.ref.update({
        imageUrls: urls,
        imageProcessing: {
          version: 2,
          status: 'completed',
          updatedAt: new Date().toISOString()
        }
      });
      console.log(`✅ Tamamlandı: ${doc.id}`);
    } catch (err) {
      console.error(`❌ Hata: ${doc.id}`, err.message);
      await doc.ref.update({
        'imageProcessing.status': 'failed',
        'imageProcessing.error': err.message,
        'imageProcessing.updatedAt': new Date().toISOString()
      }).catch(() => {});
    }
  }

  console.log('🎉 Migration bitti!');
}

migrate().catch(console.error);
