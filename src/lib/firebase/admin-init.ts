import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from 'firebase-admin/storage';

function ensureAdminInitialized() {
  if (admin.apps.length) return;

  try {
    let serviceAccount: any;
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }

    if (serviceAccount && serviceAccount.private_key) {
      // 🎯 VERIFIED BUCKET NAME FROM USER SCREENSHOT
      const bucketName = 'studio-8632782825-fce99.firebasestorage.app';
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: bucketName
      });
      
      (global as any)._explicitBucketName = bucketName;
      console.log(`✅ Firebase Admin SDK initialized for: ${serviceAccount.project_id}`);
    } else {
      throw new Error('MISSING_SERVICE_ACCOUNT');
    }
  } catch (err: any) {
    console.error('❌ Firebase Admin Init Error:', err.message);
    throw err;
  }
}

// 🛡️ Functional Exports: Ensure these are always called to get the initialized instance.
export function getAdminDb() {
  ensureAdminInitialized();
  return admin.firestore();
}

export function getAdminStorage() {
  ensureAdminInitialized();
  const bucketName = 'studio-8632782825-fce99.firebasestorage.app';
  return getStorage().bucket(bucketName);
}

export function getAdminAuth() {
  ensureAdminInitialized();
  return admin.auth();
}

// 🏛️ Legacy Aliases for compatibility with other components
export const adminDb = {
  get firestore() { return getAdminDb(); },
  collection: (path: string) => getAdminDb().collection(path),
  doc: (path: string) => getAdminDb().doc(path),
};

export const adminStorage = {
  get storage() { return getAdminStorage(); },
  bucket: (name?: string) => getAdminStorage(),
};
