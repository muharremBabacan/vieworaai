
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Note: serviceAccount.json is assumed to be in the project root
import serviceAccount from '../../../../serviceAccount.json' assert { type: "json" };

const apps = getApps();
const adminApp = !apps.length 
  ? initializeApp({ credential: cert(serviceAccount as any) }) 
  : apps[0];

const db = getFirestore(adminApp);

/**
 * Iyzico Webhook Handler - Automatic Approval
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Webhook] Payload received:", body);

    const isSuccess = body.status === 'success' || body.paymentStatus === 'SUCCESS';
    
    // Use merchantOrderId if provided by iyzico to track our pix_purchases doc
    const purchaseId = body.merchantOrderId || body.paymentId;

    if (!isSuccess || !purchaseId) {
      return NextResponse.json({ status: 'ignored', reason: 'Invalid or unsuccessful payload' });
    }

    // Try finding by direct ID first
    let purchaseRef = db.collection('pix_purchases').doc(purchaseId);
    let purchaseSnap = await purchaseRef.get();

    // Fallback: search by paymentId field if merchantOrderId was not the doc ID
    if (!purchaseSnap.exists) {
      const q = await db.collection('pix_purchases').where('paymentId', '==', purchaseId).limit(1).get();
      if (q.empty) {
        console.warn("[Webhook] Purchase record not found:", purchaseId);
        return NextResponse.json({ status: 'not_found' }, { status: 404 });
      }
      purchaseSnap = q.docs[0];
      purchaseRef = purchaseSnap.ref;
    }

    const purchaseData = purchaseSnap.data();

    if (purchaseData?.status === 'approved') {
      return NextResponse.json({ status: 'already_processed' });
    }

    // Atomic Transaction: Update purchase status + user balance + create activity log
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
      auroSpent: -purchaseData!.pix_amount,
      timestamp: new Date().toISOString(),
      status: 'success'
    });

    await batch.commit();
    console.log(`[Webhook] Success: ${purchaseSnap.id} processed for user ${purchaseData!.user_id}`);

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
