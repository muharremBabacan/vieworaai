
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Note: serviceAccount.json is assumed to be in the project root as per scripts/seed-curriculum.ts
// In production, use environment variables for sensitive data.
import serviceAccount from '../../../../serviceAccount.json' assert { type: "json" };

const apps = getApps();
const adminApp = !apps.length 
  ? initializeApp({ credential: cert(serviceAccount as any) }) 
  : apps[0];

const db = getFirestore(adminApp);

/**
 * Iyzico Webhook Handler
 * Endpoint: https://viewora.ai/api/iyzico-webhook
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Webhook] Received iyzico payload:", body);

    // Iyzico status check (Example: 'SUCCESS' or as per iyzico link documentation)
    const isSuccess = body.status === 'success' || body.paymentStatus === 'SUCCESS';
    
    // We expect a unique reference (merchantOrderId or similar) to find the pix_purchases doc.
    // iyzico link notifications usually provide a paymentId or a custom reference.
    const purchaseId = body.merchantOrderId || body.paymentId;

    if (!isSuccess || !purchaseId) {
      return NextResponse.json({ status: 'ignored', reason: 'Invalid payload or unsuccessful' });
    }

    const purchaseRef = db.collection('pix_purchases').doc(purchaseId);
    const purchaseSnap = await purchaseRef.get();

    if (!purchaseSnap.exists) {
      // If doc not found by ID, search by iyzico paymentId
      const q = await db.collection('pix_purchases').where('paymentId', '==', purchaseId).limit(1).get();
      if (q.empty) {
        console.warn("[Webhook] Purchase record not found for:", purchaseId);
        return NextResponse.json({ status: 'not_found' }, { status: 404 });
      }
      // logic continues with found doc...
    }

    const purchaseData = purchaseSnap.exists ? purchaseSnap.data() : (await db.collection('pix_purchases').where('paymentId', '==', purchaseId).get()).docs[0].data();
    const docId = purchaseSnap.exists ? purchaseSnap.id : (await db.collection('pix_purchases').where('paymentId', '==', purchaseId).get()).docs[0].id;

    if (purchaseData?.status === 'approved') {
      return NextResponse.json({ status: 'already_processed' });
    }

    // Atomic Update: Update purchase status + user balance + create log
    const batch = db.batch();
    const userRef = db.collection('users').doc(purchaseData!.user_id);
    const logRef = db.collection('analysis_logs').doc();

    batch.update(db.collection('pix_purchases').doc(docId), {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'system_webhook',
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
    console.log(`[Webhook] Successfully processed purchase ${docId} for user ${purchaseData!.user_id}`);

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error("[Webhook] Error processing iyzico webhook:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
