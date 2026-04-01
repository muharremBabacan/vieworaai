const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixRules() {
    const snapshot = await db.collection("academy_curriculum").get();

    for (const doc of snapshot.docs) {
        await doc.ref.update({
            rules: {
                minTheoryLength: 5,
                realExamples: true,
                noGenericText: true
            },
            style: "teaching"
        });

        console.log("Updated:", doc.id);
    }

    console.log("ALL DONE");
}

fixRules();