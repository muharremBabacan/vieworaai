import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import serviceAccount from "../serviceAccount.json" assert { type: "json" };

initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore();

async function seedCurriculum() {

  const curriculum = [
    {
      level: "Temel",
      category: "Fotoğrafçılığa Giriş",
      topics: [
        "Camera basics",
        "Types of cameras",
        "Understanding megapixels",
        "Basic camera controls"
      ]
    },
    {
      level: "Temel",
      category: "Pozlama Temelleri",
      topics: [
        "ISO basics",
        "Shutter speed control",
        "Aperture basics",
        "Exposure triangle"
      ]
    },
    {
      level: "Temel",
      category: "Temel Kompozisyon",
      topics: [
        "Rule of thirds",
        "Leading lines",
        "Framing techniques",
        "Negative space"
      ]
    },
    {
      level: "Orta",
      category: "Tür Bazlı Çekim Teknikleri",
      topics: [
        "Portrait photography",
        "Street photography",
        "Landscape photography",
        "Product photography"
      ]
    },
    {
      level: "İleri",
      category: "Profesyonel Işık Kurulumu",
      topics: [
        "Studio lighting setup",
        "Three point lighting",
        "Softbox usage",
        "Lighting ratios"
      ]
    }
  ];

  for (const item of curriculum) {

    await db.collection("academy_curriculum").add({
      ...item,
      createdAt: new Date()
    });

  }

  console.log("✅ Curriculum seeded successfully");
}

seedCurriculum();