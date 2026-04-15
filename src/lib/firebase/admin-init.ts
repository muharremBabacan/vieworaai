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
      console.log('📦 Found FIREBASE_SERVICE_ACCOUNT in environment variables.');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // 🛠️ Local Development Fallback
      const localPath = path.join(process.cwd(), 'serviceAccount.json');
      if (fs.existsSync(localPath)) {
        console.log('📂 Found serviceAccount.json file.');
        serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      } else {
        console.error('❌ CRITICAL: No Firebase credentials found (ENV or FILE).');
        throw new Error('MISSING_FIREBASE_CREDENTIALS');
      }
    }

    if (serviceAccount && serviceAccount.private_key) {
      // 🔑 JWT Signature Hatasını Önlemek İçin: Karakterleri temizle
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
        .trim();
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'studio-8632782825-fce99.firebasestorage.app'
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } else {
      console.error('❌ CRITICAL: Service account object is missing private_key.');
      throw new Error('INVALID_SERVICE_ACCOUNT_FORMAT');
    }
  } catch (error: any) {
    console.error('🔥 Firebase Admin initialization failed:', error.message);
    (global as any)._adminInitError = error.message;
  }
}

// 🛡️ Safe Export: Eğer başlatılamadıysa hata fırlatan yardımcılar kullanıyoruz.
// Bu sayede "Cannot read properties of null" yerine anlamlı bir hata mesajı alıyoruz.
const getAdminDb = () => {
  if (!admin.apps.length) throw new Error('FIREBASE_ADMIN_NOT_INITIALIZED: Admin DB access failed.');
  return admin.firestore();
};

const getAdminStorage = () => {
  if (!admin.apps.length) throw new Error('FIREBASE_ADMIN_NOT_INITIALIZED: Admin Storage access failed.');
  return admin.storage();
};

const getAdminAuth = () => {
  if (!admin.apps.length) throw new Error('FIREBASE_ADMIN_NOT_INITIALIZED: Admin Auth access failed.');
  return admin.auth();
};

export const adminDb = getAdminDb();
export const adminStorage = getAdminStorage();
export const adminAuth = getAdminAuth();
