import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "01DT86bQwWUVmrewnEb8c6bd8H43";

await admin.auth().setCustomUserClaims(uid, { admin: true });

console.log("ADMIN CLAIM VERILDI");
process.exit();
