const fs = require("fs");
const path = require("path");

// JSON yolu
const dataPath = path.join(__dirname, "../src/ai/ders.v1.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const output = [];

for (const level of data.levels) {
    for (const module of level.modules) {
        for (const lesson of module.lessons) {

            const baseName = lesson.title
                .toLowerCase()
                .replace(/\s+/g, "_");

            // 📸 Cover
            output.push({
                type: "cover",
                lesson: lesson.title,
                filename: `${baseName}_cover.jpg`,
                prompt: `${lesson.title} photography clean professional shot`
            });

            // 📸 Content (kural bazlı)
            if (lesson.title.toLowerCase().includes("portre")) {
                output.push({
                    type: "content",
                    lesson: lesson.title,
                    filename: `${baseName}_blur.jpg`,
                    prompt: "portrait shallow depth of field blurred background"
                });

                output.push({
                    type: "content",
                    lesson: lesson.title,
                    filename: `${baseName}_sharp.jpg`,
                    prompt: "portrait deep focus sharp background"
                });
            }

            if (lesson.title.toLowerCase().includes("manzara")) {
                output.push({
                    type: "content",
                    lesson: lesson.title,
                    filename: `${baseName}_wide.jpg`,
                    prompt: "landscape wide angle dramatic sky"
                });
            }

            if (lesson.title.toLowerCase().includes("sokak")) {
                output.push({
                    type: "content",
                    lesson: lesson.title,
                    filename: `${baseName}_motion.jpg`,
                    prompt: "street photography motion blur people walking"
                });
            }

        }
    }
}

// 📄 çıktı dosyası
fs.writeFileSync(
    path.join(__dirname, "../image-list.json"),
    JSON.stringify(output, null, 2)
);

console.log("🔥 image-list.json oluşturuldu");