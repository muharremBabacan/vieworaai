import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from 'fs';
import path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'serviceAccount.json'), 'utf-8'));

initializeApp({
  credential: cert(serviceAccount),
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
      level: "Orta",
      category: "Işık Kontrolü ve Yönlendirme",
      topics: [
        "Natural light manipulation",
        "Reflector usage",
        "Silhouettes",
        "Golden hour photography"
      ]
    },
    {
      level: "Orta",
      category: "İleri Kompozisyon Kuralları",
      topics: [
        "Golden ratio",
        "Fibonacci spiral",
        "Symmetry and patterns",
        "Color theory in photography"
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
    },
    {
      level: "İleri",
      category: "Storytelling ve Konsept",
      topics: [
        "Visual narrative",
        "Conceptual photography",
        "Documentary story",
        "Creating a photography series"
      ]
    },
    {
      level: "İleri",
      category: "Stil İmzası ve Düzenleme",
      topics: [
        "Developing a personal style",
        "Advanced color grading",
        "Retouching techniques",
        "Print preparation"
      ]
    }
  ];

  const existingDocs = await db.collection("academy_curriculum").get();
  const batch = db.batch();
  existingDocs.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log("🧹 Cleared existing curriculum documents");

  for (const item of curriculum) {

    await db.collection("academy_curriculum").add({
      ...item,
      createdAt: new Date()
    });

  }

  console.log("✅ Curriculum seeded successfully");
}

seedCurriculum();