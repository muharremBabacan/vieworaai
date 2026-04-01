const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔥 JSON DATA
const curriculum = {
    academy: "Viewora Photography",
    levels: [
        {
            level: "Temel",
            modules: [
                {
                    moduleIndex: 1,
                    title: "Fotoğrafın Temelleri",
                    lessons: [
                        { lessonIndex: 1, title: "Fotoğraf Nedir?", type: "concept", requiresSettings: false },
                        { lessonIndex: 2, title: "Kamera Nasıl Çalışır?", type: "concept", requiresSettings: false }
                    ]
                },
                {
                    moduleIndex: 2,
                    title: "Pozlama Kontrolü",
                    lessons: [
                        { lessonIndex: 3, title: "Diyafram", type: "technical", requiresSettings: true },
                        { lessonIndex: 4, title: "Enstantane", type: "technical", requiresSettings: true },
                        { lessonIndex: 5, title: "ISO", type: "technical", requiresSettings: true },
                        { lessonIndex: 6, title: "Pozlama Üçgeni", type: "integration", requiresSettings: true }
                    ]
                }
            ]
        },
        {
            level: "Orta",
            modules: [
                {
                    moduleIndex: 3,
                    title: "Fotoğraf Türleri",
                    lessons: [
                        { lessonIndex: 1, title: "Portre", type: "application", requiresSettings: true },
                        { lessonIndex: 2, title: "Sokak", type: "application", requiresSettings: true },
                        { lessonIndex: 3, title: "Manzara", type: "application", requiresSettings: true }
                    ]
                }
            ]
        },
        {
            level: "İleri",
            modules: [
                {
                    moduleIndex: 4,
                    title: "Profesyonel Fotoğraf",
                    lessons: [
                        { lessonIndex: 1, title: "Işık Ustalığı", type: "advanced", requiresSettings: true },
                        { lessonIndex: 2, title: "Portfolyo", type: "project", requiresSettings: false }
                    ]
                }
            ]
        }
    ]
};

// 🔥 FIRESTORE YAZ
async function seedAcademy() {
    for (const level of curriculum.levels) {
        const levelRef = db.collection("academy").doc(level.level);
        await levelRef.set({
            level: level.level
        });

        for (const module of level.modules) {
            const moduleRef = levelRef.collection("modules").doc(`module_${module.moduleIndex}`);

            await moduleRef.set({
                title: module.title,
                moduleIndex: module.moduleIndex
            });

            for (const lesson of module.lessons) {
                const lessonRef = moduleRef.collection("lessons").doc(`lesson_${lesson.lessonIndex}`);

                await lessonRef.set({
                    ...lesson,
                    level: level.level,
                    moduleIndex: module.moduleIndex
                });

                console.log(`✔ ${level.level} - ${module.title} - ${lesson.title}`);
            }
        }
    }

    console.log("🔥 ACADEMY SEED TAMAMLANDI");
}

seedAcademy();