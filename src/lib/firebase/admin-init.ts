import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from 'fs';
import path from 'path';

export function initAdmin() {
  if (getApps().length) {
    console.log('✅ [admin-init] Firebase Admin already initialized');
    return;
  }

  console.log('🏗️ [admin-init] Initializing Firebase Admin...');

  try {
    const saPath = path.join(process.cwd(), 'serviceAccount.json');
    if (fs.existsSync(saPath)) {
      console.log(`📦 [admin-init] FOUND serviceAccount.json at ${saPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('🚀 [admin-init] Initialized with serviceAccount.json');
      return;
    } else {
      console.log(`ℹ️ [admin-init] No serviceAccount.json found at ${saPath}`);
    }
  } catch (e: any) {
    console.warn('⚠️ [admin-init] Error loading serviceAccount.json:', e.message);
  }

  console.log('🔗 [admin-init] Falling back to Environment Variables...');
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"|"$/g, "").trim();
  
  if (!privateKey) {
    console.error('❌ [admin-init] FIREBASE_PRIVATE_KEY IS MISSING!');
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
  console.log('🚀 [admin-init] Initialized with Environment Variables');
}

export function getAdminAuth() {
  initAdmin();
  return getAuth();
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminStorage() {
  initAdmin();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return getStorage().bucket(bucketName);
}

// 🛡️ Helper exports for legacy code
initAdmin();
export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminStorage = getStorage();