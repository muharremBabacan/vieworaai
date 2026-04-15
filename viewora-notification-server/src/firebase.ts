import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

export const messaging = admin.messaging();
export default admin;
