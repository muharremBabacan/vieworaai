import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from 'firebase-admin/storage';

/**
 * 🔑 Private Key formatter for production environments (App Hosting, Vercel, etc.)
 */
function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  // Handle both escaped \n and raw newlines
  return key.replace(/\\n/g, "\n");
}

/**
 * 🏗️ Initializes Firebase Admin as a Singleton
 * Throws MISSING_SERVICE_ACCOUNT if required environment variables are absent in production.
 */
export function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // --- 1. DETECT CREDENTIALS ---
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const compositeKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;

  console.log(`🔍 [AdminInit] Env Check: PID=${!!projectId}, EMAIL=${!!clientEmail}, KEY=${!!privateKey}, COMPOSITE=${!!compositeKey}`);

  // --- 2. VALIDATE FOR PRODUCTION ---
  const isProduction = process.env.NODE_ENV === "production";
  const hasSeparateKeys = projectId && clientEmail && privateKey;
  const hasCompositeKey = !!compositeKey;

  if (!hasSeparateKeys && !hasCompositeKey) {
    if (isProduction) {
      console.error("❌ [AdminInit] CRITICAL: Service account environment variables are missing.");
      throw new Error("MISSING_SERVICE_ACCOUNT");
    } else {
      console.warn("[AdminInit] WARN: No valid credentials found. Skipping initialization (Safe during local Build).");
      return null;
    }
  }

  // --- 3. INITIALIZE ---
  try {
    let credential;
    
    if (hasSeparateKeys) {
      console.log(`[AdminInit] Initializing with individual keys for Project: ${projectId}`);
      credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } else {
      console.log(`[AdminInit] Initializing with composite JSON key...`);
      const isBase64 = !compositeKey!.trim().startsWith('{');
      const decoded = isBase64 ? Buffer.from(compositeKey!, 'base64').toString('utf8') : compositeKey!;
      const processed = decoded.replace(/\\n/g, '\n');
      credential = admin.credential.cert(JSON.parse(processed));
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || 'studio-8632782825-fce99'}.firebasestorage.app`;
    
    return admin.initializeApp({
      credential,
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
  initAdmin();
  
  // 🎯 BUCKET AUTO-DETECTION STRATEGY
  const projectId = process.env.FIREBASE_PROJECT_ID || 'studio-8632782825-fce99';
  const bucketName = 
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
    `${projectId}.appspot.com`; // Usually the safest bet for existing projects

  console.log(`🪣 [AdminInit] Using storage bucket: ${bucketName}`);
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
