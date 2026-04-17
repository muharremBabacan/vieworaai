import { NextResponse } from 'next/server';
import { getServiceAccount, getAdminDb } from '@/lib/firebase/admin-init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Simple check for internal testing (can be expanded with actual auth)
  const { searchParams } = new URL(request.url);
  const debugToken = searchParams.get('token');
  
  // Optional security: only allow if token matches or in dev
  // if (process.env.NODE_ENV === 'production' && debugToken !== 'viewora-diag-2026') {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const results: any = {
    environment: {
      NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'missing',
      NODE_ENV: process.env.NODE_ENV,
      Vercel: !!process.env.VERCEL,
      AppHosting: !!process.env.FIREBASE_CONFIG || !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    },
    secrets: {
      HAS_FIREBASE_ADMIN_KEY: !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT),
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
    },
    firebaseAdmin: {
      status: 'testing...',
    }
  };

  try {
    const sa = getServiceAccount();
    results.firebaseAdmin.initialized = !!sa;
    results.firebaseAdmin.projectId = sa?.project_id || 'unknown';
    
    // Attempt a light read
    const db = getAdminDb();
    const snapshot = await db.collection('settings').limit(1).get();
    results.firebaseAdmin.connectivity = 'OK';
    results.firebaseAdmin.documentCount = snapshot.size;
  } catch (err: any) {
    results.firebaseAdmin.connectivity = 'FAILED';
    results.firebaseAdmin.error = err.message;
  }

  return NextResponse.json(results);
}
