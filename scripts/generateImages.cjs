require("dotenv").config();

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 📄 kaynak liste
const LIST_PATH = path.join(__dirname, "../image-list.json");
let list = JSON.parse(fs.readFileSync(LIST_PATH, "utf-8"));

// 📁 çıktı klasörü
const OUTPUT_DIR = path.join(__dirname, "../public/images");
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 📄 progress dosyası
const PROGRESS_PATH = path.join(__dirname, "../progress.json");

// ⏱ ayarlar
const DAILY_LIMIT = 5;
const DELAY = 30000;

// ⏳ sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));


// 🔥 FILENAME TEMİZLEYİCİ
function cleanFileName(name) {
    return name
        .toLowerCase()
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u")
        .replace(/\?/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_\.]/g, "");
}


// 🧠 progress
function loadProgress() {
    if (!fs.existsSync(PROGRESS_PATH)) {
        return { index: 0, completed: [] };
    }
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
}

function saveProgress(p) {
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2));
}


// 📸 üretim
async function generateImage(item) {
    const safeName = cleanFileName(item.filename);
    const outPath = path.join(OUTPUT_DIR, safeName);

    console.log(`🎨 Üretiliyor: ${safeName}`);

    try {
        const res = await openai.images.generate({
            model: "gpt-image-1.5",
            prompt: `professional photography, ${item.prompt}, realistic, high detail`,
            size: "1024x1024"
        });

        const img = res.data?.[0]?.b64_json;
        if (!img) throw new Error("Boş görsel döndü");

        const buffer = Buffer.from(img, "base64");
        fs.writeFileSync(outPath, buffer);

        console.log(`✅ Kaydedildi: ${safeName}`);
        return { success: true, filename: safeName };

    } catch (err) {
        console.error(`❌ Hata: ${safeName}`, err.message);
        return { success: false };
    }
}


// 🚀 ANA MOTOR
async function run() {
    const progress = loadProgress();

    let processedToday = 0;

    console.log(`📍 Kaldığı index: ${progress.index}`);

    for (let i = progress.index; i < list.length; i++) {

        if (processedToday >= DAILY_LIMIT) {
            console.log("🛑 Günlük limite ulaşıldı");
            break;
        }

        const item = list[i];
        const safeName = cleanFileName(item.filename);
        const outPath = path.join(OUTPUT_DIR, safeName);

        // varsa atla
        if (fs.existsSync(outPath)) {
            console.log(`⏭️ Zaten var: ${safeName}`);
            progress.index = i + 1;
            saveProgress(progress);
            continue;
        }

        const result = await generateImage(item);

        if (result.success) {
            progress.completed.push(result.filename);
            progress.index = i + 1;
            saveProgress(progress);
            processedToday++;
        }

        if (processedToday < DAILY_LIMIT) {
            console.log("⏳ Bekleniyor...");
            await sleep(DELAY);
        }
    }

    if (progress.index >= list.length) {
        console.log("🎉 Tüm görseller tamamlandı!");
    } else {
        console.log(`📌 Yarın ${progress.index}. sıradan devam eder`);
    }
}

run();