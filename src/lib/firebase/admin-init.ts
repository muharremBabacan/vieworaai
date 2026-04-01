import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Yapılandırması
 * Sunucu tarafı işlemleri (Storage upload, Firestore admin access vb.) için kullanılır.
 */

import * as fs from 'fs';
import * as path from 'path';

if (!admin.apps.length) {
  try {
    let serviceAccount: any;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // 🛠️ Local Development Fallback: serviceAccount.json dosyasını kök dizinden oku
      const localPath = path.join(process.cwd(), 'serviceAccount.json');
      if (fs.existsSync(localPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      } else {
        throw new Error('Firebase Service Account credentials not found in ENV or FILE.');
      }
    }

    if (serviceAccount && serviceAccount.private_key) {
      // 🔑 JWT Signature Hatasını Önlemek İçin: Karakterleri temizle
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, '\n')     // Literal \n'leri gerçek newline'a çevir
        .replace(/\r/g, '')        // Windows \r karakterlerini kaldır
        .trim();                   // Başındaki/sonundaki boşlukları temizle
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'studio-8632782825-fce99.firebasestorage.app'
      });
      console.log('✅ Firebase Admin initialized successfully.');
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin init error:', error.message);
  }
}

// 🛡️ Safe Export: Eğer başlatılamadıysa null dön veya hata fırlatıldığında terminalde görünüp UI'yı kırmasın.
// Ancak Firestore işlemlerinde bu değişkenler kullanılacağı için başlatılmış olması zorunludur.
const getAdminDb = () => admin.apps.length ? admin.firestore() : null!;
const getAdminStorage = () => admin.apps.length ? admin.storage() : null!;
const getAdminAuth = () => admin.apps.length ? admin.auth() : null!;

export const adminDb = getAdminDb();
export const adminStorage = getAdminStorage();
export const adminAuth = getAdminAuth();
