import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin-init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const results: any = {
    environment: {
      NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'missing',
      NODE_ENV: process.env.NODE_ENV,
      AppHosting: !!process.env.FIREBASE_CONFIG || !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    },
    secrets: {
      HAS_FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      HAS_FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      HAS_FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      HAS_COMPOSITE_KEY: !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT),
    },
    firebaseAdmin: {
      status: 'testing...',
    }
  };

  try {
    const { getAdminDb, getAdminStorage } = await import('@/lib/firebase/admin-init');
    const db = getAdminDb();
    const bucket = getAdminStorage();
    
    // Attempt a light read
    const snapshot = await db.collection('settings').limit(1).get();
    
    results.firebaseAdmin.connectivity = 'OK';
    results.firebaseAdmin.initialized = true;
    results.firebaseAdmin.bucketName = bucket.name;
    results.firebaseAdmin.documentCount = snapshot.size;
  } catch (err: any) {
    results.firebaseAdmin.connectivity = 'FAILED';
    results.firebaseAdmin.error = err.message;
    results.firebaseAdmin.initialized = false;
  }

  return NextResponse.json(results);
}
