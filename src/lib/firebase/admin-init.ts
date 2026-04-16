import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from 'firebase-admin/storage';

function ensureAdminInitialized() {
  if (admin.apps.length) return;

  try {
    let serviceAccount: any;
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
    
    console.log(`[AdminInit] Checking credentials... CWD: ${process.cwd()}`);

    if (envKey) {
      console.log('[AdminInit] Using FIREBASE_SERVICE_ACCOUNT from environment variables.');
      try {
        // 🛡️ Support Base64 or Raw JSON
        const isBase64 = !envKey.trim().startsWith('{');
        const decoded = isBase64 ? Buffer.from(envKey, 'base64').toString('utf8') : envKey;
        
        // Handle potentially escaped newlines if NOT base64
        const processed = isBase64 ? decoded : decoded.replace(/\\n/g, '\n');
        serviceAccount = JSON.parse(processed);
      } catch (e: any) {
        console.error('[AdminInit] Environment variable parse error:', e.message);
        throw new Error(`INVALID_ENV_SERVICE_ACCOUNT: ${e.message}`);
      }
    } else if (fs.existsSync(serviceAccountPath)) {
      console.log(`[AdminInit] Using physical file: ${serviceAccountPath}`);
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
      console.error('[AdminInit] FAILED: No valid credentials found. EnvVar present:', !!envKey, 'File exists:', fs.existsSync(serviceAccountPath));
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
