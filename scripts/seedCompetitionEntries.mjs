import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

const COMPETITIONS = [
  "wk7yQMHxOVix0lHFyjN2",   // Hayvan Portresi
  "wnndpyVs2BmSOHoXRcDD",   // Sokaklar
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function run() {
  console.log("Competition seeding started...");

  const seedUsersSnap = await db
    .collection("users")
    .where("is_seed", "==", true)
    .get();

  const seedUsers = seedUsersSnap.docs;

  for (const competitionId of COMPETITIONS) {
    console.log("Seeding competition:", competitionId);

    const shuffled = [...seedUsers].sort(() => 0.5 - Math.random());
    const participants = shuffled.slice(0, Math.floor(seedUsers.length * 0.3));

    for (const userDoc of participants) {
      const photosSnap = await userDoc.ref.collection("photos").get();
      if (photosSnap.empty) continue;

      const randomPhoto =
        photosSnap.docs[randomInt(0, photosSnap.docs.length - 1)];

      await db
        .collection("competitions")
        .doc(competitionId)
        .collection("entries")
        .add({
          userId: userDoc.id,
          photoId: randomPhoto.id,
          imageUrl: randomPhoto.data().imageUrl,
          votes: [],
          is_seed: true,
          createdAt: new Date(),
        });
    }
  }

  console.log("Competition seeding completed.");
}

run().catch(console.error);