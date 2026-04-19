import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function verify() {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
  console.log(`Checking path: ${serviceAccountPath}`);
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('File not found!');
    process.exit(1);
  }

  const cert = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log(`Loaded key for: ${cert.project_id} (ID: ${cert.private_key_id.substring(0, 8)}...)`);

  try {
    admin.initializeApp({
      credential: admin.credential.cert(cert)
    });
    console.log('✅ Firebase Admin initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to initialize:', err.message);
    process.exit(1);
  }
}

verify();
