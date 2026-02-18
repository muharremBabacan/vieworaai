import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "01DT86bQwWUVmrewnEb8c6bd8H43";

const user = await admin.auth().getUser(uid);

console.log("CLAIMS:", user.customClaims);
