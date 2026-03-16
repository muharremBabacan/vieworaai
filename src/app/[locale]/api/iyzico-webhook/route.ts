
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// serviceAccount.json MUST be present in the project root for this to work
// If not, please upload it via standard Firebase setup.
import serviceAccount from '../../../../serviceAccount.json' assert { type: "json" };

const apps = getApps();
const adminApp = !apps.length 
  ? initializeApp({ credential: cert(serviceAccount as any) }) 
  : apps[0];

const db = getFirestore(adminApp);

/**
 * Iyzico Webhook Handler - Production Automatic Approval
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Webhook] Payload received:", body);

    // Iyzico signals success via 'status' field in payment notification
    const isSuccess = body.status === 'success' || body.paymentStatus === 'SUCCESS';
    
    // We expect merchantOrderId to be the Firestore Document ID of the pix_purchases record
    const purchaseId = body.merchantOrderId || body.paymentId;

    if (!isSuccess || !purchaseId) {
      return NextResponse.json({ status: 'ignored', reason: 'Invalid or unsuccessful payload' });
    }

    // Direct fetch by ID
    const purchaseRef = db.collection('pix_purchases').doc(purchaseId);
    const purchaseSnap = await purchaseRef.get();

    if (!purchaseSnap.exists) {
      console.warn("[Webhook] Purchase record not found:", purchaseId);
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    const purchaseData = purchaseSnap.data();

    // Idempotency: Don't process twice
    if (purchaseData?.status === 'approved') {
      return NextResponse.json({ status: 'already_processed' });
    }

    // Atomic Transaction: Status update + Balance Increment + Activity Log
    const batch = db.batch();
    const userRef = db.collection('users').doc(purchaseData!.user_id);
    const logRef = db.collection('analysis_logs').doc();

    batch.update(purchaseRef, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'iyzico_webhook',
      raw_webhook_payload: body
    });

    batch.update(userRef, {
      auro_balance: FieldValue.increment(purchaseData!.pix_amount),
      pix_balance: FieldValue.increment(purchaseData!.pix_amount)
    });

    batch.set(logRef, {
      id: logRef.id,
      userId: purchaseData!.user_id,
      userName: purchaseData!.user_name,
      type: 'package',
      auroSpent: -purchaseData!.pix_amount, // Negative spent = income/load
      timestamp: new Date().toISOString(),
      status: 'success'
    });

    await batch.commit();
    console.log(`[Webhook] Success: ${purchaseId} processed for user ${purchaseData!.user_id}`);

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error("[Webhook] Internal Error:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
