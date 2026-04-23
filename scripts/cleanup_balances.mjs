import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function cleanupDatabase() {
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
    const snapshot = await usersRef.get();

    console.log(`🔍 Found ${snapshot.size} users. Starting cleanup...`);

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const updates = {};
      
      // If pix_balance doesn't exist but legacy fields do, preserve the value into pix_balance
      if (data.pix_balance === undefined) {
        if (data.Pix_balance !== undefined) updates.pix_balance = data.Pix_balance;
        else if (data.auro_balance !== undefined) updates.pix_balance = data.auro_balance;
      }

      // Fields to be deleted
      if (data.auro_balance !== undefined) {
        updates.auro_balance = FieldValue.delete();
      }
      if (data.Pix_balance !== undefined) {
        updates.Pix_balance = FieldValue.delete();
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Cleanup complete! Updated ${count} users.`);
    } else {
      console.log('✨ No legacy fields found. Database is already clean.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupDatabase();
