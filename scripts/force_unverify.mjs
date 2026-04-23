import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function forceUnverifyAll() {
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

    console.log(`🔄 Updating ${snapshot.size} users to 'Unverified' status...`);

    const batch = db.batch();
    snapshot.forEach(doc => {
      // Set emailVerified to false for everyone initially
      // When they log in successfully, it will be updated to true in the code
      batch.update(doc.ref, { emailVerified: false });
    });

    await batch.commit();
    console.log('✅ Everyone is now marked as "Pending Verification" in the Admin Panel.');
    console.log('💡 They will automatically turn Green (Verified) as soon as they log in with a verified email.');

  } catch (error) {
    console.error('❌ Error during update:', error);
  }
}

forceUnverifyAll();
