const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkUser() {
  try {
    const userRecord = await admin.auth().getUserByEmail('admin@viewora.ai');
    console.log('User Record:', JSON.stringify(userRecord.toJSON(), null, 2));
    
    const providers = userRecord.providerData.map(p => p.providerId);
    console.log('Providers:', providers);
    
    if (!providers.includes('password')) {
      console.log('This user does NOT have a password set (likely signed up via Google).');
    } else {
      console.log('This user HAS a password set.');
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  } finally {
    process.exit();
  }
}

checkUser();
