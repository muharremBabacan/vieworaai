import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from 'firebase-admin/storage';

/**
 * 🔑 Reusable helper to get Firebase Admin credentials from Env or File
 */
export function getServiceAccount() {
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');

  if (envKey) {
    try {
      const isBase64 = !envKey.trim().startsWith('{');
      const decoded = isBase64 ? Buffer.from(envKey, 'base64').toString('utf8') : envKey;
      const processed = isBase64 ? decoded : decoded.replace(/\\n/g, '\n');
      return JSON.parse(processed);
    } catch (e: any) {
      console.error('[AdminInit] Environment variable parse error:', e.message);
      return null;
    }
  }

  if (fs.existsSync(serviceAccountPath)) {
    try {
       return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (e) {
       console.error('[AdminInit] serviceAccount.json read error:', e);
       return null;
    }
  }

  return null;
}

function ensureAdminInitialized() {
  if (admin.apps.length) return;

  try {
    const serviceAccount = getServiceAccount();
    
    if (serviceAccount && serviceAccount.private_key) {
      console.log(`[AdminInit] Initializing Firebase Admin...`);
      const bucketName = 'studio-8632782825-fce99.firebasestorage.app';
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: bucketName
      });
      
      console.log(`✅ Firebase Admin SDK initialized for: ${serviceAccount.project_id}`);
    } else {
      // 🛡️ Build-time safety: Log instead of throw
      console.warn('[AdminInit] SKIP: No valid credentials found. This is expected during Build Time on App Hosting.');
      // We don't throw here to allow the build process to continue
    }
  } catch (err: any) {
    console.error('❌ Firebase Admin Init Error:', err.message);
    // Only re-throw if it's not a missing credential error during build
    if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
       return; 
    }
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
