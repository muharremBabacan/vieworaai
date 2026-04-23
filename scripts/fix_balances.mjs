import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function fixZeroBalances() {
  try {
    const serviceAccountPath = join(process.cwd(), 'serviceAccount.json');
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    const db = getFirestore();
    const usersRef = db.collection('users');
    // Find users with 0 pix_balance and 0 analyses (likely new users hit by the bug)
    const snapshot = await usersRef.where('pix_balance', '==', 0).get();

    console.log(`🔍 Found ${snapshot.size} users with 0 PIX. Checking for eligibility...`);

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      // If they haven't done any analysis, give them their 20 starting PIX
      if (!data.total_analyses_count || data.total_analyses_count === 0) {
        batch.update(doc.ref, { pix_balance: 20 });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Fixed balances for ${count} users. They now have 20 PIX.`);
    } else {
      console.log('✨ No users needed a balance fix.');
    }

  } catch (error) {
    console.error('❌ Error during fix:', error);
  }
}

fixZeroBalances();
