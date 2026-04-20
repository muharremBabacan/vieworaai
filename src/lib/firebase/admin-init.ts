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
export function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const compositeKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.APP_ADMIN_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  if (compositeKey) {
    try {
      const isBase64 = !compositeKey.trim().startsWith('{');
      const decoded = isBase64 ? Buffer.from(compositeKey, 'base64').toString('utf8') : compositeKey;
      const processed = decoded.replace(/\\n/g, '\n');
      return JSON.parse(processed);
    } catch (err) {
      console.error("[AdminInit] Failed to parse composite service account key:", err);
    }
  }

  // 📂 FALLBACK: Read from local serviceAccount.json for local development
  try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
    if (fs.existsSync(serviceAccountPath)) {
      console.log("📂 [AdminInit] Using local serviceAccount.json file.");
      const fileData = fs.readFileSync(serviceAccountPath, 'utf8');
      return JSON.parse(fileData);
    }
  } catch (fileErr: any) {
    console.warn("[AdminInit] Failed to read serviceAccount.json:", fileErr.message);
  }

  return null;
}

/**
 * 🏗️ Initializes Firebase Admin as a Singleton
 * Throws MISSING_SERVICE_ACCOUNT if required environment variables are absent in production.
 */
export function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = getServiceAccount();
  const isProduction = process.env.NODE_ENV === "production";

  console.log(`🔍 [AdminInit] Env Check: ServiceAccount=${!!serviceAccount}, Env=${process.env.NODE_ENV}`);

  if (!serviceAccount) {
    if (isProduction) {
      console.error("❌ [AdminInit] CRITICAL: Service account environment variables are missing.");
      throw new Error("MISSING_SERVICE_ACCOUNT");
    } else {
      console.warn("[AdminInit] WARN: No valid credentials found. Skipping initialization (Safe during local Build).");
      return null;
    }
  }

  try {
    const isProduction = process.env.NODE_ENV === "production";
    
    // 🎯 Use canonical .firebasestorage.app suffix as recommended in the stabilization guide
    const bucketNameEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '');
    const bucketName = bucketNameEnv || `${serviceAccount.project_id || serviceAccount.projectId}.firebasestorage.app`;
    
    console.log(`🚀 [AdminInit] Initializing for Project: ${serviceAccount.project_id || serviceAccount.projectId}`);
    console.log(`🪣 [AdminInit] Using Storage Bucket: ${bucketName}`);

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });

  } catch (err: any) {
    console.error("❌ [AdminInit] Firebase Admin Initialization Failed:", err.message);
    if (isProduction) throw err;
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
