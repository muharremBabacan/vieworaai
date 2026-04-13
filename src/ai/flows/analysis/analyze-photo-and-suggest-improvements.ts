'use server';

import OpenAI from 'openai';
import { adminDb } from "@/lib/firebase/admin-init";
import { PhotoAnalysis } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Tier = "start" | "pro" | "master";

export type PhotoAnalysisInput = {
  photoUrl: string;
  language: string;
  tier: Tier;
  guestId?: string; // 🔥 Kilit için eklendi
};

export type PhotoAnalysisOutput = {
  genre: string;
  scene: string;
  dominant_subject: string;
  light_score: number;
  composition_score: number;
  technical_clarity_score: number;
  storytelling_score: number;
  boldness_score: number;
  technical_details: {
    focus: string;
    light: string;
    technical_quality: string;
    color: string;
    composition: string;
  };
  general_quality: 'Düşük' | 'Orta' | 'İyi' | 'Çok İyi' | 'Profesyonel';
  expert_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  tags: string[];
  short_neutral_analysis: string;
  quality_note?: string;
};

/**
 * AI bazen sayı yerine "8/10" veya "8.5" gibi stringler dönebiliyor.
 * Bunları güvenli bir şekilde sayıya çevirir ve 0-10 aralığına normalize eder.
 */
function parseSafeScore(score: any): number {
  if (typeof score === 'number') return score;
  if (typeof score !== 'string') return 0;

  // "8/10" formatını temizle
  const cleanScore = score.split('/')[0].replace(',', '.').trim();
  const num = parseFloat(cleanScore);
  
  return isNaN(num) ? 0 : num;
}

export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {
  const langMap: Record<string, string> = {
    tr: "Turkish",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    ru: "Russian",
    ar: "Arabic",
    zh: "Chinese",
    ja: "Japanese"
  };
  const fullLanguage = langMap[input.language] || input.language;

  const prompt = `
Sen profesyonel bir fotoğraf analiz uzmanı ve görsel kalite değerlendiricisisin.

Amaç:
- Fotoğrafı teknik ve estetik açıdan yüksek doğrulukla analiz etmek
- Detay kaybı olmadan değerlendirme yapmak
- Fotoğrafın seviyesini ve kalitesini objektif olarak belirlemek

KRATERLER (ÖZELLİKLE DİKKAT ET):
- Netlik (focus accuracy)
- Motion blur (hareket bulanıklığı)
- Noise / grain (kumlanma)
- Compression artefacts (sıkıştırma bozulmaları)
- Işık dengesi (pozlama, dynamic range)
- Kompozisyon dengesi
- Renk doğruluğu

KURALLAR:
- Yüzeysel yorum yapma
- Teknik detayları özellikle incele
- Tahmin değil, gözleme dayalı analiz yap
- Kısa ama yoğun bilgi ver
- NOT: Fotoğraf düşük çözünürlüklü veya detay kaybı içeriyorsa bunu quality_note kısmında belirt.

TON: Profesyonel, Net, Saygılı.
DİL: ${fullLanguage}

ÇIKTI FORMATI (JSON):
{
  "light_score": 0-10,
  "composition_score": 0-10,
  "technical_clarity_score": 0-10,
  "storytelling_score": 0-10,
  "boldness_score": 0-10,
  "technical_details": {
    "focus": "Netlik analizi...",
    "light": "Işık analizi...",
    "technical_quality": "Teknik kalite analizi...",
    "color": "Renk analizi...",
    "composition": "Kompozisyon analizi..."
  },
  "general_quality": "Düşük | Orta | İyi | Çok İyi | Profesyonel",
  "expert_level": "Beginner | Intermediate | Advanced | Expert",
  "genre": "...",
  "scene": "...",
  "dominant_subject": "...",
  "tags": ["tag1", "tag2"],
  "short_neutral_analysis": "2-3 cümlelik profesyonel özet yorum",
  "quality_note": "Opsiyonel kalite notu (düşük çözünürlük uyarısı vb.)"
}
`;

  try {
    // 🔒 THE LOCK: Sunucu tarafı kontrolü
    if (input.guestId && adminDb) {
      const usageRef = adminDb.collection('guest_usage').doc(input.guestId);
      const usageDoc = await usageRef.get();
      
      if (usageDoc.exists) {
        const lastUsedAt = usageDoc.data()?.last_used_at;
        if (lastUsedAt) {
          const cooldown = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - lastUsedAt < cooldown) {
            throw new Error("GUEST_LIMIT_REACHED");
          }
        }
      }
    }

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: input.photoUrl,
              },
            },
          ],
        },
      ],
    });

    const raw = res.choices[0]?.message?.content || "";
    const parsed = JSON.parse(raw);

    // 📝 THE RECORD: Kullanımı kaydet
    if (input.guestId && adminDb) {
      await adminDb.collection('guest_usage').doc(input.guestId).set({
        last_used_at: Date.now(),
        last_photo_url: input.photoUrl
      }, { merge: true });
    }

    return {
      genre: parsed.genre || "",
      scene: parsed.scene || "",
      dominant_subject: parsed.dominant_subject || "",
      light_score: parseSafeScore(parsed.light_score),
      composition_score: parseSafeScore(parsed.composition_score),
      technical_clarity_score: parseSafeScore(parsed.technical_clarity_score),
      storytelling_score: parseSafeScore(parsed.storytelling_score),
      boldness_score: parseSafeScore(parsed.boldness_score),
      technical_details: {
        focus: parsed.technical_details?.focus || "",
        light: parsed.technical_details?.light || "",
        technical_quality: parsed.technical_details?.technical_quality || "",
        color: parsed.technical_details?.color || "",
        composition: parsed.technical_details?.composition || ""
      },
      general_quality: parsed.general_quality || "Orta",
      expert_level: parsed.expert_level || "Beginner",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      short_neutral_analysis: parsed.short_neutral_analysis || "",
      quality_note: parsed.quality_note || undefined
    };

  } catch (e: any) {
    if (e.message === "GUEST_LIMIT_REACHED") throw e;
    throw new Error("AI analysis failed: " + e.message);
  }
}