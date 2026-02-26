import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

const LEVELS = ["Neuner", "Viewner", "Sytner", "Omner", "Vexer"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedUsers() {
  console.log("Seeding users and photos...");

  for (let i = 1; i <= 120; i++) {
    const uid = `seed_user_${i}`;

    const userData = {
      id: uid,
      name: `Demo User ${i}`,
      level_name: randomItem(LEVELS),
      current_xp: randomInt(0, 5000),
      is_seed: true,
      created_at: new Date(),
    };

    await db.collection("users").doc(uid).set(userData);

    // Eski fotoğrafları temizle (tekrar çalıştırınca çoğalmasın)
    const existingPhotos = await db
      .collection("users")
      .doc(uid)
      .collection("photos")
      .get();

    for (const doc of existingPhotos.docs) {
      await doc.ref.delete();
    }

    // Yeni 5 foto ekle
    for (let p = 1; p <= 5; p++) {
      await db
        .collection("users")
        .doc(uid)
        .collection("photos")
        .add({
          title: `Seed Photo ${p}`,
          imageUrl: "https://placehold.co/600x600",
          likes: [],
          is_seed: true,
          created_at: new Date(),
        });
    }
  }

  console.log("Users + photos created.");
}

async function simulateLikes() {
  console.log("Simulating likes...");

  const seedUsersSnapshot = await db
    .collection("users")
    .where("is_seed", "==", true)
    .get();

  const userIds = seedUsersSnapshot.docs.map(d => d.id);

  for (const userDoc of seedUsersSnapshot.docs) {
    const photos = await userDoc.ref.collection("photos").get();

    for (const photo of photos.docs) {
      const likeCount = randomInt(0, 15);

      const shuffled = [...userIds].sort(() => 0.5 - Math.random());
      const likes = shuffled.slice(0, likeCount);

      await photo.ref.update({ likes });
    }
  }

  console.log("Likes simulated.");
}

async function run() {
  await seedUsers();
  await simulateLikes();
  console.log("Seed process completed successfully.");
}

run().catch(console.error);