import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from 'firebase-admin/storage';

/**
 * 🔑 Private Key formatter for production environments (App Hosting, Cloud Run, etc.)
 */
function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  // Handle both escaped \n and raw newlines
  return key.replace(/\\n/g, "\n");
}

/**
 * 🛠️ Extracts service account credentials from environment variables.
 * Supports both individual keys and composite base64/JSON keys.
 */
let cachedServiceAccount: any = null;

export function getServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const compositeKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.APP_ADMIN_KEY;

  if (projectId && clientEmail && privateKey) {
    cachedServiceAccount = { projectId, clientEmail, privateKey };
    return cachedServiceAccount;
  }

  if (compositeKey) {
    try {
      const isBase64 = !compositeKey.trim().startsWith('{');
      const decoded = isBase64 ? Buffer.from(compositeKey, 'base64').toString('utf8') : compositeKey;
      const sanitized = decoded.trim().replace(/[\u0000-\u001F]+/g, (match) => match === '\n' || match === '\r' ? ' ' : '');
      cachedServiceAccount = JSON.parse(sanitized);
      return cachedServiceAccount;
    } catch (err) {
      console.error("[AdminInit] Failed to parse composite key:", err);
    }
  }

  // 📂 FALLBACK (Only for Local Dev)
  try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
    if (fs.existsSync(serviceAccountPath)) {
      cachedServiceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      return cachedServiceAccount;
    }
  } catch (e) {}

  return null;
}

export function initAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  try {
    const projectId = serviceAccount.project_id || serviceAccount.projectId;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '') || `${projectId}.firebasestorage.app`;
    
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });
  } catch (err: any) {
    console.error("❌ [AdminInit] Failed:", err.message);
    return null;
  }
}

/** Legacy support (refactored to use initAdmin internally) */
function ensureAdminInitialized() {
  initAdmin();
}

// 🛡️ Functional Exports: Ensure these are always called to get the initialized instance.
export function getAdminDb() {
  initAdmin();
  return admin.firestore();
}

export function getAdminStorage() {
  const app = initAdmin();
  if (!app) {
    throw new Error("ADMIN_NOT_INITIALIZED: Cannot access storage without valid admin app.");
  }
  
  // 🎯 BUCKET AUTO-DETECTION STRATEGY (Strictly follows "studio-XXX.firebasestorage.app" format)
  const serviceAccount = getServiceAccount();
  const projectId = serviceAccount?.project_id || serviceAccount?.projectId || process.env.FIREBASE_PROJECT_ID || 'studio-8632782825-fce99';
  
  const bucketNameEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '');
  const bucketName = bucketNameEnv || `${projectId}.firebasestorage.app`; 
  
  console.log(`🪣 [AdminInit] Providing storage bucket: ${bucketName}`);
  return getStorage(app).bucket(bucketName);
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
