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
      
      console.log('Setting a temporary password...');
      await admin.auth().updateUser(userRecord.uid, {
        password: 'Password123!',
      });
      console.log('Password set to "Password123!" successfully.');
    } else {
      console.log('This user HAS a password set. Let us reset it to Password123! just in case.');
      await admin.auth().updateUser(userRecord.uid, {
        password: 'Password123!',
      });
      console.log('Password successfully reset to "Password123!".');
    }
  } catch (error) {
    console.error('Error fetching/updating user data:', error);
  } finally {
    process.exit();
  }
}

checkUser();
